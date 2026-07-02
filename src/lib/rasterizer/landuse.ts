import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";
import { rasterizePolygon } from "./core";

export function paintLanduseZoneOnGrid(
  vertices: [number, number][],
  grid: CityGrid,
  type: string
) {
  const footprint = rasterizePolygon(vertices);
  
  let blockId = BlockId.Grass;
  if (type === "residential") blockId = BlockId.ZoneResidential;
  else if (type === "commercial") blockId = BlockId.ZoneCommercial;
  else if (type === "industrial") blockId = BlockId.ZoneIndustrial;
  else if (type === "retail") blockId = BlockId.ZoneRetail;
  else if (type === "cemetery") blockId = BlockId.Cemetery;
  
  if (blockId === BlockId.Grass) return;

  for (const [x, z] of footprint) {
    // Zones are the absolute lowest priority (painted first)
    const current = grid.getVoxel(x, 0, z);
    if (current === BlockId.Grass || current === BlockId.Air) {
      grid.setVoxel(x, 0, z, blockId);
    }
  }
}
