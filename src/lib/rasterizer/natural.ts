import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";
import { rasterizePolygon, getLinePixels } from "./core";

export function paintBeachOnGrid(
  vertices: [number, number][],
  grid: CityGrid
) {
  const footprint = rasterizePolygon(vertices);
  for (const [x, z] of footprint) {
    grid.setVoxel(x, 0, z, BlockId.Sand);
  }
}

export function paintScrubOnGrid(
  vertices: [number, number][],
  grid: CityGrid
) {
  const footprint = rasterizePolygon(vertices);
  for (const [x, z] of footprint) {
    const current = grid.getVoxel(x, 0, z);
    if (current === BlockId.Grass || current === BlockId.Air) {
      grid.setVoxel(x, 0, z, BlockId.Scrub);
    }
  }
}

export function paintTreeRowOnGrid(
  points: [number, number][],
  grid: CityGrid
) {
  if (points.length < 2) return;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    // Draw line of trees, maybe spacing them every 2 voxels
    const line = getLinePixels(Math.round(p1[0]), Math.round(p1[1]), Math.round(p2[0]), Math.round(p2[1]));
    
    for (let j = 0; j < line.length; j += 2) {
      const [x, z] = line[j];
      const ground = grid.getVoxel(x, 0, z);
      const above = grid.getVoxel(x, 1, z);
      
      // Trees can go on grass, park grass, sidewalks
      if (
        (ground === BlockId.Grass || ground === BlockId.ParkGrass || ground === BlockId.Sidewalk) &&
        above === BlockId.Air
      ) {
        // Trunk
        grid.setVoxel(x, 1, z, BlockId.Wood);
        grid.setVoxel(x, 2, z, BlockId.Wood);
        grid.setVoxel(x, 3, z, BlockId.Wood);

        // Leaves
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
}
