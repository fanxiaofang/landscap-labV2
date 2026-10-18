# Live With Me · Landscape V2

当前实验为 **Phase B1：Three.js 中远景 + Live With Me 原始 SVG 前景**，等待人工美术验收。V0.8 保留为可回退基线，不继续扩展整幅 Heightfield。

运行 `npm run dev` 后打开 [B1 实验](http://127.0.0.1:4180/?mode=b1)。3D Only 默认不加载 SVG；合成按钮加载原始草甸、主屋、羊群及设施。自由斜视／顶视／侧视检查真实曲面，中性材质和反向侧光检查体积来源。目标相机可拖动平移、滚轮缩放、复位；可独立关闭远山视差。

- [B1 3D Only](http://127.0.0.1:4180/?mode=b1)
- [B1 Free Inspection](http://127.0.0.1:4180/?mode=b1&camera=oblique)
- [B1 SVG Composite](http://127.0.0.1:4180/?mode=b1&svg=1)
- [B1 1200×800 兼容画幅](http://127.0.0.1:4180/?mode=b1&svg=1&frame=integration)
- [V0.8 回退](http://127.0.0.1:4180/?mode=v08)

```powershell
npm run check:b1
npm run build
npm run test:b1
```

B1 的四张截图、额外相机检查和架构短评见 [evidence/b1/REVIEW.md](evidence/b1/REVIEW.md)。完整结构见 [ARCHITECTURE.md](ARCHITECTURE.md)。不自动进入后续美术或特效阶段。

---

以下为 V0.8 的原始使用说明。

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
