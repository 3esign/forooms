import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";
import { rasterizePolygon } from "./core";

const BUILDING_MATERIAL_MAP: Record<string, BlockId> = {
  house: BlockId.Concrete,
  apartments: BlockId.Concrete,
  commercial: BlockId.Concrete,
  retail: BlockId.Concrete,
  industrial: BlockId.Concrete,
  church: BlockId.Wall,
  garage: BlockId.Concrete,
  school: BlockId.Concrete,
  university: BlockId.Concrete,
  hospital: BlockId.Concrete,
};

export function paintBuildingOnGrid(
  vertices: [number, number][],
  heightLevels: number,
  type: string,
  grid: CityGrid
) {
  const footprint = rasterizePolygon(vertices);
  const voxelsPerLevel = 2;
  const buildingHeight = Math.max(2, heightLevels * voxelsPerLevel);

  let material = BUILDING_MATERIAL_MAP[type.toLowerCase()] || BlockId.Concrete;

  if (material === BlockId.Concrete) {
    // Deterministic selection based on footprint to create variety in facades
    const sumCoords = vertices.reduce((sum, pt) => sum + pt[0] + pt[1], 0);
    const hash = Math.floor(Math.abs(sumCoords) * 1000) % 3;
    if (hash === 1) material = BlockId.BrickFacade;
    else if (hash === 2) material = BlockId.GlassFacade;
  }

  for (const [x, z] of footprint) {
    for (let y = 1; y <= buildingHeight; y++) {
      grid.setVoxel(x, y, z, material);
    }
  }
}

export function generateBuildingSidewalks(grid: CityGrid) {
  const buildingCoords: [number, number][] = [];
  
  for (let x = grid.minX; x <= grid.maxX; x++) {
    for (let z = grid.minZ; z <= grid.maxZ; z++) {
      const b = grid.getVoxel(x, 1, z);
      // If there's a building at y=1, it will be one of these types
      if (b !== BlockId.Air && b !== BlockId.Wood && b !== BlockId.Leaves) {
        buildingCoords.push([x, z]);
      }
    }
  }

  for (const [x, z] of buildingCoords) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const targetX = x + dx;
        const targetZ = z + dz;
        
        const groundBlock = grid.getVoxel(targetX, 0, targetZ);
        const aboveBlock = grid.getVoxel(targetX, 1, targetZ);
        
        if (groundBlock === BlockId.Grass && aboveBlock === BlockId.Air) {
          grid.setVoxel(targetX, 0, targetZ, BlockId.Sidewalk);
        }
      }
    }
  }
}
