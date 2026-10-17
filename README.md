# Private ChatGPT-Style RAG AI Platform

A production-ready, full-stack, enterprise-grade AI knowledge assistant with a ChatGPT-like user experience. It empowers teams to upload organizational documents, index them into a persistent vector database (**PostgreSQL + pgvector**), and ask questions answered through Retrieval-Augmented Generation (**RAG**) with **100% private, locally hosted AI models** via **Ollama**.

---

## 🌟 Key Architecture & Capabilities

- **100% Air-Gapped & Private Inference**: No telemetry, embeddings, or prompts leave your infrastructure.
- **ChatGPT-Style Frontend**: Built with Next.js 14, React, Tailwind CSS, Lucide Icons, Markdown prose rendering, and code syntax styling.
- **Real-Time Streaming**: Token-by-token response streaming via Server-Sent Events (SSE).
- **Verified Source Citations**: Every generated fact includes clickable citations with document title, page number, section, similarity score, and exact excerpt.
- **Vector Database**: PostgreSQL 16 with native `pgvector` extension utilizing HNSW cosine distance indexing (`vector(768)`).
- **Multi-Format Document Parsing**: Ingests PDF (with page tracking), DOCX, TXT, Markdown, CSV, and XLSX.
- **Local AI Models**:
  - **Chat Model**: `llama3.1:8b` (Meta Llama 3.1 8B parameter model running locally).
  - **Embedding Model**: `nomic-embed-text` (768-dimensional embeddings).
- **Enterprise Controls**: Role-based access control (Admin / Standard User), real-time retrieval diagnostics, audit logging, and document lifecycle management.

---

## 📁 Repository Structure

```
E:\private-rag-platform/
├── compose.yaml                # Docker Compose multi-service orchestration
├── .env.example                # Configuration template
├── backend/                    # Python FastAPI RAG backend
│   ├── app/
│   │   ├── api/v1/             # REST endpoints (auth, chat, documents, models, admin, health)
│   │   ├── core/               # Configuration, security (JWT/bcrypt), database pool
│   │   ├── db/                 # SQLAlchemy models and init_db seeding
│   │   ├── schemas/            # Pydantic v2 schemas
│   │   └── services/           # Document parser, text splitter, pgvector store, RAG engine, Ollama client
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Backend container definition
│   └── tests/                  # Automated pytest suite
├── frontend/                   # Next.js 14 App Router chat frontend
│   ├── src/
│   │   ├── app/                # Next.js pages (Chat, Knowledge Base, Admin Diagnostics, Login)
│   │   ├── components/chat/    # Sidebar, ChatArea, CitationCard
│   │   └── lib/                # API client, SSE streaming parser, auth storage
│   ├── package.json
│   └── Dockerfile              # Multi-stage production container
├── docker/
│   └── init-db.sql             # PostgreSQL pgvector extension initializer
└── scripts/
    ├── setup-models.ps1        # Model download script (PowerShell)
    ├── setup-models.sh         # Model download script (Bash)
    ├── backup-db.sh            # pg_dump backup script
    └── restore-db.sh           # Database restoration script
```

---

## 🚀 Quick Start (Local Docker Compose)

### 1. Prerequisites
- **Docker Desktop**: With WSL2 engine enabled and Docker Compose v2.
- **Hardware**: Minimum 16 GB RAM (32 GB recommended for `llama3.1:8b` CPU inference).

### 2. Configure Environment
```powershell
cd E:\private-rag-platform
Copy-Item .env.example .env
```

### 3. Launch Services
```powershell
docker compose up -d
```

### 4. Download Local AI Models into Ollama
```powershell
.\scripts\setup-models.ps1
```
*(Or via Bash: `bash scripts/setup-models.sh`)*

### 5. Access the Web Application
- **Frontend Dashboard**: [http://localhost:3001](http://localhost:3001) (or `http://localhost:3000`)
- **Backend Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Accounts**: set `ADMIN_PASSWORD` / `USER_PASSWORD` (and `POSTGRES_PASSWORD`, `SECRET_KEY`) in `.env` before the first start. Accounts are created from those values; no default credentials ship with the repo.

---

## 🔒 Security & Data Isolation
- Direct access to PostgreSQL (5432) and Ollama (11434) is restricted to the internal Docker bridge network in production.
- Non-admin users are strictly isolated to their own uploaded documents.
- All documents, chunks, and vector embeddings are permanently purged upon deletion with transactional consistency.
