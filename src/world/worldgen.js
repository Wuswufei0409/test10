// Deterministic world generation: biomes, surface height, full block columns.
// Pure / dependency-free so it can be run in Node tests for reproducibility.

import {
  CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL,
  DEEP_OCEAN_THRESHOLD, MOUNTAIN_THRESHOLD, SNOW_LEVEL,
  HEIGHT_SCALE, BASE_NOISE_OCTAVES, BASE_NOISE_GAIN, BASE_NOISE_LACUNARITY,
  BIOME, CLIMATE,
} from "../config.js";
import { mulberry32, hashSeed, fractalNoise } from "./noise.js";

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  SNOW: 6,
  OAK_LOG: 7,
  OAK_LEAVES: 8,
  BEDROCK: 9,
  CACTUS: 10,
  SANDSTONE: 11,
};

// Column result computed from deterministic noise.
export class WorldGenerator {
  constructor(seed) {
    this.seedHash = hashSeed(seed);
    const rng = mulberry32(this.seedHash);
    this.heightNoise = fractalNoise(
      mulberry32(rng() * 4294967296 >>> 0 || 1),
      BASE_NOISE_OCTAVES, BASE_NOISE_GAIN, BASE_NOISE_LACUNARITY
    );
    this.mountainNoise = fractalNoise(
      mulberry32(rng() * 4294967296 >>> 0 || 1),
      BASE_NOISE_OCTAVES, BASE_NOISE_GAIN, BASE_NOISE_LACUNARITY
    );
    this.temperatureNoise = fractalNoise(
      mulberry32(rng() * 4294967296 >>> 0 || 1),
      3, 0.5, 2.0
    );
    this.moistureNoise = fractalNoise(
      mulberry32(rng() * 4294967296 >>> 0 || 1),
      3, 0.5, 2.0
    );
    this.treeNoise = fractalNoise(
      mulberry32(rng() * 4294967296 >>> 0 || 1),
      2, 0.5, 2.0
    );
  }

  // Temperature in [0,1] (cold->warm). Drives ocean climate.
  temperature(x, z) {
    return this.temperatureNoise(x * 0.004 + 100, z * 0.004 + 100);
  }

  // Moisture in [0,1] (dry->wet). Drives forest vs plains vs desert.
  moisture(x, z) {
    return this.moistureNoise(x * 0.006 + 300, z * 0.006 + 300);
  }

  // Continent/height noise influencing base elevation.
  baseElevation(x, z) {
    return this.heightNoise(x * HEIGHT_SCALE, z * HEIGHT_SCALE);
  }

  // Mountains add sharp vertical relief on top of base elevation.
  mountainFactor(x, z) {
    const m = this.mountainNoise(x * 0.008 + 50, z * 0.008 + 50);
    return Math.max(0, (m - 0.5) * 2.0); // 0..1 steepness contribution
  }

  // Biomes, ocean depth and climate for a column. Deterministic.
  biomeAt(x, z) {
    const elev = this.baseElevation(x, z);
    const mtn = this.mountainFactor(x, z);
    const temp = this.temperature(x, z);
    const moist = this.moisture(x, z);

    // Height in voxels above sea level from continent noise.
    const raw = (elev - 0.5) * 46 + mtn * 46;
    // Amplify oceans so shallow seafloor sits gently below sea level and deep
    // ocean floors drop significantly — a clear shallow/deep depth separation.
    let land = raw;
    if (raw < -8) land = raw * 3.2; // deep ocean
    else if (raw < 0) land = raw * 1.6; // shallow ocean

    const climate = temp < 0.33 ? CLIMATE.COLD : temp > 0.66 ? CLIMATE.WARM : CLIMATE.TEMPERATE;

    if (raw < -8) return { biome: BIOME.OCEAN_DEEP, elev: land, climate };
    if (land < 0) return { biome: BIOME.OCEAN_SHALLOW, elev: land, climate };
    if (land < 1) return { biome: BIOME.BEACH, elev: land, climate };

    if (mtn > 0.55 || land > 26) {
      const biome = elev + mtn * elev > SNOW_LEVEL ? BIOME.SNOWY : BIOME.MOUNTAINS;
      return { biome, elev: land, climate };
    }
    if (temp < 0.3 && moist > 0.5) return { biome: BIOME.SNOWY, elev: land, climate };
    if (temp > 0.62 && moist < 0.42) return { biome: BIOME.DESERT, elev: land, climate };
    if (moist > 0.52) return { biome: BIOME.FOREST, elev: land, climate };
    return { biome: BIOME.PLAINS, elev: land, climate };
  }

