"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AvatarMesh } from "./VoxelMesh";

function SpinningAvatar({ color, nodes }: { color: string; nodes: number }) {
  const ref = useRef<any>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 1.5;
    }
  });

  return (
    <group ref={ref} position={[0, -0.6, 0]}>
      <AvatarMesh color={color} nodes={nodes} size={1} />
    </group>
  );
}

export default function AvatarPreview({ color = "#3b82f6", nodes = 4 }: { color: string; nodes: number }) {
  return (
    <div className="w-full h-32 bg-black/40 border border-white/10 rounded-xl overflow-hidden relative shadow-inner">
      <Canvas camera={{ position: [0, 0.4, 1.8], fov: 50 }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[5, 5, 5]} intensity={1.5} />
        <SpinningAvatar color={color} nodes={nodes} />
      </Canvas>
    </div>
  );
}
