#!/usr/bin/env bash
set -e

CHAT_MODEL=${CHAT_MODEL:-"llama3.1:8b"}
EMBED_MODEL=${EMBED_MODEL:-"nomic-embed-text"}

echo "Waiting for Ollama to start..."
until curl -s http://localhost:11434/api/tags > /dev/null; do
    echo "Waiting for Ollama on port 11434..."
    sleep 3
done

echo "Pulling Embedding Model: $EMBED_MODEL..."
docker exec -i rag-ollama ollama pull "$EMBED_MODEL"

echo "Pulling Chat Model: $CHAT_MODEL..."
docker exec -i rag-ollama ollama pull "$CHAT_MODEL"

echo "Verifying models:"
docker exec -i rag-ollama ollama list
echo "Models ready!"
