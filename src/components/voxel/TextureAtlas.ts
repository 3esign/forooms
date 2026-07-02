import * as THREE from "three";
import { BlockId, getBlockDef, BLOCK_REGISTRY } from "../../lib/blocks/BlockRegistry";
import { PRNG } from "../../lib/voxel/prng";

export function createBlockTexture(blockId: BlockId, prng: PRNG): THREE.Texture | null {
  if (typeof window === 'undefined') return null;
  const def = getBlockDef(blockId);
  if (!def) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  // Base
  ctx.fillStyle = def.baseColor;
  ctx.fillRect(0, 0, 16, 16);

  // Noise
  const numNoise = def.noiseColors.length > 0 ? 30 : 0;
  for (let i = 0; i < numNoise; i++) {
    const x = Math.floor(prng.next() * 16);
    const y = Math.floor(prng.next() * 16);
    ctx.fillStyle = def.noiseColors[Math.floor(prng.next() * def.noiseColors.length)];
    ctx.fillRect(x, y, 1, 1);
  }

  // Border
  ctx.strokeStyle = def.borderColor;
  ctx.strokeRect(0, 0, 16, 16);

  // Specific details
  if (def.textureType === "wood") {
    ctx.fillStyle = def.noiseColors[0];
    for (let i = 0; i < 4; i++) {
      const y = Math.floor(prng.next() * 16);
      ctx.fillRect(0, y, 16, 2);
    }
  } else if (def.textureType === "parking") {
    // Draw parking lines
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(1, 1, 1, 14);
    ctx.fillRect(14, 1, 1, 14);
  } else if (def.textureType === "platform") {
    // Yellow edge
    ctx.fillStyle = "#eab308";
    ctx.fillRect(0, 0, 16, 2);
  } else if (def.textureType === "railway") {
    // Railway sleepers
    ctx.fillStyle = def.borderColor;
    for (let i = 0; i < 16; i += 4) {
      ctx.fillRect(0, i, 16, 2);
    }
    // Rails
    ctx.fillStyle = "#a1a1aa";
    ctx.fillRect(3, 0, 2, 16);
    ctx.fillRect(11, 0, 2, 16);
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
