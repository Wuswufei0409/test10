// Central tunable configuration for the W1 module.
// Default seed is fixed so a given build reproduces identical terrain for every
// user (reproducible acceptance evidence). Override with ?seed=<seed> in the URL.

export const DEFAULT_SEED = "BEDROCK_1_4_2_W1";

export const CHUNK_SIZE = 16; // columns per chunk side
export const WORLD_HEIGHT = 96; // max column height
export const SEA_LEVEL = 24; // water surface y (world units)
export const DEEP_OCEAN_THRESHOLD = 15; // height below which ocean is "deep"
export const SHALLOW_OCEAN_THRESHOLD = SEA_LEVEL - 6;

// Render distance in chunks around the player.
export const RENDER_DISTANCE = 4;

// World-gen noise scales.
export const HEIGHT_SCALE = 0.0065;
export const BASE_NOISE_OCTAVES = 4;
export const BASE_NOISE_GAIN = 0.5;
export const BASE_NOISE_LACUNARITY = 2.0;
export const MOUNTAIN_THRESHOLD = 0.62;
export const SNOW_LEVEL = 72;

export const BIOME = {
  OCEAN_DEEP: 0,
  OCEAN_SHALLOW: 1,
  BEACH: 2,
  PLAINS: 3,
  FOREST: 4,
  DESERT: 5,
  MOUNTAINS: 6,
  SNOWY: 7,
};

export const CLIMATE = {
  COLD: "cold",
  TEMPERATE: "temperate",
  WARM: "warm",
};
