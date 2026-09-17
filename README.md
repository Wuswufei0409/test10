# VoxelCraft Web — W1 世界/渲染核心模块

多 Agent 目标「网页端 Minecraft Bedrock 1.4.2 高还原度复刻」的 **W1 世界/渲染核心**
模块（对应完成标准 02 + 03）。在目标仓库 `test10` 中实现。

本模块提供可游玩的**第一人称 3D 体素沙盒渲染底座**：

- 第一人称方块世界渲染（Three.js）：原始像素纹理、天空、雾、十字准星、
  手部物品、仿真 Bedrock HUD（快捷栏/信息面板），窗口缩放后布局可用。
- **可复现 seed 世界生成**：确定性 PRNG + 分形值噪声，同 seed 地形完全一致。
- **分块（chunk）加载/卸载**与跨区块可见面剔除（被隐藏面不渲染）。
- **群系**：平原 / 森林 / 沙漠 / 山地 / 雪原，以及 **冷/暖 × 深/浅海洋**。

> 画面与音效素材均为**程序化原创生成**（canvas 逐像素绘制），未复制任何
> Minecraft 或商业素材包。默认 seed 固定，任意用户打开同一构建得到相同地形。

## 快速开始

```bash
npm install
npm run dev        # 本地开发（Vite，默认 http://localhost:5173）
npm run build      # 生产构建到 dist/
npm run preview    # 预览构建产物
```

固定 seed 可通过 URL 覆盖：`/?seed=MY_SEED`（默认 `BEDROCK_1_4_2_W1`）。

## 操作

点击画面锁定鼠标；`WASD` 移动、`空格` 跳跃、鼠标视角。HUD 显示
Seed / FPS / 玩家坐标，底部为快捷栏，右下角为手部方块。

## 自动化测试 / CI

```bash
npm test         # 单元测试：确定性、群系/海洋深度/气候、分块网格
npm run smoke    # 固定 seed 冒烟：群系覆盖 + 深度 + 气候 + 可复现性
npm run health   # 部署健康检查：构建产物 / 与 JS 资源返回 200
```

`npm run build` 成功为无阻断级构建保证；`npm test` 覆盖核心逻辑与网格生成；
`npm run smoke` 用固定 seed 验证关键地形一致性与群系/海洋深度/气候齐全；
`npm run health` 校验部署产物可正常访问（刷新不白屏的静态基础）。

CI（`.github/workflows/ci.yml`）：构建 → 单元测试 → 固定 seed 冒烟 → 部署健康检查。

## 目录结构

```
src/
  config.js            # 全局可调参数（seed/海平面/群系阈值/渲染距离…）
  main.js              # 启动入口 + 渲染循环
  world/
    noise.js           # 确定性 PRNG（mulberry32, FNV-1a）+ 分形值噪声
    worldgen.js        # 群系、海深/气候、地表高度、整列方块生成
    World.js           # 分块缓存 + 跨区块列访问
    mesher.js          # 可见面剔除网格生成（不透明 + 半透明水体）
  render/
    engine.js          # Three.js 场景/天空/雾/光照/相机/分块挂载
    player.js          # 第一人称相机/移动/重力/碰撞
    textures.js        # 程序化原始像素纹理图集
    hud.js             # 十字准星/快捷栏/信息/操作提示
scripts/
  smoke.mjs            # 固定 seed 冒烟
  health.mjs           # 部署健康检查
test/                  # vitest 单元测试（worldgen + mesher）
```

## 验收对照（本模块范围：标准 02 + 03）

| 完成标准 | 实现 |
| --- | --- |
| 02 第一人称 3D 体素画面 + HUD | Three.js 方块世界、天空、雾、十字准星、手部方块、Bedrock 风格 HUD，响应式布局 |
| 03 可复现 seed 世界 / 分块 / 群系 / 海洋 | 确定性生成，平原/森林/沙漠/山地/雪原 + 冷/暖×深/浅海洋，分块加载卸载 |

已知限制：单层 UI、未实现破坏/放置/合成/生物（见后续 W 模块）；光照为
简化三光源；分块未做 gpu 实例化（当前面剔除 + 共享材质已足够实时）。

## 许可

MIT，见 `LICENSE`。所有纹理/代码为原创或许可兼容。
