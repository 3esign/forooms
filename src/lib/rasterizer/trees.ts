import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";
import { PRNG } from "../voxel/prng";

export function generateCouncilEditableVoxels(grid: CityGrid, prng: PRNG) {
  for (let x = grid.minX; x <= grid.maxX; x++) {
    for (let z = grid.minZ; z <= grid.maxZ; z++) {
      if (grid.getVoxel(x, 0, z) === BlockId.Grass && grid.getVoxel(x, 1, z) === BlockId.Air) {
        if (prng.next() < 0.005) {
          grid.setVoxel(x, 0, z, BlockId.Editable);
        }
      }
    }
  }
}

/** Sparse tree pass — scans grid cells to spawn trees densely inside parks and sparsely elsewhere. */
export function runTreePass(grid: CityGrid, prng: PRNG) {
  for (let x = grid.minX; x <= grid.maxX; x += 2) {
    for (let z = grid.minZ; z <= grid.maxZ; z += 2) {
      const ground = grid.getVoxel(x, 0, z);
      const above = grid.getVoxel(x, 1, z);
      
      // Only spawn trees on grass or park grass, with y=1 being empty
      if ((ground !== BlockId.Grass && ground !== BlockId.ParkGrass) || above !== BlockId.Air) continue;

      // Parks have much higher tree density!
      const isPark = ground === BlockId.ParkGrass;
      const spawnChance = isPark ? 0.15 : 0.015;

      if (prng.next() > spawnChance) continue;

      // Ensure no tree trunk overlaps a road or water body (within 1 cell radius)
      let nearRoadOrWater = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const adj = grid.getVoxel(x + dx, 0, z + dz);
          if (adj === BlockId.Asphalt || adj === BlockId.Water) {
            nearRoadOrWater = true;
            break;
          }
        }
      }
      if (nearRoadOrWater) continue;

      // Set tree trunk
      grid.setVoxel(x, 1, z, BlockId.Wood);
      grid.setVoxel(x, 2, z, BlockId.Wood);
      grid.setVoxel(x, 3, z, BlockId.Wood);

      // Leaves foliage
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx !== 0 || dz !== 0) {
            grid.setVoxel(x + dx, 3, z + dz, BlockId.Leaves);
          }
        }
      }
      grid.setVoxel(x, 4, z, BlockId.Leaves);
    }
  }
}
