# Live With Me · Landscape V2

当前为 **V0.5 中景山群 benchmark**。三张候选图已完成，**美术未验收，不进入整场景集成**。

五张山体参考统一用于主峰、次峰、鞍部、支脊、远近错位和尺度关系；秋季定稿继续作为构图与色彩基准。只提取山体结构，不复制写实纹理。

## 查看

```powershell
npm ci
npm run dev
```

打开 http://127.0.0.1:4180/ 。默认显示纯地形与秋季定稿，支持静态云海、等尺度并排、透明叠图、擦拭和 PNG 导出。五张形体参考在页面下方展开。

- `/?view=terrain&clouds=0`：无云海的真实山群、坡脚与谷地。
- `/?view=terrain&clouds=1`：同一相机与地形上的静态云团遮挡。

默认 benchmark 隐藏田块、道路、Proxy 与正式资产；不提供整场景集成入口。历史代码仍保留，但本轮不对其适配做验收。

## 本轮图像

| 文件 | 内容 |
| --- | --- |
| `evidence/v05/01-terrain-16x9.png` | 1600×900 纯地形 |
| `evidence/v05/02-static-clouds-16x9.png` | 1600×900 静态云海 |
| `evidence/v05/03-autumn-comparison.png` | 与秋季定稿并排对照，四格均为 1600×900 |
| `evidence/v05/REVIEW.md` | 五图形体映射、实际截图差距及停止点 |
| `evidence/v05/geometry-report.json` | 网格、谷地剖面、云面覆盖与投影检查 |
| `evidence/v05/browser-report.json` | 导出、切换、响应式与零正式资产请求检查 |

V0.4 及更早图片保留原样。当前仍需改善纯地形坡脚分离、支脊显露和前景下坡的视觉表达，不能将工程检查通过当作美术通过。

## 重现检查与出图

```powershell
npm run check:geometry
npm run build
npm run test:visual
```

视觉检查需要本地 4180 服务，使用 Playwright Chromium / SwiftShader。`PREVIEW_URL` 可覆盖地址。`npm run capture:benchmark` 仅刷新两张独立 PNG；完整视觉检查还生成并排图和审阅界面。

实现见 [ARCHITECTURE.md](ARCHITECTURE.md)，审阅结果见 [REVIEW.md](REVIEW.md)。
