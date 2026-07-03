import React from "react";
import { MapPin, ArrowRight, X } from "lucide-react";

interface MarkersDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  infoBlocks: Record<string, string>;
  onTeleport: (x: number, y: number, z: number) => void;
}

export function MarkersDashboardModal({ isOpen, onClose, infoBlocks, onTeleport }: MarkersDashboardModalProps) {
  if (!isOpen) return null;

  const markers = Object.entries(infoBlocks).map(([key, text]) => {
    const [x, y, z] = key.split(",").map(Number);
    let comments: string[] = [];
    try {
      if (text.startsWith("[") && text.endsWith("]")) {
        comments = JSON.parse(text);
      } else {
        comments = text ? [text] : [];
      }
    } catch (e) {
      comments = text ? [text] : [];
    }

    return {
      x, y, z,
      key,
      title: comments[0] || "No Description",
      commentCount: comments.length
    };
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-auto p-4 font-mono">
      <div className="bg-[#111111] border border-[#333] p-6 rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#888] hover:text-white transition-colors cursor-pointer bg-transparent border-0">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
          <MapPin className="w-5 h-5 text-urban-park" />
          Marker Dashboard
        </h2>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {markers.map(m => (
            <div key={m.key} className="flex items-center justify-between bg-[#1C1C1C] p-4 rounded-xl border border-[#333] hover:border-urban-park/30 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-urban-park/10 flex items-center justify-center text-urban-park">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white text-sm font-bold truncate max-w-[280px]">{m.title}</div>
                  <div className="text-xs text-[#888] mt-1 flex gap-3">
                    <span>{m.x}, {m.y}, {m.z}</span>
                    <span>•</span>
                    <span>{m.commentCount} {m.commentCount === 1 ? 'input' : 'inputs'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  onTeleport(m.x, m.y, m.z);
                  onClose();
                }}
                className="bg-urban-park/20 hover:bg-urban-park/40 text-urban-park border border-urban-park/30 px-3 py-2 rounded-xl text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                Go to
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}

          {markers.length === 0 && (
            <div className="text-center text-[#888] text-sm py-12 italic">
              No markers placed yet. Right-click on the ground in Council mode to place one!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
