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
}

/**
 * A greedy meshing algorithm that takes a CityGrid and merges adjacent 
 * identical voxels into large cuboids.
 * 
 * Returns a map of BlockId -> Array of Cuboids.
 */
export function greedyMeshGrid(grid: CityGrid): Record<number, Cuboid[]> {
  const result: Record<number, Cuboid[]> = {};
  
  // We need to know the bounds.
  const minX = grid.minX;
  const maxX = grid.maxX;
  const minZ = grid.minZ;
  const maxZ = grid.maxZ;
  
  // Find max Y in the grid
  let maxY = 0;
  for (const [, yMap] of grid.data.entries()) {
    for (const yStr of yMap.keys()) {
      const y = parseInt(yStr, 10);
      if (y > maxY) maxY = y;
    }
  }

  const width = maxX - minX + 1;
  const depth = maxZ - minZ + 1;
  const height = maxY + 1;

  // We process each material type separately to make greedy meshing simple.
  // First, let's find all unique materials present in the grid.
  const materials = new Set<number>();
  for (const [, yMap] of grid.data.entries()) {
    for (const [, zMap] of yMap.entries()) {
      for (const blockId of zMap.values()) {
        if (blockId !== BlockId.Air) {
          materials.add(blockId);
        }
      }
    }
  }

  // Pre-allocate a mask for greedy sweeping (1D array for the 2D slice)
  const mask = new Int8Array(width * depth);

  for (const blockId of materials) {
    if (blockId === BlockId.Grass) continue; // Grass is handled by ground plane

    const cuboids: Cuboid[] = [];

    // Sweep over each Y level (horizontal slices)
    for (let y = 0; y < height; y++) {
      let maskIdx = 0;
      
      // Build the boolean mask for this Y level and material
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          const actualX = minX + x;
          const actualZ = minZ + z;
          const b = grid.getVoxel(actualX, y, actualZ);
          mask[maskIdx++] = (b === blockId) ? 1 : 0;
        }
      }

      // Greedy mesh the 2D mask
      maskIdx = 0;
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          if (mask[maskIdx] === 1) {
            // Compute width
            let w = 1;
            while (x + w < width && mask[maskIdx + w * depth] === 1) {
              w++;
            }
            
            // Compute depth
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

            // Create cuboid (h=1 initially, we could 3D sweep but 2D per-level is fast and good enough for our buildings)
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

            // Clear the mask
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
    
    // Pass 2: Merge vertically across Y slices!
    // Since buildings are extruded upwards, merging vertically eliminates thousands of interior floor cuboids.
    for (let i = 0; i < cuboids.length; i++) {
      const c1 = cuboids[i];
      if (!c1) continue;

      for (let j = i + 1; j < cuboids.length; j++) {
        const c2 = cuboids[j];
        if (!c2) continue;

        if (c1.x === c2.x && c1.z === c2.z && c1.w === c2.w && c1.d === c2.d && c1.y + c1.h === c2.y) {
          // Merge c2 into c1
          c1.h += c2.h;
          cuboids[j] = null as any; // Mark for deletion
        }
      }
    }

    result[blockId] = cuboids.filter(c => c !== null);
  }

  return result;
}

/**
 * Converts a list of Cuboids into a single optimized THREE.BufferGeometry.
 * UVs are mapped such that a 1x1 texture perfectly tiles across W, H, D.
 */
export function buildGeometryFromCuboids(cuboids: Cuboid[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  let vertexOffset = 0;

  // For each cuboid, we push 6 faces (each with 4 vertices)
  for (const c of cuboids) {
    // Our voxels are 2 units wide by default, but let's keep units as grid indices here,
    // and scale them in the Mesh. Or we output real-world units directly.
    // Let's output voxel coordinates (where 1 unit = 1 voxel block).
    // The VoxelMesh component handles the * 2 scale.
    
    const px = c.x;
    const py = c.y;
    const pz = c.z;
    const w = c.w;
    const h = c.h;
    const d = c.d;

    // Front face (+Z)
    positions.push(
      px, py, pz + d,       // bottom left
      px + w, py, pz + d,   // bottom right
      px + w, py + h, pz + d, // top right
      px, py + h, pz + d    // top left
    );
    normals.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
    uvs.push(0, 0, w, 0, w, h, 0, h);
    indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset, vertexOffset + 2, vertexOffset + 3
    );
    vertexOffset += 4;

    // Back face (-Z)
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

    // Top face (+Y)
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

    // Bottom face (-Y)
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

    // Right face (+X)
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

    // Left face (-X)
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  // We are creating voxels centered on the origin, so shift the vertices slightly 
  // to match the previous instanced mesh behavior if necessary.
  // Wait, our old InstancedMesh did `mesh.position.set(v.position.x * 2, v.position.y * 2, v.position.z * 2)`.
  // And the `BoxGeometry` had `args={[2, 2, 2]}`. So its corners went from -1 to 1 around the center.
  // Our geometry above defines coordinates from px to px+w.
  // To perfectly match, we scale by 2, and shift by -1 so it matches the center of the voxel!
  
  geometry.scale(2, 2, 2);
  geometry.translate(-1, -1, -1);

  return geometry;
}
