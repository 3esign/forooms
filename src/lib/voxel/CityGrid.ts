import { BlockId } from "../blocks/BlockRegistry";

/**
 * Sparse 3D voxel grid. Ground is implicitly grass (BlockId.Grass) unless overridden.
 */
export class CityGrid {
  private voxels: Map<string, number>;
  public readonly width: number;
  public readonly depth: number;
  public readonly minX: number;
  public readonly maxX: number;
  public readonly minZ: number;
  public readonly maxZ: number;

  constructor(width: number, depth: number) {
    this.width = width;
    this.depth = depth;
    this.voxels = new Map();

    this.minX = -Math.floor(width / 2);
    this.maxX = Math.ceil(width / 2) - 1;
    this.minZ = -Math.floor(depth / 2);
    this.maxZ = Math.ceil(depth / 2) - 1;
  }

  public setVoxel(x: number, y: number, z: number, blockId: number) {
    const rx = Math.round(x);
    const rz = Math.round(z);
    
    // Enforce strict bounding box boundary clipping
    if (rx < this.minX || rx > this.maxX || rz < this.minZ || rz > this.maxZ) {
      return; // Do not render voxels that extend beyond the initial terrain bounds
    }

    const key = `${rx},${Math.round(y)},${rz}`;
    if (blockId === BlockId.Air) {
      this.voxels.delete(key);
    } else {
      this.voxels.set(key, blockId);
    }
  }

  public getVoxel(x: number, y: number, z: number): number {
    const stored = this.voxels.get(`${Math.round(x)},${Math.round(y)},${Math.round(z)}`);
    if (stored !== undefined) return stored;
    return y === 0 ? BlockId.Grass : BlockId.Air;
  }

  public getEntries(): IterableIterator<[string, number]> {
    return this.voxels.entries();
  }
}
