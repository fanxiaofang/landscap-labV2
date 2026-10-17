import { useEffect, useRef, useState } from 'react';
import { LandscapeRenderer } from './world/renderer';
import { Calibration } from './composition/Calibration';
import { downloadUrl, exportFrame } from './composition/export';
import { measureProjection } from './world/projection';
import { assetLayout, loadAssetComposition } from './composition/assets';
import { Proxy, proxySvg } from './composition/Proxy';
import { sceneLayout, type CompositionView } from './composition/placements';
import './style.css';

declare global {interface Window { landscape?: {export:(view?:CompositionView|boolean)=>Promise<string>;stats:()=>unknown;ready:boolean;assets:typeof assetLayout;placements:typeof sceneLayout;assetSvg:()=>Promise<string>;proxySvg:typeof proxySvg;view:()=>CompositionView;setView:(view:CompositionView)=>void} }}
type Reference='autumn-approved.png'|'live-overview.png'|'winter-counterpart.png'|'previous-composition.png'|'v02-terrain.png';
const VIEW_LABELS:Record<CompositionView,string>={terrain:'纯地形',proxy:'Proxy 占位',composite:'SVG 对照'};
const VIEW_CAPTIONS:Record<CompositionView,string>={terrain:'独立地形 · 无资产',proxy:'通用体块与占地范围 · 随地形布局',composite:'正式 SVG 对照 · 共用地形布局'};
const VIEW_NOTES:Record<CompositionView,string>={terrain:'先观察草甸、农田与谷地的连续关系，再切换 Proxy 检查生活区尺度。',proxy:'体块仅表示占地、体量与叙事位置。正式 SVG 可单独切换对照。',composite:'正式 SVG 适配当前布局；地形与占位布局独立于原始资产坐标。'};

