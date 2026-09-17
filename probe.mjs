import { PNG } from "pngjs"; import { readFileSync } from "node:fs"; import { join } from "node:path";
const dir="screenshots/w1-BEDROCK_1_4_2_W1";
for(const f of ["_nosky.png","_up_nosky.png"]){
  const png=PNG.sync.read(readFileSync(join(dir,f)));const {width:W,height:H,data}=png;
  console.log("== "+f+" ==");
  for(const pct of [0.1,0.25,0.4,0.55,0.7,0.85]){
    const y=Math.floor(pct*H),x=Math.floor(W/2),i=(y*W+x)*4;
    console.log(`  y=${(pct*100).toFixed(0)}% center RGB=(${data[i]},${data[i+1]},${data[i+2]})`);
  }
}
