#!/usr/bin/env bash
# Database restore script for Private RAG Platform
set -e

if [ -z "$1" ]; then
    echo "Usage: ./scripts/restore-db.sh <path_to_backup_file.sql>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file $BACKUP_FILE does not exist."
    exit 1
fi

echo "Restoring database from $BACKUP_FILE..."
cat "$BACKUP_FILE" | docker exec -i rag-postgres psql -U postgres -d rag_db

echo "Database restore completed successfully!"
