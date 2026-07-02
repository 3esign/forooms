import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { getBlockDef } from "../../lib/blocks/BlockRegistry";
import { Cuboid, buildGeometryFromCuboids } from "../../lib/voxel/mesher";

const VOXEL_SIZE = 2;

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
      <meshLambertMaterial map={texture || undefined} />
    </instancedMesh>
  );
}

export function MeshedChunk({ cuboids, blockId, texture }: { cuboids: Cuboid[]; blockId: number; texture: THREE.Texture | null }) {
  const geometry = useMemo(() => buildGeometryFromCuboids(cuboids), [cuboids]);
  const def = getBlockDef(blockId);
  const castsShadow = def ? def.castsShadow : false;

  return (
    <mesh geometry={geometry} castShadow={castsShadow} receiveShadow>
      <meshLambertMaterial map={texture || undefined} />
    </mesh>
  );
}
