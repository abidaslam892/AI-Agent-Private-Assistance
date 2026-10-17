"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/chat/Sidebar";
import { api } from "@/lib/api";
import {
  Shield,
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  Database,
  Cpu,
  Layers,
  Clock,
  User,
  Terminal,
  RefreshCw
} from "lucide-react";

export default function AdminPage() {
  const [health, setHealth] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [diagnosticQuery, setDiagnosticQuery] = useState("");
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [runningDiag, setRunningDiag] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [healthData, auditData, usersData] = await Promise.all([
        api.health.check().catch(() => null),
        api.admin.auditLogs().catch(() => []),
        api.admin.users().catch(() => []),
      ]);
      setHealth(healthData);
      setAuditLogs(auditData);
      setUsers(usersData);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosticQuery.trim() || runningDiag) return;

    setRunningDiag(true);
    try {
      const results = await api.admin.diagnostics(diagnosticQuery, 5, 0.1);
      setDiagnosticResults(results);
    } catch (err: any) {
      alert(`Diagnostic failed: ${err.message}`);
    } finally {
      setRunningDiag(false);
    }
  };

  const handleToggleUser = async (id: string) => {
    try {
      const res = await api.admin.toggleUser(id);
      setUsers(prev =>
        prev.map(u => (u.id === id ? { ...u, is_active: res.is_active } : u))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#212121]">
        {/* Header */}
        <header className="h-14 border-b border-[#2e2e2e] flex items-center justify-between px-8 bg-[#212121]/95 z-10">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h1 className="text-base font-bold text-white">
              Administrator Diagnostics & Controls
            </h1>
          </div>
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2b2b2b] hover:bg-[#333333] border border-[#383838] text-xs font-medium text-white transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Diagnostics</span>
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Health Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-emerald-400" /> PostgreSQL
                </span>
                {health?.database ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div className="text-lg font-bold text-white">
                {health?.database ? "Connected" : "Disconnected"}
              </div>
              <p className="text-[11px] text-neutral-500">
                Primary persistent database
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-emerald-400" /> pgvector Extension
                </span>
                {health?.pgvector ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div className="text-lg font-bold text-white">
                {health?.pgvector ? "Active (768d)" : "Inactive"}
              </div>
              <p className="text-[11px] text-neutral-500">
                HNSW cosine distance indexes
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-emerald-400" /> Ollama Inference
                </span>
                {health?.ollama ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div className="text-lg font-bold text-white">
                {health?.ollama ? "Online" : "Unreachable"}
              </div>
              <p className="text-[11px] text-neutral-500">
                Local model execution runtime
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-emerald-400" /> Active Models
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {health?.models_available?.length || 0} installed
                </span>
              </div>
              <div className="text-xs font-mono font-medium text-white truncate">
                {health?.chat_model || "llama3.1:8b"}
              </div>
              <p className="text-[11px] text-neutral-500 truncate">
                Embed: {health?.embedding_model || "nomic-embed-text"}
              </p>
            </div>
          </div>

          {/* Retrieval Diagnostics Section */}
          <div className="p-6 rounded-2xl bg-[#1a1a1a] border border-[#303030] space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                RAG Retrieval & Vector Similarity Diagnostics
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Directly query pgvector without calling the chat LLM to inspect retrieved chunk relevance, cosine scores, and execution latency.
              </p>
            </div>

            <form onSubmit={handleRunDiagnostic} className="flex gap-3">
              <input
                type="text"
                placeholder="Enter a test query (e.g. 'What is GMLC latency threshold?')..."
                value={diagnosticQuery}
                onChange={(e) => setDiagnosticQuery(e.target.value)}
                className="flex-1 rounded-xl bg-[#262626] border border-[#383838] px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={runningDiag || !diagnosticQuery.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white transition flex items-center gap-2 shrink-0"
              >
                {runningDiag ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Searching Vectors...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" />
                    <span>Run Diagnostic</span>
                  </>
                )}
              </button>
            </form>

            {diagnosticResults && (
              <div className="mt-4 pt-4 border-t border-[#2e2e2e] space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>
                    Matched Chunks: <strong className="text-white">{diagnosticResults.results_found}</strong>
                  </span>
                  <span className="font-mono text-emerald-400">
                    Execution Time: {diagnosticResults.execution_time_ms} ms
                  </span>
                </div>

                <div className="space-y-2">
                  {diagnosticResults.chunks.map((c: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg bg-[#202020] border border-[#2c2c2c] text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          #{idx + 1} {c.document_name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Score: {c.similarity_score}
                        </span>
                      </div>
                      <p className="text-neutral-300 font-mono text-[11px] bg-[#161616] p-2 rounded border border-[#242424]">
                        {c.content_preview}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Audit Logs Table */}
          <div className="p-6 rounded-2xl bg-[#1a1a1a] border border-[#303030] space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              Platform Audit Trail & Security Events
            </h2>

            <div className="rounded-xl border border-[#2b2b2b] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#242424] text-neutral-400 border-b border-[#2b2b2b]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Action</th>
                    <th className="py-2.5 px-4 font-semibold">Resource</th>
                    <th className="py-2.5 px-4 font-semibold">Resource ID</th>
                    <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626] text-neutral-300 font-mono text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-neutral-500">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.slice(0, 15).map((log) => (
                      <tr key={log.id} className="hover:bg-[#202020]">
                        <td className="py-2.5 px-4 font-semibold text-emerald-400">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 capitalize">{log.resource_type}</td>
                        <td className="py-2.5 px-4 truncate max-w-xs">{log.resource_id || "—"}</td>
                        <td className="py-2.5 px-4 text-neutral-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Management */}
          <div className="p-6 rounded-2xl bg-[#1a1a1a] border border-[#303030] space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-400" />
              User Access & Roles
            </h2>

            <div className="rounded-xl border border-[#2b2b2b] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#242424] text-neutral-400 border-b border-[#2b2b2b]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Username</th>
                    <th className="py-2.5 px-4 font-semibold">Email</th>
                    <th className="py-2.5 px-4 font-semibold">Role</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626] text-neutral-300">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#202020]">
                      <td className="py-2.5 px-4 font-medium text-white">{u.username}</td>
                      <td className="py-2.5 px-4 text-neutral-400">{u.email}</td>
                      <td className="py-2.5 px-4 uppercase text-[11px] font-mono text-emerald-400">
                        {u.role}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.is_active
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-red-950 text-red-400 border border-red-800"
                          }`}
                        >
                          {u.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleUser(u.id)}
                          className="px-2.5 py-1 rounded bg-[#2b2b2b] hover:bg-[#333333] border border-[#383838] text-[11px] text-neutral-200 transition"
                        >
                          {u.is_active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
