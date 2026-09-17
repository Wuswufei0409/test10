import { chromium } from "playwright-core";
const EXE = "/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4182/";
const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader","--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(base+"?seed=BEDROCK_1_4_2_W1", { waitUntil:"networkidle" });
await page.waitForTimeout(3500);
await page.waitForFunction(()=>window.__voxel && window.__voxel.loadedChunks()>20).catch(()=>{});
await page.waitForTimeout(2000);
// sample pixels from the rendered canvas
const res = await page.evaluate(() => {
  const cv = document.querySelector("canvas");
  const c = document.createElement("canvas");
  c.width = cv.width; c.height = cv.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(cv, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height;
  // classify: sky-ish = bright blue (r<g<b, b high), water-ish, terrain(brownish/green/gray)
  let sky=0, water=0, terrain=0, total=0;
  const isSky = (r,g,b)=> b>150 && b>=r && g>=r && (b-r)>30;
  const isWater = (r,g,b)=> b>110 && b>=g && b>=r && g>60;
  // sample only the bottom 55% (terrain band mostly) center 60%
  for (let y=Math.floor(H*0.45); y<H; y+=2){
    for (let x=Math.floor(W*0.2); x<W*0.8; x+=2){
      const i=(y*W+x)*4, r=d[i],g=d[i+1],b=d[i+2];
      total++;
      if(isWater(r,g,b)){ if(b-r>60&&g>60) water++; }
      if(isSky(r,g,b)) sky++;
      else terrain++;
    }
  }
  return { W,H, sky, water, terrain, total, skyPct:(sky/total*100).toFixed(1), waterPct:(water/total*100).toFixed(1) };
});
console.log(JSON.stringify(res));
await browser.close();
