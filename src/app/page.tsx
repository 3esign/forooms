"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Layers, Box, Cpu, ChevronRight, Lock, Key, ClipboardList, Send, MapPin, Eye, User } from "lucide-react";
import { normalizeBbox } from "../lib/osm";
import usePartySocket from "partysocket/react";
import { AuthResponse, UserAccount, ActiveForoom, AuthMessage } from "@/types/auth";

// Dynamically import Map so it only renders on client
const Map = dynamic(() => import("../components/Map"), { ssr: false });
const VoxelCanvas = dynamic(() => import("../components/voxel"), { ssr: false });
const AvatarPreview = dynamic(() => import("../components/voxel/AvatarPreview"), { ssr: false });

export default function Home() {
  const router = useRouter();
  
  const [selectedBbox, setSelectedBbox] = useState<[number, number, number, number] | null>(null);
  const [isVoxelMode, setIsVoxelMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(13);
  const [isSearching, setIsSearching] = useState(false);

  // Prefetch states
  const [prefetchStatus, setPrefetchStatus] = useState<"idle" | "fetching" | "completed" | "error">("idle");
  const [prefetchStats, setPrefetchStats] = useState<{ buildings: number; roads: number } | null>(null);

  const { activeAccount, authSessionToken, adminPin, login, loginAsAdmin, logout, isAdmin } = useAuth();
  const [authTab, setAuthTab] = useState<"login" | "request">("login");
  const [sidebarTab, setSidebarTab] = useState<"home" | "profile" | "admin">("home");
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  // Request access fields
  const [requestEmail, setRequestEmail] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestNick, setRequestNick] = useState("");
  const [requestAvatarColor, setRequestAvatarColor] = useState("#3b82f6");
  const [requestAvatarNodes, setRequestAvatarNodes] = useState(4);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState("");

  // Forooms data
  const [forooms, setForooms] = useState<ActiveForoom[]>([]);
  const [newForoomName, setNewForoomName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  // Guest mode flag passed to canvas
  const [isGuest, setIsGuest] = useState(false);

  // Google Sign-In
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if we logged in via the admin dashboard
    const adminPinOld = localStorage.getItem("admin_auto_login");
    if (adminPinOld) {
      loginAsAdmin(adminPinOld);
      localStorage.removeItem("admin_auto_login");
    }
  }, [loginAsAdmin]);

  useEffect(() => {
    if (activeAccount) {
      setSidebarTab("profile");
    } else if (adminPin) {
      setSidebarTab("admin");
    } else {
      setSidebarTab("home");
    }
  }, [activeAccount, adminPin]);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
    room: "admin-auth",
    party: "auth",
    onOpen: () => {
      setConnectionStatus("connected");
      console.log("[home] Socket connected");
    },
    onClose: () => {
      setConnectionStatus("disconnected");
      console.log("[home] Socket disconnected");
    },
    onError: () => {
      setConnectionStatus("disconnected");
    },
    onMessage: (e) => {
      console.log("[home] Socket message received:", e.data);
      try {
        const msg = JSON.parse(e.data) as AuthResponse;
        if (msg.type === "login_success") {
          login(msg.payload.account as UserAccount, msg.payload.token);
          setLoginError("");
        } else if (msg.type === "login_failed") {
          setLoginError(msg.payload);
        } else if (msg.type === "all_forooms") {
          setForooms(msg.payload);
        } else if (msg.type === "request_submitted") {
          setRequestSuccessMsg(msg.payload);
          setRequestEmail("");
          setRequestDescription("");
          setRequestNick("");
          setRequestAvatarColor("#3b82f6");
          setRequestAvatarNodes(4);
        }
      } catch (err) {}
    }
  });

  // Check for deep link
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const foroomId = urlParams.get("foroom");
      const bboxParam = urlParams.get("bbox");

      if (bboxParam) {
        const coords = bboxParam.split(",").map(Number) as [number, number, number, number];
        if (coords.length === 4 && coords.every(c => !isNaN(c))) {
          setSelectedBbox(coords);
          setIsVoxelMode(true);
          window.history.replaceState({}, document.title, "/");
          return;
        }
      }

      if (foroomId && forooms.length > 0) {
        const found = forooms.find(f => f.id === foroomId);
        if (found) {
          setSelectedBbox(found.bbox);
          setIsVoxelMode(true);
          // clear url param so it doesn't get stuck if they exit
          window.history.replaceState({}, document.title, "/");
        }
      }
    }
  }, [forooms]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    try {
      socket.send(JSON.stringify({ 
        type: "verify_login", 
        payload: { email: loginEmail, passwordHash: loginPassword } 
      }));
    } catch (err) {
      console.error("[home] Failed to send verify_login:", err);
    }
  };

  const handleGoogleLogin = useCallback((response: { credential: string }) => {
    try {
      socket.send(JSON.stringify({
        type: "google_login",
        payload: { credential: response.credential }
      }));
    } catch (err) {
      console.error("[home] Failed to send google_login:", err);
    }
  }, [socket]);

  // Initialize Google Sign-In button
  useEffect(() => {
    if (activeAccount || adminPin) return;
    const interval = setInterval(() => {
      const google = (window as unknown as Record<string, unknown>).google as { accounts?: { id?: { initialize: (opts: Record<string, unknown>) => void; renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void } } } | undefined;
      if (google?.accounts?.id && googleBtnRef.current) {
        clearInterval(interval);
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleLogin,
        });
        google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "filled_black",
          size: "large",
          width: "100%",
          shape: "pill",
          text: "signin_with",
        });
      }
    }, 300);
    return () => clearInterval(interval);
  }, [activeAccount, adminPin, handleGoogleLogin]);

  const handleRequestAccess = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[home] handleRequestAccess email:", requestEmail, "desc:", requestDescription);
    if (!requestEmail || !requestDescription) return;

    try {
      socket.send(JSON.stringify({ 
        type: "request_access", 
        payload: { 
          email: requestEmail, 
          description: requestDescription,
          nick: requestNick || requestEmail.split("@")[0],
          avatarColor: requestAvatarColor,
          avatarNodes: Number(requestAvatarNodes)
        } 
      }));
      console.log("[home] Sent request_access to socket");
    } catch (err) {
      console.error("[home] Failed to send request_access:", err);
    }
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
    
    // If it's a new Foroom, let's register it in auth.ts
    const existing = forooms.find(f => 
      Math.abs(f.bbox[0] - selectedBbox[0]) < 0.0001 &&
      Math.abs(f.bbox[1] - selectedBbox[1]) < 0.0001
    );

    if (!existing) {
      if (!newForoomName.trim()) {
        alert("Please provide a name for this Foroom before initializing.");
        return;
      }
      
      const nameExists = forooms.some(f => f.name.toLowerCase() === newForoomName.trim().toLowerCase());
      if (nameExists) {
        alert("A Foroom with this name already exists. Please choose a different name.");
        return;
      }

      socket.send(JSON.stringify({
        type: "create_foroom",
        payload: {
          name: newForoomName.trim(),
          bbox: selectedBbox,
          creatorEmail: activeAccount?.email || "unknown@builder",
          token: authSessionToken || adminPin || undefined
        }
      } as AuthMessage));
    }

    setIsGuest(false);
    setIsVoxelMode(true);
  };
  
  const handleEnterGuest = (bboxToEnter?: [number, number, number, number]) => {
    const targetBbox = bboxToEnter || selectedBbox;
    if (!targetBbox) return;
    setSelectedBbox(targetBbox);
    setIsGuest(true);
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
    } finally {
      setIsSearching(false);
    }
  };

  // Determine permissions
  const canDraw = activeAccount?.canCreateForoom ?? false;
  const sessionToken = adminPin || authSessionToken;

  if (isVoxelMode && selectedBbox) {
    const finalRole = isAdmin ? "admin" : (isGuest ? "guest" : "builder");
    return (
      <div className="w-full h-screen relative">
        <VoxelCanvas bbox={selectedBbox} onExit={handleExitForoom} role={finalRole} token={sessionToken} />
      </div>
    );
  }

  return (
    <main className="flex h-screen w-full bg-urban-void overflow-hidden">
      
      {/* Left Panel - Map Area */}
      <div className="flex-1 relative bg-black">
        <Map 
          onBoundingBoxSelect={handleBboxSelect}
          forooms={forooms}
          allowDrawing={canDraw}
          center={mapCenter}
          zoom={mapZoom}
        />
        
        {/* Map Overlay Instructions */}
        <div className="absolute top-8 left-8 z-10">
          <div className="bg-urban-void/80 backdrop-blur-md border border-urban-concrete/20 rounded-xl p-4 shadow-2xl flex items-start gap-4 max-w-sm">
            <div className="w-10 h-10 rounded-lg bg-urban-blueprint/20 text-urban-blueprint flex items-center justify-center shrink-0">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-wide uppercase">
                {canDraw ? "Select Region" : "Explore Forooms"}
              </h3>
              <p className="text-urban-concrete text-xs mt-1 leading-relaxed">
                {canDraw 
                  ? "Hold Shift and drag to select a region to build a new Foroom." 
                  : "Click on any active green region on the map or select a Foroom from the list on the right side to visit."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - UI Overlay (Panel moved to Right) */}
      <div className="w-96 h-full bg-urban-void/90 backdrop-blur-md border-l border-urban-concrete/20 z-10 flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-8 border-b border-urban-concrete/20 bg-gradient-to-br from-urban-void to-black">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-urban-blueprint/20 text-urban-blueprint flex items-center justify-center shadow-[0_0_15px_rgba(47,129,247,0.3)]">
              <Layers className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-widest uppercase">FOROOMS</h1>
          </div>
          <p className="text-xs font-mono text-urban-concrete">Institute for Applied Design Intelligence</p>
        </div>

        {/* Tab Navigation (Only shown when logged in) */}
        {(activeAccount || adminPin) && (
          <div className="flex border-b border-urban-concrete/20 bg-urban-void/50 shrink-0 font-mono">
            <button
              onClick={() => setSidebarTab("home")}
              className={`flex-1 py-3 text-center text-xs font-bold tracking-wider transition-all border-b-2 cursor-pointer
                ${sidebarTab === "home" 
                  ? "border-urban-blueprint text-white bg-white/5" 
                  : "border-transparent text-urban-concrete hover:text-white"}`}
            >
              🌐 HOME
            </button>
            <button
              onClick={() => setSidebarTab("profile")}
              className={`flex-1 py-3 text-center text-xs font-bold tracking-wider transition-all border-b-2 cursor-pointer
                ${sidebarTab === "profile" 
                  ? "border-urban-park text-white bg-white/5" 
                  : "border-transparent text-urban-concrete hover:text-white"}`}
            >
              👤 PROFILE
            </button>
            {isAdmin && (
              <button
                onClick={() => setSidebarTab("admin")}
                className={`flex-1 py-3 text-center text-xs font-bold tracking-wider transition-all border-b-2 cursor-pointer
                  ${sidebarTab === "admin" 
                    ? "border-urban-signal text-white bg-white/5" 
                    : "border-transparent text-urban-concrete hover:text-white"}`}
              >
                ⚙️ ADMIN
              </button>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {sidebarTab === "home" && (
            <>
              {/* Search Box */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-white/5 border border-urban-concrete/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-urban-concrete focus:outline-none focus:border-urban-blueprint transition-all"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-urban-blueprint/20 border border-urban-blueprint/40 hover:border-urban-blueprint hover:bg-urban-blueprint/30 text-white rounded-xl px-5 py-3 text-sm font-semibold font-mono uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSearching ? "..." : "Go"}
                </button>
              </form>

              {/* Active Forums List */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-widest font-semibold text-urban-concrete flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Active Forooms ({forooms.length})
                </h3>

                {connectionStatus === "connecting" && (
                  <div className="p-3 bg-urban-blueprint/5 border border-urban-blueprint/20 rounded-xl flex items-start gap-3 animate-pulse">
                    <div className="w-2.5 h-2.5 rounded-full bg-urban-blueprint animate-ping shrink-0 mt-1" />
                    <div className="text-xxs text-urban-concrete leading-normal">
                      <strong className="text-white">Connecting to Realtime Engine...</strong>
                      <p className="mt-0.5">Render free-tier servers sleep when idle. Cold boot may take 30–50 seconds. Thanks for your patience!</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {forooms.map((f) => (
                    <div 
                      key={f.id}
                      onClick={() => {
                        setSelectedBbox(f.bbox);
                        setMapCenter([(f.bbox[0] + f.bbox[2])/2, (f.bbox[1] + f.bbox[3])/2]);
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between hover:bg-white/5
                        ${selectedBbox && Math.abs(selectedBbox[0] - f.bbox[0]) < 0.0001 
                          ? "border-urban-blueprint bg-urban-blueprint/5" 
                          : "border-urban-concrete/10 bg-white/5"}`}
                    >
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-urban-park" />
                          {f.name}
                        </div>
                        <div className="text-xxs text-urban-concrete mt-0.5">By: {f.creatorEmail}</div>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `${window.location.origin}/?foroom=${f.id}`;
                            navigator.clipboard.writeText(url);
                            alert("Link copied to clipboard!");
                          }}
                          className="p-1.5 bg-urban-concrete/10 hover:bg-urban-concrete/20 rounded text-urban-concrete hover:text-white transition-all"
                          title="Copy Link"
                        >
                          🔗
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeAccount) {
                              setSelectedBbox(f.bbox);
                              setIsGuest(false);
                              setIsVoxelMode(true);
                            } else {
                              handleEnterGuest(f.bbox);
                            }
                          }}
                          className="p-1.5 bg-urban-concrete/10 hover:bg-urban-concrete/20 rounded text-urban-concrete hover:text-white transition-all"
                          title="Visit"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {forooms.length === 0 && (
                    <p className="text-xs text-urban-concrete italic py-2">No active forums yet.</p>
                  )}
                </div>
              </div>

              {/* Target Region Status & Creation Panel */}
              {selectedBbox && (
                <div className="p-6 rounded-xl border border-urban-blueprint bg-urban-blueprint/5 space-y-4">
                  <h3 className="text-xs uppercase tracking-widest font-semibold text-urban-concrete">Selected Region</h3>
                  
                  {(() => {
                    const foroom = forooms.find(f => 
                      Math.abs(f.bbox[0] - selectedBbox[0]) < 0.0001 &&
                      Math.abs(f.bbox[1] - selectedBbox[1]) < 0.0001
                    );
                    return foroom ? (
                      <div className="text-sm font-bold text-white">Foroom: {foroom.name}</div>
                    ) : (
                      canDraw && (
                        <div className="space-y-2">
                          <label className="block text-xs text-urban-concrete">Foroom Name</label>
                          <input 
                            type="text"
                            placeholder="e.g. Town Square"
                            value={newForoomName}
                            onChange={e => setNewForoomName(e.target.value)}
                            className="w-full bg-urban-void border border-urban-concrete/20 rounded-lg px-3 py-1.5 text-sm text-white focus:border-urban-blueprint transition-all outline-none"
                          />
                        </div>
                      )
                    );
                  })()}

                  {!forooms.some(f => Math.abs(f.bbox[0] - selectedBbox[0]) < 0.0001) && (
                    <div className="pt-2 border-t border-urban-concrete/10">
                      {prefetchStatus === "idle" && (
                        <button
                          type="button"
                          onClick={handlePrefetch}
                          className="w-full py-2.5 bg-urban-blueprint hover:bg-blue-500 text-white rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer"
                        >
                          Prefetch OSM Data
                        </button>
                      )}
                      {prefetchStatus === "fetching" && (
                        <p className="text-xs text-urban-blueprint font-medium animate-pulse">Downloading geography vectors...</p>
                      )}
                      {prefetchStatus === "completed" && prefetchStats && (
                        <div className="space-y-2 text-xs">
                          <p className="text-urban-park font-bold">✓ Prefetch Successful</p>
                          <p className="text-white">Found: {prefetchStats.buildings} buildings, {prefetchStats.roads} roads</p>
                        </div>
                      )}
                      {prefetchStatus === "error" && (
                        <div className="space-y-2">
                          <p className="text-xs text-urban-brick font-medium">⚠️ Prefetch failed</p>
                          <button
                            type="button"
                            onClick={handlePrefetch}
                            className="w-full py-2 bg-urban-brick/10 border border-urban-brick/20 rounded-lg text-xxs font-bold text-urban-brick transition-all cursor-pointer"
                          >
                            Retry Prefetch
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-urban-concrete/10">
                    {(() => {
                      const foroom = forooms.find(f => 
                        Math.abs(f.bbox[0] - selectedBbox[0]) < 0.0001 &&
                        Math.abs(f.bbox[1] - selectedBbox[1]) < 0.0001
                      );
                      const isExistingForoom = !!foroom;
                      
                      return (
                        <>
                          {!isExistingForoom && !activeAccount && (
                            <div className="p-3 bg-urban-signal/10 border border-urban-signal/20 rounded-xl mb-3 text-center">
                              <p className="text-xxs text-urban-signal">You must log in to initialize new voxel design servers.</p>
                            </div>
                          )}

                          {!isExistingForoom && activeAccount && !activeAccount.canCreateForoom && (
                            <div className="p-3 bg-urban-signal/10 border border-urban-signal/20 rounded-xl mb-3 text-center">
                              <p className="text-xxs text-urban-signal">You do not have creator permissions to initialize new voxel servers.</p>
                            </div>
                          )}

                          {isExistingForoom && (
                            <button 
                              onClick={() => {
                                if (activeAccount) {
                                  setIsGuest(false);
                                  setIsVoxelMode(true);
                                } else {
                                  handleEnterGuest();
                                }
                              }}
                              className="w-full py-3 bg-urban-concrete/20 hover:bg-urban-concrete/30 text-white rounded-xl font-bold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                            >
                              {activeAccount ? "Enter Room" : "Enter as Guest"}
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                          
                          {activeAccount?.canCreateForoom && (
                            <button 
                              onClick={handleCreateForoom}
                              className="w-full py-3 bg-urban-blueprint hover:bg-blue-500 text-white rounded-xl font-bold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer text-sm shadow-[0_0_20px_rgba(47,129,247,0.3)]"
                            >
                              {isExistingForoom ? "Enter Creator Server" : "Initialize Voxel Server"}
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Guest Google Login Box at the bottom */}
              {!(activeAccount || adminPin) && (
                <div className="border-t border-urban-concrete/20 pt-6 space-y-4">
                  <div className="space-y-4">
                    {/* Google Sign-In Button */}
                    <div ref={googleBtnRef} className="w-full flex justify-center py-2" />

                    {loginError === "pending_approval" ? (
                      <div className="p-4 bg-urban-signal/10 border border-urban-signal/25 rounded-xl text-center">
                        <p className="text-xs text-urban-signal leading-relaxed font-bold">
                          Access Pending Approval
                        </p>
                        <p className="text-[11px] text-white/70 leading-relaxed mt-1">
                          Your Google account access request is submitted. You will receive an email notification once the administrator grants you permission.
                        </p>
                      </div>
                    ) : (
                      loginError && (
                        <div className="p-3 bg-urban-brick/10 border border-urban-brick/20 rounded-xl text-center">
                          <p className="text-xs text-urban-brick font-medium">{loginError}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {sidebarTab === "profile" && (
            <div className="space-y-6 font-mono">
              <h3 className="text-xs font-bold uppercase tracking-wider text-urban-concrete flex items-center gap-1.5 border-b border-white/10 pb-2">
                <User className="w-3.5 h-3.5 text-urban-park" />
                User Profile
              </h3>

              {activeAccount ? (
                <div className="p-4 rounded-xl bg-white/5 border border-urban-concrete/20 space-y-4">
                  <div className="flex gap-4 items-center">
                    {activeAccount.avatarColor && activeAccount.avatarNodes ? (
                      <div className="w-16 h-16 bg-black/20 rounded-lg overflow-hidden border border-white/10 shrink-0">
                        <AvatarPreview color={activeAccount.avatarColor} nodes={activeAccount.avatarNodes} />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-black/20 rounded-lg border border-white/10 flex items-center justify-center shrink-0">
                        <User className="w-8 h-8 text-urban-concrete" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-urban-concrete font-bold">Nickname</div>
                      <div className="text-sm font-bold text-white leading-tight break-all">
                        {activeAccount.nick || activeAccount.email.split("@")[0]}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-urban-concrete/60 font-bold mt-1">Role</div>
                      <div className="text-xs text-urban-park font-bold">
                        Builder
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-urban-concrete font-bold">Email Address</div>
                      <div className="text-xs text-white/80 mt-0.5 break-all">{activeAccount.email}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-urban-concrete font-bold">Member Since</div>
                      <div className="text-xs text-white/80 mt-0.5">
                        {new Date(activeAccount.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : adminPin ? (
                <div className="p-4 rounded-xl bg-white/5 border border-urban-concrete/20 space-y-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-black/20 rounded-lg border border-white/10 flex items-center justify-center shrink-0">
                      <User className="w-8 h-8 text-urban-blueprint" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-urban-concrete font-bold">Nickname</div>
                      <div className="text-sm font-bold text-white leading-tight">
                        Administrator
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-urban-concrete/60 font-bold mt-1">Role</div>
                      <div className="text-xs text-urban-blueprint font-bold">
                        Root Admin
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-urban-concrete font-bold">Admin Email</div>
                      <div className="text-xs text-white/80 mt-0.5 font-mono">admin@forooms.app</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeAccount && !activeAccount.canCreateForoom && (
                <div className="p-4 rounded-xl bg-urban-signal/10 border border-urban-signal/20 text-center">
                  <p className="text-xs text-urban-signal leading-relaxed">
                    You have permissions to build and annotate existing maps, but you are not authorized to initialize new maps.
                  </p>
                </div>
              )}

              <button 
                onClick={() => {
                  logout();
                  setSidebarTab("home");
                  window.location.reload();
                }}
                className="w-full py-2.5 bg-urban-brick/10 hover:bg-urban-brick/20 border border-urban-brick/20 rounded-xl text-xs font-bold tracking-wide text-urban-brick transition-all cursor-pointer"
              >
                Log Off
              </button>
            </div>
          )}

          {sidebarTab === "admin" && isAdmin && (
            <div className="space-y-6 font-mono">
              <h3 className="text-xs font-bold uppercase tracking-wider text-urban-concrete flex items-center gap-1.5 border-b border-white/10 pb-2">
                <Cpu className="w-3.5 h-3.5 text-urban-signal" />
                Administrator Console
              </h3>

              <div className="p-4 rounded-xl bg-urban-blueprint/10 border border-urban-blueprint/20 space-y-4">
                <div className="text-xs text-white leading-relaxed">
                  You are authenticated with root administrator privileges. You can manage access requests, accounts, and server rooms via the portal.
                </div>
                <div className="text-[10px] uppercase tracking-wider text-urban-concrete font-bold">Access Token</div>
                <div className="text-xs font-mono text-white/60 bg-black/45 p-2 rounded border border-white/5 truncate">
                  {authSessionToken || "Locally Configured"}
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => window.location.href = "/admin"}
                  className="flex-1 py-3 bg-urban-blueprint hover:bg-blue-500 text-white rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer text-center"
                >
                  Enter Admin Portal
                </button>
                <button 
                  onClick={() => {
                    logout();
                    setSidebarTab("home");
                    window.location.reload();
                  }}
                  className="py-3 px-4 bg-urban-brick/10 hover:bg-urban-brick/20 border border-urban-brick/20 rounded-xl text-xs font-bold tracking-wide text-urban-brick transition-all cursor-pointer"
                >
                  Log Off
                </button>
              </div>
            </div>
          )}

        </div>

        {/* System Status Footer */}
        <div className="p-6 border-t border-urban-concrete/20 bg-black/40">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-urban-concrete uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Engine Status
            </span>
            <span className="text-urban-park flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-urban-park animate-pulse"></span>
              ONLINE
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
