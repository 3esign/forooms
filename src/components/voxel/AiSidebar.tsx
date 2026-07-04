"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bot, Sparkles, Key, Eye, EyeOff, Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiSidebarProps {
  currentRole: string;
  isSimulationRunning: boolean;
  onRunSimulation: (provider: string, apiKey: string, depth: string) => void;
  logs: Array<{ timestamp: number; type?: string; message: string }>;
  roomName: string;
  bbox: [number, number, number, number];
  activeLayer: string;
}

export function AiSidebar({
  currentRole,
  isSimulationRunning,
  onRunSimulation,
  logs,
  roomName,
  bbox,
  activeLayer
}: AiSidebarProps) {
  // Personal AI State
  const [personalAiEnabled, setPersonalAiEnabled] = useState(false);
  const [personalProvider, setPersonalProvider] = useState("openrouter");
  const [personalKey, setPersonalKey] = useState("");
  const [showPersonalKey, setShowPersonalKey] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I am your Foroom Design Assistant. Input your API key above to start discussing the room geometry, logs, and edits." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Admin Simulation State
  const [simProvider, setSimProvider] = useState("openrouter");
  const [simKey, setSimKey] = useState("");
  const [showSimKey, setShowSimKey] = useState(false);
  const [simDepth, setSimDepth] = useState("standard"); // light, standard, deep

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load saved keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPersonalKey = localStorage.getItem("personal_ai_key") || "";
      const savedPersonalEnabled = localStorage.getItem("personal_ai_enabled") === "true";
      const savedSimKey = localStorage.getItem("admin_sim_key") || "";
      
      setPersonalKey(savedPersonalKey);
      setPersonalAiEnabled(savedPersonalEnabled);
      setSimKey(savedSimKey);
    }
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSavePersonalKey = (val: string) => {
    setPersonalKey(val);
    localStorage.setItem("personal_ai_key", val);
  };

  const handleSavePersonalEnabled = (val: boolean) => {
    setPersonalAiEnabled(val);
    localStorage.setItem("personal_ai_enabled", val ? "true" : "false");
  };

  const handleSaveSimKey = (val: string) => {
    setSimKey(val);
    localStorage.setItem("admin_sim_key", val);
  };

  // Chat completion logic directly on client side
  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading || !personalKey) return;

    const userText = chatInput.trim();
    setChatInput("");
    
    const newMessages: Message[] = [...chatMessages, { role: "user", content: userText }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
      // Build context of logs, chat, and room properties
      const recentLogsText = logs
        .slice(-30)
        .map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.message}`)
        .join("\n");

      const systemPrompt = `You are a Foroom Voxel Assistant. You help users design 3D city blocks.
Current Foroom: ${roomName}
Bounding Box: [${bbox.join(", ")}]
Recent activity and chats:
${recentLogsText}

