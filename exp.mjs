import { chromium } from "playwright-core";
const EXE="/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
const base="http://127.0.0.1:4182/";
const browser=await chromium.launch({executablePath:EXE,args:["--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.goto(base+"?seed=BEDROCK_1_4_2_W1",{waitUntil:"networkidle"});
await page.waitForTimeout(3500);
await page.waitForFunction(()=>window.__voxel && window.__voxel.engine).catch(()=>{});
await page.waitForTimeout(1500);
// experiment A: nosky
await page.evaluate(()=>{ window.__voxel.engine.sky.visible=false; const p=window.__voxel.player; p.yaw=4.2; p.pitch=-0.25; });
await page.waitForTimeout(400);
await page.screenshot({path:"screenshots/w1-BEDROCK_1_4_2_W1/_nosky.png"});
// experiment B: restore sky, and also test looking UP
await page.evaluate(()=>{ const p=window.__voxel.player; window.__voxel.engine.sky.visible=false; p.yaw=0; p.pitch=0.5; });
await page.waitForTimeout(400);
await page.screenshot({path:"screenshots/w1-BEDROCK_1_4_2_W1/_up_nosky.png"});
console.log("top-3 rows of nosky (looking down) center pixel and a mid scan");
await browser.close();
