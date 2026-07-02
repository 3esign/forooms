import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";
import { getLinePixels } from "./core";

export function paintBarrierOnGrid(
  points: [number, number][],
  grid: CityGrid
) {
  if (points.length < 2) return;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const line = getLinePixels(Math.round(p1[0]), Math.round(p1[1]), Math.round(p2[0]), Math.round(p2[1]));
    
    for (const [x, z] of line) {
      // Paint a wall 1-2 voxels tall
      // Don't overwrite buildings (BlockId.Concrete) or other vital things, but wall can overwrite grass
      const currentGround = grid.getVoxel(x, 0, z);
      const currentAbove = grid.getVoxel(x, 1, z);

      if (currentAbove === BlockId.Air) {
        grid.setVoxel(x, 1, z, BlockId.Wall);
        // Maybe occasionally 2 tall? For now keep it 1 voxel tall
      }
    }
  }
}