export default function App() {
  const params=new URLSearchParams(location.search);
  const capture=params.get('capture')==='1';
  const initial=params.get('view');
  const [view,setView]=useState<CompositionView>(initial==='proxy'||initial==='composite'?initial:'terrain');
  const viewRef=useRef(view);viewRef.current=view;
  const [compare,setCompare]=useState(false);
  const [calibrate,setCalibrate]=useState(false),[wire,setWire]=useState(false);
  const [reference,setReference]=useState<Reference>('v02-terrain.png');
  const [ready,setReady]=useState(false),[assetReady,setAssetReady]=useState(false),[error,setError]=useState('');
  const [exporting,setExporting]=useState(false),[status,setStatus]=useState('');
  const [assetUrl,setAssetUrl]=useState('');
  const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<LandscapeRenderer|null>(null);
  const [report,setReport]=useState<any>(null);
  const projection=measureProjection();
  useEffect(()=>{
    try{
      const e=new LandscapeRenderer(canvas.current!);engine.current=e;setReady(true);
      window.landscape={ready:true,export:(mode=viewRef.current)=>exportFrame(e,mode),stats:()=>e.stats,assets:assetLayout,placements:sceneLayout,assetSvg:async()=>(await loadAssetComposition()).svg,proxySvg,view:()=>viewRef.current,setView};
      return ()=>{delete window.landscape;engine.current=null;e.dispose();};
    }catch(err){setError(`Three.js 初始化失败：${String(err)}`);}
  },[]);
  useEffect(()=>{
    const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState(null,'',url);
    if(view!=='composite')return;
    let active=true;
    loadAssetComposition().then(({url})=>{if(active)setAssetUrl(url);}).catch(err=>{if(active)setError(String(err));});
    return ()=>{active=false;};
  },[view]);
  useEffect(()=>{engine.current?.setWireframe(wire);},[wire]);
  useEffect(()=>{fetch('/geometry-report.json').then(r=>{if(!r.ok)throw new Error('暂无检查报告');return r.json();}).then(setReport).catch(()=>setReport(null));},[]);
  async function save() {
    if(!engine.current)return;
    setExporting(true);setStatus('');
    try{
      const src=await exportFrame(engine.current,view,calibrate?document.querySelector<SVGSVGElement>('svg.calibration'):null);
      downloadUrl(src,`landscape-v03-${view}${calibrate?'-calibrated':''}.png`);
      setStatus('已导出 1200 × 800 PNG');
    }catch(e){setError(String(e));}finally{setExporting(false);}
  }
  const showAssets=view==='composite';
  return <main className={capture?'app capture':'app'}>
    {!capture&&<>
      <header className="app-header"><a className="wordmark" href="/">Live With Me <span>/</span> <strong>Landscape</strong></a><span className="version">V0.3 · 地形与占位布局</span><span className="review-state">构图待审阅</span></header>
      <div className="workspace-heading"><div><h1>高处的家园，低处的群山</h1><p>高地草甸 / 缓坡农田 / 开阔谷地 · 无云海</p></div><button className="primary" onClick={save} disabled={!ready||exporting||(showAssets&&!assetReady)}>{exporting?'正在导出…':'导出截图'}<span aria-hidden="true">↗</span></button></div>
      <div className="toolbar"><div className="view-switch" role="group" aria-label="预览模式">{(['terrain','proxy','composite'] as CompositionView[]).map(mode=><button key={mode} aria-pressed={view===mode} onClick={()=>{setView(mode);setStatus('');}}>{VIEW_LABELS[mode]}</button>)}</div><div className="debug-controls"><label><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>参考对照</label><label><input type="checkbox" checked={calibrate} onChange={e=>setCalibrate(e.target.checked)}/>投影校准</label><label><input type="checkbox" checked={wire} onChange={e=>setWire(e.target.checked)}/>线框</label></div></div>
    </>}
    {error&&<p className="error" role="alert">{error}</p>}
    <div className={`preview-layout ${compare?'comparing':''}`}>
      <section className="viewport-panel" aria-label="Three.js 秋季地形预览">
        {compare&&!capture&&<div className="comparison-heading">当前 V0.3 · {VIEW_LABELS[view]}</div>}
        <div className="viewport" data-testid="viewport" data-view={view}>
          <canvas ref={canvas} width="1200" height="800" aria-label="无云海三维地形"/>
          {view==='proxy'&&<Proxy/>}
          {showAssets&&assetUrl&&<img className="asset-overlay visible" src={assetUrl} alt="正式 Live With Me SVG 对照，按通用生活区与农田布局定位" onLoad={()=>setAssetReady(true)} onError={()=>setError('场景资产载入失败，请刷新重试。')}/>}
          {calibrate&&<Calibration/>}
          {!ready&&!error&&<div className="loading">正在建立地形…</div>}
          {ready&&showAssets&&!assetReady&&!error&&<div className="overlay-status" role="status">正在载入 SVG 对照…</div>}
        </div>
        {!capture&&<div className="viewport-caption"><span><i/>{VIEW_CAPTIONS[view]}</span><span>秋季 / 无云海 / 固定正交</span></div>}
      </section>
      {compare&&!capture&&<aside className="reference-panel"><div className="reference-heading"><label htmlFor="reference">对照基准</label><select id="reference" value={reference} onChange={e=>setReference(e.target.value as Reference)}><option value="v02-terrain.png">V0.2 纯地形</option><option value="autumn-approved.png">秋季定稿图</option><option value="previous-composition.png">V0.1 旧构图</option><option value="live-overview.png">真实 Overview 截图</option><option value="winter-counterpart.png">冬季参考图</option></select></div><div className="reference-image"><img src={'/reference/'+reference} alt={reference==='v02-terrain.png'?'调整前的 V0.2 纯地形':reference==='previous-composition.png'?'调整前的 V0.1 无云海构图':reference==='autumn-approved.png'?'秋季正式目标图':reference==='live-overview.png'?'真实正式项目 Overview':'冬季季节参考，不改变地形'}/></div><p>{reference==='v02-terrain.png'?'同一正交画幅，比较农田与主屋草甸的视觉高低、草甸起伏和山谷留白。':reference==='previous-composition.png'?'同一画幅的旧版，比较草甸边缘、田块走向与山群间距。':reference==='live-overview.png'?'正式源码运行后的静态参考，黄昏主题，1200 × 800。':'完整保留参考图比例；上下留白用于比较，不裁切、不拉伸。'}</p></aside>}
    </div>
    {!capture&&<>
      <div className="status-line" role="status"><span>{status||VIEW_NOTES[view]}</span><a href="/reference/provenance.json" target="_blank" rel="noreferrer">查看来源记录 ↗</a></div>
      <details className="checks"><summary><span>空间与投影检查</span><span>{report?.passed?'几何检查通过':'检查报告待生成'} · 构图待审阅</span></summary><div className="checks-body"><dl><div><dt>主屋草甸</dt><dd>+200.0 <small>研究单位</small></dd></div><div><dt>最高观景山脊</dt><dd>{report?.highestViewingRidge?.toFixed(1)??'—'} <small>低于草甸</small></dd></div><div><dt>下行路径最大坡度</dt><dd>{report?.route?.maxSlopeDegrees?.toFixed(2)??'—'}°</dd></div><div><dt>地面轴 / 相机仰角</dt><dd>±15.806° / {projection.elevationDegrees.toFixed(3)}°</dd></div></dl><p>当前无云海；主屋平台稳定，外围草甸允许温和起伏。场景单位不是米。</p><a href="/geometry-report.json" target="_blank" rel="noreferrer">查看完整采样结果 ↗</a></div></details>
      <footer><span>Landscape V2 · 当前仓库持续迭代</span><span>先验证空间，再增加环境细节。</span></footer>
    </>}
  </main>;
}
