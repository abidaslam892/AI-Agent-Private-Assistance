import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Document, DocumentChunk, IngestionJob, AuditEvent
from app.services.document_parser import document_parser
from app.services.text_splitter import text_splitter
from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

class IngestionService:
    @staticmethod
    def validate_file(filename: str, file_size: int) -> bool:
        ext = os.path.splitext(filename)[1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise ValueError(f"File extension {ext} not allowed. Supported extensions: {', '.join(settings.ALLOWED_EXTENSIONS)}")
        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise ValueError(f"File size exceeds maximum limit of {settings.MAX_FILE_SIZE_MB}MB")
        return True

    @staticmethod
    async def process_document_ingestion(
        session: AsyncSession,
        document_id: uuid.UUID
    ) -> Document:
        """
        Background/Pipeline ingestion of document:
        1. Fetch document record
        2. Create IngestionJob record
        3. Parse file
        4. Split into chunks
        5. Generate embeddings via Ollama nomic-embed-text
        6. Store into document_chunks with pgvector
        7. Mark document as indexed
        """
        doc = await session.get(Document, document_id)
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        job = IngestionJob(
            document_id=doc.id,
            status="running",
            started_at=datetime.now(timezone.utc)
        )
        session.add(job)
        doc.status = "processing"
        doc.error_message = None
        await session.commit()

        try:
            # 1. Parse document into sections
            logger.info(f"Parsing document {doc.original_name} ({doc.id})")
            sections = document_parser.parse_file(doc.file_path, doc.original_name)
            if not sections:
                raise ValueError("No readable text found in document.")

            # 2. Split sections into overlapping chunks
            chunks = text_splitter.split_parsed_sections(sections)
            if not chunks:
                raise ValueError("Document yielded 0 text chunks after processing.")

            logger.info(f"Document {doc.original_name} yielded {len(chunks)} chunks. Generating embeddings...")

            # 3. Clean any existing chunks for this document if re-indexing
            await session.execute(
                delete(DocumentChunk).where(DocumentChunk.document_id == doc.id)
            )

            # 4. Generate embeddings and create Chunk records
            chunk_models = []
            for item in chunks:
                text_content = item["content"]
                
                # Prefix embedding input with document name for richer semantic context
                embed_input = f"search_document: {doc.original_name} | {text_content}"
                try:
                    embedding_vector = await ollama_service.get_embedding(embed_input)
                except Exception as embed_err:
                    logger.warning(f"Embedding failed with prefix, retrying raw text: {embed_err}")
                    embedding_vector = await ollama_service.get_embedding(text_content)

                chunk_obj = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=item["chunk_index"],
                    page_number=item.get("page_number"),
                    section=item.get("section"),
                    content=text_content,
                    embedding=embedding_vector,
                    token_count=item.get("token_count", 0),
                    chunk_metadata=item.get("metadata", {})
                )
                chunk_models.append(chunk_obj)

            session.add_all(chunk_models)
            
            # 5. Update Document & Job status
            doc.status = "indexed"
            doc.total_chunks = len(chunk_models)
            doc.updated_at = datetime.now(timezone.utc)
            
            job.status = "completed"
            job.finished_at = datetime.now(timezone.utc)

            # Audit event
            audit = AuditEvent(
                user_id=doc.user_id,
                action="DOCUMENT_INDEXED",
                resource_type="document",
                resource_id=str(doc.id),
                details={
                    "filename": doc.original_name,
                    "chunks": len(chunk_models),
                    "model": settings.EMBEDDING_MODEL
                }
            )
            session.add(audit)

            await session.commit()
            await session.refresh(doc)
            logger.info(f"Successfully indexed document {doc.original_name} with {len(chunk_models)} chunks.")
            return doc

        except Exception as e:
            logger.error(f"Failed to ingest document {doc.id}: {e}", exc_info=True)
            doc.status = "failed"
            doc.error_message = str(e)
            doc.updated_at = datetime.now(timezone.utc)
            
            job.status = "failed"
            job.error_details = str(e)
            job.finished_at = datetime.now(timezone.utc)

            await session.commit()
            raise

    @staticmethod
    async def delete_document(session: AsyncSession, document: Document, user_id: Optional[uuid.UUID] = None) -> bool:
        """Permanently delete document, files, chunks, and log audit."""
        doc_id_str = str(document.id)
        doc_name = document.original_name

        # Delete physical file
        if os.path.exists(document.file_path):
            try:
                os.remove(document.file_path)
            except Exception as e:
                logger.warning(f"Could not remove physical file {document.file_path}: {e}")

        # Delete from database (cascades to chunks and jobs)
        await session.delete(document)

        audit = AuditEvent(
            user_id=user_id,
            action="DOCUMENT_DELETED",
            resource_type="document",
            resource_id=doc_id_str,
            details={"filename": doc_name}
        )
        session.add(audit)
        await session.commit()
        return True

ingestion_service = IngestionService()
