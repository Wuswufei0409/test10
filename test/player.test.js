import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { Player } from "../src/render/player.js";
import { World } from "../src/world/World.js";
import { BLOCK } from "../src/world/worldgen.js";

const SEED = "BEDROCK_1_4_2_W1";

function makePlayer() {
  const world = new World(SEED);
  const camera = { rotation: { order: "YXZ", y: 0, x: 0 }, position: new THREE.Vector3() };
  const dom = { requestPointerLock() {} };
  return new Player(camera, world, dom);
}

describe("Player spawn / collision root cause", () => {
  it("spawns on clear open ground (not in/on a tree canopy, with air above), camera not embedded", () => {
    const p = makePlayer();
    const fx = Math.floor(p.pos.x), fy = Math.floor(p.pos.y), fz = Math.floor(p.pos.z);
    // ground under feet is solid
    expect(p.world.getBlock(fx, fy - 1, fz)).not.toBe(BLOCK.AIR);
    // block at feet and above are not solid (open space; leaves passable)
    expect(p.isSolid(fx, fy, fz)).toBe(false);
    expect(p.isSolid(fx, fy + 1, fz)).toBe(false);
    expect(p.isSolid(fx, fy + 2, fz)).toBe(false);
    // camera position is a clean standing point
    expect(p.overlapsSolid()).toBe(false);
  });

  it("leaves are passable (player never gets trapped in a canopy)", () => {
    const w = new World(SEED);
    const p = new Player({ rotation: { order: "YXZ", y: 0, x: 0 }, position: new THREE.Vector3() }, w, { requestPointerLock() {} });
    // find any leaf block and assert isSolid(leaf) is false
    let found = null;
    outer:
    for (let cx = -10; cx <= 10; cx++) {
      for (let cz = -10; cz <= 10; cz++) {
        const c = w.ensureChunk(cx, cz);
        for (const [k, col] of c) {
          for (let y = 0; y < 96; y++) {
            if (col[y] === BLOCK.OAK_LEAVES) {
              const lx = k % 16, lz = Math.floor(k / 16);
              found = { wx: cx * 16 + lx, wy: y, wz: cz * 16 + lz };
              break outer;
            }
          }
        }
      }
    }
    expect(found).toBeTruthy();
    expect(p.isSolid(found.wx, found.wy, found.wz)).toBe(false);
    // the log trunk the leaves hang on IS solid
    expect(p.isSolid(found.wx, found.wy - 3, found.wz)).not.toBe(false);
  });

  it("anti-embedding: moveAxis never leaves the body overlapping a solid block", () => {
    const p = makePlayer();
    // push player hard into a wall nearby and confirm resolution removes overlap
    p.moveAxis("y", -50); // fall far
    expect(p.overlapsSolid()).toBe(false);
    p.moveAxis("x", 50);
    p.moveAxis("z", 50);
    p.update(0.016);
    expect(p.overlapsSolid()).toBe(false);
  });
});
