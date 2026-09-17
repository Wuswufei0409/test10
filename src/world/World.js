// World-level chunk cache + column accessor that lazily generates neighbour
// columns so chunk meshing stays correct across chunk borders.
import { WorldGenerator, generateChunk, BLOCK } from "./worldgen.js";
import { CHUNK_SIZE, WORLD_HEIGHT } from "../config.js";

export class World {
  constructor(seed) {
    this.gen = new WorldGenerator(seed);
    this.seed = seed;
    this.chunks = new Map(); // "cx,cz" -> columns Map
    this.meshes = new Map(); // "cx,cz" -> { opaque, water }
  }

  key(cx, cz) {
    return cx + "," + cz;
  }

  unloadChunk(cx, cz) {
    const k = this.key(cx, cz);
    this.chunks.delete(k);
    if (this.meshes.has(k)) this.meshes.delete(k);
  }

  ensureChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (!this.chunks.has(k)) {
      this.chunks.set(k, generateChunk(this.gen, cx, cz));
    }
    return this.chunks.get(k);
  }

  getColumn(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunk = this.ensureChunk(cx, cz);
    return chunk.get(lx + lz * CHUNK_SIZE) || null;
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return BLOCK.AIR;
    const col = this.getColumn(wx, wz);
    return col ? col[wy] : BLOCK.AIR;
  }
}
