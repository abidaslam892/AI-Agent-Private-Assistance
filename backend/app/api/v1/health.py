from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.schemas.admin import SystemHealthResponse
from app.services.ollama_service import ollama_service

router = APIRouter()

@router.get("", response_model=SystemHealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    db_ok = False
    pgvector_ok = False
    try:
        res = await db.execute(text("SELECT 1;"))
        db_ok = res.scalar() == 1
        
        vec_res = await db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector';"))
        pgvector_ok = vec_res.scalar() == 1
    except Exception:
        db_ok = False
        pgvector_ok = False

    ollama_info = await ollama_service.check_health()
    ollama_ok = ollama_info.get("available", False)
    models = ollama_info.get("models", [])

    overall_status = "healthy" if (db_ok and pgvector_ok and ollama_ok) else "degraded"

    return SystemHealthResponse(
        status=overall_status,
        database=db_ok,
        pgvector=pgvector_ok,
        ollama=ollama_ok,
        models_available=models,
        chat_model=settings.CHAT_MODEL,
        embedding_model=settings.EMBEDDING_MODEL,
        timestamp=datetime.now(timezone.utc)
    )
