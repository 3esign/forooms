import React from "react";
import { HardHat, Landmark, MonitorPlay } from "lucide-react";

export type LayerType = "playground" | "council" | "simulation";

interface LayerSwitcherProps {
  activeLayer: LayerType;
  onChange: (layer: LayerType) => void;
  role: "guest" | "builder" | "admin";
}

export function LayerSwitcher({ activeLayer, onChange, role }: LayerSwitcherProps) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.5)] z-20 pointer-events-auto">
      
      <button 
        onClick={() => onChange("playground")}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all ${activeLayer === "playground" ? "bg-white text-black shadow-lg" : "text-urban-concrete hover:text-white hover:bg-white/10"}`}
      >
        <HardHat className="w-4 h-4" />
        PLAYGROUND
      </button>

      <button 
        onClick={() => onChange("council")}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all ${activeLayer === "council" ? "bg-white text-black shadow-lg" : "text-urban-concrete hover:text-white hover:bg-white/10"}`}
      >
        <Landmark className="w-4 h-4" />
        COUNCIL
      </button>

      <button 
        onClick={() => onChange("simulation")}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all ${activeLayer === "simulation" ? "bg-white text-black shadow-lg" : "text-urban-concrete hover:text-white hover:bg-white/10"}`}
      >
        <MonitorPlay className="w-4 h-4" />
        SIMULATION
      </button>
      
    </div>
  );
}
