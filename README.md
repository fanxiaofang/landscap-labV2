# Live With Me · Landscape V2

当前为 V0.4 构图审阅候选。**美术未验收，完成本轮出图后暂停。**

秋季定稿 `../references/01_autumn_approved.png.png` 是唯一主要构图和色彩基准，运行时使用字节一致的 `public/reference/autumn-approved.png`。V0.2/V0.3 仅留作历史记录。四张补充山群参考只用于形体与空间研究，不复制写实材质、岩石纹理或蓝灰色调。

## 启动与审阅

```powershell
npm ci
npm run dev
```

打开 http://127.0.0.1:4180/ 。默认显示无云海纯地形与秋季定稿图，均为 16:9 同尺度画框。参考图完整等比适配，不裁切、不拉伸。

- `/?view=terrain&clouds=0`：纯地形，检查完整谷地和山脚。
- `/?view=terrain&clouds=1`：静态云海构图，检查留白与露峰。
- `/?view=proxy&clouds=1`：同一构图叠加通用生活区 Proxy。
- `/?frame=integration&view=proxy`：1200×800 SVG 叠层兼容性画幅，只使用 Proxy。

对照支持并排、透明叠图、左右擦拭，以及定稿图的归一化轮廓和四分位线。轮廓为人工近似标注，不能替代视觉审阅。窗口缩放只改变显示尺寸，不改变相机。PNG 导出不包含参考图或构图标注；勾选投影校准时会包含校准层。

## 本轮交付

| 文件 | 内容 |
| --- | --- |
| `evidence/v04/01-terrain-16x9.png` | 1600×900 纯地形，无云海、无 Proxy |
| `evidence/v04/02-static-clouds-16x9.png` | 1600×900 静态云海构图 |
| `evidence/v04/03-proxy-clouds-16x9.png` | 1600×900 Proxy 尺度检查 |
| `evidence/v04/04-autumn-same-scale-comparison.png` | 同尺度对照，两行分别比较无云海和静态云海；每格 1600×900 |
| `evidence/v04/05-aligned-contours.png` | 定稿轮廓在两侧同尺度叠加 |
| `evidence/v04/06-overlay.png` / `06-wipe.png` | 透明叠图 / 擦拭对照 |
| `evidence/v04/09-integration-1200x800.png` | 1200×800 兼容性检查 |
| `evidence/v04/REVIEW.md` | 仍存在的视觉差距与四张结构参考的落实情况 |
| `evidence/v04/geometry-report.json` | 几何、坡度、两种画幅的真实矩阵检查 |
| `evidence/v04/composition-observations.json` | 定稿人工轮廓和当前前景占比的观察记录 |
| `evidence/v04/browser-report.json` | 浏览器、导出、响应式与参考来源检查 |

## 验证

```powershell
npm run check:geometry
npm run build
npm run test:visual
```

浏览器检查需要 4180 服务运行，并使用 Playwright Chromium / SwiftShader。`PREVIEW_URL` 可覆盖目标。`node scripts/preview-shot.mjs` 只刷新三张独立预览，不生成完整审阅证据。

工程验证与美术验收分别记录。几何报告保留网格合法性、坡度、贴地、相机投影检查；旧版“主田必须在主屋屏幕下方”和“田块必须完整入画”等布局选择已退出验收条件，理由记录在报告中。前景占比接近定稿不能说明山群、云层或整体视觉已达标。

本轮不接入正式 SVG；历史资产快照与适配代码仍保留，当前预览及导出不读取它们。1200×800 只验证画幅、地面轴与生成 SVG 叠层契约，不声称完成正式资产接地或遮挡适配。没有粒子、复杂 Shader、动画或季节系统。

具体实现见 [ARCHITECTURE.md](ARCHITECTURE.md)，美术状态见 [REVIEW.md](REVIEW.md)。
