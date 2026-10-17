# Live With Me · Landscape V2

React + TypeScript + Vite + Three.js 景观实验，当前版本 V0.2，在原仓库持续迭代。

**本轮交付重新组织空间关系的无云海构图。主屋保留原体量，10 组真实 SVG 资产按地形重新定位。** 工程检查与人工视觉验收分开；本轮没有进入云海、冬季或复杂光照阶段。具体变化、旧版对照与剩余问题见 [REVIEW.md](REVIEW.md)。

## 启动

Node.js 22.12+，建议使用 Node.js 24。普通启动不依赖正式 Live With Me 仓库。

```powershell
cd live-with-me-landscape-v2
npm ci
npm run dev
```

打开 http://127.0.0.1:4180/ 。若 npm 缓存目录不可写，可使用 `npm ci --cache .npm-cache`。

```powershell
npm run check:geometry
npm run build
npm run preview
```

`dev` 和 `preview` 使用相同端口，不要同时启动。预览提供无云海地形、真实资产合成、三类参考对照、投影校准、线框和 1200×800 PNG 导出。所有预览采用固定 3:2 画框，resize 只缩放画框，不改变构图。

## 交付文件

| 内容 | 文件 |
| --- | --- |
| 1200×800 无云海地形 | `evidence/01-terrain-no-clouds.png` |
| 1200×800 真实 SVG 资产合成 | `evidence/02-real-assets-composite.png` |
| 实际点击按钮得到的 PNG | `evidence/03-button-export.png` |
| 投影校准视图 | `evidence/04-projection-calibration.png` |
| 桌面预览 | `evidence/05-desktop-review.png` |
| 秋季定稿图对照 | `evidence/06-autumn-comparison.png` |
| 390px 窄屏预览 | `evidence/07-mobile-review.png` |
| V0.2 / V0.1 同屏对照 | `evidence/08-before-after-review.png` |
| 迭代前截图和检查基线 | `evidence/v01/` |
| 真实项目场景截图（隔离实际 SVG） | `public/reference/live-overview.png` |
| 资产来源、变换和时间 | `public/reference/provenance.json` |
| 高程 / 坡度 / 法线 / 边界 / 投影 | `evidence/geometry-report.json` |
| 步行路径 501 点 | `evidence/walk-route.csv` |
| 浏览器和导出检查 | `evidence/browser-report.json` |
| 真实资产变换核对 | `evidence/asset-alignment.json` |
| 新布局坐标、缩放、原始几何保留核对 | `evidence/asset-placement.json` |
| 正式仓库保护检查 | `evidence/source-unchanged.json` |

简短结构说明见 [ARCHITECTURE.md](ARCHITECTURE.md)，本轮差距和验收边界见 [REVIEW.md](REVIEW.md)。

## 重现浏览器检查

开发服务器运行时执行：

```powershell
npx playwright install chromium
npm run test:visual
```

若机器已有 Playwright 1.56.1 对应 Chromium，可跳过安装。检查使用无头 Chromium 的 SwiftShader 软件 WebGL：验证实际渲染、控制台、视口变化、PNG 尺寸、按钮下载和 SVG 变换。它不是 GPU 性能基准，也不判定美术通过。

生产预览也可以运行同一检查。`PREVIEW_URL` 可覆盖目标地址。

## 真实参考的来源

秋季源图是上一级 `references/01_autumn_approved.png.png`（原文件含双扩展名）；冬季图与用户提供的 Overview 同样保留，并复制到本项目以便独立运行。

本轮还从 **正式工作树实际运行的 http://127.0.0.1:4178/** 获取了真实 Overview。使用实际源码，包括原有未提交修改；不是旧 dist，不是 Mock。截图选择黄昏主题，原 Overview 保持 `(0,135,0.66)`。

原始对照是从真实 DOM 隔离的静态 SVG 快照，共 10 个资产组。`public/reference/live-assets.svg` 保留原始几何和祖先变换；V0.2 在外层按 `src/composition/assets.ts` 的地形落点移动和等比缩放各组。预览与导出共用同一套布局。它不导入旧景观代码，不把资产变成 Three.js Sprite / 纹理 Mesh，不声称已迁移交互或完成正式集成。

如果需要重新抓取，先确认正式项目正在 4178 运行。若未运行，本实验提供只读源码宿主：

```powershell
node scripts/serve-reference.mjs
```

另一个终端执行：

```powershell
npm run capture:reference
node scripts/verify-source-unchanged.mjs
```

设置 `LWM_SOURCE` 为正式项目的本机源码目录后，可运行只读宿主。它依赖正式项目已安装的 Tailwind Vite 插件，将优化缓存写入本实验 `.reference-cache`。如果 4178 已占用，应使用现有服务，不要覆盖或终止用户的服务。

重新抓取会更新本实验内的参考快照及来源记录。截图抓取器使用全新的浏览器上下文，不读取用户浏览器个人状态；点击黄昏只改变该临时上下文。

## 本轮停止点

V0.2 保持原正交地面轴，已放宽资产坐标约束并重排坡肩、田块、谷地与山群。可以在“参考对照”选择“V0.1 旧构图”审阅变化。后续美术迭代重点是山体轮廓、谷底层次和资产逐脚点接地；云海、天气和正式交互集成仍未启动。