  // Surface block height (top solid block y) for a column.
  surfaceHeight(x, z) {
    const { elev } = this.biomeAt(x, z);
    let h = SEA_LEVEL + Math.round(elev);
    return Math.max(1, Math.min(WORLD_HEIGHT - 2, h));
  }

  // Generate the full block column (bottom->top) for world column (x, z).
  column(x, z) {
    const { biome, climate } = this.biomeAt(x, z);
    const surface = this.surfaceHeight(x, z);
    const col = new Array(WORLD_HEIGHT).fill(BLOCK.AIR);

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      if (y === 0) {
        col[y] = BLOCK.BEDROCK;
      } else if (y < surface) {
        col[y] = biome === BIOME.DESERT ? BLOCK.SANDSTONE : BLOCK.STONE;
      } else if (y === surface) {
        switch (biome) {
          case BIOME.DESERT: col[y] = BLOCK.SAND; break;
          case BIOME.BEACH: col[y] = BLOCK.SAND; break;
          case BIOME.SNOWY: col[y] = BLOCK.SNOW; break;
          default: col[y] = BLOCK.GRASS;
        }
      } else if (y === surface - 1) {
        // a layer of dirt under the surface block (only on grassy land)
        if (biome !== BIOME.DESERT && biome !== BIOME.BEACH && biome !== BIOME.SNOWY) {
          col[y] = BLOCK.DIRT;
        }
      }
    }

    // Water filling under sea level.
    for (let y = surface + 1; y <= SEA_LEVEL; y++) {
      if (col[y] === BLOCK.AIR) col[y] = BLOCK.WATER;
    }

    // Trees / cacti.
    if ((biome === BIOME.FOREST || biome === BIOME.PLAINS)) {
      const tn = this.treeNoise(x * 0.05, z * 0.05);
      if (biome === BIOME.FOREST && tn > 0.55) this.placeTree(col, surface);
      else if (biome === BIOME.PLAINS && tn > 0.82) this.placeTree(col, surface);
    } else if (biome === BIOME.DESERT) {
      const tn = this.treeNoise(x * 0.05 + 7, z * 0.05 + 7);
      if (tn > 0.86) this.placeCactus(col, surface);
    }

    // climate is surfaced for ocean decisions (warm/cold) — expose via extra field
    col.climate = climate;
    return col;
  }

  placeTree(col, surface) {
    const base = surface + 1;
    const trunkH = 4;
    const top = base + trunkH;
    if (top + 2 >= WORLD_HEIGHT) return;
    for (let i = 0; i < trunkH; i++) {
      if (col[base + i] === BLOCK.AIR) col[base + i] = BLOCK.OAK_LOG;
    }
    // Leaf canopy: a 3x3x2 blob centered on (top..top+1), leaving trunk gaps.
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const idx = top + dy;
          if (idx >= WORLD_HEIGHT || col[idx] !== BLOCK.AIR) continue;
          if (dy === 0 && dx === 0 && dz === 0) continue; // trunk column
          col[idx] = BLOCK.OAK_LEAVES;
        }
      }
    }
    if (col[top] === BLOCK.AIR) col[top] = BLOCK.OAK_LEAVES;
  }

  placeCactus(col, surface) {
    for (let i = 1; i <= 2; i++) {
      if (surface + i < WORLD_HEIGHT) col[surface + i] = BLOCK.CACTUS;
    }
  }
}

// Generate a full chunk (columns CHUNK_SIZE x CHUNK_SIZE) at chunk coords.
// worldX = chunkX * CHUNK_SIZE ... Returns { columns: Map(key->column) }
export function generateChunk(gen, chunkX, chunkZ) {
  const columns = new Map();
  const baseX = chunkX * CHUNK_SIZE;
  const baseZ = chunkZ * CHUNK_SIZE;
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = baseX + lx;
      const wz = baseZ + lz;
      columns.set(lx + lz * CHUNK_SIZE, gen.column(wx, wz));
    }
  }
  return columns;
}
