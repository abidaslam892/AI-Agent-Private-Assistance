import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine, Base
from app.core.security import get_password_hash
from app.db.models import User, SystemSetting
from app.core.config import settings

logger = logging.getLogger(__name__)

async def init_db():
    async with engine.begin() as conn:
        # Enable pgvector and uuid extensions
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"))
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
        # Create HNSW index for vector cosine similarity if not exists
        try:
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_chunks_embedding_hnsw 
                ON document_chunks 
                USING hnsw (embedding vector_cosine_ops);
            """))
            logger.info("Vector HNSW index verified/created.")
        except Exception as e:
            logger.warning(f"Could not create HNSW index automatically (might need more rows or fallback to ivfflat): {e}")

    # Seed initial users & settings
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        # Check admin
        admin_res = await session.execute(
            text("SELECT id FROM users WHERE username = :u LIMIT 1"),
            {"u": settings.ADMIN_USERNAME}
        )
        if settings.ADMIN_PASSWORD and not admin_res.fetchone():
            admin = User(
                email="admin@local.rag",
                username=settings.ADMIN_USERNAME,
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                role="admin",
                is_active=True
            )
            session.add(admin)
            logger.info("Admin user created.")

        # Check default user
        user_res = await session.execute(
            text("SELECT id FROM users WHERE username = :u LIMIT 1"),
            {"u": settings.USER_USERNAME}
        )
        if settings.USER_PASSWORD and not user_res.fetchone():
            default_user = User(
                email="ops@local.rag",
                username=settings.USER_USERNAME,
                hashed_password=get_password_hash(settings.USER_PASSWORD),
                role="user",
                is_active=True
            )
            session.add(default_user)
            logger.info("Standard user created.")

        # Seed default RAG configuration
        setting_res = await session.execute(
            text("SELECT key FROM system_settings WHERE key = 'rag_config' LIMIT 1")
        )
        if not setting_res.fetchone():
            setting = SystemSetting(
                key="rag_config",
                value={
                    "chat_model": settings.CHAT_MODEL,
                    "embedding_model": settings.EMBEDDING_MODEL,
                    "chunk_size": settings.CHUNK_SIZE,
                    "chunk_overlap": settings.CHUNK_OVERLAP,
                    "top_k": settings.DEFAULT_TOP_K,
                    "similarity_threshold": settings.SIMILARITY_THRESHOLD,
                    "max_context_tokens": settings.MAX_CONTEXT_TOKENS,
                    "system_prompt": (
                        "You are a specialized AI Knowledge Assistant. "
                        "Answer user questions accurately and thoroughly based ONLY on the retrieved organizational document context. "
                        "Always cite your sources using the format [Document: <filename>, Page: <page>]. "
                        "If the context does not contain the answer, clearly state: 'The provided documents do not contain sufficient information to answer this question.'"
                    )
                }
            )
            session.add(setting)
            logger.info("Default RAG configuration initialized in database.")

        await session.commit()
