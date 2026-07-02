import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";

export function paintFootpathOnGrid(
  points: [number, number][],
  grid: CityGrid,
  pathWidth: number = 2
) {
  paintPathLike(points, grid, pathWidth, BlockId.Footpath);
}

export function paintServiceRoadOnGrid(
  points: [number, number][],
  grid: CityGrid,
  pathWidth: number = 2
) {
  paintPathLike(points, grid, pathWidth, BlockId.ServiceRoad);
}

function paintPathLike(
  points: [number, number][],
  grid: CityGrid,
  pathWidth: number,
  blockId: BlockId
) {
  if (points.length < 2) return;
  const halfWidth = pathWidth / 2;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dx = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const len = Math.sqrt(dx * dx + dz * dz);

    if (len === 0) continue;

    const steps = Math.ceil(len * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = p1[0] + dx * t;
      const z = p1[1] + dz * t;

      const rStart = -Math.floor(halfWidth);
      const rEnd = Math.ceil(halfWidth) - 1;

      for (let rx = rStart; rx <= rEnd; rx++) {
        for (let rz = rStart; rz <= rEnd; rz++) {
          const paintX = Math.round(x + rx);
          const paintZ = Math.round(z + rz);
          const dist = Math.sqrt(rx * rx + rz * rz);
          
          if (dist <= halfWidth) {
            const current = grid.getVoxel(paintX, 0, paintZ);
            // Only overwrite grass/air/parks
            if (current === BlockId.Grass || current === BlockId.Air || current === BlockId.ParkGrass || current === BlockId.Sand) {
              grid.setVoxel(paintX, 0, paintZ, blockId);
            }
          }
        }
      }
    }
  }
}
