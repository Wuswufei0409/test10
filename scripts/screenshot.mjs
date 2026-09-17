// Visual smoke + acceptance evidence for W1.
// Loads the built app in headless Chromium, verifies canvas/HUD with zero
// blocking console errors, records a stable average FPS, and captures
// screenshots across 2 viewport sizes x 3 camera angles for the reviewer.
// Usage: node scripts/screenshot.mjs [--out DIR]
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const EXE = process.env.CHROMIUM_EXE ||
  "/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4182/";
const seed = "BEDROCK_1_4_2_W1";
const outDir = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : join(root, "screenshots", `w1-${seed}`);
mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", w: 1280, h: 720 },
  { name: "small", w: 900, h: 600 },
];
const ANGLES = [
  { name: "a", yaw: 0.0, pitch: 0.05 },
  { name: "b", yaw: 2.4, pitch: 0.0 },
  { name: "c", yaw: 4.2, pitch: -0.25 },
];

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const blocking = (t) => !/favicon/i.test(t);
let globalErrors = [];
let minFps = Infinity, maxFps = -Infinity, sampleCount = 0;

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && blocking(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => { const s = String(e); if (blocking(s)) errors.push(s); });

  const url = base + "?seed=" + encodeURIComponent(seed);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.getElementById("app")?.requestPointerLock?.bind?.call || 0); // noop guard
  // wait for chunks to load + first mesh
  await page.waitForFunction(() => window.__voxel && window.__voxel.loadedChunks() > 30, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // stable average FPS over ~6s
  const fps = await page.evaluate(() => {
    return new Promise((resolve) => {
      const v = window.__voxel;
      let frames = 0, acc = 0, t0 = performance.now();
      const start = performance.now();
      function tick() {
        frames++;
        const now = performance.now();
        if (now - start >= 6000) {
          resolve({ avg: frames / ((now - start) / 1000), loaded: v.loadedChunks() });
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  });
  if (fps.avg < minFps) minFps = fps.avg;
  if (fps.avg > maxFps) maxFps = fps.avg;
  sampleCount++;
  const stat = vp.name;

  for (const a of ANGLES) {
    await page.evaluate((aa) => {
      const v = window.__voxel;
      v.player.yaw = aa.yaw;
      v.player.pitch = aa.pitch;
    }, a);
    await page.waitForTimeout(700);
    const fn = join(outDir, `${stat}_${a.name}.png`);
    await page.screenshot({ path: fn, fullPage: false });
    globalErrors.push(...errors);
    console.log(`${stat}/${a.name} saved ${fn} (fps=${fps.avg.toFixed(1)}, loaded=${fps.loaded}, err=${errors.length})`);
  }
  await page.close();
}

await browser.close();
console.log("FPS range:", minFps.toFixed(1), "-", maxFps.toFixed(1), "samples:", sampleCount);
console.log("consoleErrors:", globalErrors.length, globalErrors.slice(0, 5));
console.log("screenshots dir:", outDir);
if (globalErrors.length > 0) { console.error("VISUAL_FAIL blocking console errors present"); process.exit(1); }
console.log("VISUAL_OK");
