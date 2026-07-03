import * as THREE from "three";
import { CityGrid } from "./CityGrid";
import { BlockId } from "../blocks/BlockRegistry";

export interface Cuboid {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  facesMask?: number; // Bitmask of visible faces: +Z (1), -Z (2), +Y (4), -Y (8), +X (16), -X (32)
}

const CHUNK_SIZE = 16;

function toChunk(v: number): number {
  return Math.floor(v / CHUNK_SIZE);
}

function isFaceOccluded(
  grid: CityGrid,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  faceAxis: number,
  faceDir: number
): boolean {
  if (faceAxis === 0) { // X axis face (Left/Right)
    const nx = faceDir > 0 ? x + w : x - 1;
    for (let ly = 0; ly < h; ly++) {
      for (let lz = 0; lz < d; lz++) {
        if (grid.getVoxel(nx, y + ly, z + lz) === BlockId.Air) {
          return false;
        }
      }
    }
  } else if (faceAxis === 1) { // Y axis face (Top/Bottom)
    const ny = faceDir > 0 ? y + h : y - 1;
    if (ny < 0) return true; // Ground bottom is always occluded
    for (let lx = 0; lx < w; lx++) {
      for (let lz = 0; lz < d; lz++) {
        if (grid.getVoxel(x + lx, ny, z + lz) === BlockId.Air) {
          return false;
        }
      }
    }
  } else { // Z axis face (Front/Back)
    const nz = faceDir > 0 ? z + d : z - 1;
    for (let lx = 0; lx < w; lx++) {
      for (let ly = 0; ly < h; ly++) {
        if (grid.getVoxel(x + lx, y + ly, nz) === BlockId.Air) {
          return false;
        }
      }
    }
  }
  return true; // Fully occluded by neighboring blocks
}

/**
 * Remesh only the 16³ chunks touched by a single voxel edit.
 */
export function patchMeshedChunksAfterEdit(
  grid: CityGrid,
  current: Record<number, Cuboid[]>,
  x: number,
  y: number,
  z: number,
  oldBlockId: number,
  newBlockId: number
): Record<number, Cuboid[]> {
  const affectedMaterials = new Set<number>();
  if (oldBlockId !== BlockId.Air) affectedMaterials.add(oldBlockId);
  if (newBlockId !== BlockId.Air) affectedMaterials.add(newBlockId);
  if (affectedMaterials.size === 0) return current;

  const cx = toChunk(x);
  const cy = toChunk(y);
  const cz = toChunk(z);

  const next: Record<number, Cuboid[]> = { ...current };
  for (const blockId of affectedMaterials) {
    next[blockId] = (next[blockId] ?? []).filter((c) => {
      const ccx = toChunk(c.x);
      const ccy = toChunk(c.y);
      const ccz = toChunk(c.z);
      return !(ccx === cx && ccy === cy && ccz === cz);
    });
  }

  const chunkMeshes = greedyMeshChunks(grid, [{ cx, cy, cz }], affectedMaterials);
  for (const [idStr, cuboids] of Object.entries(chunkMeshes)) {
    const blockId = Number(idStr);
    next[blockId] = [...(next[blockId] ?? []), ...cuboids];
  }

  return next;
}

