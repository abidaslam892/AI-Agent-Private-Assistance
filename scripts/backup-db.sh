#!/usr/bin/env bash
# Database backup script for Private RAG Platform
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/rag_db_backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"
echo "Creating PostgreSQL database backup to ${BACKUP_FILE}..."

docker exec -t rag-postgres pg_dump -U postgres -d rag_db > "$BACKUP_FILE"

echo "Backup completed successfully! Size: $(du -h "$BACKUP_FILE" | cut -f1)"
