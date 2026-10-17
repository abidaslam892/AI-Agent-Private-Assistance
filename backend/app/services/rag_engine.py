import json
import logging
from typing import List, Dict, Any, AsyncGenerator, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Conversation, Message
from app.services.ollama_service import ollama_service
from app.services.vector_store import vector_store_service

logger = logging.getLogger(__name__)

class RAGEngine:
    @staticmethod
    def construct_system_prompt(retrieved_context: str) -> str:
        return (
            "You are an enterprise AI Knowledge Assistant for a telecom operations team, expert in Docker, Kubernetes, "
            "Online Charging Systems (OCS), charging/billing and CRM.\n\n"
            "INSTRUCTIONS:\n"
            "1. Prefer the retrieved knowledge-base context below and mention the source document names when you use it.\n"
            "2. If the context is missing or only partly relevant, still answer helpfully from your own expert knowledge of these topics, "
            "and note briefly that the answer is not from the uploaded documents.\n"
            "3. Be accurate; do not invent commands, AVPs or product behaviour. Say so when unsure.\n"
            "4. Format answers in markdown (headings, bullets, fenced code blocks for commands and YAML).\n\n"
            "=== RETRIEVED CONTEXT ===\n"
            f"{retrieved_context}\n"
            "=== END CONTEXT ==="
        )
    @staticmethod
    async def process_chat(
        session: AsyncSession,
        conversation_id: UUID,
        user_message_text: str,
        user_id: UUID,
        is_admin: bool = False,
        top_k: int = settings.DEFAULT_TOP_K,
        similarity_threshold: float = settings.SIMILARITY_THRESHOLD
    ) -> AsyncGenerator[str, None]:
        """
        Orchestrates RAG generation and streams Server-Sent Events (SSE).
        Yields events formatted as SSE: data: {"type": ..., "data": ...}\n\n
        """
        # 1. Save user message to database
        user_msg = Message(
            conversation_id=conversation_id,
            role="user",
            content=user_message_text
        )
        session.add(user_msg)
        await session.commit()

        # 2. Retrieve past messages for conversation context (last 6 messages)
        past_msgs_query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        history_res = await session.execute(past_msgs_query)
        all_messages = history_res.scalars().all()
        
        # Build contextual query
        query_text = user_message_text
        if len(all_messages) > 2:
            # We can use the last user + assistant exchange if relevant
            recent_context = " ".join([m.content for m in all_messages[-3:-1] if m.role == "user"])
            if recent_context:
                query_text = f"{user_message_text} (Context: {recent_context[:200]})"

        # 3. Generate query embedding with nomic-embed-text
        yield f"data: {json.dumps({'type': 'status', 'content': 'Searching vector database...'})}\n\n"
        
        try:
            embed_input = f"search_query: {query_text}"
            try:
                query_vector = await ollama_service.get_embedding(embed_input)
            except Exception:
                query_vector = await ollama_service.get_embedding(query_text)
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': 'Failed to generate query embedding from Ollama.'})}\n\n"
            return

        # 4. Retrieve matching chunks from PostgreSQL vector store
        try:
            matched_chunks = await vector_store_service.similarity_search(
                session=session,
                query_embedding=query_vector,
                top_k=top_k,
                similarity_threshold=similarity_threshold,
                user_id=user_id,
                is_admin=is_admin
            )
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': 'Vector similarity search failed.'})}\n\n"
            return

        # 5. Format citations
        citations = []
        context_parts = []
        for idx, chunk in enumerate(matched_chunks):
            citation_item = {
                "document_id": chunk["document_id"],
                "document_name": chunk["document_name"],
                "chunk_id": chunk["chunk_id"],
                "page_number": chunk.get("page_number"),
                "section": chunk.get("section"),
                "snippet": chunk["content"][:300] + "..." if len(chunk["content"]) > 300 else chunk["content"],
                "score": chunk["score"]
            }
            citations.append(citation_item)

            page_info = f" (Page {chunk['page_number']})" if chunk.get("page_number") else ""
            section_info = f" [{chunk['section']}]" if chunk.get("section") else ""
            context_parts.append(
                f"[Source {idx+1}: {chunk['document_name']}{page_info}{section_info} | Score: {chunk['score']}]\n"
                f"{chunk['content']}\n"
            )

        # Send citations to client immediately so UI can display them
        yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"
        yield f"data: {json.dumps({'type': 'status', 'content': 'Generating grounded response...'})}\n\n"

        # 6. Build messages payload for Ollama
        retrieved_context_text = "\n---\n".join(context_parts) if context_parts else "No relevant documents found."
        system_prompt = RAGEngine.construct_system_prompt(retrieved_context_text)

        ollama_messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add past 4 messages from conversation history
        for m in all_messages[-5:-1]:
            ollama_messages.append({"role": m.role, "content": m.content})
        
        ollama_messages.append({"role": "user", "content": user_message_text})

        # 7. Stream generated tokens from Ollama
        full_assistant_reply = []
        try:
            async for token in ollama_service.stream_chat(ollama_messages):
                full_assistant_reply.append(token)
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
        except Exception as e:
            logger.error(f"Inference streaming failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': f'Inference error: {str(e)}'})}\n\n"

        final_content = "".join(full_assistant_reply)

        # 8. Save assistant reply with citations into database
        assistant_msg = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=final_content,
            citations=citations
        )
        session.add(assistant_msg)
        await session.commit()
        await session.refresh(assistant_msg)

        # Send completion event
        yield f"data: {json.dumps({'type': 'done', 'message_id': str(assistant_msg.id)})}\n\n"

rag_engine = RAGEngine()
