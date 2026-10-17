import json
import logging
from typing import List, Dict, Any, AsyncGenerator, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class OllamaService:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.client_timeout = httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=30.0)

    async def check_health(self) -> Dict[str, Any]:
        """Check if Ollama server is reachable and get list of installed models."""
        try:
            async with httpx.AsyncClient(timeout=self.client_timeout) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name") for m in data.get("models", [])]
                    return {
                        "available": True,
                        "models": models,
                        "has_chat_model": any(settings.CHAT_MODEL in m for m in models),
                        "has_embed_model": any(settings.EMBEDDING_MODEL in m for m in models)
                    }
                return {"available": False, "models": [], "error": f"Status {res.status_code}"}
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return {"available": False, "models": [], "error": str(e)}

    async def list_models(self) -> List[Dict[str, Any]]:
        """List detailed models from Ollama."""
        try:
            async with httpx.AsyncClient(timeout=self.client_timeout) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    return res.json().get("models", [])
                return []
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
            return []

    async def pull_model(self, model_name: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Pull a model and stream progress."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=600.0, write=10.0, pool=30.0)) as client:
                async with client.stream("POST", f"{self.base_url}/api/pull", json={"name": model_name}) as response:
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                yield json.loads(line)
                            except Exception:
                                pass
        except Exception as e:
            logger.error(f"Failed to pull model {model_name}: {e}")
            yield {"status": "error", "error": str(e)}

    async def get_embedding(self, text: str, model: Optional[str] = None) -> List[float]:
        """Generate embedding vector for a given text chunk using Ollama embed endpoint."""
        model_name = model or settings.EMBEDDING_MODEL
        try:
            async with httpx.AsyncClient(timeout=self.client_timeout) as client:
                # Try new /api/embed first
                res = await client.post(
                    f"{self.base_url}/api/embed",
                    json={"model": model_name, "input": text}
                )
                if res.status_code == 200:
                    data = res.json()
                    embeddings = data.get("embeddings")
                    if embeddings and len(embeddings) > 0:
                        return embeddings[0]
                
                # Fallback to legacy /api/embeddings
                res_legacy = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": model_name, "prompt": text}
                )
                if res_legacy.status_code == 200:
                    data_legacy = res_legacy.json()
                    return data_legacy.get("embedding", [])
                
                raise RuntimeError(f"Ollama embedding API error: status {res.status_code} - {res.text}")
        except Exception as e:
            logger.error(f"Error generating embedding with {model_name}: {e}")
            raise

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2
    ) -> AsyncGenerator[str, None]:
        """Stream chat completion response token by token."""
        model_name = model or settings.CHAT_MODEL
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": True,
            "keep_alive": "24h",
            "options": {
                "num_predict": 400,
                "num_thread": 4,
                "temperature": temperature,
                "num_ctx": settings.MAX_CONTEXT_TOKENS
            }
        }
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=30.0)) as client:
                async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                    if response.status_code != 200:
                        yield f"Error from AI Model Server ({response.status_code}). Please verify model availability."
                        return
                    
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                chunk = json.loads(line)
                                msg = chunk.get("message", {})
                                content = msg.get("content", "")
                                if content:
                                    yield content
                                if chunk.get("done", False):
                                    break
                            except Exception:
                                continue
        except httpx.ConnectError:
            yield "Failed to connect to local Ollama inference service. Please ensure Ollama is running."
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"\n[Inference Error: {str(e)}]"

ollama_service = OllamaService()
