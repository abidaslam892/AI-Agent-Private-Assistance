"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/chat/Sidebar";
import { api } from "@/lib/api";
import {
  Upload,
  FileText,
  Trash2,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw
} from "lucide-react";

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDocChunks, setSelectedDocChunks] = useState<any[] | null>(null);
  const [activeDocName, setActiveDocName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
    // Poll every 5 seconds if any document is processing
    const interval = setInterval(() => {
      setDocuments(prev => {
        const hasProcessing = prev.some(d => d.status === "processing" || d.status === "uploaded");
        if (hasProcessing) {
          loadDocuments(false);
        }
        return prev;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadDocuments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.documents.list();
      setDocuments(data);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.documents.upload(file);
      await loadDocuments(false);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}" and all its vector embeddings?`)) return;
    try {
      await api.documents.delete(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await api.documents.retry(id);
      await loadDocuments(false);
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    }
  };

  const handleViewChunks = async (doc: any) => {
    setActiveDocName(doc.original_name);
    try {
      const chunks = await api.documents.getChunks(doc.id);
      setSelectedDocChunks(chunks);
    } catch (err: any) {
      alert(`Failed to load chunks: ${err.message}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredDocs = documents.filter(d =>
    d.original_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#212121]">
        {/* Top Header */}
        <header className="h-14 border-b border-[#2e2e2e] flex items-center justify-between px-8 bg-[#212121]/95 z-10">
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-400" />
              Knowledge Base & Vector Store
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadDocuments()}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#2b2b2b] transition"
              title="Refresh document status"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <ShieldCheck className="w-3.5 h-3.5" />
              pgvector Cosine Distance Indexing
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#383838] hover:border-emerald-500/60 rounded-2xl p-8 text-center bg-[#1e1e1e] hover:bg-[#242424] cursor-pointer transition space-y-3 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx"
            />
            <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {uploading ? "Uploading & Storing File..." : "Click or drag documents to upload"}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Supported formats: PDF, DOCX, TXT, Markdown, CSV, XLSX (Max 50MB per file)
              </p>
            </div>
          </div>

          {/* Search & Stats Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search indexed documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg bg-[#282828] border border-[#333333] py-2 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="text-xs text-neutral-400">
              Total Documents: <span className="font-semibold text-white">{documents.length}</span>
            </div>
          </div>

          {/* Documents Table */}
          <div className="rounded-xl border border-[#303030] bg-[#1a1a1a] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#242424] text-neutral-400 border-b border-[#303030]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Document Name</th>
                  <th className="py-3 px-4 font-semibold">Size</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Total Chunks</th>
                  <th className="py-3 px-4 font-semibold">Uploaded At</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a] text-neutral-300">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-500">
                      Loading documents...
                    </td>
                  </tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-500">
                      No documents found in the private knowledge base.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#202020] transition">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="truncate max-w-xs">{doc.original_name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-neutral-400">
                        {formatBytes(doc.file_size)}
                      </td>
                      <td className="py-3.5 px-4">
                        {doc.status === "indexed" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                            <CheckCircle className="h-3 w-3" /> Indexed
                          </span>
                        )}
                        {doc.status === "processing" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950 text-amber-400 border border-amber-800/50 animate-pulse">
                            <RefreshCw className="h-3 w-3 animate-spin" /> Embedding...
                          </span>
                        )}
                        {doc.status === "uploaded" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-950 text-blue-400 border border-blue-800/50">
                            <Clock className="h-3 w-3" /> Uploaded
                          </span>
                        )}
                        {doc.status === "failed" && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-950 text-red-400 border border-red-800/50"
                            title={doc.error_message || "Ingestion error"}
                          >
                            <AlertTriangle className="h-3 w-3" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {doc.total_chunks > 0 ? (
                          <button
                            onClick={() => handleViewChunks(doc)}
                            className="text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Layers className="h-3 w-3" />
                            {doc.total_chunks} chunks
                          </button>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400 font-mono">
                        {new Date(doc.created_at).toLocaleDateString()}{" "}
                        {new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {doc.status === "failed" && (
                            <button
                              onClick={() => handleRetry(doc.id)}
                              className="p-1 rounded text-neutral-400 hover:text-emerald-400 transition"
                              title="Retry ingestion"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(doc.id, doc.original_name)}
                            className="p-1 rounded text-neutral-400 hover:text-red-400 transition"
                            title="Delete document and vector chunks"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chunks Inspection Modal */}
        {selectedDocChunks && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl rounded-xl bg-[#212121] border border-[#383838] p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#303030] pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="font-semibold text-white text-sm">
                      Indexed Chunks: {activeDocName}
                    </h3>
                    <div className="text-xs text-neutral-400">
                      Total {selectedDocChunks.length} vector embeddings (nomic-embed-text / 768d)
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDocChunks(null)}
                  className="text-neutral-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {selectedDocChunks.map((chunk, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-[#181818] border border-[#2b2b2b] text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                      <span className="font-mono text-emerald-400">
                        Chunk #{chunk.chunk_index + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        {chunk.page_number && <span>Page: {chunk.page_number}</span>}
                        {chunk.section && <span>Section: {chunk.section}</span>}
                        <span>Est. Tokens: {chunk.token_count}</span>
                      </div>
                    </div>
                    <p className="text-neutral-200 font-mono whitespace-pre-wrap leading-relaxed bg-[#141414] p-2.5 rounded border border-[#222222]">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t border-[#303030]">
                <button
                  onClick={() => setSelectedDocChunks(null)}
                  className="px-4 py-2 rounded-lg bg-[#303030] hover:bg-[#3a3a3a] text-xs font-medium text-white transition"
                >
                  Close Chunks Viewer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
