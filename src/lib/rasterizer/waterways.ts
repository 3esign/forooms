import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";
import { rasterizePolygon } from "./core";

export function paintWaterwayOnGrid(
  points: [number, number][],
  grid: CityGrid,
  waterWidth: number = 3
) {
  const isPolygon =
    points.length >= 4 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1];

  if (isPolygon) {
    const footprint = rasterizePolygon(points);
    for (const [x, z] of footprint) {
      grid.setVoxel(x, 0, z, BlockId.Water);
    }
  } else {
    if (points.length < 2) return;
    const halfWidth = waterWidth / 2;

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
            grid.setVoxel(paintX, 0, paintZ, BlockId.Water);
          }
        }
      }
    }
  }
}
