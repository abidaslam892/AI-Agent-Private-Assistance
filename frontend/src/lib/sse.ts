import { authStorage } from "./auth";

export interface Citation {
  document_id: string;
  document_name: string;
  chunk_id: string;
  page_number?: number;
  section?: string;
  snippet: string;
  score: number;
}

export interface StreamChatCallbacks {
  onToken?: (token: string) => void;
  onCitations?: (citations: Citation[]) => void;
  onStatus?: (status: string) => void;
  onError?: (error: string) => void;
  onDone?: (messageId: string) => void;
}

export async function streamChatMessage(
  conversationId: string,
  content: string,
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const token = authStorage.getToken();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token || ""}`,
    },
    body: JSON.stringify({ content, stream: true }),
    signal,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      // ignore
    }
    callbacks.onError?.(errorDetail);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.("ReadableStream not supported by browser.");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "token") {
              callbacks.onToken?.(parsed.token);
            } else if (parsed.type === "citations") {
              callbacks.onCitations?.(parsed.citations);
            } else if (parsed.type === "status") {
              callbacks.onStatus?.(parsed.content);
            } else if (parsed.type === "error") {
              callbacks.onError?.(parsed.content);
            } else if (parsed.type === "done") {
              callbacks.onDone?.(parsed.message_id);
            }
          } catch (err) {
            console.error("Failed to parse SSE line:", trimmed, err);
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name !== "AbortError") {
      callbacks.onError?.(err.message || "Streaming interrupted.");
    }
  } finally {
    reader.releaseLock();
  }
}
