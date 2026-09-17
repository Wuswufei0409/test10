import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const dir = "screenshots/w1-BEDROCK_1_4_2_W1";
for (const f of ["desktop_a.png","desktop_c.png"]){
  const png=PNG.sync.read(readFileSync(join(dir,f)));
  const {width:W,height:H,data}=png;
  console.log("== "+f+" ==");
  for (const pct of [0.08,0.2,0.35,0.5,0.62,0.75,0.9]){
    const y=Math.floor(pct*H);
    // sample a horizontal line, print min/avg/max of luminance and a few colors
    let avgR=0,avgG=0,avgB=0,n=0,darkN=0,brightN=0;
    for(let x=0;x<W;x+=8){const i=(y*W+x)*4,r=data[i],g=data[i+1],b=data[i+2];avgR+=r;avgG+=g;avgB+=b;n++;if(r<80&&g<80&&b<80)darkN++;if(r>140&&g>120&&b>120)brightN++;}
    avgR/=n;avgG/=n;avgB/=n;
    const i=(Math.floor(y)*W+Math.floor(W/2))*4;
    console.log(`y=${(pct*100).toFixed(0)}% avgRGB=(${avgR.toFixed(0)},${avgG.toFixed(0)},${avgB.toFixed(0)}) center=(${data[i]},${data[i+1]},${data[i+2]}) dark=${darkN} bright=${brightN}`);
  }
}
