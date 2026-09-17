// Original procedural pixel textures. We generate every tile from scratch on a
// canvas with a seeded RNG — no copied Minecraft or commercial assets.
import { mulberry32 } from "../world/noise.js";

export const TILE = 16; // texture tile is 16x16 pixels (Bedrock-inspired resolution)
export const BLOCKS_PER_ROW = 8;

// Block -> { side, top, bottom } tile indices into the atlas.
// tile 0 = reserved empty (air/simple).
export const TILE_BY_BLOCK = {
  grass: { side: 1, top: 2, bottom: 3 },
  dirt: { side: 3, top: 3, bottom: 3 },
  stone: { side: 4, top: 4, bottom: 4 },
  sand: { side: 5, top: 5, bottom: 5 },
  sandstone: { side: 6, top: 6, bottom: 6 },
  water: { side: 7, top: 7, bottom: 7 },
  snow: { side: 8, top: 8, bottom: 8 },
  log: { side: 9, top: 10, bottom: 10 },
  leaves: { side: 11, top: 11, bottom: 11 },
  bedrock: { side: 12, top: 12, bottom: 12 },
  cactus: { side: 13, top: 14, bottom: 15 },
  plank: { side: 16, top: 16, bottom: 16 },
};

// Base palette per tile index — original colors (not exact Minecraft values).
function palette(tile) {
  switch (tile) {
    case 1: return { base: [122, 164, 78], dark: [95, 133, 60] };   // grass side
    case 2: return { base: [121, 189, 72], dark: [100, 162, 58] };  // grass top
    case 3: return { base: [132, 96, 58], dark: [110, 78, 47] };    // dirt
    case 4: return { base: [126, 126, 126], dark: [102, 102, 102] };// stone
    case 5: return { base: [210, 196, 146], dark: [184, 168, 118] };// sand
    case 6: return { base: [216, 202, 156], dark: [190, 172, 124] };// sandstone
    case 7: return { base: [52, 106, 190], dark: [36, 84, 168] };   // water
    case 8: return { base: [238, 244, 250], dark: [208, 220, 232] };// snow
    case 9: return { base: [106, 78, 48], dark: [88, 64, 40] };     // log side
    case 10: return { base: [142, 108, 68], dark: [120, 90, 56] };  // log end
    case 11: return { base: [66, 128, 58], dark: [52, 104, 46] };   // leaves
    case 12: return { base: [52, 52, 52], dark: [40, 40, 40] };     // bedrock
    case 13: return { base: [76, 128, 62], dark: [60, 106, 50] };   // cactus side
    case 14: return { base: [190, 224, 84], dark: [150, 180, 58] }; // cactus end
    case 15: return { base: [160, 196, 66], dark: [128, 156, 50] }; // cactus stripe
    case 16: return { base: [186, 158, 100], dark: [158, 132, 82] };// plank
    default: return { base: [255, 255, 255], dark: [200, 200, 200] };
  }
}

// Build a canvas texture atlas with one 16x16 tile per entry.
export function buildAtlas(seed = "W1_ATLAS") {
  const rand = mulberry32(123456 + (seed.charCodeAt(0) || 0));
  const cols = BLOCKS_PER_ROW;
  const rows = Math.ceil(32 / cols);
  const canvas =
    typeof document !== "undefined"
      ? document.createElement("canvas")
      : null;
  if (!canvas) return null; // no DOM in Node tests
  canvas.width = cols * TILE;
  canvas.height = rows * TILE;
  const ctx = canvas.getContext("2d");

  const drawTile = (tile, x0, y0) => {
    const { base, dark } = palette(tile);
    // per-pixel speckle for a pixel-art look
    const img = ctx.createImageData(TILE, TILE);
    const d = img.data;
    for (let i = 0; i < TILE * TILE; i++) {
      const r = base[0] + (rand() - 0.5) * 26;
      const g = base[1] + (rand() - 0.5) * 26;
      const b = base[2] + (rand() - 0.5) * 26;
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
    // a few darker pixels for interest
    for (let k = 0; k < 8; k++) {
      const i = Math.floor(rand() * TILE * TILE);
      d[i * 4] = dark[0];
      d[i * 4 + 1] = dark[1];
      d[i * 4 + 2] = dark[2];
    }
    ctx.putImageData(img, x0 * TILE, y0 * TILE);
  };

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawTile(idx, c, r);
      idx++;
      if (idx > 32) break;
    }
  }
  return canvas;
}

// UV rect for a tile index (in normalized 0..1 space) given atlas size.
export function tileUV(tile) {
  const cols = BLOCKS_PER_ROW;
  const rows = Math.ceil(32 / cols);
  const col = tile % cols;
  const row = Math.floor(tile / cols);
  const u0 = col / cols;
  const v0 = 1 - (row / rows);
  const u1 = (col + 1) / cols;
  const v1 = 1 - ((row + 1) / rows);
  return { u0, v0, u1, v1 };
}
