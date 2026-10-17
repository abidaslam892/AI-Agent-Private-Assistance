"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Square,
  Sparkles,
  Paperclip,
  Copy,
  Check,
  RotateCcw,
  Bot,
  User,
  Shield,
  FileText,
  AlertCircle
} from "lucide-react";
import { CitationCard } from "./CitationCard";
import { streamChatMessage, Citation } from "@/lib/sse";
import { api } from "@/lib/api";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

interface ChatAreaProps {
  conversationId: string | null;
  onConversationCreated?: (id: string) => void;
}

export function ChatArea({ conversationId, onConversationCreated }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeModel, setActiveModel] = useState("llama3.1:8b");

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipLoadForIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusMessage]);

  // Load existing conversation messages
  useEffect(() => {
    if (conversationId) {
      if (skipLoadForIdRef.current === conversationId) {
        skipLoadForIdRef.current = null;
        return;
      }
      loadConversationMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const loadConversationMessages = async (id: string) => {
    try {
      const data = await api.chat.getConversation(id);
      if (data && data.messages) {
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.citations || [],
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load conversation messages:", err);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isStreaming) return;

    setInput("");
    setStatusMessage(null);

    let currentConvId = conversationId;

    // If no active conversation, create one first
    if (!currentConvId) {
      try {
        const title = textToSend.slice(0, 35) + (textToSend.length > 35 ? "..." : "");
        const newConv = await api.chat.createConversation(title);
        currentConvId = newConv.id;
        skipLoadForIdRef.current = newConv.id;
        if (onConversationCreated && currentConvId) {
          onConversationCreated(currentConvId);
        }
      } catch (err) {
        console.error("Failed to create conversation:", err);
        return;
      }
    }

    if (!currentConvId) return;

    // Add user message to UI
    const userMsg: Message = { role: "user", content: textToSend };
    const assistantMsgPlaceholder: Message = {
      role: "assistant",
      content: "",
      citations: [],
      isStreaming: true
    };

    setMessages(prev => [...prev, userMsg, assistantMsgPlaceholder]);
    setIsStreaming(true);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    let accumulatedContent = "";
    let capturedCitations: Citation[] = [];

    await streamChatMessage(
      currentConvId,
      textToSend,
      {
        onToken: (token) => {
          accumulatedContent += token;
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              last.content = accumulatedContent;
            }
            return next;
          });
        },
        onCitations: (citations) => {
          capturedCitations = citations;
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              last.citations = citations;
            }
            return next;
          });
        },
        onStatus: (status) => {
          setStatusMessage(status);
        },
        onError: (err) => {
          setStatusMessage(`Error: ${err}`);
          setIsStreaming(false);
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              last.isStreaming = false;
              if (!last.content) {
                last.content = `[Generation failed: ${err}]`;
              }
            }
            return next;
          });
        },
        onDone: (msgId) => {
          setIsStreaming(false);
          setStatusMessage(null);
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              last.id = msgId;
              last.isStreaming = false;
              last.citations = capturedCitations;
            }
            return next;
          });
        }
      },
      abortCtrl.signal
    );
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStatusMessage("Generation stopped by user.");
    }
  };

  const handleCopy = (content: string, id?: string) => {
    navigator.clipboard.writeText(content);
    const key = id || "current";
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      await api.documents.upload(file);
      alert(`File "${file.name}" uploaded successfully! Document ingestion and vector embedding started in background.`);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exampleQuestions = [
    "What is the current health status of the BSS and OCS platforms?",
    "Which services are experiencing abnormal latency or error rates?",
    "Summarize the root cause analysis and investigation steps from the logs.",
    "Which system resources are approaching their configured capacity limits?"
  ];

  return (
    <div className="flex flex-col flex-1 h-full bg-[#212121] overflow-hidden relative">
      {/* Top Bar */}
      <header className="h-14 border-b border-[#2e2e2e] flex items-center justify-between px-6 bg-[#212121]/95 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-neutral-200">Model:</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2b2b2b] border border-[#383838] text-xs font-mono text-emerald-400">
            <Bot className="h-3.5 w-3.5" />
            <span>{activeModel}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-neutral-800 text-neutral-400 border border-neutral-700">
            <span>Embed: nomic-embed-text (768d)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
          <span className="hidden md:inline">Air-Gapped & Private Vector Storage</span>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-12 text-center space-y-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Enterprise AI Knowledge Assistant
              </h2>
              <p className="text-sm text-neutral-400 mt-2 max-w-md mx-auto">
                Ask questions answered strictly using uploaded organizational documents and pgvector semantic retrieval.
              </p>
            </div>

            {/* Suggested Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
              {exampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  className="p-3 rounded-xl bg-[#282828] hover:bg-[#303030] border border-[#333333] hover:border-emerald-500/40 text-xs text-neutral-200 transition space-y-1"
                >
                  <div className="font-medium text-emerald-400">Prompt</div>
                  <div className="text-neutral-300 line-clamp-2">{q}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={index}
                  className={`flex gap-3 text-sm ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-3 max-w-[85%] ${
                      isUser
                        ? "bg-[#2f2f2f] text-white border border-[#383838]"
                        : "bg-[#282828] text-neutral-100 border border-[#333333]"
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    ) : (
                      <div className="prose">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                        {msg.isStreaming && (
                          <span className="inline-block h-3.5 w-1.5 ml-1 bg-emerald-400 animate-pulse" />
                        )}
                      </div>
                    )}

                    {/* Citations Card */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <CitationCard citations={msg.citations} />
                    )}

                    {/* Assistant message action buttons */}
                    {!isUser && !msg.isStreaming && msg.content && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#333333] text-xs text-neutral-400">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id || String(index))}
                          className="flex items-center gap-1 hover:text-white transition"
                        >
                          {copiedId === (msg.id || String(index)) ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="h-7 w-7 rounded-lg bg-neutral-700 flex items-center justify-center text-white shrink-0 mt-0.5">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Status indicator during search / inference */}
            {statusMessage && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-lg max-w-fit">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-[#212121] border-t border-[#2e2e2e]">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center rounded-2xl bg-[#2f2f2f] border border-[#3b3b3b] shadow-lg focus-within:border-emerald-500/70 transition">
            {/* File attachment upload trigger */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              className="p-3 text-neutral-400 hover:text-white transition disabled:opacity-50"
              title="Upload document to knowledge base (.pdf, .docx, .txt, .csv, .xlsx)"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything about your documents or telecom operational health..."
              rows={1}
              className="flex-1 bg-transparent py-3 text-sm text-white placeholder-neutral-400 focus:outline-none resize-none max-h-36 overflow-y-auto"
            />

            {/* Send or Stop button */}
            <div className="p-2">
              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition"
                  title="Stop generating"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition"
                  title="Send question"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-2 px-1">
            <span>Powered by Ollama + pgvector (Zero external data transmission)</span>
            <span>Press Enter to send, Shift + Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}
