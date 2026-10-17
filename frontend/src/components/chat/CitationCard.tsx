"use client";

import React, { useState } from "react";
import { Citation } from "@/lib/sse";
import { FileText, ExternalLink, ChevronDown, ChevronUp, BookOpen, Check } from "lucide-react";

interface CitationCardProps {
  citations: Citation[];
}

export function CitationCard({ citations }: CitationCardProps) {
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-[#333333]">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Verified Sources & Citations ({citations.length})</span>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          {citations.map((c, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedCitation(c)}
              className="p-2.5 rounded-lg bg-[#1e1e1e] border border-[#2e2e2e] hover:border-emerald-500/50 hover:bg-[#252525] cursor-pointer transition text-xs"
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 font-medium text-neutral-200 truncate">
                  <FileText className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{c.document_name}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/50 font-mono shrink-0">
                  {Math.round(c.score * 100)}% match
                </span>
              </div>

              <div className="text-[11px] text-neutral-400 flex items-center gap-2 mb-1">
                {c.page_number && <span>Page {c.page_number}</span>}
                {c.section && <span className="truncate">• {c.section}</span>}
              </div>

              <p className="text-[11px] text-neutral-300 line-clamp-2 italic bg-[#171717] p-1.5 rounded border border-[#2a2a2a]">
                "{c.snippet}"
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal to view full citation chunk */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl bg-[#212121] border border-[#383838] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-[#303030] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    {selectedCitation.document_name}
                  </h3>
                  <div className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5">
                    {selectedCitation.page_number && <span>Page {selectedCitation.page_number}</span>}
                    {selectedCitation.section && <span>• {selectedCitation.section}</span>}
                    <span className="text-emerald-400 font-mono">• Score: {selectedCitation.score}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCitation(null)}
                className="text-neutral-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#181818] rounded-lg p-3.5 border border-[#2c2c2c] max-h-80 overflow-y-auto text-xs text-neutral-200 leading-relaxed font-mono whitespace-pre-wrap">
              {selectedCitation.snippet}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedCitation(null)}
                className="px-4 py-1.5 rounded-lg bg-[#303030] hover:bg-[#3a3a3a] text-xs font-medium text-white transition"
              >
                Close Citation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
