"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, ShieldAlert } from "lucide-react";

interface InteractTarget {
  x: number;
  y: number;
  z: number;
}

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  interactTarget: InteractTarget | null;
  isEditingInfo: boolean;
  setIsEditingInfo: (editing: boolean) => void;
  infoText: string;
  onSaveInfo: (newText: string) => void;
  role: string;
}

function parseComments(text: string): string[] {
  try {
    if (text.startsWith("[") && text.endsWith("]")) {
      return JSON.parse(text);
    }
  } catch (e) {}
  return text ? [text] : [];
}

export function InfoModal({
  isOpen,
  onClose,
  interactTarget,
  isEditingInfo,
  setIsEditingInfo,
  infoText,
  onSaveInfo,
  role
}: InfoModalProps) {
  const [comments, setComments] = useState<string[]>([]);
  const [descInput, setDescInput] = useState("");
  const [commentInput, setCommentInput] = useState("");

  useEffect(() => {
    const parsed = parseComments(infoText);
    setComments(parsed);
    setDescInput(parsed[0] || "");
  }, [infoText, isOpen]);

  if (!isOpen || !interactTarget) return null;

  const handleSaveDescription = () => {
    if (!descInput.trim()) return;
    const updated = [...comments];
    if (updated.length === 0) {
      updated.push(descInput);
    } else {
      updated[0] = descInput;
    }
    onSaveInfo(JSON.stringify(updated));
    setIsEditingInfo(false);
  };

  const handleAddComment = () => {
    if (!commentInput.trim() || comments.length >= 10) return;
    const updated = [...comments, commentInput.trim()];
    onSaveInfo(JSON.stringify(updated));
    setCommentInput("");
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto font-mono">
      <div className="bg-[#111111] border border-[#333] rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-4 border-b border-[#333] pb-3">
          <h3 className="text-white font-bold tracking-wider flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-urban-park" />
            Marker Information 
            <span className="text-[#888] text-xs font-normal">({interactTarget.x}, {interactTarget.y}, {interactTarget.z})</span>
          </h3>
          <button onClick={onClose} className="text-[#888] hover:text-white cursor-pointer bg-transparent border-0 text-lg">✕</button>
        </div>
        
        {isEditingInfo || comments.length === 0 ? (
          <div className="space-y-4">
            <label className="text-xs text-[#888] uppercase font-bold">Main Description / Topic</label>
            <textarea 
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              placeholder="Write the main description for this marker..."
              className="w-full h-32 bg-[#1C1C1C] border border-[#333] rounded-xl p-3 text-white text-sm focus:border-urban-park outline-none resize-none custom-scrollbar"
            />
            <div className="flex justify-end gap-2">
              {comments.length > 0 && (
                <button onClick={() => setIsEditingInfo(false)} className="px-4 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all text-xs font-bold uppercase cursor-pointer">Cancel</button>
              )}
              <button 
                onClick={handleSaveDescription} 
                disabled={!descInput.trim()}
                className="px-4 py-2 rounded-xl bg-urban-park hover:bg-urban-park/90 text-[#111] disabled:opacity-50 font-bold transition-all text-xs uppercase cursor-pointer"
              >
                Save Description
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            
            {/* Scrollable Thread */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar min-h-0">
              {/* Main Topic */}
              <div className="bg-urban-park/5 border border-urban-park/20 p-4 rounded-xl">
                <div className="text-[10px] text-urban-park font-bold uppercase tracking-wider mb-1">Main Topic</div>
                <div className="text-white text-sm whitespace-pre-wrap">{comments[0]}</div>
              </div>

              {/* Comment Bubble Thread */}
              {comments.length > 1 && (
                <div className="space-y-2.5">
                  <div className="text-[10px] text-[#888] font-bold uppercase tracking-wider px-1">Inputs & Comments ({comments.length - 1})</div>
                  {comments.slice(1).map((c, i) => (
                    <div key={i} className="bg-[#1C1C1C] border border-[#2A2A2A] p-3.5 rounded-xl text-white/95 text-xs whitespace-pre-wrap relative shadow-sm">
                      <div className="text-[9px] text-[#555] font-bold uppercase mb-1">Input #{i+1}</div>
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input Form at Bottom */}
            {role !== "guest" && (
              <div className="border-t border-[#333] pt-4 space-y-3">
                {comments.length < 10 ? (
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Add your comment/input..."
                      className="bg-[#1C1C1C] border border-[#333] text-white text-xs rounded-xl px-4 py-3 flex-1 focus:border-urban-park outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddComment();
                      }}
                    />
                    <button 
                      onClick={handleAddComment}
                      disabled={!commentInput.trim()}
                      className="bg-urban-park hover:bg-urban-park/90 text-[#111] disabled:opacity-50 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center"
                    >
                      Post
                    </button>
                  </div>
                ) : (
                  <div className="bg-yellow-950/20 border border-yellow-700/30 p-3 rounded-xl flex items-center gap-2 text-yellow-500 text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Input capacity reached (Max 10 inputs).</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#555] uppercase">Capacity: {comments.length} / 10</span>
                  <button 
                    onClick={() => setIsEditingInfo(true)} 
                    className="text-xs text-urban-park/70 hover:text-urban-park transition-all font-bold uppercase cursor-pointer"
                  >
                    Edit Description
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
