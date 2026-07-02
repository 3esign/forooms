import React, { useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import usePartySocket from "partysocket/react";
import { PartySocket } from "partysocket";

import { Bbox } from "../../lib/osm/types";
import { fetchOSMData, projectLatLngToGrid, getGridDimensionsFromBbox } from "../../lib/osm/fetcher";
import { CityGrid } from "../../lib/voxel/CityGrid";
import { BlockId } from "../../lib/blocks/BlockRegistry";
import { createAllTextures } from "./TextureAtlas";
import { VoxelMesh, VoxelBlock, MeshedChunk } from "./VoxelMesh";
import { Player, MovementMode } from "./Player";
import { LoadingOverlay } from "./LoadingOverlay";
import { PRNG, hashBbox } from "../../lib/voxel/prng";
import { greedyMeshGrid, Cuboid } from "../../lib/voxel/mesher";

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

interface VoxelSceneProps {
  bbox: Bbox;
  onExit: () => void;
  token?: string;
}

export function VoxelScene({ bbox, onExit, token }: VoxelSceneProps) {
  const [status, setStatus] = useState<"idle" | "fetching" | "projecting" | "rasterizing" | "completed" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [movementMode, setMovementMode] = useState<MovementMode>("fps");
  const [textures, setTextures] = useState<Record<number, THREE.Texture>>({});
  const controlsEnabled = !overlayVisible && status === "completed";

  const [stats, setStats] = useState({ buildings: 0, roads: 0, grass: 0, buildingVoxels: 0, vegetation: 0 });

  // Mesh States
  const [meshes, setMeshes] = useState<Record<number, VoxelBlock[]>>({});
  const [meshedChunks, setMeshedChunks] = useState<Record<number, Cuboid[]>>({});

  // Real-time edits
  const [externalEdits, setExternalEdits] = useState<VoxelBlock[]>([]);

  // Connect to PartyKit
  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
    room: `foroom-${bbox.join("-")}`,
    query: token ? { token } : undefined,
    onMessage: (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "init") {
          const loadedEdits: VoxelBlock[] = [];
          msg.edits.forEach((edit: any) => {
            loadedEdits.push({ x: edit.x, y: edit.y, z: edit.z, blockId: edit.blockId });
          });
          setExternalEdits(loadedEdits);
        } else if (msg.type === "edit") {
          setExternalEdits(prev => {
            // Remove existing block at coordinate if replacing/deleting
            const filtered = prev.filter(b => b.x !== msg.x || b.y !== msg.y || b.z !== msg.z);
            if (msg.blockId !== 0) { // Assuming 0 is Air/Delete
              filtered.push({ x: msg.x, y: msg.y, z: msg.z, blockId: msg.blockId });
            }
            return filtered;
          });
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

        // 1. Landuse zones (lowest priority)
        osmData.landuse.forEach(zone => {
          const pts = zone.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintLanduseZoneOnGrid(pts, grid, zone.type);
        });

        // 2. Parks
        osmData.parks.forEach(park => {
          const pts = park.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintParkOnGrid(pts, grid, park.type);
        });

        // 3. Natural
        osmData.beaches.forEach(beach => {
          const pts = beach.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintBeachOnGrid(pts, grid);
        });
        osmData.scrub.forEach(scr => {
          const pts = scr.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintScrubOnGrid(pts, grid);
        });

        // 4. Waterways
        osmData.waterways.forEach(ww => {
          const pts = ww.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintWaterwayOnGrid(pts, grid);
        });

        // 5. Parking
        osmData.parking.forEach(p => {
          const pts = p.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintParkingOnGrid(pts, grid);
        });

        // 6. Railways
        osmData.railways.forEach(rail => {
          const pts = rail.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintRailwayOnGrid(pts, grid, 2);
          if (rail.isStation) paintStationPlatform(pts, grid);
        });

        // 7. Roads
        osmData.roads.forEach(road => {
          const pts = road.coordinates.map(c => projectLatLngToGrid(c, origin));
          const width = ["motorway", "trunk"].includes(road.type) ? 8 :
                        ["primary", "secondary"].includes(road.type) ? 6 :
                        road.type === "service" ? 2 : 4;
          
          if (road.type === "service") {
            paintServiceRoadOnGrid(pts, grid, width);
          } else {
            paintRoadOnGrid(pts, grid, width);
          }
        });

        // 8. Paths
        osmData.paths.forEach(path => {
          const pts = path.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintFootpathOnGrid(pts, grid, 2);
        });

        // 9. Buildings
        osmData.buildings.forEach(b => {
          const pts = b.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintBuildingOnGrid(pts, b.heightLevels, b.type, grid);
        });

        // 10. Sidewalks
        generateBuildingSidewalks(grid);

        // 11. Barriers
        osmData.barriers.forEach(barrier => {
          const pts = barrier.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintBarrierOnGrid(pts, grid);
        });

        // 12. Vegetation
        osmData.treeRows.forEach(tr => {
          const pts = tr.coordinates.map(c => projectLatLngToGrid(c, origin));
          paintTreeRowOnGrid(pts, grid);
        });
        // 9. Trees & Council blocks (Deterministic)
        runTreePass(grid, prng);
        generateCouncilEditableVoxels(grid, prng);

        // --- EXPORT TO MESHES ---
        // We use greedy meshing for the static environment base
        const chunks = greedyMeshGrid(grid);
        setMeshedChunks(chunks);

        // Calculate stats from chunks
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
          grass: 1, // Single plane now
          buildingVoxels: totalConcrete,
          vegetation: totalVegetation,
        });

        if (active) setStatus("completed");
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

  // Group external edits by material for rendering as InstancedMesh
  const dynamicMeshes = useMemo(() => {
    const grouped: Record<number, VoxelBlock[]> = {};
    externalEdits.forEach(edit => {
      if (!grouped[edit.blockId]) grouped[edit.blockId] = [];
      grouped[edit.blockId].push(edit);
    });
    return grouped;
  }, [externalEdits]);

  const repeatingGrassTexture = useMemo(() => {
    if (!textures[BlockId.Grass]) return null;
    const tex = textures[BlockId.Grass].clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2000, 2000); // 4000x4000 plane, voxels are 2x2 so 2000 repeats
    tex.needsUpdate = true;
    return tex;
  }, [textures]);

  return (
    <div className="w-full h-full relative bg-[#87CEEB]">
      {overlayVisible && (
        <LoadingOverlay 
          status={status}
          stats={stats}
          error={error}
          onFadeComplete={() => setOverlayVisible(false)}
          onExit={onExit}
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
        <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
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
        
        {/* Dynamic Ground Plane (Replacing 160k Grass Instances) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[4000, 4000]} />
          {repeatingGrassTexture && (
            <meshStandardMaterial 
              map={repeatingGrassTexture} 
              color="#5C8542"
            />
          )}
        </mesh>

        {Object.entries(meshedChunks).map(([id, list]) => {
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

        {Object.entries(dynamicMeshes).map(([id, list]) => {
          const blockId = Number(id);
          return (
            <VoxelMesh 
              key={`dynamic-${blockId}`} 
              blockId={blockId} 
              voxelList={list} 
              texture={textures[blockId] || null} 
            />
          );
        })}

        <Player 
          onLock={() => setIsLocked(true)} 
          onUnlock={() => setIsLocked(false)}
          onModeChange={setMovementMode}
          enabled={controlsEnabled}
        />
      </Canvas>

      {!isLocked && controlsEnabled && (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="text-white/70 font-mono text-sm bg-black/40 px-6 py-3 rounded-lg backdrop-blur-sm border border-white/10 text-center space-y-1">
            <p>Click anywhere to enter FPS mode</p>
            <p className="text-white/40 text-xs">WASD move · Mouse look · Space jump · F toggle fly · Esc exit</p>
          </div>
        </div>
      )}
      
      {isLocked && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white/50 rounded-full mix-blend-difference pointer-events-none z-50" />
      )}
    </div>
  );
}
