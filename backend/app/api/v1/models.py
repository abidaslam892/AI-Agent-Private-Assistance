from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import settings
from app.api.deps import get_current_user, get_current_admin
from app.db.models import User
from app.services.ollama_service import ollama_service

router = APIRouter()

class ModelPullRequest(BaseModel):
    name: str

@router.get("")
async def get_models(current_user: User = Depends(get_current_user)):
    models_list = await ollama_service.list_models()
    return {
        "active_chat_model": settings.CHAT_MODEL,
        "active_embedding_model": settings.EMBEDDING_MODEL,
        "embedding_dimension": settings.EMBEDDING_DIMENSION,
        "models": models_list
    }

@router.post("/pull")
async def pull_model(
    pull_req: ModelPullRequest,
    current_admin: User = Depends(get_current_admin)
):
    async def progress_stream():
        import json
        async for progress in ollama_service.pull_model(pull_req.name):
            yield f"data: {json.dumps(progress)}\n\n"

    return StreamingResponse(progress_stream(), media_type="text/event-stream")
