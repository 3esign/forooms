/**
 * A simple seeded pseudo-random number generator (Mulberry32).
 * Used to ensure deterministic procedural generation (textures, trees) for the same bounding box.
 */
export class PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Returns a float between 0 (inclusive) and 1 (exclusive) */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Creates a deterministic seed integer from a bounding box array.
 */
export function hashBbox(bbox: [number, number, number, number]): number {
  const str = bbox.map(n => n.toFixed(6)).join(',');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
