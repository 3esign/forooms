import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";

export function paintRoadOnGrid(
  points: [number, number][],
  grid: CityGrid,
  roadWidth: number = 4
) {
  if (points.length < 2) return;
  const halfWidth = roadWidth / 2;

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
          
          if (dist <= halfWidth * 0.6) {
            grid.setVoxel(paintX, 0, paintZ, BlockId.Asphalt);
          } else if (dist <= halfWidth) {
            grid.setVoxel(paintX, 0, paintZ, BlockId.Sidewalk);
          }
        }
      }
    }
  }
}
