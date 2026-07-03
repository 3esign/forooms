import React, { useMemo, useState, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getGridDimensionsFromBbox } from "../../lib/osm/fetcher";
import { Bbox } from "../../lib/osm/types";
import maplibregl from "maplibre-gl";
import { Maximize2, Minimize2 } from "lucide-react";

// Renders the actual UI. Put this outside the Canvas.
export function MiniMapUI({ bbox, infoBlocks, expanded, onToggleExpand }: { bbox: Bbox, infoBlocks: Record<string, string>, expanded: boolean, onToggleExpand: () => void }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  const { width, depth } = useMemo(() => getGridDimensionsFromBbox(bbox), [bbox]);
  
  // World bounds are approximately [-width, width] and [-depth, depth]
  const mapSize = expanded ? 400 : 200;

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;
    
    // Initialize static map
    const centerLng = (bbox[0] + bbox[2]) / 2;
    const centerLat = (bbox[1] + bbox[3]) / 2;
    
    // Esri World Imagery Satellite Map style object for MapLibre
    const satelliteStyle = {
      version: 8,
      sources: {
        satellite: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256,
          attribution: "Esri"
        }
      },
      layers: [
        {
          id: "satellite",
          type: "raster",
          source: "satellite",
          minzoom: 0,
          maxzoom: 19
        }
      ]
    };
    
    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: satelliteStyle as any,
      center: [centerLng, centerLat],
      zoom: 17, // Approximating zoom based on typical voxel area, you may need to adjust
      interactive: false,
      attributionControl: false
    });
    
    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [bbox]);

  // Adjust map on resize
  useEffect(() => {
    if (mapInstance.current) {
      setTimeout(() => mapInstance.current?.resize(), 100);
    }
  }, [expanded]);
  
  
  const toMapCoords = (worldX: number, worldZ: number) => {
    // Map world [-width/2, width/2] to [0, mapSize]
    const x = ((worldX + width / 2) / width) * mapSize;
    const z = ((worldZ + depth / 2) / depth) * mapSize;
    return { x, z };
  };

  const infoMarkers = useMemo(() => {
    const markers: {x: number, z: number}[] = [];
    for (const key of Object.keys(infoBlocks)) {
      const [vx, vy, vz] = key.split(",").map(Number);
      // voxel to world is 1:1
      const worldX = vx;
      const worldZ = vz;
      markers.push(toMapCoords(worldX, worldZ));
    }
    return markers;
  }, [infoBlocks, width, depth]);

  return (
    <div className={`absolute bottom-6 right-6 transition-all duration-300 ${expanded ? 'w-[400px] h-[400px] rounded-2xl' : 'w-[200px] h-[200px] rounded-full'} bg-urban-void/80 border-2 border-urban-concrete/30 overflow-hidden shadow-2xl z-20 pointer-events-auto`}>
      
      {/* Mapbox Background */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full opacity-95" />

      {/* Grid lines */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />

      {/* Info Markers */}
      {infoMarkers.map((m, i) => (
        <div 
          key={i} 
          className="absolute w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,1)] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: m.x, top: m.z }}
        />
      ))}

      {/* Local Player Marker */}
      <div 
        id="minimap-player"
        className="absolute w-3 h-3 bg-urban-blueprint rounded-full shadow-[0_0_10px_rgba(47,129,247,1)] transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 pointer-events-none"
        style={{ left: '50%', top: '50%' }} // default center
      >
        <div 
          id="minimap-player-dir"
          className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-transparent border-b-white absolute -top-1.5 left-1/2 transform -translate-x-1/2 origin-[50%_10px]" 
        />
      </div>

      {/* Expand/Collapse Toggle */}
      <button 
        onClick={onToggleExpand}
        className="absolute bottom-4 right-4 bg-black/60 hover:bg-black p-2 rounded-full border border-white/20 text-white transition-colors"
      >
        {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

// Put this inside the Canvas. It updates the DOM directly for performance.
export function MiniMapTracker({ bbox, expanded }: { bbox: Bbox, expanded?: boolean }) {
  const { width, depth } = useMemo(() => getGridDimensionsFromBbox(bbox), [bbox]);
  const mapSize = expanded ? 400 : 200;

  useFrame(({ camera }) => {
    const el = document.getElementById("minimap-player");
    const dirEl = document.getElementById("minimap-player-dir");
    if (!el || !dirEl) return;

    const x = ((camera.position.x + width / 2) / width) * mapSize;
    const z = ((camera.position.z + depth / 2) / depth) * mapSize;
    
    // Clamp to map bounds
    const cx = Math.max(0, Math.min(mapSize, x));
    const cz = Math.max(0, Math.min(mapSize, z));

    el.style.left = `${cx}px`;
    el.style.top = `${cz}px`;

    // Calculate yaw rotation
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    // euler.y is yaw in radians. We want to rotate the arrow. 0 is -Z (North).
    const deg = (euler.y * 180) / Math.PI;
    dirEl.style.transform = `translate(-50%, 0) rotate(${deg}deg)`;
  });

  return null;
}
