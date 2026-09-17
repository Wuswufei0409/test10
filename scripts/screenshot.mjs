// Visual smoke: load the built page in headless Chromium, wait for the WebGL
// canvas + HUD to render, and capture screenshots for acceptance evidence.
// Usage: node scripts/screenshot.mjs [--seed SEED] [--out PATH]
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const EXE = process.env.CHROMIUM_EXE ||
  "/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4173/";
const seed = process.argv.includes("--seed") ? process.argv[process.argv.indexOf("--seed") + 1] : "BEDROCK_1_4_2_W1";
const outIdx = process.argv.indexOf("--out");
const out = outIdx !== -1 ? process.argv[outIdx + 1] : join(root, "screenshots", `w1-${seed}.png`);

const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
// ignore harmless favicon 404 (non-blocking); log others
const isBlocking = (t) => !/favicon/i.test(t);
page.on("console", (m) => { if (m.type() === "error" && isBlocking(m.text())) errors.push(m.text()); });
page.on("pageerror", (e) => { const s = String(e); if (isBlocking(s)) errors.push(s); });
page.on("requestfailed", (r) => { if (isBlocking(r.url())) errors.push("reqfail " + r.url()); });

const url = base + (base.includes("?") ? "&" : "?") + "seed=" + encodeURIComponent(seed);
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3500); // let the loop mesh + render chunks

const hasCanvas = await page.evaluate(() => !!document.querySelector("canvas"));
const health = await page.evaluate(() => ({
  crosshair: !!document.getElementById("hub-crosshair"),
  hotbar: document.getElementById("hub-hotbar")?.children.length || 0,
  fps: document.getElementById("hub-fps")?.textContent || "",
}));

await page.screenshot({ path: out, fullPage: true });

console.log("canvas:", hasCanvas, "crosshair:", health.crosshair, "hotbarCells:", health.hotbar, "fps:", health.fps);
console.log("consoleErrors:", errors.length, errors.slice(0, 5));
console.log("screenshot:", out);
await browser.close();

if (!hasCanvas || health.hotbar < 5 || errors.length > 0) {
  console.error("VISUAL_FAIL");
  process.exit(1);
}
console.log("VISUAL_OK");
