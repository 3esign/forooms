/**
 * Handles Run-Length Encoding (RLE) to serialize/deserialize voxel chunks
 * in a highly optimized Uint16Array format: [count, blockId].
 */

/**
 * Compresses a flat 1D array of chunk block IDs into an RLE Uint16Array.
 * Max blockId is 65535, Max count is 65535.
 */
export function compressChunkRLE(chunkData: number[] | Uint16Array | Int32Array): Uint16Array {
  if (chunkData.length === 0) return new Uint16Array(0);

  const compressed: number[] = [];
  let currentBlock = chunkData[0];
  let currentCount = 1;

  for (let i = 1; i < chunkData.length; i++) {
    const block = chunkData[i];
    
    if (block === currentBlock && currentCount < 65535) {
      currentCount++;
    } else {
      compressed.push(currentCount, currentBlock);
      currentBlock = block;
      currentCount = 1;
    }
  }
  
  // Push the final run
  compressed.push(currentCount, currentBlock);

  return new Uint16Array(compressed);
}

/**
 * Decompresses an RLE Uint16Array back into a flat 1D array of block IDs.
 * Needs the expected target size (e.g. 32*32*32 = 32768) to preallocate the array.
 */
export function decompressChunkRLE(compressed: Uint16Array, expectedSize: number): Int32Array {
  const chunkData = new Int32Array(expectedSize);
  let writeIndex = 0;

  for (let i = 0; i < compressed.length; i += 2) {
    const count = compressed[i];
    const blockId = compressed[i + 1];

    for (let c = 0; c < count; c++) {
      if (writeIndex < expectedSize) {
        chunkData[writeIndex++] = blockId;
      }
    }
  }

  return chunkData;
}
