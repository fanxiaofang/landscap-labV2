# Live With Me · Landscape V2

React + TypeScript + Vite + Three.js 景观实验，当前版本 V0.3，在原仓库持续迭代。

**本轮先审阅纯地形，再用 Proxy 检查生活区布局，最后切换正式 SVG 对照。** 左侧农田从独立高坡肩改到草甸侧面的缓坡浅洼，中央保留开阔、稳定的高地生活区。正式 SVG 按需加载，原始资产坐标不参与地形设计。当前无云海，也未增加装饰、四季或天气系统。具体变化和验收边界见 [REVIEW.md](REVIEW.md)。

## 启动与审阅

Node.js 22.12+，建议使用 Node.js 24。普通启动不依赖正式 Live With Me 仓库。

~~~powershell
cd live-with-me-landscape-v2
npm ci
npm run dev
~~~

打开 http://127.0.0.1:4180/ 。若 npm 缓存目录不可写，可使用 npm ci --cache .npm-cache。

按以下顺序检查同一地形与同一相机：

1. **纯地形**：默认模式，或 ?view=terrain。检查草甸、三块田、谷底与山群，不加载正式 SVG 文件。
2. **Proxy 占位**：?view=proxy。以通用体块和占地轮廓查看主屋、拖拉机、桥与火车及辅助设施；落点与体量来自独立布局数据。
3. **SVG 对照**：?view=composite。按需加载 10 组原始正式资产，适配同一套布局；主屋保持原体量。

预览还提供 V0.2 纯地形、V0.1 构图和项目参考对照，投影校准、线框及当前模式的 1200×800 PNG 导出。所有预览采用固定 3:2 画框，resize 只缩放画框，不改变构图。

~~~powershell
npm run check:geometry
npm run build
npm run preview
~~~

dev 和 preview 使用相同端口，不要同时启动。V0.3 几何检查已通过 17 项断言，包含主田最终投影低于主屋参考点、完整入画、两块左田之间的可见草地间隔。浏览器检查 11 组通过，生产构建通过；构建仍提示既有 Three.js 主包大于 500 KB。工程结果不代表美术验收通过。

## 交付文件

| 内容 | 文件 |
| --- | --- |
| V0.3 无正式资产、无云海纯地形 | evidence/v03/01-terrain.png |
| V0.3 Proxy 占位布局 | evidence/v03/02-proxy.png |
| V0.3 正式 SVG 对照 | evidence/v03/03-svg-comparison.png |
| V0.3 桌面预览 | evidence/v03/04-desktop-review.png |
| V0.3 / V0.2 对照 | evidence/v03/05-before-after.png |
| V0.3 窄屏预览 | evidence/v03/06-mobile-review.png |
| V0.2 验收记录 | evidence/v02/REVIEW.md |
| V0.2 纯地形基线 | evidence/09-terrain-baseline-no-svg.png |
| V0.1 截图和检查基线 | evidence/v01/ |
| 正式项目实际 SVG 场景截图 | public/reference/live-overview.png |
| 资产来源、变换和时间 | public/reference/provenance.json |
| V0.3 高程 / 坡度 / 网格 / 投影视觉关系 | evidence/v03/geometry-report.json |
| V0.3 步行路径 501 点 | evidence/v03/walk-route.csv |
| 浏览器和导出检查 | evidence/browser-report.json |
| 正式资产原始变换核对 | evidence/asset-alignment.json |
| V0.3 资产布局与源几何保留核对 | evidence/v03/asset-placement.json |
| 正式仓库保护检查 | evidence/source-unchanged.json |

检查报告应核对其中的版本与执行结果；历史报告不代表 V0.3 已通过相同检查。结构说明见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 重现浏览器检查

开发服务器运行时执行：

~~~powershell
npx playwright install chromium
npm run test:visual
~~~

若机器已有 Playwright 1.56.1 对应 Chromium，可跳过安装。检查使用无头 Chromium 的 SwiftShader 软件 WebGL，覆盖实际渲染、模式切换、控制台、视口变化、PNG 导出和资产适配。它不是 GPU 性能基准，也不判定美术通过。生产预览也可以运行同一检查，PREVIEW_URL 可覆盖目标地址。

## 正式参考的来源

秋季源图是上一级 references/01_autumn_approved.png.png（原文件含双扩展名）；冬季图与用户提供的 Overview 同样保留，并复制到本项目以便独立运行。本轮另参考用户提供的四张山群图片，研究山脊、山肩、谷地尺度与空间纵深，不复制写实材质。

既有正式 Overview 来自 **正式工作树实际运行的 http://127.0.0.1:4178/**，使用实际源码及其当时未提交修改，不是旧 dist 或 Mock。截图选择黄昏主题，原 Overview 保持 (0,135,0.66)；V0.3 没有重新捕获正式源码。

public/reference/live-assets.svg 是从真实 DOM 隔离的静态 SVG 快照，共 10 个资产组，保留原始几何和祖先变换。V0.3 的 src/composition/placements.ts 独立定义通用生活区域；assets.ts 只负责源 SVG 接地点、缩放与外层变换。Proxy 不引用正式资产，正式 SVG 仅在切换对照或显式请求其导出时加载。预览与导出共用布局。它不导入旧景观代码，也不声称已迁移正式交互或完成逐脚点、深度遮挡适配。

如果需要重新抓取，先确认正式项目正在 4178 运行。若未运行，本实验提供只读源码宿主：

~~~powershell
node scripts/serve-reference.mjs
~~~

另一个终端执行：

~~~powershell
npm run capture:reference
node scripts/verify-source-unchanged.mjs
~~~

设置 LWM_SOURCE 为正式项目的本机源码目录后，可运行只读宿主。它依赖正式项目已安装的 Tailwind Vite 插件，将优化缓存写入本实验 .reference-cache。如果 4178 已占用，应使用现有服务，不要覆盖或终止用户的服务。

重新抓取会更新本实验内的参考快照及来源记录。截图抓取器使用全新的浏览器上下文，不读取用户浏览器个人状态；点击黄昏只改变该临时上下文。对正式仓库保持只读。

## 本轮停止点

V0.3 交付可审阅的地形与占位构图：主屋位于中央高地，三块不等田地与两侧草甸穿插，山群后退并形成主峰与次肩。农田视觉高低同时检查世界高程与最终正交投影。谷底大色块仍偏简化，正式 SVG 的逐脚点接地与完整遮挡仍待后续处理。云海、天气与装饰没有进入本轮范围，最终构图由作者审阅。
