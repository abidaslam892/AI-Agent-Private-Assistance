import time
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.db.models import User, AuditEvent
from app.schemas.admin import (
    RetrievalDiagnosticsRequest,
    RetrievalDiagnosticsResponse,
    DiagnosticChunk,
    AuditLogResponse
)
from app.schemas.auth import UserResponse
from app.api.deps import get_current_admin
from app.services.ollama_service import ollama_service
from app.services.vector_store import vector_store_service

router = APIRouter()

@router.post("/diagnostics", response_model=RetrievalDiagnosticsResponse)
async def run_retrieval_diagnostics(
    req: RetrievalDiagnosticsRequest,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    start_time = time.time()
    # Generate query embedding
    try:
        query_vector = await ollama_service.get_embedding(f"search_query: {req.query}")
    except Exception:
        query_vector = await ollama_service.get_embedding(req.query)

    # Search in vector store
    matched_chunks = await vector_store_service.similarity_search(
        session=db,
        query_embedding=query_vector,
        top_k=req.top_k or 5,
        similarity_threshold=req.similarity_threshold or 0.1,
        is_admin=True
    )

    elapsed_ms = (time.time() - start_time) * 1000.0

    diag_chunks = [
        DiagnosticChunk(
            chunk_id=c["chunk_id"],
            document_id=c["document_id"],
            document_name=c["document_name"],
            page_number=c.get("page_number"),
            section=c.get("section"),
            similarity_score=c["score"],
            content_preview=c["content"][:250] + "..." if len(c["content"]) > 250 else c["content"]
        )
        for c in matched_chunks
    ]

    return RetrievalDiagnosticsResponse(
        query=req.query,
        results_found=len(diag_chunks),
        chunks=diag_chunks,
        execution_time_ms=round(elapsed_ms, 2)
    )

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    query = select(AuditEvent).order_by(desc(AuditEvent.created_at)).limit(100)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    query = select(User).order_by(desc(User.created_at))
    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate own account")

    user.is_active = not user.is_active
    await db.commit()
    return {"status": "success", "user_id": str(user.id), "is_active": user.is_active}
