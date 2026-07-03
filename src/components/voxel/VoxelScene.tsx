import React, { useState, useEffect, useMemo, useCallback, useRef, startTransition } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import usePartySocket from "partysocket/react";
import { PartySocket } from "partysocket";
import { Map, Settings, X, Share2, Sun, MapPin, FileText } from "lucide-react";

import { Bbox } from "../../lib/osm/types";
import { fetchOSMData, projectLatLngToGrid, getGridDimensionsFromBbox } from "../../lib/osm/fetcher";
import { CityGrid } from "../../lib/voxel/CityGrid";
import { BlockId } from "../../lib/blocks/BlockRegistry";
import { createAllTextures } from "./TextureAtlas";
import { VoxelMesh, VoxelBlock, MeshedChunk, InfoBlockHighlights, OtherPlayer, PixelClouds } from "./VoxelMesh";
import { SimulationAgents } from "./SimulationAgents";
import { MiniMapUI, MiniMapTracker } from "./MiniMap";
import { ActivitySidebar } from "./ActivitySidebar";
import { LayerSwitcher, LayerType } from "./LayerSwitcher";
import { Player, MovementMode } from "./Player";
import { LoadingOverlay } from "./LoadingOverlay";
import { Hotbar } from "./Hotbar";
import { AdminModal } from "./AdminModal";
import { AdminAppearancePanel, ForoomAppearance, DEFAULT_APPEARANCE } from "./AdminAppearancePanel";
import { InfoModal } from "./InfoModal";
import { MarkersDashboardModal } from "./MarkersDashboardModal";
import { ActivityLogModal } from "./ActivityLogModal";
import { PRNG, hashBbox } from "../../lib/voxel/prng";
import { greedyMeshGrid, patchMeshedChunksAfterEdit, Cuboid } from "../../lib/voxel/mesher";

import {
  paintLanduseZoneOnGrid,
  paintParkOnGrid,
  paintBeachOnGrid,
  paintScrubOnGrid,
  paintWaterwayOnGrid,
  paintParkingOnGrid,
  paintRailwayOnGrid,
  paintRoadOnGrid,
  paintFootpathOnGrid,
  paintServiceRoadOnGrid,
  paintBuildingOnGrid,
  generateBuildingSidewalks,
  paintBarrierOnGrid,
  paintStationPlatform,
  runTreePass,
  paintTreeRowOnGrid,
  generateCouncilEditableVoxels
} from "../../lib/rasterizer";

const PLAYGROUND_BLOCKS = [
  { id: BlockId.Concrete, name: "Concrete", color: "#c9c2b9" },
  { id: BlockId.Wall, name: "Wall", color: "#8b7355" },
  { id: BlockId.Platform, name: "Platform", color: "#b0a89e" },
  { id: BlockId.Wood, name: "Wood", color: "#7d593c" },
  { id: BlockId.Leaves, name: "Leaves", color: "#2f751c" },
  { id: BlockId.Asphalt, name: "Asphalt", color: "#2c2d30" }
];

const COUNCIL_BLOCKS = [
  { id: BlockId.Editable, name: "Editable", color: "#4ade80" },
  { id: BlockId.Grass, name: "Grass", color: "#659c44" },
  { id: BlockId.Water, name: "Water", color: "#1d4ed8" },
  { id: BlockId.Sidewalk, name: "Sidewalk", color: "#a3a3a3" },
  { id: BlockId.Sand, name: "Sand", color: "#d4b896" },
  { id: BlockId.Pitch, name: "Pitch", color: "#b45309" }
];

interface VoxelSceneProps {
  bbox: Bbox;
  onExit: () => void;
  role: "admin" | "builder" | "guest" | string;
  token?: string | null;
}

