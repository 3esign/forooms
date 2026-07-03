import React, { useState } from "react";
import { X, Save, Sun, CloudFog } from "lucide-react";

export interface ForoomAppearance {
  sunElevation: number;
  turbidity: number;
  rayleigh: number;
  fogColor: string;
  fogDensity: number;
}

export const DEFAULT_APPEARANCE: ForoomAppearance = {
  sunElevation: 50,
  turbidity: 1.5,
  rayleigh: 1.5,
  fogColor: "#cbd5e1",
  fogDensity: 0.008,
};

interface AdminAppearancePanelProps {
  isOpen: boolean;
  onClose: () => void;
  appearance: ForoomAppearance;
  onChange: (app: ForoomAppearance) => void;
}

export function AdminAppearancePanel({ isOpen, onClose, appearance, onChange }: AdminAppearancePanelProps) {
  const [localApp, setLocalApp] = useState<ForoomAppearance>(appearance);

  if (!isOpen) return null;

  const handleApply = () => {
    onChange(localApp);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-auto font-mono">
      <div className="bg-[#1C1C1C] border border-[#333333] p-6 rounded-2xl w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
          <Sun className="w-5 h-5 text-urban-park" />
          Appearance Settings
        </h2>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-urban-park text-sm font-bold uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
              <Sun className="w-4 h-4" /> Sky & Sun
            </h3>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60 uppercase">Sun Elevation ({localApp.sunElevation})</label>
              <input 
                type="range" min="0" max="200" step="5"
                value={localApp.sunElevation}
                onChange={(e) => setLocalApp({ ...localApp, sunElevation: Number(e.target.value) })}
                className="w-full accent-urban-park"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60 uppercase">Turbidity ({localApp.turbidity})</label>
              <input 
                type="range" min="0" max="10" step="0.1"
                value={localApp.turbidity}
                onChange={(e) => setLocalApp({ ...localApp, turbidity: Number(e.target.value) })}
                className="w-full accent-urban-park"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60 uppercase">Rayleigh ({localApp.rayleigh})</label>
              <input 
                type="range" min="0" max="4" step="0.1"
                value={localApp.rayleigh}
                onChange={(e) => setLocalApp({ ...localApp, rayleigh: Number(e.target.value) })}
                className="w-full accent-urban-park"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-urban-park text-sm font-bold uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
              <CloudFog className="w-4 h-4" /> Atmosphere
            </h3>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60 uppercase">Fog Density ({localApp.fogDensity.toFixed(4)})</label>
              <input 
                type="range" min="0" max="0.02" step="0.0005"
                value={localApp.fogDensity}
                onChange={(e) => setLocalApp({ ...localApp, fogDensity: Number(e.target.value) })}
                className="w-full accent-urban-park"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60 uppercase">Fog Color</label>
              <div className="flex gap-2">
                <input 
                  type="color"
                  value={localApp.fogColor}
                  onChange={(e) => setLocalApp({ ...localApp, fogColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <input 
                  type="text"
                  value={localApp.fogColor}
                  onChange={(e) => setLocalApp({ ...localApp, fogColor: e.target.value })}
                  className="bg-black/40 border border-white/20 text-white px-3 py-2 rounded flex-1 text-sm outline-none focus:border-urban-park"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={() => setLocalApp(DEFAULT_APPEARANCE)}
            className="flex-1 bg-[#2A2A2A] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[#333333] transition-colors"
          >
            Reset Default
          </button>
          <button 
            onClick={handleApply}
            className="flex-1 bg-urban-park text-[#111] py-3 rounded-xl font-bold uppercase text-xs hover:bg-urban-park/90 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Apply to Room
          </button>
        </div>

      </div>
    </div>
  );
}
