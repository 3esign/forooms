import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SimulationAgentsProps {
  roads: [number, number][][];
}

export function SimulationAgents({ roads }: SimulationAgentsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Create agents from roads
  const agents = useMemo(() => {
    const validRoads = roads.filter(r => r.length > 1);
    const agentsList: { road: [number, number][], progress: number, speed: number, color: THREE.Color }[] = [];
    
    // Create roughly 1 agent per road
    validRoads.forEach(road => {
      agentsList.push({
        road,
        progress: Math.random(), // 0 to 1 along the path
        speed: 0.005 + Math.random() * 0.005,
        color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6) // Cyberpunk neon colors
      });
    });
    
    return agentsList;
  }, [roads]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    agents.forEach((agent, i) => {
      agent.progress += agent.speed * (delta * 10);
      if (agent.progress > 1) agent.progress = 0;
      
      const path = agent.road;
      // Calculate exact position based on progress
      const totalSegments = path.length - 1;
      const exactIndex = agent.progress * totalSegments;
      const segmentIndex = Math.floor(exactIndex);
      const segmentProgress = exactIndex - segmentIndex;
      
      const p1 = path[segmentIndex];
      const p2 = path[Math.min(segmentIndex + 1, path.length - 1)];
      
      if (!p1 || !p2) return;

      const x = p1[0] + (p2[0] - p1[0]) * segmentProgress;
      const z = p1[1] + (p2[1] - p1[1]) * segmentProgress;
      
      // Floating slightly above road (y=1 for road, so y=2)
      dummy.position.set(x, 1.5, z);
      
      // Direction
      const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      dummy.rotation.y = -angle; 
      dummy.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, agent.color);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.instanceColor!.needsUpdate = true;
  });

  if (agents.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, agents.length]}>
      <boxGeometry args={[0.5, 0.5, 1.2]} />
      <meshStandardMaterial emissive="#4080ff" emissiveIntensity={0.5} toneMapped={false} />
    </instancedMesh>
  );
}
