// W1 entry point: boot the voxel world, engine, player, HUD and the
// render loop. Reads an optional ?seed= override (default is fixed & reproducible).
import { Engine } from "./render/engine.js";
import { Player } from "./render/player.js";
import { HUD } from "./render/hud.js";
import { World } from "./world/World.js";
import { DEFAULT_SEED } from "./config.js";
import { tileUV, BLOCKS_PER_ROW, TILE, TILE_BY_BLOCK } from "./render/textures.js";
import * as THREE from "three";

function readSeed() {
  const p = new URLSearchParams(window.location.search);
  return p.get("seed") && p.get("seed").trim() ? p.get("seed") : DEFAULT_SEED;
}

function init() {
  const container = document.getElementById("app");
  const seed = readSeed();

  const engine = new Engine(container);
  const world = new World(seed);
  const player = new Player(engine.camera, world, engine.renderer.domElement);
  const hud = new HUD(document.body, seed);

  // wire hotbar tile backgrounds from the atlas
  const rc = engine.texCanvas;
  for (const [name, tiles] of Object.entries(TILE_BY_BLOCK)) {
    const { u0, v0, u1, v1 } = tileUV(tiles.side);
    const sx = Math.round(u0 * rc.width);
    const sy = Math.round((1 - v0) * rc.height);
    const sw = Math.round((u1 - u0) * rc.width);
    const sh = Math.round((v0 - v1) * rc.height);
    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = sw; tileCanvas.height = sh;
    const tctx = tileCanvas.getContext("2d");
    tctx.drawImage(rc, sx, sy, sw, sh, 0, 0, sw, sh);
    hud.setTileStyle(name, `url(${tileCanvas.toDataURL()})`);
  }

  window.addEventListener("resize", () => {
    const w = container.clientWidth, h = container.clientHeight;
    engine.resize(w, h);
  });
  engine.resize(container.clientWidth, container.clientHeight);

  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement) hud.hideControls();
  });

  // ---- render loop ----
  let last = performance.now();
  let frames = 0;
  let fpsTimer = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    player.update(dt);
    const pc = player.playerChunk();
    engine.updateChunks(world, pc.x, pc.z);

    // fps + pos (2x/sec)
    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      hud.update(frames / fpsTimer, player.pos);
      frames = 0; fpsTimer = 0;
    }
    engine.render();
  }
  requestAnimationFrame(loop);

  // debug/evidence surface (used by headless screenshot & reviewers)
  window.__voxel = {
    player, world, engine, hud, seed, THREE,
    loadedChunks: () => world.chunks.size,
  };
}

init();
