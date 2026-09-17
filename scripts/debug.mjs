// Runtime transform/geometry diagnostic for W1 (reviewer-requested debug output).
// Dumps camera/player/chunk numeric state + NDC projection of ground points per
// viewing angle, then captures screenshots and pixel-analyses them with pngjs.
// Usage: node scripts/debug.mjs [--out DIR]
import { chromium } from "playwright-core";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync } from "node:fs";
import pngjs from "pngjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const EXE = process.env.CHROMIUM_EXE ||
  "/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4182/";
const seed = "BEDROCK_1_4_2_W1";
const outDir = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : join(root, "debug");
mkdirSync(outDir, { recursive: true });
const ANGLES = [
  { name: "a", yaw: 0.0, pitch: 0.05 },
  { name: "b", yaw: 2.4, pitch: 0.0 },
  { name: "c", yaw: 4.2, pitch: -0.25 },
];

function regionStats(path) {
  const png = pngjs.PNG.sync.read(readFileSync(path));
  const { width, height, data } = png;
  // classify pixels: sky-ish (blue, saturated low-g), terrain (brown/dark/green),
  // water (blue-green). Count per vertical band.
  const bands = [];
  const bandH = Math.max(1, Math.floor(height / 8));
  for (let b = 0; b < 8; b++) {
    let sky = 0, terr = 0, water = 0, total = 0;
    for (let y = b * bandH; y < (b + 1) * bandH && y < height; y++) {
      for (let x = 0; x < width; x += 4) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], bl = data[i + 2];
        total++;
        const maxv = Math.max(r, g, bl), minv = Math.min(r, g, bl);
        // sky: blue dominant, light, low saturation
        if (bl > r + 8 && bl > g + 4 && (bl - minv) < 70) sky++;
        else if (g >= bl + 6 && g >= r + 2 && (g - minv) > 6) water++;
        else terr++;
      }
    }
    bands.push({ b, sky: +(sky / total).toFixed(3), water: +(water / total).toFixed(3), terr: +(terr / total).toFixed(3) });
  }
  return { width, height, bands };
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(base + "?seed=" + encodeURIComponent(seed), { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);
await page.waitForFunction(() => window.__voxel && window.__voxel.loadedChunks() > 30, { timeout: 20000 }).catch(()=>{});
await page.waitForFunction(() => { const v = window.__voxel; return v && v.engine && v.engine.chunkMeshes && v.engine.chunkMeshes.size >= 40; }, { timeout: 30000 }).catch(()=>{});
await page.waitForTimeout(2500);

const diag = await page.evaluate(() => {
  const v = window.__voxel, e = v.engine, c = e.camera, T = v.THREE;
  const m = { pos: [+c.position.x.toFixed(2), +c.position.y.toFixed(2), +c.position.z.toFixed(2)],
    rot: c.rotation.order + " y=" + (+c.rotation.y.toFixed(3)) + " x=" + (+c.rotation.x.toFixed(3)) + " z=" + (+c.rotation.z.toFixed(3)),
    fov: c.fov, near: c.near, far: c.far, aspect: +c.aspect.toFixed(3) };
  const renderer = { w: e.renderer.domElement.width, h: e.renderer.domElement.height,
    cssW: e.renderer.domElement.clientWidth, cssH: e.renderer.domElement.clientHeight, pr: e.renderer.getPixelRatio() };
  let verts = 0, tris = 0;
  e.chunkMeshes.forEach((pair) => pair.g.traverse((o) => {
    if (o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
      verts += o.geometry.attributes.position.count;
      tris += Math.floor((o.geometry.index ? o.geometry.index.count : 0) / 3);
    }
  }));
  // world bounds of loaded geometry via first mesh's boundingSphere
  const bounds = [];
  e.chunkMeshes.forEach((pair, k) => {
    if (bounds.length >= 5) return;
    let box = null;
    pair.g.traverse((o) => {
      if (o.geometry && o.geometry.boundingBox) { o.geometry.computeBoundingBox(); if (!box) box = o.geometry.boundingBox.clone(); else box.union(o.geometry.boundingBox); }
    });
    if (box) bounds.push({ key: k, min: [+box.min.x.toFixed(0), +box.min.y.toFixed(0), +box.min.z.toFixed(0)], max: [+box.max.x.toFixed(0), +box.max.y.toFixed(0), +box.max.z.toFixed(0)] });
  });
  return { camera: m, renderer, chunkMeshes: e.chunkMeshes.size, worldChunks: v.world.chunks.size,
    player: { pos: [+v.player.pos.x.toFixed(2), +v.player.pos.y.toFixed(2), +v.player.pos.z.toFixed(2)],
      chunk: v.player.playerChunk(), onGround: v.player.onGround, embedded: v.player.overlapsSolid() },
    geometry: { verts, tris }, chunkBounds: bounds };
});
console.log("DIAG " + JSON.stringify(diag));

for (const a of ANGLES) {
  await page.evaluate((aa) => { const v = window.__voxel; v.player.yaw = aa.yaw; v.player.pitch = aa.pitch; }, a);
  await page.waitForTimeout(800);
  const proj = await page.evaluate((aa) => {
    const v = window.__voxel, c = v.engine.camera, T = v.THREE;
    c.updateMatrixWorld(true); c.updateProjectionMatrix();
    c.matrixWorldInverse.copy(c.matrixWorld).invert();
    const p = v.player.pos;
    const fwd = new T.Vector3(); c.getWorldDirection(fwd);
    const fh = new T.Vector3(fwd.x, 0, fwd.z).normalize();
    const gy = Math.floor(p.y) - 1 + 0.1;
    const out = { yaw: aa.yaw, pitch: aa.pitch, fwd: [+fwd.x.toFixed(3), +fwd.y.toFixed(3), +fwd.z.toFixed(3)], horizonY: "" };
    // project the forward horizon (a point far ahead at camera height) to find screen Y of horizon
    const hz = new T.Vector3(p.x + fh.x * 500, p.y, p.z + fh.z * 500).project(c);
    out.horizonY = +huy(hz).toFixed(1);
    out.points = [];
    for (let d = 0; d <= 56; d += 8) {
      const q = new T.Vector3(p.x + fh.x * d, gy, p.z + fh.z * d).project(c);
      out.points.push({ d, ndc: [+q.x.toFixed(3), +q.y.toFixed(3)], sy: huy(q) });
    }
    function huy(q){ return (1 - (q.y * 0.5 + 0.5)) * 720; }
    return out;
  }, a);
  console.log("PROJ " + a.name + " " + JSON.stringify(proj));
  const fn = join(outDir, `${a.name}.png`);
  await page.screenshot({ path: fn, fullPage: false });
  console.log("REGION " + a.name + " " + JSON.stringify(regionStats(fn).bands));
}
await browser.close();
console.log("DEBUG done ->", outDir);
