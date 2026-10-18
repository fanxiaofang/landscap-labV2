# Live With Me · Landscape V2

当前为 **V0.8 田园丘陵河谷**。本轮将旧高山云海方向改为连续的宽缓草丘、河谷、左侧顺坡农田和低远山。状态为待作者美术审阅。

规范见 [AGENTS.md](AGENTS.md)，实现见 [ARCHITECTURE.md](ARCHITECTURE.md)，交付说明见 [evidence/v08/REVIEW.md](evidence/v08/REVIEW.md)。

```powershell
npm ci
npm run dev
```

打开 http://127.0.0.1:4180/ 。顶部依次为纯地形、河流轻雾、Proxy、正式 SVG 对照。检查视角支持斜视、俯视、侧视及鼠标旋转 / 平移 / 缩放，返回目标正交恢复构图。

- `/?view=terrain`：纯地形，含农田材质与无水河床。
- `/?view=river`：河流及局部轻薄雾。
- `/?view=proxy`：简单体块布局。
- `/?view=assets`：原始正式 SVG 适配后的叠加对照。
- `/?camera=oblique`、`top`、`side`：自由结构检查。
- `/?view=assets&frame=integration`：1200×800 兼容性检查。
- `clouds=0` 是兼容保留的参数名，当前含义为关闭轻雾。

```powershell
npm run check:geometry
npm run build
npm run test:visual
```

浏览器检查需要本地 4180 服务及 Playwright Chromium；可用 PREVIEW_URL 覆盖地址。截图写入 `evidence/v08/`，不覆盖旧版本。

| 文件 | 内容 |
| --- | --- |
| [01-terrain.png](evidence/v08/01-terrain.png) | 纯地形 |
| [02-river-light-mist.png](evidence/v08/02-river-light-mist.png) | 河流与轻雾 |
| [03-proxy.png](evidence/v08/03-proxy.png) | Proxy 布局 |
| [04-formal-svg.png](evidence/v08/04-formal-svg.png) | 正式 SVG 对照 |
| [05-free-inspection.png](evidence/v08/05-free-inspection.png) | 自由视角结构 |
| [06-comparison.png](evidence/v08/06-comparison.png) | V0.7、本轮与田园参考对照 |
| [geometry-report.json](evidence/v08/geometry-report.json) | 网格、坡度、农田延伸和落点检查 |
| [browser-report.json](evidence/v08/browser-report.json) | 浏览器和导出检查 |

薄雾是静态局部空气透视。SVG 为目标视角对照层，有限地表有开放外边界。工程通过不替代人工美术验收。
