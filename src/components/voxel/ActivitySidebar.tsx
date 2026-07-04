import React from "react";
import { Users, MessageSquare, ChevronDown, ChevronUp, MessageSquareDashed } from "lucide-react";

interface Player {
  id: string;
  email?: string;
  nick?: string;
  role: string;
  isOnline: boolean;
}

interface Log {
  timestamp: number;
  type?: string;
  message: string;
}

export function ActivitySidebar({ 
  players, 
  logs, 
  onSendChat 
}: { 
  players: Player[]; 
  logs: Log[]; 
  onSendChat?: (message: string) => void; 
}) {
  const [usersCollapsed, setUsersCollapsed] = React.useState(false);
  const [chatMinimized, setChatMinimized] = React.useState(false);

  // Filter only online players
  const onlinePlayers = players.filter(p => p.isOnline);
  
  // Filter only chat messages
  const chatLogs = logs.filter(l => l.type === "chat");

  return (
    <div className="absolute top-20 left-6 w-[280px] bottom-6 flex flex-col gap-4 pointer-events-none z-20">
      
      {/* Online Users Panel */}
      <div className="bg-black/60 border border-urban-concrete/30 rounded-xl overflow-hidden backdrop-blur-md shadow-2xl pointer-events-auto shrink-0">
        <button 
          onClick={() => setUsersCollapsed(!usersCollapsed)}
          className="w-full p-3 border-b border-urban-concrete/20 bg-white/5 flex items-center justify-between gap-2 hover:bg-white/10 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-urban-park" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">Online ({onlinePlayers.length})</h3>
          </div>
          {usersCollapsed ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronUp className="w-4 h-4 text-white/50" />}
        </button>
        
        {!usersCollapsed && (
          <div className="p-3 space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar">
            {onlinePlayers.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-urban-park shadow-[0_0_5px_rgba(45,212,191,0.8)]" />
                <span className="text-white text-sm truncate">{p.nick || p.id.substring(0, 8)}</span>
                {p.role === "admin" && (
                  <span className="ml-auto text-[10px] text-urban-signal border border-urban-signal/30 bg-urban-signal/10 px-1 rounded uppercase font-bold">Admin</span>
                )}
                {p.role === "builder" && (
                  <span className="ml-auto text-[10px] text-urban-blueprint border border-urban-blueprint/30 bg-urban-blueprint/10 px-1 rounded uppercase font-bold">Builder</span>
                )}
              </div>
            ))}
            {onlinePlayers.length === 0 && (
              <div className="text-urban-concrete text-xs italic">No one else is here.</div>
            )}
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <div className={`bg-black/60 border border-urban-concrete/30 rounded-xl overflow-hidden backdrop-blur-md shadow-2xl flex-1 flex flex-col pointer-events-auto min-h-0 transition-all duration-300 ${chatMinimized ? 'h-[46px] flex-none' : ''}`}>
        <button 
          onClick={() => setChatMinimized(!chatMinimized)}
          className="w-full p-3 border-b border-urban-concrete/20 bg-white/5 flex items-center justify-between gap-2 hover:bg-white/10 transition-colors text-left cursor-pointer shrink-0"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-urban-blueprint" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">Chat</h3>
          </div>
          <span className="text-[10px] text-[#888] hover:text-white ml-auto mr-1 font-bold uppercase">
            {chatMinimized ? "Expand" : "Minimize"}
          </span>
          {chatMinimized ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronUp className="w-4 h-4 text-white/50" />}
        </button>

        {!chatMinimized && (
          <>
            <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar flex-1 flex flex-col-reverse min-h-0">
              {/* Reverse logs to show newest at bottom */}
              {[...chatLogs].reverse().slice(0, 50).map((l, i) => {
                const time = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={i} className="text-xs break-words">
                    <span className="text-urban-concrete/60 font-mono mr-2">[{time}]</span>
                    <span className="text-white/90">{l.message}</span>
                  </div>
                );
              })}
              {chatLogs.length === 0 && (
                <div className="text-urban-concrete text-xs italic">No chat messages yet.</div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-2 border-t border-urban-concrete/10 bg-white/5 flex gap-1.5 shrink-0">
              <input
                type="text"
                placeholder="Press Enter to send chat..."
                className="w-full bg-[#111] border border-urban-concrete/20 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-urban-blueprint outline-none font-sans"
                onKeyDown={(e) => {
                  e.stopPropagation(); // prevent player movement on typing
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    onSendChat?.(e.currentTarget.value.trim());
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
