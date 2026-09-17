import { describe, it, expect } from "vitest";
import { World } from "../src/world/World.js";
import { meshChunk } from "../src/world/mesher.js";

function warmChunks(w) {
  w.ensureChunk(0, 0); w.ensureChunk(1, 0); w.ensureChunk(-1, 0);
  w.ensureChunk(0, 1); w.ensureChunk(0, -1);
}

describe("chunk meshing", () => {
  it("produces valid opaque geometry for a land chunk", () => {
    const w = new World("BEDROCK_1_4_2_W1");
    warmChunks(w);
    const m = meshChunk(w, 0, 0);
    expect(m.opaque).toBeTruthy();
    const idx = m.opaque.getIndex();
    expect(idx.count > 0).toBe(true);
    expect(idx.count % 3).toBe(0);
    const pos = m.opaque.getAttribute("position");
    expect(pos.count % 4).toBe(0); // quads of 4 verts
  });

  it("produces water geometry for an ocean chunk", () => {
    const w = new World("BEDROCK_1_4_2_W1");
    let oceanChunk = null;
    outer:
    for (let cx = -14; cx <= 14; cx++) {
      for (let cz = -14; cz <= 14; cz++) {
        const c = w.ensureChunk(cx, cz);
        for (const col of c.values()) {
          if (col[24] === 5) { oceanChunk = [cx, cz]; break outer; }
        }
      }
    }
    expect(oceanChunk).toBeTruthy();
    const [cx, cz] = oceanChunk;
    w.ensureChunk(cx + 1, cz); w.ensureChunk(cx - 1, cz);
    w.ensureChunk(cx, cz + 1); w.ensureChunk(cx, cz - 1);
    const m = meshChunk(w, cx, cz);
    expect(m.water).toBeTruthy();
    expect(m.water.getIndex().count > 0).toBe(true);
  });

  it("identical seed yields identical mesh triangle counts", () => {
    const a = new World("SEED_X");
    const b = new World("SEED_X");
    warmChunks(a); warmChunks(b);
    const ma = meshChunk(a, 0, 0);
    const mb = meshChunk(b, 0, 0);
    expect(ma.opaque.getIndex().count).toBe(mb.opaque.getIndex().count);
  });
});
