import { describe, it, expect, beforeAll } from "vitest";
import { WorldGenerator, generateChunk, BLOCK } from "../src/world/worldgen.js";
import { mulberry32, hashSeed, fractalNoise } from "../src/world/noise.js";
import { CHUNK_SIZE, SEA_LEVEL, BIOME, WORLD_HEIGHT } from "../src/config.js";

const SEED = "BEDROCK_1_4_2_W1";

describe("seeded PRNG + noise", () => {
  it("mulberry32 is deterministic for an identical seed", () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it("hashSeed is deterministic and varies with input", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });
  it("fractal noise is smooth-ish and bounded in [0,1]", () => {
    const fn = fractalNoise(mulberry32(7), 4, 0.5, 2);
    for (let i = 0; i < 50; i++) {
      const v = fn(i * 0.01, i * 0.02);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("world generation reproducibility", () => {
  it("same seed produces identical surface heights (key terrain consistent)", () => {
    const g1 = new WorldGenerator(SEED);
    const g2 = new WorldGenerator(SEED);
    const pts = [];
    for (let x = -60; x <= 60; x += 7) {
      for (let z = -60; z <= 60; z += 7) {
        pts.push([x, z]);
        expect(g1.surfaceHeight(x, z)).toBe(g2.surfaceHeight(x, z));
      }
    }
    // a real sanity check that we actually sampled a spread
    expect(pts.length).toBeGreaterThan(200);
  });

  it("different seeds produce different terrain", () => {
    const g1 = new WorldGenerator(SEED);
    const g2 = new WorldGenerator("ANOTHER_SEED");
    let diff = 0;
    for (let x = 0; x < 80; x += 3) {
      for (let z = 0; z < 80; z += 3) {
        if (g1.surfaceHeight(x, z) !== g2.surfaceHeight(x, z)) diff++;
      }
    }
    expect(diff).toBeGreaterThan(30);
  });

  it("generated chunk is identical across two runs of same seed", () => {
    const g1 = generateChunk(new WorldGenerator(SEED), 2, -3);
    const g2 = generateChunk(new WorldGenerator(SEED), 2, -3);
    expect(g1.size).toBe(CHUNK_SIZE * CHUNK_SIZE);
    for (const [k, col] of g1) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        expect(col[y]).toBe(g2.get(k)[y]);
      }
    }
  });
});

describe("biome and terrain diversity", () => {
  let gen;
  beforeAll(() => { gen = new WorldGenerator(SEED); });

  it("contains water, ocean depth levels (shallow & deep) and land biomes", () => {
    const found = new Set();
    const climates = new Set();
    for (let x = -200; x <= 200; x += 2) {
      for (let z = -200; z <= 200; z += 2) {
        const b = gen.biomeAt(x, z);
        found.add(b.biome);
        climates.add(b.climate);
      }
    }
    expect(found.has(BIOME.OCEAN_SHALLOW)).toBe(true);
    expect(found.has(BIOME.OCEAN_DEEP)).toBe(true);
    expect(found.has(BIOME.PLAINS)).toBe(true);
    expect(found.has(BIOME.DESERT)).toBe(true);
    expect(found.has(BIOME.MOUNTAINS)).toBe(true);
    expect(found.has(BIOME.FOREST)).toBe(true);
  });

  it("ocean climate is supported (cold/warm/deep can coexist in data)", () => {
    // water columns carry a climate label; ensure at least 2 climate classes exist
    const c = new Set();
    for (let x = -100; x <= 100; x += 3) {
      for (let z = -100; z <= 100; z += 3) {
        const b = gen.biomeAt(x, z);
        if (b.biome === BIOME.OCEAN_DEEP || b.biome === BIOME.OCEAN_SHALLOW) {
          c.add(b.climate);
        }
      }
    }
    expect(c.size).toBeGreaterThanOrEqual(2);
  });

  it("deep ocean columns are lower than shallow / sea level", () => {
    const low = [];
    for (let x = -120; x <= 120; x += 1) {
      for (let z = -120; z <= 120; z += 1) {
        const b = gen.biomeAt(x, z);
        if (b.biome === BIOME.OCEAN_DEEP) low.push(b.elev);
        if (b.biome === BIOME.OCEAN_SHALLOW && low.length < 1000) {
          // shallow stays gently below sea level
          expect(b.elev).toBeGreaterThan(-13);
        }
      }
    }
    // deep ocean sampled and notably below sea level
    expect(low.length).toBeGreaterThan(100);
    const minDeep = Math.min(...low);
    expect(minDeep).toBeLessThan(-14);
  });

  it("ocean columns fill with water up to sea level and terrain stays in bounds", () => {
    let oceanHits = 0, waterToSealevel = 0;
    for (let x = -80; x < 60; x += 1) {
      for (let z = -80; z < 60; z += 1) {
        const b = gen.biomeAt(x, z);
        if (b.biome === BIOME.OCEAN_DEEP || b.biome === BIOME.OCEAN_SHALLOW) {
          oceanHits++;
          const col = gen.column(x, z);
          expect(col.length).toBe(WORLD_HEIGHT);
          if (gen.surfaceHeight(x, z) < SEA_LEVEL) {
            expect(col[SEA_LEVEL]).toBe(BLOCK.WATER);
            waterToSealevel++;
          } else {
            // a shoal sitting exactly at sea level — surface block is solid
            expect(col[SEA_LEVEL]).not.toBe(BLOCK.AIR);
          }
        }
      }
    }
    expect(oceanHits).toBeGreaterThan(200);
    expect(waterToSealevel).toBeGreaterThan(oceanHits * 0.9);
  });
});
