// Deployment health check: serves the built `dist` and asserts the app entry
// and a built JS asset return 200. Exits non-zero on failure. Used by CI.
import http from "node:http";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = join(process.cwd(), "dist");
const PORT = 0; // bind an ephemeral free port to avoid collisions
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

if (!existsSync(join(ROOT, "index.html"))) {
  console.error("HEALTH_FAIL: dist/index.html missing — run `npm run build` first");
  process.exit(1);
}

function assetFiles() {
  const assetsDir = join(ROOT, "assets");
  if (!existsSync(assetsDir)) return [];
  return readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
}

const server = http.createServer((req, res) => {
  let p = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  let file = join(ROOT, p);
  if (!existsSync(file) || !file.startsWith(ROOT)) { res.writeHead(404); res.end("404"); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

server.listen(PORT, async () => {
  try {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    const r1 = await fetch(base + "/");
    const r2 = await fetch(base + "/index.html");
    const js = assetFiles();
    let r3 = null;
    if (js.length) r3 = await fetch(base + "/assets/" + js[0]);
    const html = await r1.text();
    const ok = r1.status === 200 && r2.status === 200 && html.includes("src") &&
      (!js.length || (r3 && r3.status === 200));
    console.log(`health: / -> ${r1.status}, /index.html -> ${r2.status}, js asset -> ${js.length ? (r3 ? r3.status : "n/a") : "none"}`);
    server.close();
    if (!ok) { console.error("HEALTH_FAIL"); process.exit(1); }
    console.log("HEALTH_OK");
  } catch (e) {
    console.error("HEALTH_FAIL", e.message);
    process.exit(1);
  }
});
