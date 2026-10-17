from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    original_name: str
    file_size: int
    mime_type: str
    status: str
    error_message: Optional[str] = None
    version: int
    total_chunks: int
    doc_metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentChunkResponse(BaseModel):
    id: UUID
    document_id: UUID
    chunk_index: int
    page_number: Optional[int] = None
    section: Optional[str] = None
    content: str
    token_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class IngestionStatusResponse(BaseModel):
    document_id: UUID
    status: str
    total_chunks: int
    error_message: Optional[str] = None
    job_id: Optional[UUID] = None
