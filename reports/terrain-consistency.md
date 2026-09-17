# W1 固定 seed 地形一致性验收证据

- 默认 seed: `BEDROCK_1_4_2_W1`
- 地形指纹 (FNV-1a over sampled surface heights [-128..128] step 4): `10b4d9be`
- 覆盖群系 (8): OCEAN_SHALLOW, OCEAN_DEEP, BEACH, FOREST, PLAINS, SNOWY, MOUNTAINS, DESERT
- 覆盖气候 (3): temperate, cold, warm
- 含水列数: 216262（含深/浅海洋, 冷/暖）
- 地表高度范围: 1 .. 70（海平面 24, 世界高度 96）

证据引用: 运行 `npm run smoke`（固定 seed 群系/深度/气候/可复现）与
`npm test`（同 seed 关键地形逐点一致 + 分块网格一致）均通过；
同 seed 每次运行输出相同指纹 `10b4d9be`。

运行环境: Chromium 1208 headless + SwiftShader, 截图见 `screenshots/w1-BEDROCK_1_4_2_W1.png`。
