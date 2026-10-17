import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import DocumentChunk, Document
from app.core.config import settings

logger = logging.getLogger(__name__)

class VectorStoreService:
    @staticmethod
    async def similarity_search(
        session: AsyncSession,
        query_embedding: List[float],
        top_k: int = settings.DEFAULT_TOP_K,
        similarity_threshold: float = settings.SIMILARITY_THRESHOLD,
        user_id: Optional[UUID] = None,
        is_admin: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Execute vector similarity search in PostgreSQL using pgvector cosine distance.
        Cosine distance is: DocumentChunk.embedding.cosine_distance(query_embedding).
        Cosine similarity = 1 - distance.
        """
        try:
            # Query chunks joined with Document to ensure document is active and indexed
            # In pgvector, cosine_distance returns float between 0 and 2
            distance_expr = DocumentChunk.embedding.cosine_distance(query_embedding)
            similarity_expr = 1.0 - distance_expr

            query = (
                select(
                    DocumentChunk,
                    Document.original_name,
                    Document.user_id,
                    similarity_expr.label("similarity")
                )
                .join(Document, DocumentChunk.document_id == Document.id)
                .where(
                    and_(
                        Document.status == "indexed",
                        DocumentChunk.embedding.isnot(None)
                    )
                )
            )

            # If user isolation is enforced (non-admin can see their own documents or shared docs)
            if user_id and not is_admin:
                query = query.where(Document.user_id == user_id)

            # Order by smallest distance (highest similarity)
            query = query.order_by(distance_expr.asc()).limit(top_k * 2)

            result = await session.execute(query)
            rows = result.all()

            matched_chunks = []
            for chunk, doc_name, doc_owner_id, similarity in rows:
                sim_score = float(similarity) if similarity is not None else 0.0
                if sim_score >= similarity_threshold:
                    matched_chunks.append({
                        "chunk_id": str(chunk.id),
                        "document_id": str(chunk.document_id),
                        "document_name": doc_name,
                        "chunk_index": chunk.chunk_index,
                        "page_number": chunk.page_number,
                        "section": chunk.section,
                        "content": chunk.content,
                        "token_count": chunk.token_count,
                        "score": round(sim_score, 4),
                        "metadata": chunk.chunk_metadata or {}
                    })

            # Trim to top_k
            return matched_chunks[:top_k]
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            raise

vector_store_service = VectorStoreService()
