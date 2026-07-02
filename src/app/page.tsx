"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Layers, Box, Cpu, ChevronRight, Lock } from "lucide-react";
import { normalizeBbox } from "../lib/osm";
import usePartySocket from "partysocket/react";
import { AccessRequest, AuthResponse } from "../../party/auth";

// Dynamically import Map so it only renders on client
const Map = dynamic(() => import("../components/Map"), { ssr: false });
const VoxelCanvas = dynamic(() => import("../components/voxel"), { ssr: false });

export default function Home() {
  const [selectedBbox, setSelectedBbox] = useState<[number, number, number, number] | null>(null);
  const [isVoxelMode, setIsVoxelMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(13);
  const [isSearching, setIsSearching] = useState(false);

  // Prefetch states
  const [prefetchStatus, setPrefetchStatus] = useState<"idle" | "fetching" | "completed" | "error">("idle");
  const [prefetchStats, setPrefetchStats] = useState<{ buildings: number; roads: number } | null>(null);

  // Auth States
  const [authStatus, setAuthStatus] = useState<AccessRequest | null>(null);
  const [requestName, setRequestName] = useState("");

  const socket = usePartySocket({
    room: "admin-auth",
    party: "auth",
    onMessage: (e) => {
      try {
        const msg = JSON.parse(e.data) as AuthResponse;
        if (msg.type === "access_status") {
          setAuthStatus(msg.payload);
        }
      } catch (err) {}
    }
  });

  const handleRequestAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestName) return;
    socket.send(JSON.stringify({ type: "request_access", payload: { name: requestName } }));
  };

  const handleBboxSelect = (bbox: [number, number, number, number] | null) => {
    setSelectedBbox(bbox);
    setPrefetchStatus("idle");
    setPrefetchStats(null);
  };

  const handlePrefetch = async () => {
    if (!selectedBbox) return;
    setPrefetchStatus("fetching");
    try {
      const [w, s, e, n] = normalizeBbox(selectedBbox);
      const res = await fetch(`/api/osm?w=${w}&s=${s}&e=${e}&n=${n}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setPrefetchStats({
        buildings: data.buildings.length,
        roads: data.roads.length
      });
      setPrefetchStatus("completed");
    } catch (err) {
      console.error(err);
      setPrefetchStatus("error");
    }
  };

  const handleCreateForoom = () => {
    if (!selectedBbox) return;
    setIsVoxelMode(true);
  };

  const handleExitForoom = () => {
    setIsVoxelMode(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        setMapCenter([parseFloat(item.lon), parseFloat(item.lat)]);
        setMapZoom(14);
      } else {
        alert("Location not found. Try adding a city name.");
      }
    } catch (err) {
      console.error(err);
      alert("Error searching location.");
    } finally {
      setIsSearching(false);
    }
  };

  if (isVoxelMode && selectedBbox) {
    return (
      <main className="w-screen h-screen overflow-hidden bg-background">
        <VoxelCanvas bbox={selectedBbox} onExit={handleExitForoom} />
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* LEFT: MapLibre Macro View */}
      <section className="relative w-2/3 h-full border-r border-urban-concrete/20">
        <Map onBoundingBoxSelect={handleBboxSelect} center={mapCenter} zoom={mapZoom} />
        
        {/* Map Overlay HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <h1 className="text-4xl font-bold tracking-tighter text-white drop-shadow-md">FOROOMS</h1>
          <p className="text-urban-concrete text-sm font-mono mt-1 drop-shadow">INSTITUTE FOR APPLIED DESIGN INTELLIGENCE</p>
        </div>

        <div className="absolute bottom-6 left-6 pointer-events-none bg-background/80 backdrop-blur-md p-4 rounded-lg border border-urban-concrete/20">
          <h3 className="text-sm font-semibold text-white mb-2 uppercase tracking-widest">Controls</h3>
          <p className="text-xs text-urban-concrete">
            <kbd className="bg-white/10 px-2 py-1 rounded text-white mr-2">Shift + Drag</kbd>
            Select Urban Bounding Box. Shift + Drag again to redraw.
          </p>
        </div>
      </section>

      {/* RIGHT: Dashboard & Server Context */}
      <section className="w-1/3 h-full flex flex-col bg-background p-8 overflow-y-auto">
        <header className="mb-12">
          <h2 className="text-2xl font-semibold mb-2">Digital Twin Broker</h2>
          <p className="text-sm text-urban-concrete leading-relaxed">
            Select an urban region on the map to instantiate a deterministic voxel twin. 
            Modifications are persisted synchronously via edge web-sockets.
          </p>
        </header>

        {/* Search Bar Form */}
        <form onSubmit={handleSearch} className="mb-8 flex gap-2">
          <input
            type="text"
            placeholder="Search city, neighborhood..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-white/5 border border-urban-concrete/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-urban-concrete focus:outline-none focus:border-urban-blueprint transition-all"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="bg-urban-blueprint/20 border border-urban-blueprint/40 hover:border-urban-blueprint hover:bg-urban-blueprint/30 text-white rounded-xl px-5 py-3 text-sm font-semibold font-mono uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isSearching ? "..." : "Go"}
          </button>
        </form>

        {/* Selected Region Status */}
        <div className={`p-6 rounded-xl border transition-all duration-300 ${selectedBbox ? 'border-urban-blueprint bg-urban-blueprint/5' : 'border-urban-concrete/20 bg-white/5'}`}>
          <h3 className="text-xs uppercase tracking-widest font-semibold text-urban-concrete mb-4">Target Region</h3>
          {selectedBbox ? (
            (() => {
              const [w, s, e, n] = normalizeBbox(selectedBbox);
              return (
            <div className="space-y-2 font-mono text-sm text-white">
              <p>W: {w.toFixed(4)}</p>
              <p>S: {s.toFixed(4)}</p>
              <p>E: {e.toFixed(4)}</p>
              <p>N: {n.toFixed(4)}</p>
            </div>
              );
            })()
          ) : (
            <p className="text-sm text-urban-concrete italic">Awaiting bounding box selection...</p>
          )}

          {selectedBbox && (
            <div className="mt-4 pt-4 border-t border-urban-concrete/10">
              {prefetchStatus === "idle" && (
                <button
                  type="button"
                  onClick={handlePrefetch}
                  className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-xs font-mono uppercase transition-all cursor-pointer"
                >
                  Prefetch OSM Data
                </button>
              )}
              {prefetchStatus === "fetching" && (
                <p className="text-xs text-urban-concrete font-mono animate-pulse">Establishing connections & fetching raw geometry...</p>
              )}
              {prefetchStatus === "completed" && prefetchStats && (
                <div className="text-xs font-mono space-y-1">
                  <p className="text-urban-park font-bold">✓ Prefetch Successful</p>
                  <p className="text-white">Found: {prefetchStats.buildings} buildings, {prefetchStats.roads} roads</p>
                </div>
              )}
              {prefetchStatus === "error" && (
                <div className="space-y-2">
                  <p className="text-xs text-urban-brick font-mono">✗ Prefetch failed (API unreachable)</p>
                  <button
                    type="button"
                    onClick={handlePrefetch}
                    className="w-full py-2 bg-urban-brick/20 border border-urban-brick/40 hover:bg-urban-brick/30 text-white rounded-lg text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Retry Prefetch
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Auth & Action Area */}
        {authStatus?.status === "approved" ? (
          <button 
            disabled={!selectedBbox}
            onClick={handleCreateForoom}
            className={`mt-6 w-full py-4 rounded-xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2
              ${selectedBbox 
                ? 'bg-urban-blueprint text-white hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(47,129,247,0.4)]' 
                : 'bg-white/5 text-urban-concrete cursor-not-allowed'}`}
          >
            Initialize Voxel Server
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : authStatus?.status === "pending" ? (
          <div className="mt-6 p-4 rounded-xl bg-urban-signal/10 border border-urban-signal/20 text-center">
            <h3 className="text-sm font-semibold text-urban-signal mb-1">Access Pending</h3>
            <p className="text-xs text-urban-concrete">Waiting for Admin approval...</p>
          </div>
        ) : authStatus?.status === "rejected" ? (
          <div className="mt-6 p-4 rounded-xl bg-urban-brick/10 border border-urban-brick/20 text-center">
            <h3 className="text-sm font-semibold text-urban-brick mb-1">Access Denied</h3>
            <p className="text-xs text-urban-concrete">The admin has rejected your request.</p>
          </div>
        ) : (
          <form onSubmit={handleRequestAccess} className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-urban-concrete font-medium uppercase tracking-wider mb-2">
              <Lock className="w-4 h-4" /> Request Access
            </div>
            <input 
              type="text" 
              placeholder="Your Name / Organization"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              className="w-full bg-white/5 border border-urban-concrete/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-urban-blueprint transition-all"
            />
            <button 
              type="submit"
              disabled={!requestName}
              className="w-full py-3 bg-urban-concrete/20 hover:bg-urban-concrete/30 text-white rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50"
            >
              Submit Request
            </button>
          </form>
        )}

        <div className="mt-auto pt-8">
           <h3 className="text-xs uppercase tracking-widest font-semibold text-urban-concrete mb-4">Layer Topology</h3>
           <ul className="space-y-4">
             <li className="flex items-start gap-3">
               <div className="p-2 rounded bg-urban-signal/20 text-urban-signal mt-0.5"><Layers className="w-4 h-4" /></div>
               <div>
                 <p className="text-sm font-medium text-white">Council (L0)</p>
                 <p className="text-xs text-urban-concrete">Discourse, metadata overlays, voting.</p>
               </div>
             </li>
             <li className="flex items-start gap-3">
               <div className="p-2 rounded bg-urban-park/20 text-urban-park mt-0.5"><Box className="w-4 h-4" /></div>
               <div>
                 <p className="text-sm font-medium text-white">Playground (L1)</p>
                 <p className="text-xs text-urban-concrete">Tactical urbanism sandbox, voxel edits.</p>
               </div>
             </li>
             <li className="flex items-start gap-3">
               <div className="p-2 rounded bg-urban-brick/20 text-urban-brick mt-0.5"><Cpu className="w-4 h-4" /></div>
               <div>
                 <p className="text-sm font-medium text-white">Simulation (L2)</p>
                 <p className="text-xs text-urban-concrete">Cellular automata, dynamic AI events.</p>
               </div>
             </li>
           </ul>
        </div>
      </section>
    </main>
  );
}