export function VoxelScene({ bbox, onExit, role, token }: VoxelSceneProps) {
  const [status, setStatus] = useState<"idle" | "fetching" | "projecting" | "rasterizing" | "completed" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [movementMode, setMovementMode] = useState<MovementMode>("fps");
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [textures, setTextures] = useState<Record<number, THREE.Texture>>({});
  const controlsEnabled = !overlayVisible && status === "completed";

  const [activeLayer, setActiveLayer] = useState<LayerType>("playground");
  const [stats, setStats] = useState({ buildings: 0, roads: 0, grass: 0, buildingVoxels: 0, vegetation: 0 });
  const [originalMeshedChunks, setOriginalMeshedChunks] = useState<Record<number, Cuboid[]>>({});
  const [editedMeshedChunks, setEditedMeshedChunks] = useState<Record<number, Cuboid[]>>({});
  const [isMiniMapExpanded, setIsMiniMapExpanded] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAppearanceModalOpen, setIsAppearanceModalOpen] = useState(false);
  const [isMarkersDashboardOpen, setIsMarkersDashboardOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [teleportPos, setTeleportPos] = useState<{ x: number, y: number, z: number } | null>(null);
  const [islandBounds, setIslandBounds] = useState<{ minX: number; maxX: number; minZ: number; maxZ: number } | null>(null);
  const [appearance, setAppearance] = useState<ForoomAppearance>(DEFAULT_APPEARANCE);
  const gridRef = useRef<CityGrid | null>(null);
  const cleanGridRef = useRef<CityGrid | null>(null);
  const pendingEditsRef = useRef<Set<string>>(new Set());
  const playerPosRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 2.0, z: 0 });

  const applyVoxelEdit = useCallback((x: number, y: number, z: number, newBlockId: number) => {
    if (!gridRef.current) return;
    const oldBlockId = gridRef.current.getVoxel(x, y, z);
    gridRef.current.setVoxel(x, y, z, newBlockId);

    startTransition(() => {
      setEditedMeshedChunks(prev => patchMeshedChunksAfterEdit(
        gridRef.current!, prev, x, y, z, oldBlockId, newBlockId
      ));
    });
  }, []);

  // Real-time edits and info
  const [externalEdits, setExternalEdits] = useState<VoxelBlock[]>([]);
  const [infoBlocks, setInfoBlocks] = useState<Record<string, string>>({});
  
  // Roads for simulation
  const [projectedRoads, setProjectedRoads] = useState<[number, number][][]>([]);

  // Interaction State
  const [interactTarget, setInteractTarget] = useState<{ x: number, y: number, z: number, key: string, neighborKey: string } | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoText, setInfoText] = useState("");
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  // Presence and Logs
  const [players, setPlayers] = useState<any[]>([]);
  const [logs, setLogs] = useState<{timestamp: number; type: string; message: string}[]>([]);
  const [activeChats, setActiveChats] = useState<Record<string, { message: string; timestamp: number }>>({});
  const [hotbarIndex, setHotbarIndex] = useState(0);

  // Connect to PartyKit
  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
    room: `foroom-${bbox.join("-")}`,
    query: { ...(token ? { token } : {}) },
    onOpen: () => {
      setIsSocketConnected(true);
      console.log("[room] WebSocket connected");
    },
    onClose: () => {
      setIsSocketConnected(false);
      console.log("[room] WebSocket disconnected");
    },
    onMessage: (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "init") {
          const loadedEdits: VoxelBlock[] = [];
          msg.edits.forEach((edit: any) => {
            loadedEdits.push({ x: edit.x, y: edit.y, z: edit.z, blockId: edit.blockId });
          });
          setExternalEdits(loadedEdits);
          if (gridRef.current) {
            const chunks = greedyMeshGrid(gridRef.current);
            setOriginalMeshedChunks(chunks);
            setEditedMeshedChunks(chunks);
            
            let currentEditedChunks = chunks;
            msg.edits.forEach((edit: any) => {
              gridRef.current?.setVoxel(edit.x, edit.y, edit.z, edit.blockId);
              currentEditedChunks = patchMeshedChunksAfterEdit(
                gridRef.current!, 
                currentEditedChunks, 
                edit.x, edit.y, edit.z, 
                BlockId.Air,
                edit.blockId
              );
            });
            setEditedMeshedChunks(currentEditedChunks);
          }
          if (msg.appearance) {
            setAppearance(msg.appearance);
          }
          if (msg.infoBlocks) {
            setInfoBlocks(msg.infoBlocks);
          }
          if (msg.players) setPlayers(msg.players);
          if (msg.logs) setLogs(msg.logs);
        } else if (msg.type === "appearance_update") {
          if (msg.appearance) setAppearance(msg.appearance);
        } else if (msg.type === "info_update") {
          setInfoBlocks(msg.infoBlocks);
        } else if (msg.type === "presence_update") {
          setPlayers(msg.players);
        } else if (msg.type === "log_event") {
          setLogs(prev => [...prev, msg.log]);
        } else if (msg.type === "edit") {
          const editKey = `${msg.x},${msg.y},${msg.z}`;
          if (pendingEditsRef.current.has(editKey)) {
            pendingEditsRef.current.delete(editKey);
            return;
          }

          setExternalEdits(prev => {
            const filtered = prev.filter(b => b.x !== msg.x || b.y !== msg.y || b.z !== msg.z);
            if (msg.blockId !== 0) {
              filtered.push({ x: msg.x, y: msg.y, z: msg.z, blockId: msg.blockId });
            }
            return filtered;
          });
          applyVoxelEdit(msg.x, msg.y, msg.z, msg.blockId);
        } else if (msg.type === "room_cleared") {
          if (cleanGridRef.current) {
            gridRef.current = cleanGridRef.current.clone();
            setEditedMeshedChunks(originalMeshedChunks);
            setExternalEdits([]);
            setInfoBlocks({});
          }
        } else if (msg.type === "player_move") {
          setPlayers(prev => prev.map(p => p.id === msg.id ? { ...p, x: msg.x, y: msg.y, z: msg.z } : p));
        } else if (msg.type === "chat") {
          setActiveChats(prev => ({
            ...prev,
            [msg.senderId]: { message: msg.message, timestamp: Date.now() }
          }));
        }
      } catch (err) {
        console.error("PartyKit message error:", err);
      }
    }
  });

  const prng = useMemo(() => new PRNG(hashBbox(bbox)), [bbox]);

  useEffect(() => {
    setTextures(createAllTextures(prng));
  }, [prng]);

  useEffect(() => {
    let active = true;
    
    async function load() {
      try {
        setStatus("fetching");
        const osmData = await fetchOSMData(bbox);
        
        if (!active) return;
        setStatus("projecting");

        const centerLat = (bbox[1] + bbox[3]) / 2;
        const centerLng = (bbox[0] + bbox[2]) / 2;
        const origin = { lat: centerLat, lng: centerLng };

        const { width: gridWidth, depth: gridDepth } = getGridDimensionsFromBbox(bbox);
        const grid = new CityGrid(gridWidth, gridDepth);

        if (!active) return;
        setStatus("rasterizing");

        osmData.landuse.forEach(zone => {
          const pts = zone.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintLanduseZoneOnGrid(pts, grid, zone.type);
        });

        osmData.parks.forEach(park => {
          const pts = park.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintParkOnGrid(pts, grid, park.type);
        });

        osmData.beaches.forEach(beach => {
          const pts = beach.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintBeachOnGrid(pts, grid);
        });
        osmData.scrub.forEach(scr => {
          const pts = scr.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintScrubOnGrid(pts, grid);
        });

        osmData.waterways.forEach(ww => {
          const pts = ww.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintWaterwayOnGrid(pts, grid);
        });

        osmData.parking.forEach(p => {
          const pts = p.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintParkingOnGrid(pts, grid);
        });

        osmData.railways.forEach(rail => {
          const pts = rail.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintRailwayOnGrid(pts, grid, 2);
          if (rail.isStation) paintStationPlatform(pts, grid);
        });

        const pRoads: [number, number][][] = [];
        osmData.roads.forEach(road => {
          const pts = road.coordinates.map(c => projectLatLngToGrid(c, origin));
          pRoads.push(pts);
          const width = ["motorway", "trunk"].includes(road.type) ? 8 :
                        ["primary", "secondary"].includes(road.type) ? 6 :
                        road.type === "service" ? 2 : 4;
          
          if (road.type === "service") {
            paintServiceRoadOnGrid(pts, grid, width);
          } else {
            paintRoadOnGrid(pts, grid, width);
          }
        });
        setProjectedRoads(pRoads);

        osmData.paths.forEach(path => {
          const pts = path.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintFootpathOnGrid(pts, grid, 2);
        });

        osmData.buildings.forEach(b => {
          const pts = b.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintBuildingOnGrid(pts, b.heightLevels, b.type, grid);
        });

        generateBuildingSidewalks(grid);

        osmData.barriers.forEach(barrier => {
          const pts = barrier.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintBarrierOnGrid(pts, grid);
        });

        osmData.treeRows.forEach(tr => {
          const pts = tr.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintTreeRowOnGrid(pts, grid);
        });
        runTreePass(grid, prng);
        generateCouncilEditableVoxels(grid, prng);
        
        gridRef.current = grid;
        cleanGridRef.current = grid.clone();
        setIslandBounds({
          minX: grid.minX,
          maxX: grid.maxX,
          minZ: grid.minZ,
          maxZ: grid.maxZ
        });

        const chunks = greedyMeshGrid(grid);
        setOriginalMeshedChunks(chunks);
        setEditedMeshedChunks(chunks);

        let totalConcrete = 0;
        let totalVegetation = 0;
        let totalAsphalt = 0;
        
        const countVoxels = (cuboids: Cuboid[]) => cuboids.reduce((sum, c) => sum + (c.w * c.h * c.d), 0);
        
        if (chunks[BlockId.Concrete]) totalConcrete += countVoxels(chunks[BlockId.Concrete]);
        if (chunks[BlockId.ZoneResidential]) totalConcrete += countVoxels(chunks[BlockId.ZoneResidential]);
        if (chunks[BlockId.ZoneCommercial]) totalConcrete += countVoxels(chunks[BlockId.ZoneCommercial]);
        if (chunks[BlockId.ZoneRetail]) totalConcrete += countVoxels(chunks[BlockId.ZoneRetail]);
        if (chunks[BlockId.ZoneIndustrial]) totalConcrete += countVoxels(chunks[BlockId.ZoneIndustrial]);
        if (chunks[BlockId.Wood]) totalVegetation += countVoxels(chunks[BlockId.Wood]);
        if (chunks[BlockId.Leaves]) totalVegetation += countVoxels(chunks[BlockId.Leaves]);
        if (chunks[BlockId.Asphalt]) totalAsphalt += countVoxels(chunks[BlockId.Asphalt]);

        setStats({
          buildings: osmData.buildings.length,
          roads: totalAsphalt,
          grass: 1, 
          buildingVoxels: totalConcrete,
          vegetation: totalVegetation,
        });

        if (active) {
          // Find building-free spawn position near center (0, 0)
          let spawnX = 0;
          let spawnZ = 0;
          let found = false;
          
          for (let r = 0; r <= 30 && !found; r++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              for (let dz = -r; dz <= r && !found; dz++) {
                if (r > 0 && Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
                
                let isClear = true;
                for (let y = 1; y <= 3; y++) {
                  const block = grid.getVoxel(dx, y, dz);
                  if (block !== 0 && block !== 7) {
                    isClear = false;
                    break;
                  }
                }
                if (isClear) {
                  spawnX = dx;
                  spawnZ = dz;
                  found = true;
                }
              }
            }
          }

          // Teleport player to the safe spot (ground level y=0 => eye height 1.98 automatically set by Player.tsx)
          setTeleportPos({ x: spawnX, y: 0, z: spawnZ });
          setTimeout(() => setTeleportPos(null), 100);
          
          setStatus("completed");
        }
      } catch (err: any) {
        if (active) {
          setError(err.message);
          setStatus("error");
        }
      }
    }

    load();
    return () => { active = false; };
  }, [bbox]);

  const repeatingWaterTexture = useMemo(() => {
    if (!textures[BlockId.Water]) return null;
    const tex = textures[BlockId.Water].clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4000, 4000);
    tex.needsUpdate = true;
    return tex;
  }, [textures]);

  const repeatingGrassTexture = useMemo(() => {
    if (!textures[BlockId.Grass]) return null;
    const tex = textures[BlockId.Grass].clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(500, 500);
    tex.needsUpdate = true;
    return tex;
  }, [textures]);

  const getBlock = useCallback((x: number, y: number, z: number) => {
    if (!gridRef.current) return 0;
    return gridRef.current.getVoxel(x, y, z);
  }, []);

  const handlePlayerMove = useCallback((x: number, y: number, z: number) => {
    playerPosRef.current = { x, y, z };
    socket?.send(JSON.stringify({ type: "player_move", x, y, z }));
  }, [socket]);

  const handleTeleport = useCallback((x: number, y: number, z: number) => {
    setTeleportPos({ x, y, z });
    setTimeout(() => setTeleportPos(null), 100);
  }, []);

  const handleSendChat = useCallback((message: string) => {
    socket?.send(JSON.stringify({ type: "chat", message }));
  }, [socket]);

  const handleInteract = useCallback((hit: THREE.Intersection | null, button: number) => {
    if (!hit) return;

    // Check if we hit a pin directly
    const userData = hit.object.userData;
    if (userData && userData.type === "pin") {
      const { x, y, z } = userData;
      const key = `${x},${y},${z}`;
      
      if (activeLayer === "council") {
        setInteractTarget({ x, y, z, key, neighborKey: key });
        if (infoBlocks[key]) {
          setInfoText(infoBlocks[key]);
          setIsEditingInfo(false);
          setIsInfoModalOpen(true);
          document.exitPointerLock();
        } else if (role !== "guest") {
          setInfoText("");
          setIsEditingInfo(true);
          setIsInfoModalOpen(true);
          document.exitPointerLock();
        }
      }
      return;
    }

    if (!hit.face) return;
    const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    const p = hit.point.clone().sub(worldNormal.clone().multiplyScalar(0.1));
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const z = Math.round(p.z);
    const key = `${x},${y},${z}`;

    const np = hit.point.clone().add(worldNormal.clone().multiplyScalar(0.1));
    const nx = Math.round(np.x);
    const ny = Math.round(np.y);
    const nz = Math.round(np.z);

    if (activeLayer === "council") {
      if (button === 0) {
        // Change texture of existing block
        if (gridRef.current && gridRef.current.getVoxel(x, y, z) !== BlockId.Air) {
          const activeBlock = COUNCIL_BLOCKS[hotbarIndex].id;
          applyVoxelEdit(x, y, z, activeBlock);
          socket?.send(JSON.stringify({
            type: "edit",
            x, y, z,
            blockId: activeBlock
          }));
        }
      } else if (button === 2) {
        // View or place note (only on ground blocks y === 0)
        if (y !== 0) return;
        setInteractTarget({ x, y, z, key, neighborKey: `${nx},${ny},${nz}` });
        
        if (infoBlocks[key]) {
          setInfoText(infoBlocks[key]);
          setIsEditingInfo(false);
          setIsInfoModalOpen(true);
          document.exitPointerLock();
        } else if (role !== "guest") {
          setInfoText("");
          setIsEditingInfo(true);
          setIsInfoModalOpen(true);
          document.exitPointerLock();
        }
      }
    } else if (activeLayer === "playground") {
      if (role === "guest") return;
      if (button === 0) {
        if (ny < 0) return; // Prevent placing blocks below ground level
        
        // Prevent placing blocks intersecting with the player to avoid trapping them
        const playerMinX = playerPosRef.current.x - 0.3;
        const playerMaxX = playerPosRef.current.x + 0.3;
        const playerMinY = playerPosRef.current.y - 1.5;
        const playerMaxY = playerPosRef.current.y + 0.2;
        const playerMinZ = playerPosRef.current.z - 0.3;
        const playerMaxZ = playerPosRef.current.z + 0.3;

        const blockMinX = nx - 0.5;
        const blockMaxX = nx + 0.5;
        const blockMinY = ny - 0.5;
        const blockMaxY = ny + 0.5;
        const blockMinZ = nz - 0.5;
        const blockMaxZ = nz + 0.5;

        const overlaps = playerMinX < blockMaxX && playerMaxX > blockMinX &&
                         playerMinY < blockMaxY && playerMaxY > blockMinY &&
                         playerMinZ < blockMaxZ && playerMaxZ > blockMinZ;

        if (overlaps) return;

        const activeBlock = PLAYGROUND_BLOCKS[hotbarIndex].id;
        const editKey = `${nx},${ny},${nz}`;
        pendingEditsRef.current.add(editKey);
        applyVoxelEdit(nx, ny, nz, activeBlock);
        socket.send(JSON.stringify({
          type: "edit",
          x: nx, y: ny, z: nz,
          blockId: activeBlock,
        }));
      } else if (button === 2) {
        if (y < 0) return; // Prevent deleting blocks below ground level
        const editKey = `${x},${y},${z}`;
        pendingEditsRef.current.add(editKey);
        applyVoxelEdit(x, y, z, BlockId.Air);
        socket.send(JSON.stringify({
          type: "edit",
          x, y, z,
          blockId: 0,
        }));
      }
    }
  }, [infoBlocks, role, activeLayer, socket, applyVoxelEdit, hotbarIndex]);

  const handleSaveInfo = (newText: string) => {
    if (!interactTarget) return;
    socket.send(JSON.stringify({
      type: "place_info",
      x: interactTarget.x, y: interactTarget.y, z: interactTarget.z,
      info: newText
    }));
    setIsInfoModalOpen(false);
  };

  const currentChunks = activeLayer === "playground" ? editedMeshedChunks : originalMeshedChunks;

  return (
    <div className="w-full h-full relative bg-[#87CEEB]">
      {overlayVisible && (
        <LoadingOverlay 
          status={status}
          stats={stats}
          error={error}
          onFadeComplete={() => setOverlayVisible(false)}
          onExit={onExit}
          isConnectingSocket={!isSocketConnected}
        />
      )}

      {!overlayVisible && (
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={onExit}
            className="bg-black/50 text-white px-4 py-2 rounded hover:bg-black/70 backdrop-blur-sm border border-white/10 text-sm font-mono transition-colors"
          >
            &larr; MAP
          </button>
          <div className="bg-black/50 text-white px-4 py-2 rounded backdrop-blur-sm border border-white/10 text-sm font-mono flex items-center gap-2">
            <span>{isLocked ? "🔒 WASD + Mouse" : "🔓 Click to look around"}</span>
            <span className="text-white/40">|</span>
            <span className={`uppercase text-xs px-2 py-0.5 rounded ${movementMode === "fps" ? "bg-urban-blueprint/30 text-urban-blueprint" : "bg-urban-signal/30 text-urban-signal"}`}>
              {movementMode === "fps" ? "FPS" : "FLY"}
            </span>
            <span className="text-white/30 text-xs">[F]</span>
            <span className="text-white/40">|</span>
            <span className="text-urban-signal flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-urban-signal animate-pulse" /> LIVE
            </span>
          </div>
        </div>
      )}

      <Canvas shadows camera={{ fov: 60, near: 0.1, far: 2000 }}>
        <fogExp2 attach="fog" args={[appearance.fogColor, appearance.fogDensity]} />
        <Sky 
          sunPosition={[100, appearance.sunElevation, 100]} 
          turbidity={appearance.turbidity} 
          rayleigh={appearance.rayleigh} 
          mieCoefficient={0.005} 
          mieDirectionalG={0.8} 
        />
        <PixelClouds />
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[100, 200, 50]} 
          intensity={1.2} 
          castShadow 
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-200}
          shadow-camera-right={200}
          shadow-camera-top={200}
          shadow-camera-bottom={-200}
        />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow raycast={() => null}>
          <planeGeometry args={[20000, 20000]} />
          {repeatingWaterTexture && (
            <meshStandardMaterial 
              map={repeatingWaterTexture} 
              color="#1d4ed8"
              roughness={0.9}
              metalness={0.0}
            />
          )}
        </mesh>

        {islandBounds && repeatingGrassTexture && (
          <mesh 
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[
              (islandBounds.minX + islandBounds.maxX) / 2, 
              -0.55, 
              (islandBounds.minZ + islandBounds.maxZ) / 2
            ]} 
            receiveShadow
          >
            <planeGeometry args={[
              islandBounds.maxX - islandBounds.minX + 1, 
              islandBounds.maxZ - islandBounds.minZ + 1
            ]} />
            <meshStandardMaterial 
              map={repeatingGrassTexture} 
              color="#5C8542"
              roughness={0.9}
              metalness={0.0}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        )}

        {Object.entries(currentChunks).map(([id, list]) => {
          const blockId = Number(id);
          return (
            <MeshedChunk 
              key={`static-${blockId}`} 
              blockId={blockId} 
              cuboids={list} 
              texture={textures[blockId] || null}
            />
          );
        })}

        {activeLayer === "simulation" && projectedRoads.length > 0 && (
          <SimulationAgents roads={projectedRoads} />
        )}

        <InfoBlockHighlights infoBlocks={activeLayer === "council" ? infoBlocks : {}} />

        {players.filter(p => p.id !== socket?.id).map(p => (
          <OtherPlayer 
            key={p.id} 
            player={p} 
            activeChat={activeChats[p.id]} 
          />
        ))}

        <Player 
          onLock={() => {
            setIsLocked(true);
            if (isInfoModalOpen) setIsInfoModalOpen(false);
          }} 
          onUnlock={() => setIsLocked(false)}
          onModeChange={setMovementMode}
          onInteract={handleInteract}
          enabled={controlsEnabled && !isInfoModalOpen && !isMarkersDashboardOpen && !isActivityLogOpen}
          getBlock={getBlock}
          onMove={handlePlayerMove}
          onSelectIndex={setHotbarIndex}
          teleportPos={teleportPos}
        />

        <MiniMapTracker bbox={bbox} />
      </Canvas>

      {/* Hotbar Overlay */}
      {controlsEnabled && activeLayer !== "simulation" && (
        <Hotbar 
          activeLayer={activeLayer}
          hotbarIndex={hotbarIndex}
          onSelectIndex={setHotbarIndex}
          playgroundBlocks={PLAYGROUND_BLOCKS}
          councilBlocks={COUNCIL_BLOCKS}
        />
      )}

      {/* Layer Switcher */}
      {controlsEnabled && (
        <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <LayerSwitcher 
            activeLayer={activeLayer}
            onChange={setActiveLayer}
            role={role as "admin" | "builder" | "guest"}
          />
        </div>
      )}

      {/* Info Modal Overlay */}
      <InfoModal 
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        interactTarget={interactTarget}
        isEditingInfo={isEditingInfo}
        setIsEditingInfo={setIsEditingInfo}
        infoText={infoText}
        onSaveInfo={handleSaveInfo}
        role={role}
      />

      {!isLocked && controlsEnabled && !isInfoModalOpen && (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="text-white/70 font-mono text-sm bg-black/40 px-6 py-3 rounded-lg backdrop-blur-sm border border-white/10 text-center space-y-1">
            <p>Click anywhere to enter FPS mode</p>
            <p className="text-white/40 text-xs">WASD / Arrow keys · Mouse look · Space jump · F toggle fly · Esc exit</p>
            <p className="text-urban-park text-xs mt-2">Left Click on a block to read/write info</p>
          </div>
        </div>
      )}
      
      {/* Center Crosshair (Hidden for Guests) */}
      {isLocked && controlsEnabled && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center">
          <div className="w-1 h-1 bg-white rounded-full"></div>
          <div className="w-4 h-4 border-2 border-white/50 rounded-full absolute"></div>
        </div>
      )}

      {/* MiniMap Overlay */}
      {controlsEnabled && (
        <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <MiniMapUI 
            bbox={bbox} 
            infoBlocks={infoBlocks} 
            expanded={isMiniMapExpanded} 
            onToggleExpand={() => setIsMiniMapExpanded(!isMiniMapExpanded)} 
          />
        </div>
      )}

       {/* Activity Sidebar Overlay */}
      {controlsEnabled && (
        <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <ActivitySidebar 
            players={Object.values(players)} 
            logs={logs} 
            onSendChat={handleSendChat}
          />
        </div>
      )}
      
       {/* Action Buttons Bar */}
      {controlsEnabled && (
        <div className="absolute top-4 right-4 z-10 flex gap-2" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={() => {
              const url = `${window.location.origin}/?bbox=${bbox.join(",")}`;
              navigator.clipboard.writeText(url);
              alert("Foroom invite link copied to clipboard!");
            }}
            className="bg-[#1C1C1C]/90 backdrop-blur-md border border-[#333333] text-white px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold hover:bg-[#2A2A2A] transition-all flex items-center gap-2 cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-urban-park animate-pulse" />
            Share Link
          </button>
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="bg-urban-signal/90 backdrop-blur-md border border-urban-signal text-white px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold hover:bg-urban-signal/70 transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Logs
          </button>
          <button 
            onClick={() => setIsMarkersDashboardOpen(true)}
            className="bg-urban-blueprint/90 backdrop-blur-md border border-urban-blueprint text-white px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold hover:bg-urban-blueprint/70 transition-all flex items-center gap-2 cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
            Markers
          </button>
          <button 
            onClick={() => setIsMiniMapExpanded(!isMiniMapExpanded)}
            className="bg-black/80 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold hover:bg-white/10 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Map className="w-4 h-4" />
            {isMiniMapExpanded ? "Shrink Map" : "Expand Map"}
          </button>
          {role === "admin" && (
            <>
              <button 
                onClick={() => setIsAppearanceModalOpen(true)}
                className="bg-urban-signal/90 backdrop-blur-md border border-urban-signal text-white px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold hover:bg-urban-signal/70 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sun className="w-4 h-4" />
                Sky & Fog
              </button>
              <button 
                onClick={() => setIsAdminModalOpen(true)}
                className="bg-urban-brick/90 backdrop-blur-md border border-urban-brick text-white px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold hover:bg-urban-brick/70 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                Admin
              </button>
            </>
          )}
        </div>
      )}

      {/* Admin Dashboard Modal */}
      <AdminModal 
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        players={players}
        onChangeRole={(targetId, newRole) => {
          socket?.send(JSON.stringify({
            type: "admin_change_role",
            targetId,
            newRole
          }));
        }}
        onClearRoom={() => {
          socket?.send(JSON.stringify({ type: "admin_clear_room" }));
        }}
      />

      <AdminAppearancePanel 
        isOpen={isAppearanceModalOpen}
        onClose={() => setIsAppearanceModalOpen(false)}
        appearance={appearance}
        onChange={(app) => {
          setAppearance(app);
          socket?.send(JSON.stringify({
            type: "appearance_update",
            appearance: app
          }));
        }}
      />

      <MarkersDashboardModal 
        isOpen={isMarkersDashboardOpen}
        onClose={() => setIsMarkersDashboardOpen(false)}
        infoBlocks={infoBlocks}
        onTeleport={handleTeleport}
      />

      <ActivityLogModal 
        isOpen={isActivityLogOpen}
        onClose={() => setIsActivityLogOpen(false)}
        logs={logs}
      />
    </div>
  );
}
