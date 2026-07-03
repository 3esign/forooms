"use client";

import React, { useState } from "react";
import { Search, FileText } from "lucide-react";

interface Log {
  timestamp: number;
  type: string;
  message: string;
}

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: Log[];
}

export function ActivityLogModal({ isOpen, onClose, logs }: ActivityLogModalProps) {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  // Filter out chat logs and apply search filter
  const activityLogs = logs
    .filter(l => l.type !== "chat")
    .filter(l => l.message.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-auto font-mono">
      <div className="bg-[#111] border border-[#333] p-6 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b border-[#333] pb-3 shrink-0">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-5 h-5 text-urban-signal" />
            Activity Log <span className="text-[#888] text-xs">({activityLogs.length} events)</span>
          </h2>
          <button onClick={onClose} className="text-[#888] hover:text-white transition-colors cursor-pointer bg-transparent border-0 text-lg">✕</button>
        </div>

        {/* Search Filter */}
        <div className="relative mb-4 shrink-0">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search activity events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1C1C1C] border border-[#333] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-urban-signal outline-none"
          />
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 custom-scrollbar min-h-0">
          {activityLogs.length > 0 ? (
            activityLogs.map((log, i) => {
              const time = new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
              const date = new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
              
              // Styling based on log category
              let tagColor = "text-gray-400 bg-gray-950/40 border-gray-800";
              if (log.type === "info") tagColor = "text-urban-park bg-urban-park/5 border-urban-park/20";
              if (log.type === "edit") tagColor = "text-urban-blueprint bg-urban-blueprint/5 border-urban-blueprint/20";
              if (log.type === "role_change") tagColor = "text-yellow-500 bg-yellow-950/10 border-yellow-800/30";
              if (log.type === "clear") tagColor = "text-red-500 bg-red-950/10 border-red-800/30";

              return (
                <div key={i} className="bg-[#1C1C1C] border border-[#222] rounded-xl p-3.5 flex gap-3 text-xs items-start">
                  <div className="shrink-0 font-mono text-[10px] text-[#666] text-right mt-0.5">
                    <div>{date}</div>
                    <div>{time}</div>
                  </div>
                  <div className="flex-1 text-white/90 leading-relaxed">
                    {log.message}
                  </div>
                  <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded border ${tagColor} shrink-0 mt-0.5 font-bold`}>
                    {log.type}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-[#666] italic text-xs">
              No matching activity events found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[#333] flex justify-end shrink-0">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all text-xs font-bold uppercase cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
