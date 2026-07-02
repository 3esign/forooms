import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";
import { rasterizePolygon } from "./core";

export function paintParkOnGrid(
  vertices: [number, number][],
  grid: CityGrid,
  type: string = "park"
) {
  const footprint = rasterizePolygon(vertices);
  
  // Pitches (sports courts like tennis/basketball) get Pitch
  // Parks, playgrounds, gardens, forests get ParkGrass
  const blockId = type.includes("pitch") ? BlockId.Pitch : BlockId.ParkGrass;

  for (const [x, z] of footprint) {
    const groundBlock = grid.getVoxel(x, 0, z);
    if (groundBlock === BlockId.Grass || groundBlock === BlockId.Air) {
      grid.setVoxel(x, 0, z, blockId);
    }
  }
}
