import { CityGrid } from "../voxel/CityGrid";
import { BlockId } from "../blocks/BlockRegistry";
import { rasterizePolygon } from "./core";

export function paintRailwayOnGrid(
  points: [number, number][],
  grid: CityGrid,
  railWidth: number = 2
) {
  if (points.length < 2) return;
  const halfWidth = railWidth / 2;

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
            grid.setVoxel(paintX, 0, paintZ, BlockId.Railway);
          }
        }
      }
    }
  }
}

export function paintStationPlatform(
  points: [number, number][],
  grid: CityGrid
) {
  if (points.length < 2) return;
  // If it's a node (len=1), maybe render a 3x3 platform? 
  // We'll assume points is at least length 2, or treat node as a small square.
  const isPolygon =
    points.length >= 4 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1];

  let footprint: [number, number][] = [];
  if (isPolygon) {
    footprint = rasterizePolygon(points);
  } else {
    // For node station, make a 5x5 platform centered on the point
    if (points.length === 1) {
      const [px, pz] = points[0];
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          footprint.push([Math.round(px + x), Math.round(pz + z)]);
        }
      }
    }
  }

  for (const [x, z] of footprint) {
    grid.setVoxel(x, 1, z, BlockId.Platform);
    grid.setVoxel(x, 2, z, BlockId.Platform);
  }
}
