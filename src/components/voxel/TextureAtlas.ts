import * as THREE from "three";
import { BlockId, getBlockDef, BLOCK_REGISTRY } from "../../lib/blocks/BlockRegistry";
import { PRNG } from "../../lib/voxel/prng";

// ─── Helpers ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r * factor)},${clamp(g * factor)},${clamp(b * factor)})`;
}

function drawNoise(
  ctx: CanvasRenderingContext2D,
  prng: PRNG,
  colors: string[],
  count: number,
  size = 1
) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(prng.next() * 16);
    const y = Math.floor(prng.next() * 16);
    ctx.fillStyle = colors[Math.floor(prng.next() * colors.length)];
    ctx.fillRect(x, y, size, size);
  }
}

// ─── Building / Concrete ─────────────────────────────────────────────────
// Generates a parametric facade: brick or panel courses + window grid + cornice

function drawConcretePanelFacade(ctx: CanvasRenderingContext2D, prng: PRNG) {
  // Precast concrete panels – horizontal banding
  const panelBase = "#c2bdb5";
  ctx.fillStyle = panelBase;
  ctx.fillRect(0, 0, 16, 16);

  // Panel joints (horizontal lines)
  ctx.fillStyle = "#8a857d";
  for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
  // Panel joints (vertical lines)
  for (let x = 4; x < 16; x += 4) ctx.fillRect(x, 0, 1, 16);

  // Surface grime variation
  drawNoise(ctx, prng, ["#aea9a1", "#d0cbc3", "#b8b3ab"], 20, 1);

  // Windows: 2×2 grid of 2×3 windows
  ctx.fillStyle = "#1a2a3a";
  for (let wy = 1; wy < 14; wy += 6) {
    for (let wx = 1; wx < 14; wx += 6) {
      ctx.fillRect(wx, wy, 3, 3);
      // Window glint
      ctx.fillStyle = "#2a5080";
      ctx.fillRect(wx, wy, 1, 1);
      ctx.fillStyle = "#1a2a3a";
    }
  }
  // Cornice line at top
  ctx.fillStyle = "#8a857d";
  ctx.fillRect(0, 0, 16, 1);
}

function drawBrickFacade(ctx: CanvasRenderingContext2D, prng: PRNG) {
  // Brick facade – staggered course pattern
  const brickColor = "#a87c5c";
  const mortarColor = "#9a9590";
  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, 16, 16);

  for (let row = 0; row < 8; row++) {
    const offset = row % 2 === 0 ? 0 : 3;
    ctx.fillStyle = brickColor;
    for (let col = -1; col < 4; col++) {
      const bx = col * 5 + offset;
      const by = row * 2;
      ctx.fillRect(bx, by, 4, 1);
      // Brick shading
      ctx.fillStyle = shade(brickColor, 0.8);
      ctx.fillRect(bx, by, 4, 1);
      ctx.fillStyle = shade(brickColor, 1.1);
      ctx.fillRect(bx, by, 1, 1);
      ctx.fillStyle = brickColor;
    }
  }
  // Windows – small punched openings
  ctx.fillStyle = "#16283a";
  ctx.fillRect(2, 2, 2, 2);
  ctx.fillRect(10, 2, 2, 2);
  ctx.fillRect(2, 10, 2, 2);
  ctx.fillRect(10, 10, 2, 2);
  // Window highlights
  ctx.fillStyle = "#1e4060";
  ctx.fillRect(2, 2, 1, 1);
  ctx.fillRect(10, 2, 1, 1);
}

