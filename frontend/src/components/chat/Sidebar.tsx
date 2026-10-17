"use client";

import React, { useState, useEffect } from "react";
import Link from "next/navigation";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus,
  MessageSquare,
  Trash2,
  Database,
  Shield,
  Activity,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";
import { authStorage, UserProfile } from "@/lib/auth";

interface SidebarProps {
  currentConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
}

export function Sidebar({
  currentConversationId,
  onSelectConversation,
  onNewChat
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [healthStatus, setHealthStatus] = useState<"healthy" | "degraded" | "offline">("healthy");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const currentUser = authStorage.getUser();
    setUser(currentUser);
    loadConversations();
    checkSystemHealth();
  }, []);

  useEffect(() => {
    loadConversations();
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const data = await api.chat.getConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const checkSystemHealth = async () => {
    try {
      const data = await api.health.check();
      setHealthStatus(data.status === "healthy" ? "healthy" : "degraded");
    } catch {
      setHealthStatus("offline");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat history?")) return;
    try {
      await api.chat.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id && onNewChat) {
        onNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleLogout = () => {
    authStorage.clear();
    router.push("/login");
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      className={`relative flex flex-col h-full bg-[#171717] border-r border-[#2b2b2b] transition-all duration-300 z-20 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#262626]">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
              AI
            </div>
            <span className="font-semibold text-sm tracking-wide text-neutral-100">
              Private Assistant
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#262626] transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={() => {
            if (pathname !== "/") {
              router.push("/");
            } else if (onNewChat) {
              onNewChat();
            }
          }}
          className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-[#262626] hover:bg-[#303030] border border-[#383838] text-sm font-medium text-white shadow-sm transition"
        >
          <Plus className="h-4 w-4 text-emerald-400" />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Search Bar (if expanded) */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md bg-[#212121] border border-[#2e2e2e] py-1.5 pl-8 pr-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>
      )}

      {/* Navigation Sections */}
      {!collapsed && (
        <div className="px-3 py-1 space-y-0.5 border-b border-[#262626] text-xs font-medium text-neutral-400">
          <button
            onClick={() => router.push("/")}
            className={`flex items-center gap-2.5 w-full py-1.5 px-2 rounded-md hover:bg-[#212121] hover:text-white transition ${
              pathname === "/" ? "bg-[#212121] text-emerald-400 font-semibold" : ""
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat Assistant</span>
          </button>
          <button
            onClick={() => router.push("/knowledge")}
            className={`flex items-center gap-2.5 w-full py-1.5 px-2 rounded-md hover:bg-[#212121] hover:text-white transition ${
              pathname === "/knowledge" ? "bg-[#212121] text-emerald-400 font-semibold" : ""
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Knowledge Base</span>
          </button>
          {user?.role === "admin" && (
            <button
              onClick={() => router.push("/admin")}
              className={`flex items-center gap-2.5 w-full py-1.5 px-2 rounded-md hover:bg-[#212121] hover:text-white transition ${
                pathname === "/admin" ? "bg-[#212121] text-emerald-400 font-semibold" : ""
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Admin & Diagnostics</span>
            </button>
          )}
        </div>
      )}

      {/* Conversation History List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {!collapsed && (
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Recent Chats
          </div>
        )}
        {filteredConversations.length === 0 ? (
          !collapsed && (
            <div className="px-2 py-4 text-center text-xs text-neutral-500">
              No conversations yet
            </div>
          )
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = currentConversationId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => {
                  if (pathname !== "/") {
                    router.push(`/?id=${conv.id}`);
                  } else if (onSelectConversation) {
                    onSelectConversation(conv.id);
                  }
                }}
                className={`group flex items-center justify-between w-full px-2.5 py-2 rounded-lg cursor-pointer text-xs transition ${
                  isSelected
                    ? "bg-[#282828] text-white font-medium border border-[#383838]"
                    : "text-neutral-400 hover:bg-[#212121] hover:text-neutral-200"
                }`}
                title={conv.title}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  {!collapsed && (
                    <span className="truncate">{conv.title}</span>
                  )}
                </div>
                {!collapsed && (
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 transition"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom User Profile & Status */}
      <div className="p-3 border-t border-[#262626] bg-[#141414]">
        {/* Health status badge */}
        {!collapsed && (
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#242424] text-[11px]">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  healthStatus === "healthy"
                    ? "bg-emerald-500 animate-pulse"
                    : healthStatus === "degraded"
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
              />
              System Status
            </span>
            <span
              className={`font-medium capitalize ${
                healthStatus === "healthy"
                  ? "text-emerald-400"
                  : healthStatus === "degraded"
                  ? "text-amber-400"
                  : "text-red-400"
              }`}
            >
              {healthStatus}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-semibold text-neutral-200 shrink-0">
              {user?.username?.[0]?.toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-xs font-medium text-neutral-200 truncate">
                  {user?.username || "Operator"}
                </div>
                <div className="text-[10px] text-neutral-500 capitalize">
                  {user?.role || "user"}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-[#262626] transition shrink-0"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
