import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const dir = "screenshots/w1-BEDROCK_1_4_2_W1";
const f = process.argv[2] || "desktop_c.png";
const png = PNG.sync.read(readFileSync(join(dir,f)));
const {width:W,height:H,data} = png;
const CW=48, CH=22;
const isSky=(r,g,b)=> b>140 && b>=r && g>=r && (b-r)>20;
const isWater=(r,g,b)=> b>=g && b>=r && g>60 && b>120;
const dark=(r,g,b)=> r<80 && g<80 && b<80;
let out="";
for(let cy=0;cy<CH;cy++){
  let row="";
  for(let cx=0;cx<CW;cx++){
    // sample the block's center pixel
    const x=Math.floor((cx+0.5)*W/CW), y=Math.floor((cy+0.5)*H/CH);
    const i=(y*W+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    row += isSky(r,g,b)?'S':(isWater(r,g,b)?'~':(dark(r,g,b)?'#':' '));
  }
  out+=row+"\n";
}
console.log("UPPER = top of frame (sky), LOWER = bottom (ground)\n");
console.log(out);
