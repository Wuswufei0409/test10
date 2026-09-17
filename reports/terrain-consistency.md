# W1 固定 seed 地形一致性 + 渲染稳定性验收证据（含返工 V2）

- 默认 seed: `BEDROCK_1_4_2_W1`
- 地形指纹 (FNV-1a over sampled surface heights [-128..128] step 4): `10b4d9be`
- 覆盖群系 (8): OCEAN_SHALLOW, OCEAN_DEEP, BEACH, FOREST, PLAINS, SNOWY, MOUNTAINS, DESERT
- 覆盖气候 (3): temperate, cold, warm
- 含水列数: 216262（含深/浅海洋, 冷/暖）
- 地表高度范围: 1 .. 70（海平面 24, 世界高度 96）

## C02 第一人称 3D 体素渲染（返工后）
- **网格修复**: mesher 曾对 +X/-X 面以反向(内)绕序发射 → 正面剔除后出现翻转/空洞伪影；
  现 pushFace 对每个面按 4 顶点质心重排成外法向 CCW 逆时针顺序，六面绕序全部外向。
  新增回归测试 `test/mesher.test.js: "every triangle winds outward (matches its vertex normal)"` 通过（flipped=0）。
- **性能**: 默认渲染距离 3 + 像素比上限 1.5 + 关闭软件 MSAA + 每分块视锥剔除。
  headless Chromium 1208 + SwiftShader 实测稳定平均 FPS：
  - 1280×720 (desktop): **33.2**
  - 900×600 (small): **52.4**
  均 ≥ 30 目标；0 条阻断级控制台错误；多视角×两窗口截图见 `screenshots/w1-BEDROCK_1_4_2_W1/`（desktop_a/b/c, small_a/b/c）。
- 证据引用: `scripts/screenshot.mjs`（稳定平均 FPS + 多角度 + 双尺寸 + 控制台 + 加载分块数）。

## 复核清单逐项
1. 第一人称体素方块世界 + 天空/雾/十字准星/手部方块/Bedrock 风格 HUD（9 格快捷栏+Seed/FPS/坐标）：截图显示
2. 窗口缩放后布局可用：1280×720 与 900×600 两尺寸均正常
3. 刷新无白屏/无阻断级控制台错误：consoleErrors=0，build+health 200
4. 可复现 seed / 分块加载卸载 / 群系（平原/森林/沙漠/山地/雪原+冷/暖×深/浅海洋）：指纹稳定，smoke/test 通过
