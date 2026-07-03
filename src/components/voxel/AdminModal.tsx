"use client";

import React from "react";
import { Settings, X } from "lucide-react";

interface PlayerData {
  id: string;
  email: string;
  role: string;
}

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerData[];
  onChangeRole: (targetId: string, newRole: string) => void;
  onClearRoom: () => void;
}

export function AdminModal({
  isOpen,
  onClose,
  players,
  onChangeRole,
  onClearRoom
}: AdminModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-auto p-4">
      <div className="bg-[#111111] border border-[#333] p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-urban-brick" />
            Foroom Admin Dashboard
          </h2>
          <button onClick={onClose} className="text-[#888] hover:text-white transition-colors cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <h3 className="text-sm uppercase tracking-widest text-urban-concrete font-bold border-b border-[#333] pb-2">Connected Users</h3>
          {players.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-[#1C1C1C] p-3 rounded-xl border border-[#333]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-urban-blueprint/20 flex items-center justify-center text-urban-blueprint font-bold">
                  {p.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-white text-sm font-bold">{p.email}</div>
                  <div className="text-xs text-[#888]">ID: {p.id.substring(0, 8)}...</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <select
                  value={p.role}
                  onChange={(e) => onChangeRole(p.id, e.target.value)}
                  className="bg-[#111] border border-[#333] text-white text-xs rounded-lg px-2 py-1.5 focus:border-urban-blueprint outline-none cursor-pointer"
                >
                  <option value="guest">Guest (View Only)</option>
                  <option value="builder">Builder (Can Edit)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>
            </div>
          ))}
          
          {players.length === 0 && (
            <div className="text-center text-[#888] text-sm py-8 italic">No users currently connected.</div>
          )}

          <div className="border-t border-[#333] pt-4 mt-6 flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-red-500">Danger Zone</h4>
              <p className="text-xs text-[#888]">Reset this Foroom to its original layout and delete all notes.</p>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear all blocks and notes from this Foroom? This cannot be undone.")) {
                  onClearRoom();
                }
              }}
              className="bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer"
            >
              Clear Layout & Notes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
