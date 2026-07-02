export interface MeshFace {
  vertices: number[];
  indices: number[];
  normals: number[];
  uvs: number[];
  color: number; // blockId or color identifier
}

/**
 * Generates an optimized 3D mesh from a voxel grid using the Greedy Meshing algorithm.
 * Reduces triangle count by merging contiguous coplanar faces of the same type.
 */
export function generateGreedyMesh(
  dims: [number, number, number],
  voxelAt: (x: number, y: number, z: number) => number
): MeshFace[] {
  const faces: MeshFace[] = [];
  
  // Sweep over each of the 3 coordinate axes
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    
    const x = [0, 0, 0];
    const q = [0, 0, 0];
    q[d] = 1;
    
    // Mask to track processed faces in the 2D plane slice
    const mask = new Int32Array(dims[u] * dims[v]);
    
    x[d] = -1;
    while (x[d] < dims[d]) {
      // 1. Compute the mask for this slice
      let n = 0;
      for (x[v] = 0; x[v] < dims[v]; ++x[v]) {
        for (x[u] = 0; x[u] < dims[u]; ++x[u]) {
          // Block at current layer vs next layer
          const a = x[d] >= 0 ? voxelAt(x[0], x[1], x[2]) : 0;
          const b = x[d] < dims[d] - 1 ? voxelAt(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : 0;
          
          if (a !== 0 && b !== 0 && a === b) {
            mask[n++] = 0; // Both solid & identical -> occluded face
          } else if (a !== 0) {
            mask[n++] = a; // Face points out
          } else if (b !== 0) {
            mask[n++] = -b; // Face points in
          } else {
            mask[n++] = 0; // Empty space
          }
        }
      }
      
      x[d]++;
      
      // 2. Generate mesh from mask
      n = 0;
      for (let j = 0; j < dims[v]; ++j) {
        for (let i = 0; i < dims[u]; ) {
          const type = mask[n];
          if (type !== 0) {
            // Find width (contiguous horizontal blocks of same type)
            let w = 1;
            while (i + w < dims[u] && mask[n + w] === type) {
              w++;
            }
            
            // Find height (contiguous vertical blocks of same type of width w)
            let h = 1;
            let ok = true;
            while (j + h < dims[v]) {
              for (let k = 0; k < w; ++k) {
                if (mask[n + k + h * dims[u]] !== type) {
                  ok = false;
                  break;
                }
              }
              if (!ok) break;
              h++;
            }
            
            // Add quad coordinates
            x[u] = i;
            x[v] = j;
            
            const du = [0, 0, 0]; du[u] = w;
            const dv = [0, 0, 0]; dv[v] = h;
            
            // Push geometry data
            faces.push({
              color: Math.abs(type),
              vertices: [
                x[0], x[1], x[2],
                x[0] + du[0], x[1] + du[1], x[2] + du[2],
                x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2],
                x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]
              ],
              indices: type > 0 
                ? [0, 1, 2, 0, 2, 3] // CCW 
                : [0, 2, 1, 0, 3, 2], // CW (inverted normal)
              normals: q, // Base normal for this axis
              uvs: [
                0, 0,
                w, 0,
                w, h,
                0, h
              ]
            });
            
            // Zero out mask values we just processed
            for (let l = 0; l < h; ++l) {
              for (let k = 0; k < w; ++k) {
                mask[n + k + l * dims[u]] = 0;
              }
            }
            
            i += w;
            n += w;
          } else {
            i++;
            n++;
          }
        }
      }
    }
  }
  
  return faces;
}
