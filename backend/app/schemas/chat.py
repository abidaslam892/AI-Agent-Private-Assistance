from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class CitationSchema(BaseModel):
    document_id: str
    document_name: str
    chunk_id: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    snippet: str
    score: float

class MessageCreate(BaseModel):
    content: str
    conversation_id: Optional[UUID] = None
    stream: bool = True

class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    citations: Optional[List[CitationSchema]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[MessageResponse]] = None

    class Config:
        from_attributes = True

class ConversationListResponse(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
