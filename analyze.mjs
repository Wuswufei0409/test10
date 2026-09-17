import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const dir = "screenshots/w1-BEDROCK_1_4_2_W1";
const files = ["desktop_a.png","desktop_c.png","desktop_move0.png","desktop_move3.png","small_c.png"];
for (const f of files){
  const png = PNG.sync.read(readFileSync(join(dir,f)));
  const {width:W,height:H,data} = png;
  const isSky=(r,g,b)=> b>140 && b>=r && g>=r && (b-r)>20;
  const isWater=(r,g,b)=> b>=g && b>=r && g>60 && (b-r)>18 && b>120;
  // dark = possibly inverted/backlit faces
  const dark=(r,g,b)=> r<70 && g<70 && b<70;
  let sky=0,water=0,darkc=0,total=0;
  for(let y=0;y<H;y+=3) for(let x=0;x<W;x+=3){
    const i=(y*W+x)*4,r=data[i],g=data[i+1],b=data[i+2]; total++;
    if(isSky(r,g,b))sky++; else if(isWater(r,g,b))water++; else if(dark(r,g,b))darkc++;
  }
  console.log(`${f}: sky=${(sky/total*100).toFixed(1)}% water=${(water/total*100).toFixed(1)}% dark=${(darkc/total*100).toFixed(1)}% W=${W} H=${H}`);
}
