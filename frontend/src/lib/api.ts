import { authStorage } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    authStorage.clear();
    if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Authentication session expired.");
  }

  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.detail || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    login: async (username: string, password: string) => {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.detail || "Login failed");
      }
      return res.json();
    },
    me: () => request<any>("/auth/me"),
  },
  chat: {
    getConversations: () => request<any[]>("/chat/conversations"),
    createConversation: (title?: string) => request<any>("/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ title: title || "New Chat" }),
    }),
    getConversation: (id: string) => request<any>(`/chat/conversations/${id}`),
    deleteConversation: (id: string) => request<any>(`/chat/conversations/${id}`, {
      method: "DELETE"
    }),
  },
  documents: {
    list: () => request<any[]>("/documents"),
    upload: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return request<any>("/documents/upload", {
        method: "POST",
        body: formData,
      });
    },
    get: (id: string) => request<any>(`/documents/${id}`),
    delete: (id: string) => request<any>(`/documents/${id}`, { method: "DELETE" }),
    retry: (id: string) => request<any>(`/documents/${id}/retry`, { method: "POST" }),
    getChunks: (id: string) => request<any[]>(`/documents/${id}/chunks`),
  },
  models: {
    list: () => request<any>("/models"),
    pull: (name: string) => request<any>("/models/pull", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  },
  admin: {
    diagnostics: (query: string, top_k = 5, similarity_threshold = 0.1) => 
      request<any>("/admin/diagnostics", {
        method: "POST",
        body: JSON.stringify({ query, top_k, similarity_threshold }),
      }),
    auditLogs: () => request<any[]>("/admin/audit-logs"),
    users: () => request<any[]>("/admin/users"),
    toggleUser: (id: string) => request<any>(`/admin/users/${id}/toggle-active`, { method: "PATCH" }),
  },
  health: {
    check: () => request<any>("/health"),
  }
};
