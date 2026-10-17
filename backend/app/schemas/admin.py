from typing import List, Optional, Any, Dict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class SystemHealthResponse(BaseModel):
    status: str
    database: bool
    pgvector: bool
    ollama: bool
    models_available: List[str]
    chat_model: str
    embedding_model: str
    timestamp: datetime

class ModelStatusResponse(BaseModel):
    name: str
    size: Optional[int] = None
    modified_at: Optional[str] = None
    digest: Optional[str] = None
    status: str

class RetrievalDiagnosticsRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    similarity_threshold: Optional[float] = 0.2

class DiagnosticChunk(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    similarity_score: float
    content_preview: str

class RetrievalDiagnosticsResponse(BaseModel):
    query: str
    results_found: int
    chunks: List[DiagnosticChunk]
    execution_time_ms: float

class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
