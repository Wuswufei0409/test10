// Fixed-seed smoke check (runs in CI + locally). Generates a fixed-seed world
// and verifies it contains the expected biome/depth/climate diversity. Exits
// non-zero on failure — mirrors the acceptance-relevant worldgen guarantees.
import { WorldGenerator, BLOCK } from "../src/world/worldgen.js";
import { BIOME, WORLD_HEIGHT } from "../src/config.js";

const SEED = "BEDROCK_1_4_2_W1";
const gen = new WorldGenerator(SEED);

const biomes = new Set();
const climates = new Set();
let oceanCols = 0, waterCount = 0, chunkChecks = 0;
const surface = new Map(); // for determinism re-check
const key = (x, z) => x + "," + z;

for (let cx = -24; cx <= 24; cx++) {
  for (let cz = -24; cz <= 24; cz++) {
    for (let x = cx * 16; x < cx * 16 + 16; x += 4) {
      for (let z = cz * 16; z < cz * 16 + 16; z += 4) {
        chunkChecks++;
        const b = gen.biomeAt(x, z);
        biomes.add(b.biome);
        climates.add(b.climate);
        const col = gen.column(x, z);
        if (col.some((v) => v === BLOCK.WATER)) { oceanCols++; waterCount++; }
        if (surface.has(key(x, z))) {
          if (surface.get(key(x, z)) !== gen.surfaceHeight(x, z)) {
            console.error("NONDETERMINISM at", x, z);
            process.exit(1);
          }
        } else {
          surface.set(key(x, z), gen.surfaceHeight(x, z));
        }
      }
    }
  }
}

// Re-run whole thing: must be identical (reproducible / no shared mutable state)
const gen2 = new WorldGenerator(SEED);
for (const [k, v] of surface) {
  const [x, z] = k.split(",").map(Number);
  if (gen2.surfaceHeight(x, z) !== v) {
    console.error("REPRO FAIL key terrain differs for same seed");
    process.exit(1);
  }
}

console.log("smoke: columns=", chunkChecks, "biomes=", biomes.size, "climates=", climates.size, "waterCols=", waterCount);
const required = [
  BIOME.OCEAN_DEEP, BIOME.OCEAN_SHALLOW, BIOME.PLAINS,
  BIOME.FOREST, BIOME.DESERT, BIOME.MOUNTAINS,
];
for (const r of required) if (!biomes.has(r)) { console.error("missing biome", r); process.exit(1); }
if (climates.size < 3) { console.error("too few climates", climates); process.exit(1); }
if (waterCount < 500) { console.error("too little ocean", waterCount); process.exit(1); }
console.log("SMOKE_OK");