Be concise and help the user build their voxel city block. Speak within the context of design and spatial planning.`;

      const requestBody = {
        model: personalProvider === "openrouter" ? "google/gemini-2.5-flash" : "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...newMessages.map(m => ({ role: m.role, content: m.content }))
        ]
      };

      const url = personalProvider === "openrouter" 
        ? "https://openrouter.ai/api/v1/chat/completions" 
        : "https://api.openai.com/v1/chat/completions";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${personalKey}`
      };

      if (personalProvider === "openrouter") {
        headers["HTTP-Referer"] = "https://forooms.vercel.app";
        headers["X-Title"] = "FOROOMS Assistant";
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
      
      setChatMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (err: any) {
      console.error(err);
      setChatMessages([...newMessages, { role: "assistant", content: `Error: ${err.message || "Could not reach AI model. Check your API key."}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const triggerSimulation = () => {
    if (!simKey) {
      alert("Please enter a valid Simulator API Key.");
      return;
    }
    onRunSimulation(simProvider, simKey, simDepth);
  };

  return (
    <div className="absolute top-20 right-6 w-[320px] bottom-6 flex flex-col gap-4 pointer-events-none z-20 font-sans">
      
      {/* Scrollable Container */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pointer-events-auto min-h-0">
        
        {/* Personal AI Assistant Panel */}
        <div className="bg-black/60 border border-urban-concrete/30 rounded-xl overflow-hidden backdrop-blur-md shadow-2xl flex flex-col shrink-0">
          <div className="p-3 border-b border-urban-concrete/20 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-urban-park animate-pulse" />
              <h3 className="text-white text-xs font-bold uppercase tracking-wider">AI Companion</h3>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={personalAiEnabled} 
                onChange={(e) => handleSavePersonalEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-7 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-urban-park"></div>
            </label>
          </div>

          {personalAiEnabled && (
            <div className="p-3 space-y-3">
              {/* Key Config */}
              <div className="space-y-1.5 bg-black/40 p-2.5 rounded-lg border border-white/5">
                <div className="flex items-center justify-between text-xxs font-bold text-urban-concrete uppercase">
                  <span>API Key Config</span>
                  <select 
                    value={personalProvider}
                    onChange={(e) => setPersonalProvider(e.target.value)}
                    className="bg-[#111] border border-white/10 text-[10px] text-white rounded px-1 py-0.5 outline-none cursor-pointer"
                  >
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>
                
                <div className="relative flex items-center">
                  <Key className="w-3.5 h-3.5 text-white/30 absolute left-2" />
                  <input
                    type={showPersonalKey ? "text" : "password"}
                    placeholder="sk-or-..."
                    value={personalKey}
                    onChange={(e) => handleSavePersonalKey(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded pl-7 pr-8 py-1 text-xxs text-white focus:outline-none focus:border-urban-blueprint font-mono"
                  />
                  <button 
                    onClick={() => setShowPersonalKey(!showPersonalKey)}
                    className="absolute right-2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPersonalKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Chat Output */}
              <div className="h-[200px] overflow-y-auto border border-white/5 bg-black/40 rounded-lg p-2 space-y-2 flex flex-col custom-scrollbar text-xxs leading-relaxed">
                {chatMessages.map((m, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2 rounded-lg max-w-[85%] ${
                      m.role === "user" 
                        ? "bg-urban-blueprint/20 border border-urban-blueprint/30 text-white self-end" 
                        : "bg-white/5 border border-white/5 text-white/80 self-start"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-1.5 text-urban-concrete italic self-start bg-white/5 border border-white/5 p-2 rounded-lg">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder={personalKey ? "Ask assistant..." : "Provide API key above first"}
                  disabled={!personalKey || isChatLoading}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleSendChat();
                  }}
                  className="flex-1 bg-[#111] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-urban-blueprint outline-none font-sans"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!personalKey || !chatInput.trim() || isChatLoading}
                  className="p-1.5 bg-urban-park/20 hover:bg-urban-park/35 text-urban-park border border-urban-park/40 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Future Simulator Panel (Admin Only) */}
        {currentRole === "admin" && activeLayer === "simulation" && (
          <div className="bg-black/60 border border-urban-concrete/30 rounded-xl overflow-hidden backdrop-blur-md shadow-2xl flex flex-col shrink-0">
            <div className="p-2.5 border-b border-urban-concrete/20 bg-white/5 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-urban-signal animate-pulse" />
              <h3 className="text-white text-[10px] font-bold uppercase tracking-widest">Future Simulator</h3>
            </div>

            <div className="p-2.5 space-y-3">
              {/* Provider Config */}
              <div className="space-y-1 bg-black/40 p-2 rounded-lg border border-white/5">
                <div className="flex items-center justify-between text-[9px] font-bold text-urban-concrete uppercase tracking-wider">
                  <span>API Key Config</span>
                  <select 
                    value={simProvider}
                    onChange={(e) => setSimProvider(e.target.value)}
                    className="bg-[#111] border border-white/10 text-[9px] text-white rounded px-1 py-0.5 outline-none cursor-pointer"
                  >
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>
                
                <div className="relative flex items-center">
                  <Key className="w-3 h-3 text-white/30 absolute left-2" />
                  <input
                    type={showSimKey ? "text" : "password"}
                    placeholder="sk-or-..."
                    value={simKey}
                    onChange={(e) => handleSaveSimKey(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded pl-6 pr-8 py-0.5 text-[10px] text-white focus:outline-none focus:border-urban-blueprint font-mono"
                  />
                  <button 
                    onClick={() => setShowSimKey(!showSimKey)}
                    className="absolute right-2 text-white/40 hover:text-white transition-colors"
                  >
                    {showSimKey ? <EyeOff className="w-3 h-3" /> : <Key className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Slider for Inference Depth */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[9px] font-bold text-urban-concrete uppercase tracking-wider">
                  <span>Inference depth / Budget</span>
                  <span className="text-urban-signal font-bold uppercase text-[9px]">{simDepth}</span>
                </div>
                
                <div className="flex gap-1.5">
                  {[
                    { id: "light", label: "Light" },
                    { id: "standard", label: "Standard" },
                    { id: "deep", label: "Deep" }
                  ].map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSimDepth(d.id)}
                      className={`flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer border
                        ${simDepth === d.id 
                          ? 'bg-urban-signal/20 border-urban-signal text-urban-signal' 
                          : 'bg-white/5 border-white/5 text-urban-concrete hover:bg-white/10'
                        }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trigger Button */}
              <button
                onClick={triggerSimulation}
                disabled={isSimulationRunning || !simKey}
                className="w-full py-2 bg-urban-signal hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-urban-signal text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.2)] flex items-center justify-center gap-1.5"
              >
                {isSimulationRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Simulating Space...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Run Future Simulation
                  </>
                )}
              </button>

              {isSimulationRunning && (
                <div className="space-y-1">
                  <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                    <div className="bg-urban-signal h-full w-[65%] animate-pulse rounded-full"></div>
                  </div>
                  <p className="text-[9px] text-urban-concrete text-center italic">Projecting 50, 100, and 200 year models...</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
