import React, { useState, useEffect } from "react";

export interface LoadingOverlayProps {
  status: "idle" | "fetching" | "projecting" | "rasterizing" | "completed" | "error";
  stats: { buildings: number; roads: number; grass: number; buildingVoxels: number; vegetation: number };
  error: string | null;
  onFadeComplete: () => void;
  onExit: () => void;
}

export function LoadingOverlay({ status, stats, error, onFadeComplete, onExit }: LoadingOverlayProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [shouldFadeOut, setShouldFadeOut] = useState(false);

  useEffect(() => {
    const timestamp = () => new Date().toISOString().split("T")[1].slice(0, 8);
    
    if (status === "fetching") {
      setLogs([
        `[${timestamp()}] [DATA] Fetching building footprints & major roads...`
      ]);
    } else if (status === "projecting") {
      setLogs(prev => [
        ...prev, 
        `[${timestamp()}] [DATA] Footprints and highway vectors downloaded successfully.`,
        `[${timestamp()}] [DATA] Constructing 2D City Blueprint...`
      ]);
    } else if (status === "rasterizing") {
      setLogs(prev => [
        ...prev, 
        `[${timestamp()}] [RENDER] Rasterizing building footprint polygons...`,
        `[${timestamp()}] [RENDER] Painting stone roads onto baseline grid...`,
        `[${timestamp()}] [AI] Intelligence council formulating ecology & foliage pass...`
      ]);
    } else if (status === "completed") {
      setLogs(prev => [
        ...prev,
        `[${timestamp()}] [DATA] Loaded ${stats.buildings} OSM building footprints.`,
        `[${timestamp()}] [RENDER] Painted ${stats.roads} road blocks, extruded ${stats.buildingVoxels} building voxels.`,
        `[${timestamp()}] [READY] Voxel twin synchronized.`
      ]);
      const t = setTimeout(() => {
        setShouldFadeOut(true);
        setTimeout(onFadeComplete, 500);
      }, 1200);
      return () => clearTimeout(t);
    } else if (status === "error" && error) {
      setLogs(prev => [
        ...prev,
        `[${timestamp()}] [ERROR] ${error}`,
      ]);
    }
  }, [status, stats, error, onFadeComplete]);

  const progressMap = {
    idle: 0,
    fetching: 25,
    projecting: 50,
    rasterizing: 75,
    completed: 100,
    error: 100,
  };
  const pct = progressMap[status] || 0;

  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1117] text-urban-concrete font-mono text-sm transition-opacity duration-500 ${shouldFadeOut ? "opacity-0" : "opacity-100"}`}>
      <div className="w-[620px] max-w-[95%] bg-black/50 p-6 rounded-lg border border-urban-concrete/20 shadow-2xl backdrop-blur-md">
        <h2 className="text-white text-md tracking-widest font-semibold mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status === "error" ? "bg-urban-brick" : "bg-urban-signal animate-pulse"}`} />
            {status === "error" ? "OSM LOAD FAILED" : "SYNCHRONIZING FOROOM BLUEPRINT"}
          </span>
          <span className="text-xs text-urban-blueprint">{pct}%</span>
        </h2>
        
        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-5">
          <div 
            className="bg-urban-blueprint h-full transition-all duration-300 ease-out" 
            style={{ width: `${pct}%` }} 
          />
        </div>

        <div className="h-[200px] overflow-y-auto flex flex-col justify-end text-xs leading-relaxed">
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${log.includes('[READY]') ? 'text-urban-blueprint font-bold' : log.includes('[AI]') ? 'text-urban-signal' : ''}`}>
              {log}
            </div>
          ))}
          <div className="animate-pulse mt-1 opacity-50 text-urban-blueprint">_</div>
        </div>

        {status === "error" && (
          <button
            onClick={onExit}
            className="mt-4 w-full py-2 rounded bg-urban-brick/20 border border-urban-brick/40 text-white text-xs uppercase tracking-wider hover:bg-urban-brick/30"
          >
            Back to Map
          </button>
        )}
      </div>
    </div>
  );
}