function greedyMeshChunks(
  grid: CityGrid,
  chunks: { cx: number; cy: number; cz: number }[],
  materialsFilter?: Set<number>
): Record<number, Cuboid[]> {
  const result: Record<number, Cuboid[]> = {};

  for (const { cx, cy, cz } of chunks) {
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;
    const endX = startX + CHUNK_SIZE - 1;
    const endY = startY + CHUNK_SIZE - 1;
    const endZ = startZ + CHUNK_SIZE - 1;

    const materials = new Set<number>();
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        for (let z = startZ; z <= endZ; z++) {
          const b = grid.getVoxel(x, y, z);
          if (b !== BlockId.Air) materials.add(b);
        }
      }
    }

    const width = CHUNK_SIZE;
    const depth = CHUNK_SIZE;
    const mask = new Int8Array(width * depth);

    for (const blockId of materials) {
      if (materialsFilter && !materialsFilter.has(blockId)) continue;

      const cuboids: Cuboid[] = [];

      for (let y = startY; y <= endY; y++) {
        let maskIdx = 0;
        for (let lx = 0; lx < width; lx++) {
          for (let lz = 0; lz < depth; lz++) {
            const actualX = startX + lx;
            const actualZ = startZ + lz;
            const b = grid.getVoxel(actualX, y, actualZ);
            mask[maskIdx++] = b === blockId ? 1 : 0;
          }
        }

        maskIdx = 0;
        for (let lx = 0; lx < width; lx++) {
          for (let lz = 0; lz < depth; lz++) {
            if (mask[maskIdx] === 1) {
              let w = 1;
              while (lx + w < width && mask[maskIdx + w * depth] === 1) w++;

              let d = 1;
              let done = false;
              while (lz + d < depth) {
                for (let i = 0; i < w; i++) {
                  if (mask[maskIdx + i * depth + d] !== 1) {
                    done = true;
                    break;
                  }
                }
                if (done) break;
                d++;
              }

              const cx = startX + lx;
              const cz = startZ + lz;
              let facesMask = 0;
              if (!isFaceOccluded(grid, cx, y, cz, w, 1, d, 2, 1)) facesMask |= 1;  // +Z
              if (!isFaceOccluded(grid, cx, y, cz, w, 1, d, 2, -1)) facesMask |= 2; // -Z
              if (!isFaceOccluded(grid, cx, y, cz, w, 1, d, 1, 1)) facesMask |= 4;  // +Y
              if (!isFaceOccluded(grid, cx, y, cz, w, 1, d, 1, -1)) facesMask |= 8; // -Y
              if (!isFaceOccluded(grid, cx, y, cz, w, 1, d, 0, 1)) facesMask |= 16; // +X
              if (!isFaceOccluded(grid, cx, y, cz, w, 1, d, 0, -1)) facesMask |= 32;// -X

              cuboids.push({
                x: cx,
                y,
                z: cz,
                w,
                h: 1,
                d,
                facesMask,
              });

              for (let i = 0; i < w; i++) {
                for (let j = 0; j < d; j++) {
                  mask[maskIdx + i * depth + j] = 0;
                }
              }
            }
            maskIdx++;
          }
        }
      }

      if (cuboids.length > 0) {
        if (!result[blockId]) result[blockId] = [];
        result[blockId].push(...cuboids);
      }
    }
  }

  return result;
}

export function greedyMeshGrid(grid: CityGrid): Record<number, Cuboid[]> {
  const result: Record<number, Cuboid[]> = {};
  
  const minX = grid.minX;
  const maxX = grid.maxX;
  const minZ = grid.minZ;
  const maxZ = grid.maxZ;
  
  let maxY = 0;
  const materials = new Set<number>();
  
  for (const [key, blockId] of grid.getEntries()) {
    const y = parseInt(key.split(",")[1], 10);
    if (y > maxY) maxY = y;
    if (blockId !== BlockId.Air) {
      materials.add(blockId);
    }
  }
  materials.add(BlockId.Grass);

  const width = maxX - minX + 1;
  const depth = maxZ - minZ + 1;
  const height = maxY + 1;

  const mask = new Int8Array(width * depth);

  for (const blockId of materials) {
    const cuboids: Cuboid[] = [];

    // Sweep over Y slices
    for (let y = 0; y < height; y++) {
      let maskIdx = 0;
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          const actualX = minX + x;
          const actualZ = minZ + z;
          const b = grid.getVoxel(actualX, y, actualZ);
          mask[maskIdx++] = (b === blockId) ? 1 : 0;
        }
      }

      maskIdx = 0;
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          if (mask[maskIdx] === 1) {
            let w = 1;
            while (x + w < width && mask[maskIdx + w * depth] === 1) {
              w++;
            }
            
            let d = 1;
            let done = false;
            while (z + d < depth) {
              for (let i = 0; i < w; i++) {
                if (mask[maskIdx + i * depth + d] !== 1) {
                  done = true;
                  break;
                }
              }
              if (done) break;
              d++;
            }

            const actualX = minX + x;
            const actualZ = minZ + z;
            
            cuboids.push({
              x: actualX,
              y: y,
              z: actualZ,
              w: w,
              h: 1,
              d: d
            });

            for (let i = 0; i < w; i++) {
              for (let j = 0; j < d; j++) {
                mask[maskIdx + i * depth + j] = 0;
              }
            }
          }
          maskIdx++;
        }
      }
    }
    
    // Vertical Merging Pass
    for (let i = 0; i < cuboids.length; i++) {
      const c1 = cuboids[i];
      if (!c1) continue;

      for (let j = i + 1; j < cuboids.length; j++) {
        const c2 = cuboids[j];
        if (!c2) continue;

        if (c1.x === c2.x && c1.z === c2.z && c1.w === c2.w && c1.d === c2.d && c1.y + c1.h === c2.y) {
          c1.h += c2.h;
          cuboids[j] = null as any;
        }
      }
    }

    const finalCuboids = cuboids.filter(c => c !== null);
    // Adjacency-Aware Face Occlusion Pass
    for (const c of finalCuboids) {
      let facesMask = 0;
      if (!isFaceOccluded(grid, c.x, c.y, c.z, c.w, c.h, c.d, 2, 1)) facesMask |= 1;  // +Z
      if (!isFaceOccluded(grid, c.x, c.y, c.z, c.w, c.h, c.d, 2, -1)) facesMask |= 2; // -Z
      if (!isFaceOccluded(grid, c.x, c.y, c.z, c.w, c.h, c.d, 1, 1)) facesMask |= 4;  // +Y
      if (!isFaceOccluded(grid, c.x, c.y, c.z, c.w, c.h, c.d, 1, -1)) facesMask |= 8; // -Y
      if (!isFaceOccluded(grid, c.x, c.y, c.z, c.w, c.h, c.d, 0, 1)) facesMask |= 16; // +X
      if (!isFaceOccluded(grid, c.x, c.y, c.z, c.w, c.h, c.d, 0, -1)) facesMask |= 32;// -X
      c.facesMask = facesMask;
    }

    result[blockId] = finalCuboids;
  }

  return result;
}

