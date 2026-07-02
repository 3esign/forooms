export function getLinePixels(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const pixels: [number, number][] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = (x0 < x1) ? 1 : -1;
  let sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;

  while(true) {
    pixels.push([x0, y0]);
    if ((x0 === x1) && (y0 === y1)) break;
    let e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return pixels;
}

export function rasterizePolygon(vertices: [number, number][]): [number, number][] {
  if (vertices.length < 3) return [];
  const coordsMap = new Map<string, [number, number]>();

  // 1. Draw solid outline using Bresenham to guarantee no walls disappear
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    const line = getLinePixels(Math.round(p1[0]), Math.round(p1[1]), Math.round(p2[0]), Math.round(p2[1]));
    for (const [x, z] of line) {
      coordsMap.set(`${x},${z}`, [x, z]);
    }
  }

  // 2. Scanline fill for the interior
  let minZ = Infinity, maxZ = -Infinity;
  for (const [_, z] of vertices) {
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const startZ = Math.ceil(minZ);
  const endZ = Math.floor(maxZ);

  for (let z = startZ; z <= endZ; z++) {
    const intersections: number[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % vertices.length];
      if ((p1[1] <= z && p2[1] > z) || (p2[1] <= z && p1[1] > z)) {
        const t = (z - p1[1]) / (p2[1] - p1[1]);
        const x = p1[0] + t * (p2[0] - p1[0]);
        intersections.push(x);
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      if (i + 1 >= intersections.length) break;
      const xStart = Math.ceil(intersections[i]);
      const xEnd = Math.floor(intersections[i + 1]);
      for (let x = xStart; x <= xEnd; x++) {
        coordsMap.set(`${x},${z}`, [x, z]);
      }
    }
  }

  return Array.from(coordsMap.values());
}
