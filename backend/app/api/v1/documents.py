import os
import uuid
import shutil
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
from app.db.models import User, Document, DocumentChunk, AuditEvent
from app.schemas.document import DocumentResponse, DocumentChunkResponse
from app.api.deps import get_current_user
from app.services.ingestion_service import ingestion_service

router = APIRouter()

async def background_ingest_worker(doc_id: UUID):
    """Background task to process file parsing, chunking, and vector embedding."""
    async with AsyncSessionLocal() as session:
        try:
            await ingestion_service.process_document_ingestion(session, doc_id)
        except Exception as e:
            # Error is already recorded in the document record inside ingestion_service
            pass

@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Document).order_by(desc(Document.created_at))
    if current_user.role != "admin":
        query = query.where(Document.user_id == current_user.id)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Validate extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File extension {ext} not supported. Allowed formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # Save physical file to disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    doc_uuid = uuid.uuid4()
    stored_filename = f"{doc_uuid}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, stored_filename)

    file_size = 0
    with open(file_path, "wb") as buffer:
        while content := await file.read(1024 * 1024):  # 1MB chunks
            file_size += len(content)
            if file_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
                buffer.close()
                if os.path.exists(file_path):
                    os.remove(file_path)
                raise HTTPException(
                    status_code=400,
                    detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB"
                )
            buffer.write(content)

    # Create document record in database
    doc = Document(
        id=doc_uuid,
        user_id=current_user.id,
        filename=stored_filename,
        original_name=file.filename,
        file_size=file_size,
        mime_type=file.content_type or "application/octet-stream",
        file_path=file_path,
        status="uploaded"
    )
    db.add(doc)
    
    # Audit log
    audit = AuditEvent(
        user_id=current_user.id,
        action="DOCUMENT_UPLOADED",
        resource_type="document",
        resource_id=str(doc.id),
        details={"filename": file.filename, "size_bytes": file_size}
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(doc)

    # Dispatch ingestion background task
    background_tasks.add_task(background_ingest_worker, doc.id)

    return doc

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to access this document")
    return doc

@router.delete("/{document_id}")
async def delete_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this document")

    await ingestion_service.delete_document(db, doc, user_id=current_user.id)
    return {"status": "success", "message": f"Document '{doc.original_name}' deleted successfully."}

@router.post("/{document_id}/retry", response_model=DocumentResponse)
async def retry_ingestion(
    document_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to retry ingestion for this document")

    doc.status = "processing"
    doc.error_message = None
    await db.commit()

    background_tasks.add_task(background_ingest_worker, doc.id)
    return doc

@router.get("/{document_id}/chunks", response_model=List[DocumentChunkResponse])
async def get_document_chunks(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view chunks")

    query = (
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index.asc())
    )
    result = await db.execute(query)
    return result.scalars().all()
