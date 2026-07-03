"use client";

import React from "react";

interface HotbarItem {
  id: number;
  name: string;
  color: string;
}

interface HotbarProps {
  activeLayer: string;
  hotbarIndex: number;
  onSelectIndex: (index: number) => void;
  playgroundBlocks: HotbarItem[];
  councilBlocks: HotbarItem[];
}

export function Hotbar({
  activeLayer,
  hotbarIndex,
  onSelectIndex,
  playgroundBlocks,
  councilBlocks
}: HotbarProps) {
  const items = activeLayer === "council" ? councilBlocks : playgroundBlocks;

  return (
    <div 
      className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-2 bg-black/75 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl z-20 pointer-events-auto font-mono"
      onPointerDown={(e) => e.stopPropagation()} 
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => (
        <button
          key={item.id}
          onClick={() => onSelectIndex(idx)}
          className={`w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center relative transition-all cursor-pointer ${
            hotbarIndex === idx 
              ? "bg-white/20 border-urban-blueprint shadow-[0_0_15px_rgba(47,129,247,0.4)] scale-105" 
              : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
          }`}
          title={item.name}
        >
          <div 
            className="w-4 h-4 rounded shadow" 
            style={{ backgroundColor: item.color }} 
          />
          <span className="text-[8px] text-white/40 absolute top-0.5 right-1">{idx + 1}</span>
          <span className="text-[7.5px] text-white font-bold mt-1 truncate max-w-full px-1">{item.name}</span>
        </button>
      ))}
    </div>
  );
}
