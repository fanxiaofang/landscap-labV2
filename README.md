# Live With Me · Landscape V2

当前为 **V0.7 Terrain Foundation**，基于 V0.6 持续迭代。四张 1600×900 候选图见下方，**等待人工美术验收，不进入下一阶段**。

长期规范见 [AGENTS.md](AGENTS.md)，实现与未来边界见 [ARCHITECTURE.md](ARCHITECTURE.md)，参考用途见 [美术参考清单](docs/art-direction/mountain-and-cloud-references.md)。

## 查看

```powershell
npm ci
npm run dev
```

打开 http://127.0.0.1:4180/ 。默认纯地形与秋季定稿对照，保留静态云海、并排、叠图、擦拭和 PNG 导出。顶部“检查视角”可选目标正交、自由斜视、俯视结构、侧向坡度；自由视角拖动旋转、右键平移、滚轮缩放，返回目标正交恢复原构图与着色。

- `/?clouds=0`：目标正交无云地形。
- `/?clouds=1`：冻结的静态云海占位。
- `/?camera=oblique`、`/?camera=top`、`/?camera=side`：自由检查预设，中性材质便于辨认坡面。
- `/?study=layout&view=proxy&frame=integration`：1200×800 SVG 兼容性画幅，只使用 Proxy，正式 SVG 未接入。

## 本轮交付

| 文件 | 内容 |
| --- | --- |
| [01-terrain-target.png](evidence/v07/01-terrain-target.png) | 1600×900 目标正交无云完整地形 |
| [02-free-inspection.png](evidence/v07/02-free-inspection.png) | 1600×900 自由视角地形结构 |
| [03-static-cloud-placeholder.png](evidence/v07/03-static-cloud-placeholder.png) | 1600×900 现有静态云海占位 |
| [04-v06-v07-autumn-comparison.png](evidence/v07/04-v06-v07-autumn-comparison.png) | 1600×900 三方对照，上排无云、下排静态云 |
| [REVIEW.md](evidence/v07/REVIEW.md) | 地貌改动、实际截图差距与停止点 |
| [geometry-report.json](evidence/v07/geometry-report.json) | 连续网格、孔洞、坡面采样与投影检查 |
| [browser-report.json](evidence/v07/browser-report.json) | 自由视角交互、导出、恢复、天空及兼容性检查 |

`evidence/v07/baseline/` 保存修改前 V0.6 实际截图和源文件哈希；`checks/` 保存俯视、侧视、1200×800 Proxy 与浏览器辅助证据。V0.6 及更早图像保持不变。

## 重现检查与出图

```powershell
npm run check:geometry
npm run build
npm run test:visual
```

视觉检查需要本地 4180 服务和 Playwright Chromium / SwiftShader，`PREVIEW_URL` 可覆盖地址。`npm run capture:benchmark` 与完整视觉检查相同，重建四张交付图及辅助证据，不覆盖 V0.6 基线。

工程通过不能替代美术验收。当前云、设施接地和正式资产集成的局限见本轮审阅说明。