export function buildGeometryFromCuboids(cuboids: Cuboid[], blockId: number): THREE.BufferGeometry {
  const PODIUM_Y = 0.0;
  const isUrban = [
    BlockId.Concrete, BlockId.Wall, BlockId.Asphalt, BlockId.Sidewalk,
    BlockId.Railway, BlockId.Platform, BlockId.Parking, BlockId.Footpath, BlockId.ServiceRoad
  ].includes(blockId);
  const yOffset = isUrban ? PODIUM_Y : 0;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  let vertexOffset = 0;

  for (const c of cuboids) {
    const px = c.x - 0.5;
    const py = c.y - 0.5 + yOffset;
    const pz = c.z - 0.5;
    const w = c.w;
    const h = c.h;
    const d = c.d;

    const mask = c.facesMask !== undefined ? c.facesMask : 63; // Render all 6 faces if no mask provided

    // Front face (+Z)
    if (mask & 1) {
      positions.push(
        px, py, pz + d,
        px + w, py, pz + d,
        px + w, py + h, pz + d,
        px, py + h, pz + d
      );
      normals.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
      uvs.push(0, 0, w, 0, w, h, 0, h);
      indices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset, vertexOffset + 2, vertexOffset + 3
      );
      vertexOffset += 4;
    }

    // Back face (-Z)
    if (mask & 2) {
      positions.push(
        px + w, py, pz,
        px, py, pz,
        px, py + h, pz,
        px + w, py + h, pz
      );
      normals.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
      uvs.push(0, 0, w, 0, w, h, 0, h);
      indices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset, vertexOffset + 2, vertexOffset + 3
      );
      vertexOffset += 4;
    }

    // Top face (+Y)
    if (mask & 4) {
      positions.push(
        px, py + h, pz + d,
        px + w, py + h, pz + d,
        px + w, py + h, pz,
        px, py + h, pz
      );
      normals.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
      uvs.push(0, 0, w, 0, w, d, 0, d);
      indices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset, vertexOffset + 2, vertexOffset + 3
      );
      vertexOffset += 4;
    }

    // Bottom face (-Y)
    if (mask & 8) {
      positions.push(
        px, py, pz,
        px + w, py, pz,
        px + w, py, pz + d,
        px, py, pz + d
      );
      normals.push(0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0);
      uvs.push(0, 0, w, 0, w, d, 0, d);
      indices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset, vertexOffset + 2, vertexOffset + 3
      );
      vertexOffset += 4;
    }

    // Right face (+X)
    if (mask & 16) {
      positions.push(
        px + w, py, pz + d,
        px + w, py, pz,
        px + w, py + h, pz,
        px + w, py + h, pz + d
      );
      normals.push(1,0,0, 1,0,0, 1,0,0, 1,0,0);
      uvs.push(0, 0, d, 0, d, h, 0, h);
      indices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset, vertexOffset + 2, vertexOffset + 3
      );
      vertexOffset += 4;
    }

    // Left face (-X)
    if (mask & 32) {
      positions.push(
        px, py, pz,
        px, py, pz + d,
        px, py + h, pz + d,
        px, py + h, pz
      );
      normals.push(-1,0,0, -1,0,0, -1,0,0, -1,0,0);
      uvs.push(0, 0, d, 0, d, h, 0, h);
      indices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset, vertexOffset + 2, vertexOffset + 3
      );
      vertexOffset += 4;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}