function drawGlassFacade(ctx: CanvasRenderingContext2D, prng: PRNG) {
  // Modernist glass curtain wall
  const frameColor = "#6b7280";
  ctx.fillStyle = "#1a2533";
  ctx.fillRect(0, 0, 16, 16);

  // Mullion grid
  ctx.fillStyle = frameColor;
  for (let x = 0; x < 16; x += 4) ctx.fillRect(x, 0, 1, 16);
  for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);

  // Glass pane reflections
  const glintColors = ["#1e3a5f", "#243f6e", "#152a45", "#1a3050"];
  for (let px = 1; px < 16; px += 4) {
    for (let py = 1; py < 16; py += 4) {
      ctx.fillStyle = glintColors[Math.floor(prng.next() * glintColors.length)];
      ctx.fillRect(px, py, 3, 3);
      // Specular highlight in top-left corner
      ctx.fillStyle = "#3a6090";
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

// ─── Wall / Masonry ─────────────────────────────────────────────────────
// Stone-like wall with irregular coursing

function drawWallTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  // Base stone
  ctx.fillStyle = "#8e7f6c";
  ctx.fillRect(0, 0, 16, 16);

  // Irregular stone blocks
  const stoneColors = ["#9e8f7c", "#7e7060", "#b09a84", "#6e6052"];
  let y = 0;
  while (y < 16) {
    const rowH = 2 + Math.floor(prng.next() * 2);
    let x = 0;
    while (x < 16) {
      const w = 3 + Math.floor(prng.next() * 4);
      ctx.fillStyle = stoneColors[Math.floor(prng.next() * stoneColors.length)];
      ctx.fillRect(x + 1, y + 1, Math.min(w, 16 - x - 1), rowH - 1);
      x += w + 1;
    }
    // Mortar row
    ctx.fillStyle = "#6a6058";
    ctx.fillRect(0, y, 16, 1);
    y += rowH;
  }
  // Subtle noise
  drawNoise(ctx, prng, ["#7a6e5e", "#a09080"], 10, 1);
}

// ─── Grass ──────────────────────────────────────────────────────────────

function drawGrassTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  ctx.fillStyle = "#659c44";
  ctx.fillRect(0, 0, 16, 16);
  drawNoise(ctx, prng, ["#528234", "#77b252", "#4a7230", "#8ac060"], 35, 1);
  // Grass blade strokes
  ctx.fillStyle = "#4a7230";
  for (let i = 0; i < 6; i++) {
    const gx = Math.floor(prng.next() * 14);
    const gy = Math.floor(prng.next() * 14);
    ctx.fillRect(gx, gy, 1, 2);
  }
}

// ─── Asphalt / Road ─────────────────────────────────────────────────────

function drawAsphaltTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  ctx.fillStyle = "#2c2d30";
  ctx.fillRect(0, 0, 16, 16);
  drawNoise(ctx, prng, ["#1e1f22", "#3c3d40", "#353638"], 25, 1);
  // Aggregate speckle
  ctx.fillStyle = "#4a4b50";
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(Math.floor(prng.next() * 15), Math.floor(prng.next() * 15), 1, 1);
  }
}

// ─── Wood ───────────────────────────────────────────────────────────────

function drawWoodTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  ctx.fillStyle = "#7d593c";
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = "#523722";
  for (let i = 0; i < 5; i++) {
    const y = Math.floor(prng.next() * 16);
    ctx.fillRect(0, y, 16, 1 + Math.floor(prng.next() * 2));
  }
  drawNoise(ctx, prng, ["#6b4a2f", "#8d6745"], 8, 1);
  ctx.fillStyle = "#3f2010";
  ctx.strokeRect(0, 0, 16, 16);
}

// ─── Leaves ─────────────────────────────────────────────────────────────

function drawLeavesTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  ctx.fillStyle = "#2f751c";
  ctx.fillRect(0, 0, 16, 16);
  drawNoise(ctx, prng, ["#1a470e", "#459e2b", "#245f14", "#5ab536"], 40, 1);
  // Cluster dots
  for (let i = 0; i < 5; i++) {
    const cx = Math.floor(prng.next() * 14) + 1;
    const cy = Math.floor(prng.next() * 14) + 1;
    ctx.fillStyle = "#1a470e";
    ctx.fillRect(cx - 1, cy, 3, 1);
    ctx.fillRect(cx, cy - 1, 1, 3);
  }
}

// ─── Water ─────────────────────────────────────────────────────────────

function drawWaterTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  // Deep sea blue base
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(0, 0, 16, 16);
  
  // Sea noise with various shades of blue and soft navy
  drawNoise(ctx, prng, ["#1e40af", "#3b82f6", "#172554", "#2563eb"], 15, 1);
  
  // Wave foam lines (whiteish/translucent white waves)
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  for (let i = 0; i < 3; i++) {
    const y = Math.floor(prng.next() * 16);
    const x = Math.floor(prng.next() * 8);
    ctx.fillRect(x, y, 6 + Math.floor(prng.next() * 6), 1);
  }
  
  // Shimmer/highlight specks (pure white foam)
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(Math.floor(prng.next() * 15), Math.floor(prng.next() * 15), 1, 1);
  }
}

// ─── Sidewalk ──────────────────────────────────────────────────────────

function drawSidewalkTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  ctx.fillStyle = "#b0b0b0";
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = "#888";
  for (let x = 0; x < 16; x += 4) ctx.fillRect(x, 0, 1, 16);
  for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
  drawNoise(ctx, prng, ["#9a9a9a", "#c4c4c4"], 10, 1);
}

// ─── Platform ──────────────────────────────────────────────────────────

function drawPlatformTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  ctx.fillStyle = "#b0a89e";
  ctx.fillRect(0, 0, 16, 16);
  drawNoise(ctx, prng, ["#9a9288", "#c5bdb3"], 12, 1);
  ctx.fillStyle = "#eab308";
  ctx.fillRect(0, 0, 16, 2);
  ctx.fillStyle = "#9a9288";
  for (let x = 0; x < 16; x += 3) ctx.fillRect(x, 0, 1, 2);
}

// ─── Parking ────────────────────────────────────────────────────────────

function drawParkingTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  ctx.fillStyle = "#3a3a3e";
  ctx.fillRect(0, 0, 16, 16);
  drawNoise(ctx, prng, ["#2e2e32", "#4a4a50"], 12, 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(1, 1, 1, 14);
  ctx.fillRect(14, 1, 1, 14);
  ctx.fillStyle = "#d4d4d8";
  ctx.fillRect(7, 6, 2, 4);
}

// ─── Railway ────────────────────────────────────────────────────────────

function drawRailwayTexture(ctx: CanvasRenderingContext2D, prng: PRNG) {
  ctx.fillStyle = "#4a3c2e";
  ctx.fillRect(0, 0, 16, 16);
  drawNoise(ctx, prng, ["#3a2e22", "#5c4a38"], 10, 1);
  ctx.fillStyle = "#6b5a44";
  for (let i = 0; i < 16; i += 4) ctx.fillRect(0, i, 16, 2);
  ctx.fillStyle = "#c0c0c8";
  ctx.fillRect(3, 0, 2, 16);
  ctx.fillRect(11, 0, 2, 16);
  ctx.fillStyle = "#909098";
  ctx.fillRect(3, 0, 1, 16);
}

// ─── Generic fallback ───────────────────────────────────────────────────

function drawGenericTexture(
  ctx: CanvasRenderingContext2D,
  prng: PRNG,
  baseColor: string,
  noiseColors: string[],
  borderColor: string
) {
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 16, 16);
  drawNoise(ctx, prng, noiseColors.length > 0 ? noiseColors : [baseColor], 20, 1);
  ctx.strokeStyle = borderColor;
  ctx.strokeRect(0, 0, 16, 16);
}

// ─── Main entry ─────────────────────────────────────────────────────────

export function createBlockTexture(blockId: BlockId, prng: PRNG): THREE.Texture | null {
  if (typeof window === "undefined") return null;
  const def = getBlockDef(blockId);
  if (!def) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")!;

  switch (def.textureType) {
    case "concrete":
      drawConcretePanelFacade(ctx, prng);
      break;
    case "brick_facade":
      drawBrickFacade(ctx, prng);
      break;
    case "glass_facade":
      drawGlassFacade(ctx, prng);
      break;
    case "wall":
      drawWallTexture(ctx, prng);
      break;
    case "grass":
    case "park_grass":
    case "zone_residential":
    case "zone_commercial":
    case "zone_industrial":
    case "zone_retail":
    case "cemetery":
    case "scrub":
      drawGrassTexture(ctx, prng);
      break;
    case "stone":
    case "service_road":
      drawAsphaltTexture(ctx, prng);
      break;
    case "wood":
      drawWoodTexture(ctx, prng);
      break;
    case "leaves":
      drawLeavesTexture(ctx, prng);
      break;
    case "water":
      drawWaterTexture(ctx, prng);
      break;
    case "sidewalk":
    case "footpath":
      drawSidewalkTexture(ctx, prng);
      break;
    case "platform":
      drawPlatformTexture(ctx, prng);
      break;
    case "parking":
      drawParkingTexture(ctx, prng);
      break;
    case "railway":
      drawRailwayTexture(ctx, prng);
      break;
    default:
      drawGenericTexture(ctx, prng, def.baseColor, def.noiseColors, def.borderColor);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createAllTextures(prng: PRNG): Record<number, THREE.Texture> {
  const textures: Record<number, THREE.Texture> = {};
  for (const blockId of BLOCK_REGISTRY.keys()) {
    if (blockId === BlockId.Air) continue;
    const tex = createBlockTexture(blockId, prng);
    if (tex) textures[blockId] = tex;
  }
  return textures;
}
