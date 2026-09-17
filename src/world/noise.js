// Deterministic seeded PRNG + fractal value noise used by world generation.
// Everything here is pure and dependency-free so it can be unit-tested in Node
// and guarantees identical output for an identical seed.

// mulberry32 — a compact, deterministic, seedable 32-bit PRNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Derive a 32-bit integer seed from an arbitrary string (FNV-1a).
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Deterministic 2D lattice value noise at integer lattice points.
// Returns values roughly in [0, 1].
export function valueNoise2D(rand) {
  // Generate a deterministic lattice using the supplied RNG.
  const table = new Float32Array(256 * 256);
  for (let i = 0; i < table.length; i++) table[i] = rand();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  function sample(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const idx = (xi & 255) + (yi & 255) * 256;
    const a = table[idx];
    const b = table[(idx + 1) & 255];
    const c = table[(idx + 256) & 65535];
    const d = table[((idx + 1) & 255) + 256];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  return sample;
}

// Fractal (octave) noise: sum of value noise at increasing frequency.
// Returns value roughly in [0,1].
export function fractalNoise(rand, octaves, gain, lacunarity) {
  const base = valueNoise2D(rand);
  return function (x, y) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += base(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  };
}
