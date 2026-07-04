import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getBlockDef } from "../../lib/blocks/BlockRegistry";
import { Cuboid, buildGeometryFromCuboids } from "../../lib/voxel/mesher";
import { Html } from "@react-three/drei";
import { PRNG } from "../../lib/voxel/prng";
import { PlayerState } from "@/types/auth";

const VOXEL_SIZE = 1;

export interface VoxelBlock {
  x: number;
  y: number;
  z: number;
  blockId: number;
}

export function VoxelMesh({ voxelList, blockId, texture }: { voxelList: VoxelBlock[]; blockId: number; texture: THREE.Texture | null }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { positions, colors } = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    
    voxelList.forEach(voxel => {
      pos.push(voxel.x * VOXEL_SIZE, voxel.y * VOXEL_SIZE, voxel.z * VOXEL_SIZE);
      col.push(1, 1, 1); 
    });

    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col)
    };
  }, [voxelList]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (meshRef.current && positions.length > 0) {
      const count = positions.length / 3;
      for (let idx = 0; idx < count; idx++) {
        dummy.position.set(
          positions[idx * 3],
          positions[idx * 3 + 1],
          positions[idx * 3 + 2]
        );
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx, dummy.matrix);
        meshRef.current.setColorAt(
          idx,
          new THREE.Color(
            colors[idx * 3],
            colors[idx * 3 + 1],
            colors[idx * 3 + 2]
          )
        );
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
      meshRef.current.computeBoundingSphere();
      meshRef.current.computeBoundingBox();
    }
  }, [positions, colors, dummy]);

  if (positions.length === 0) return null;

  const def = getBlockDef(blockId);
  const castsShadow = def ? def.castsShadow : false;

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[undefined, undefined, positions.length / 3]}
      castShadow={castsShadow}
      receiveShadow
      frustumCulled={false}
    >
      <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
      <meshStandardMaterial map={texture || undefined} />
    </instancedMesh>
  );
}

