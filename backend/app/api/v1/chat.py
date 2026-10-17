from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db, AsyncSessionLocal
from app.db.models import User, Conversation, Message
from app.schemas.chat import (
    ConversationResponse,
    ConversationListResponse,
    ConversationCreate,
    MessageCreate,
    MessageResponse
)
from app.api.deps import get_current_user
from app.services.rag_engine import rag_engine

router = APIRouter()

@router.get("/conversations", response_model=List[ConversationListResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(desc(Conversation.updated_at))
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    conv_in: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conv = Conversation(
        user_id=current_user.id,
        title=conv_in.title or "New Chat"
    )
    db.add(conv)
    await db.commit()
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv.id)
        .options(selectinload(Conversation.messages))
        .execution_options(populate_existing=True)
    )
    return result.scalars().one()

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    result = await db.execute(query)
    conv = result.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")
    return conv

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this conversation")
    
    await db.delete(conv)
    await db.commit()
    return {"status": "success", "message": "Conversation deleted"}

@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: UUID,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user)
):
    # Verify conversation exists and belongs to user
    async with AsyncSessionLocal() as db_check:
        conv = await db_check.get(Conversation, conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conv.user_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Not authorized to access this conversation")
        
        # Auto-update title if it's the first message
        if conv.title == "New Chat":
            conv.title = msg_in.content[:40].strip() + ("..." if len(msg_in.content) > 40 else "")
            await db_check.commit()

    # Generator for SSE response
    async def event_stream():
        async with AsyncSessionLocal() as session:
            async for sse_chunk in rag_engine.process_chat(
                session=session,
                conversation_id=conversation_id,
                user_message_text=msg_in.content,
                user_id=current_user.id,
                is_admin=(current_user.role == "admin")
            ):
                yield sse_chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
