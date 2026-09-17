// HUD overlay: crosshair, Bedrock-like hotbar, hand block, seed + FPS readouts.
// Pure DOM/CSS so it stays layout-usable across window resizes (C02).

const HOTBAR_BLOCKS = ["grass", "dirt", "stone", "sand", "log", "leaves", "plank", "sandstone", "cactus"];

export class HUD {
  constructor(root, seed) {
    this.root = root;
    const style = document.createElement("style");
    style.textContent = `
      #hub-root{position:fixed;inset:0;pointer-events:none;z-index:10;font-family:'Segoe UI',system-ui,sans-serif;
        color:#fff;text-shadow:1px 1px 2px rgba(0,0,0,.6);user-select:none;}
      #hub-crosshair{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:22px;height:22px;}
      #hub-crosshair::before,#hub-crosshair::after{content:'';position:absolute;background:#fff;box-shadow:0 0 2px #000;}
      #hub-crosshair::before{left:10px;top:2px;width:2px;height:18px;}
      #hub-crosshair::after{left:2px;top:10px;width:18px;height:2px;}
      #hub-hotbar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:4px;
        background:rgba(0,0,0,.45);padding:5px;border-radius:6px;border:1px solid rgba(255,255,255,.2);}
      .hub-cell{width:46px;height:46px;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.25);
        border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:10px;}
      .hub-cell.selected{border-color:#fff;background:rgba(255,255,255,.25);}
      .hub-tile{width:100%;height:100%;image-rendering:pixelated;background-size:100% 100%;}
      #hub-hand{position:absolute;right:24px;bottom:12px;width:110px;height:110px;
        background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.2);border-radius:6px;
        display:flex;align-items:center;justify-content:center;}
      #hub-info{position:absolute;top:12px;left:12px;font-size:13px;line-height:1.5;
        background:rgba(0,0,0,.4);padding:8px 12px;border-radius:6px;pointer-events:auto;}
      #hub-controls{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;
        background:rgba(0,0,0,.6);padding:20px 28px;border-radius:8px;pointer-events:none;max-width:90vw;}
      #hub-controls.hidden{display:none;}
      @media (max-width:600px){.hub-cell{width:34px;height:34px;}#hub-hand{width:70px;height:70px;}}
    `;
    document.head.appendChild(style);

    const rootEl = document.createElement("div");
    rootEl.id = "hub-root";
    rootEl.innerHTML = `
      <div id="hub-crosshair"></div>
      <div id="hub-hotbar"></div>
      <div id="hub-hand"></div>
      <div id="hub-info">Seed: <b>${seed}</b><br>FPS: <span id="hub-fps">--</span><br>XYZ: <span id="hub-xyz">--</span></div>
      <div id="hub-controls">点击锁定鼠标 · WASD 移动 · 空格 跳跃<br>单击世界以开始</div>`;
    document.body.appendChild(rootEl);

    this.hotbar = document.getElementById("hub-hotbar");
    this.cells = [];
    HOTBAR_BLOCKS.forEach((b, i) => {
      const cell = document.createElement("div");
      cell.className = "hub-cell" + (i === 0 ? " selected" : "");
      cell.innerHTML = `<div class="hub-tile" data-block="${b}"></div>`;
      this.hotbar.appendChild(cell);
      this.cells.push(cell);
    });
    this.controls = document.getElementById("hub-controls");
    this.fpsEl = document.getElementById("hub-fps");
    this.xyzEl = document.getElementById("hub-xyz");
  }

  setTileStyle(blockName, cssUrl) {
    this.cells.forEach((c) => {
      const t = c.querySelector(`[data-block="${blockName}"]`);
      if (t) t.style.backgroundImage = cssUrl;
    });
  }

  update(fps, pos) {
    this.fpsEl.textContent = fps.toFixed(0);
    this.xyzEl.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
  }

  hideControls() {
    this.controls.classList.add("hidden");
  }
}