export function MeshedChunk({ cuboids, blockId, texture }: { cuboids: Cuboid[]; blockId: number; texture: THREE.Texture | null }) {
  const geometry = useMemo(() => buildGeometryFromCuboids(cuboids, blockId), [cuboids, blockId]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const def = getBlockDef(blockId);
  const castsShadow = def ? def.castsShadow : false;

  return (
    <mesh geometry={geometry} castShadow={castsShadow} receiveShadow>
      <meshStandardMaterial map={texture || undefined} />
    </mesh>
  );
}

function AnimatedPin({ position, commentCount = 1 }: { position: [number, number, number]; commentCount?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const initialY = position[1] + VOXEL_SIZE * 0.7; // Start slightly above block
  
  // Scale increases by 0.15 per comment, capped at 2.2x
  const scale = Math.min(2.2, 1.0 + (commentCount - 1) * 0.15);

  useFrame((state) => {
    if (groupRef.current) {
      // Bob up and down
      groupRef.current.position.y = initialY + Math.sin(state.clock.elapsedTime * 3) * 0.2;
      // Slowly rotate
      groupRef.current.rotation.y = state.clock.elapsedTime;
    }
  });

  return (
    <group ref={groupRef} position={[position[0], initialY, position[2]]} scale={[scale, scale, scale]}>
      {/* Pin Head - Set userData so raycasting can detect the pin's base coordinates */}
      <mesh position={[0, 1.2, 0]} userData={{ type: "pin", x: position[0], y: position[1], z: position[2] }}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial color="#EF4444" roughness={0.2} metalness={0.1} />
      </mesh>
      {/* Pin Body - Set userData so raycasting can detect the pin's base coordinates */}
      <mesh position={[0, 0.6, 0]} userData={{ type: "pin", x: position[0], y: position[1], z: position[2] }}>
        <coneGeometry args={[0.1, 1.2, 16]} />
        <meshStandardMaterial color="#EF4444" roughness={0.2} metalness={0.1} />
      </mesh>
    </group>
  );
}

export function InfoBlockHighlights({ infoBlocks }: { infoBlocks: Record<string, string> }) {
  const keys = Object.keys(infoBlocks);
  if (keys.length === 0) return null;

  return (
    <group>
      {keys.map(key => {
        const [x, y, z] = key.split(",").map(Number);
        
        // Parse comments count to determine pin scale
        const text = infoBlocks[key] || "";
        let count = 1;
        try {
          if (text.startsWith("[") && text.endsWith("]")) {
            count = JSON.parse(text).length;
          }
        } catch (e) {}

        return (
          <AnimatedPin 
            key={key} 
            position={[x * VOXEL_SIZE, y * VOXEL_SIZE, z * VOXEL_SIZE]} 
            commentCount={count}
          />
        );
      })}
    </group>
  );
}

export function AvatarMesh({ color = "#3b82f6", nodes = 4, size = 1 }) {
  return (
    <group>
      {/* Head: Light icosahedron */}
      <mesh position={[0, size * 0.9, 0]}>
        <icosahedronGeometry args={[size * 0.25, 1]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Body: Inverted cone */}
      <mesh position={[0, size * 0.45, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[size * 0.3, size * 0.7, nodes]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  );
}

export function OtherPlayer({ player, activeChat }: { player: PlayerState; activeChat?: { message: string; timestamp: number } }) {
  const showChat = activeChat && (Date.now() - activeChat.timestamp < 5000);

  return (
    <group position={[player.x || 0, player.y || 1.5, player.z || 0]}>
      <AvatarMesh color={player.avatarColor} nodes={player.avatarNodes} />
      
      {/* Nameplate & Chat Bubble */}
      <Html position={[0, 1.4, 0]} center distanceFactor={15}>
        <div className="flex flex-col items-center select-none pointer-events-none font-mono">
          {showChat && (
            <div className="bg-[#111111]/95 text-white px-3 py-1.5 rounded-lg border-2 border-white text-xs mb-2 max-w-[180px] break-words text-center shadow-lg relative animate-bounce font-bold tracking-wide">
              {activeChat.message}
              <div className="w-2 h-2 bg-[#111111] border-r-2 border-b-2 border-white rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2" />
            </div>
          )}
          <div className="bg-black/80 border border-white/20 px-2 py-0.5 rounded text-[10px] font-bold text-white/90 whitespace-nowrap shadow-md uppercase tracking-wider">
            {player.nick || "Builder"}
          </div>
        </div>
      </Html>
    </group>
  );
}

interface CloudVoxel {
  x: number;
  y: number;
  z: number;
  color: string;
}

function generateVoxelCloud(prng: PRNG, width: number, height: number, depth: number): CloudVoxel[] {
  const voxels: CloudVoxel[] = [];
  const cx = width / 2;
  const cy = height / 2;
  const cz = depth / 2;

  // Generate 3-5 overlapping ellipsoids to form a fluffy shape
  const numMetaballs = 3 + Math.floor(prng.next() * 3);
  const metaballs = [];
  for (let i = 0; i < numMetaballs; i++) {
    metaballs.push({
      x: cx + (prng.next() - 0.5) * (width * 0.5),
      y: cy + (prng.next() - 0.5) * (height * 0.4),
      z: cz + (prng.next() - 0.5) * (depth * 0.5),
      rx: (0.35 + prng.next() * 0.3) * width,
      ry: (0.35 + prng.next() * 0.3) * height,
      rz: (0.35 + prng.next() * 0.3) * depth
    });
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        let sum = 0;
        for (const mb of metaballs) {
          const dx = (x - mb.x) / mb.rx;
          const dy = (y - mb.y) / mb.ry;
          const dz = (z - mb.z) / mb.rz;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < 1) {
            sum += (1 - d) * (1 - d);
          }
        }

        if (sum > 0.2) {
          // Color gradient based on vertical height (shading)
          let color = "#ffffff"; // Top layer: pure white
          if (y === 0) {
            color = "#cbd5e1"; // Bottom layer: soft blue-gray shadow
          } else if (y === 1) {
            color = "#f1f5f9"; // Mid layer: off-white
          }
          voxels.push({ x: x - cx, y: y - cy, z: z - cz, color });
        }
      }
    }
  }
  return voxels;
}

export function PixelClouds() {
  const count = 12;
  const clouds = useMemo(() => {
    const list = [];
    // Deterministic random generator for clouds
    let seed = 12345;
    const rand = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < count; i++) {
      const x = rand() * 600 - 300;
      const y = 50 + rand() * 25; // Height between 50 and 75
      const z = rand() * 600 - 300;
      const speed = 0.2 + rand() * 0.6;
      
      // Grid dimensions (small grid for performance, scaled up in Three.js)
      const w = 8 + Math.floor(rand() * 5);
      const h = 3;
      const d = 6 + Math.floor(rand() * 4);
      
      list.push({ id: i, x, y, z, speed, w, h, d });
    }
    return list;
  }, []);

  return (
    <group>
      {clouds.map(c => (
        <PixelCloud key={c.id} cloud={c} />
      ))}
    </group>
  );
}

function PixelCloud({ cloud }: { cloud: any }) {
  const ref = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.position.x += cloud.speed * delta * 4;
      if (ref.current.position.x > 350) {
        ref.current.position.x = -350;
      }
    }
  });

  const voxels = useMemo(() => {
    const prng = new PRNG(cloud.id * 1000 + 4321);
    return generateVoxelCloud(prng, cloud.w, cloud.h, cloud.d);
  }, [cloud]);

  // Scale of cloud voxels to make them chunky and retro
  const boxSize = 2.0;

  return (
    <group ref={ref} position={[cloud.x, cloud.y, cloud.z]}>
      {voxels.map((v, i) => (
        <mesh 
          key={i} 
          position={[v.x * boxSize, v.y * boxSize, v.z * boxSize]} 
          castShadow={false} 
          receiveShadow={false}
        >
          <boxGeometry args={[boxSize, boxSize, boxSize]} />
          <meshStandardMaterial 
            color={v.color} 
            roughness={0.9} 
            metalness={0.0} 
            transparent 
            opacity={0.8} 
            flatShading 
          />
        </mesh>
      ))}
    </group>
  );
}

