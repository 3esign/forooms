import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";
import { rasterizePolygon } from "./core";

export function paintParkingOnGrid(
  vertices: [number, number][],
  grid: CityGrid
) {
  const footprint = rasterizePolygon(vertices);
  
  for (const [x, z] of footprint) {
    const current = grid.getVoxel(x, 0, z);
    // Don't overwrite water or roads
    if (current !== BlockId.Water && current !== BlockId.Asphalt) {
      grid.setVoxel(x, 0, z, BlockId.Parking);
    }
  }
}
