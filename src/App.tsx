import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LandscapeRenderer } from './world/renderer';
import { FRAME, INTEGRATION_FRAME } from './world/projection';
import { Calibration } from './composition/Calibration';
import { ContourGuides, REFERENCE_BANDS } from './composition/Contours';
import { downloadUrl, exportFrame } from './composition/export';
import { Proxy, proxySvg } from './composition/Proxy';
import { sceneLayout, type CompositionView } from './composition/placements';
import './style.css';

declare global {interface Window {landscape?:{export:(view?:CompositionView,clouds?:boolean)=>Promise<string>;stats:()=>unknown;ready:boolean;placements:typeof sceneLayout;proxySvg:typeof proxySvg;view:()=>CompositionView;setView:(view:CompositionView)=>void;setClouds:(enabled:boolean)=>void}}}
const params=new URLSearchParams(location.search);
const benchmark=params.get('study')!=='layout';
const integration=!benchmark&&params.get('frame')==='integration';
const frame=integration?INTEGRATION_FRAME:FRAME;
const labels:Record<CompositionView,string>={terrain:'纯地形',proxy:'Proxy 占位'};
export default function App() {
  const capture=params.get('capture')==='1';
  const [view,setView]=useState<CompositionView>(!benchmark&&params.get('view')==='proxy'?'proxy':'terrain');
  const [clouds,setClouds]=useState(params.get('clouds')==='1');
  const [compare,setCompare]=useState(!integration),[comparison,setComparison]=useState('side');
  const [mix,setMix]=useState(50),[guides,setGuides]=useState(false);
  const [calibrate,setCalibrate]=useState(false),[wire,setWire]=useState(false);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[exporting,setExporting]=useState(false),[status,setStatus]=useState('');
  const viewRef=useRef(view);viewRef.current=view;
  const cloudsRef=useRef(clouds);cloudsRef.current=clouds;
  const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<LandscapeRenderer|null>(null);
  useEffect(()=>{
    try {
      const e=new LandscapeRenderer(canvas.current!,frame,benchmark);engine.current=e;e.setClouds(cloudsRef.current);setReady(true);
      window.landscape={ready:true,export:(mode=viewRef.current,cloud=cloudsRef.current)=>exportFrame(e,benchmark?'terrain':mode,cloud),stats:()=>e.stats,placements:sceneLayout,proxySvg,view:()=>viewRef.current,setView,setClouds};
      return ()=>{delete window.landscape;engine.current=null;e.dispose();};
    }catch(err){setError(`地形初始化失败：${String(err)}`);}
  },[]);
  useEffect(()=>{engine.current?.setClouds(clouds);const url=new URL(location.href);url.searchParams.set('view',view);url.searchParams.set('clouds',clouds?'1':'0');history.replaceState(null,'',url);},[clouds,view]);
  useEffect(()=>{engine.current?.setWireframe(wire);},[wire]);
  async function save() {
    if(!engine.current)return;setExporting(true);setStatus('');
    try{const src=await exportFrame(engine.current,view,clouds,calibrate?document.querySelector<SVGSVGElement>('svg.calibration'):null);downloadUrl(src,`landscape-v05-${view}-${clouds?'clouds':'clear'}-${frame.width}x${frame.height}.png`);setStatus(`已导出 ${frame.width} × ${frame.height} PNG`);}catch(e){setError(String(e));}finally{setExporting(false);}
  }
  const aligned=compare&&!integration,overlay=aligned&&comparison!=='side';
  const frameStyle={'--frame-ratio':`${frame.width} / ${frame.height}`,'--frame-width':`${frame.width}px`,'--frame-height':`${frame.height}px`} as CSSProperties;
  return <main className={`app ${capture?'capture':''}`} style={frameStyle}>
    {!capture&&<>
      <header className="app-header"><a className="wordmark" href="/">Live With Me <span>/</span> <strong>Landscape</strong></a><span className="version">V0.5 · 中景山群 benchmark</span><span className="review-state">美术待审阅</span></header>
      <div className="workspace-heading"><div><h1>中景云海露峰 · 形体研究</h1><p>{integration?'1200 × 800 · SVG 集成兼容性画幅，仅显示 Proxy':'1600 × 900 · 高草甸下坡 / 错位山群 / 谷地云团'}</p></div><button className="primary" onClick={save} disabled={!ready||exporting}>{exporting?'正在导出…':'导出截图'}<span aria-hidden="true">↗</span></button></div>
      <div className="toolbar"><div className="view-switch" role="group" aria-label="预览模式">{((benchmark?['terrain']:['terrain','proxy']) as CompositionView[]).map(mode=><button key={mode} aria-pressed={view===mode} onClick={()=>setView(mode)}>{labels[mode]}</button>)}</div><div className="debug-controls"><label><input type="checkbox" checked={clouds} onChange={e=>setClouds(e.target.checked)}/>静态云海</label><label><input type="checkbox" checked={calibrate} onChange={e=>setCalibrate(e.target.checked)}/>投影校准</label><label><input type="checkbox" checked={wire} onChange={e=>setWire(e.target.checked)}/>线框</label></div></div>
      {!integration&&<div className="comparison-controls"><label><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>秋季定稿对照</label>{compare&&<><label>比较方式<select aria-label="比较方式" value={comparison} onChange={e=>setComparison(e.target.value)}><option value="side">并排同尺度</option><option value="overlay">透明叠图</option><option value="wipe">左右擦拭</option></select></label><label><input type="checkbox" checked={guides} onChange={e=>setGuides(e.target.checked)}/>构图轮廓</label>{overlay&&<label className="mix-control">{comparison==='overlay'?'定稿透明度':'定稿覆盖范围'}<input aria-label="对照比例" type="range" min="0" max="100" value={mix} onChange={e=>setMix(+e.target.value)}/><output>{mix}%</output></label>}</>}</div>}
    </>}
    {error&&<p className="error" role="alert">{error}</p>}
    <div className={`preview-layout ${aligned&&comparison==='side'?'comparing':''}`}>
      <section className="viewport-panel" aria-label="当前构图">
        {!capture&&<div className="comparison-heading">当前 V0.5 · {labels[view]} · {clouds?'静态云海 benchmark':'无云海几何检查'}</div>}
        <div className="viewport" data-testid="viewport" data-view={view} data-clouds={clouds}>
          <canvas ref={canvas} width={frame.width} height={frame.height} aria-label={clouds?'静态云海地形预览':'无云海三维地形'}/>
          {view==='proxy'&&<Proxy frame={frame}/>}
          {calibrate&&<Calibration frame={frame}/>}
          {overlay&&!capture&&<img className="reference-overlay" src="/reference/autumn-approved.png" alt="秋季定稿叠图" style={comparison==='overlay'?{opacity:mix/100}:{clipPath:`inset(0 ${100-mix}% 0 0)`}}/>}
          {overlay&&comparison==='wipe'&&!capture&&<span className="wipe-divider" style={{left:`${mix}%`}}/>}
          {aligned&&guides&&!capture&&<ContourGuides/>}
          {!ready&&!error&&<div className="loading">正在建立地形…</div>}
        </div>
        {!capture&&<div className="viewport-caption"><span><i/>{clouds?'静态云团遮挡，检查坡脚与谷地':'云层完全关闭，检查真实谷地与山脚'}</span><span>{frame.width} × {frame.height}</span></div>}
      </section>
      {aligned&&comparison==='side'&&!capture&&<aside className="reference-panel"><div className="comparison-heading">秋季定稿图 · 唯一主要美术基准</div><div className="reference-image"><img src="/reference/autumn-approved.png" alt="秋季定稿图"/>{guides&&<ContourGuides/>}</div><p>完整原图等比适配 16:9，不裁切、不拉伸；两侧画框大小和位置基线一致。</p></aside>}
    </div>
    {!capture&&<>
      <div className="status-line" role="status"><span>{status||'轮廓线为定稿图人工标注；几何检查通过不代表美术构图通过。'}</span><span>本轮停在山群 benchmark，整场景尚未集成</span></div>
      <details className="checks"><summary><span>本轮审阅范围与画面占比</span><span>完成出图后暂停，等待审阅</span></summary><div className="checks-body"><p>定稿图人工轮廓估算：天空约 {(REFERENCE_BANDS.sky*100).toFixed(1)}%，前景约 {(REFERENCE_BANDS.foreground*100).toFixed(1)}%，其间谷地与山群约 {(REFERENCE_BANDS.valleyAndMountains*100).toFixed(1)}%。这些比例用于构图比较，不是自动验收阈值。</p><p>五张参考统一用于主峰、次峰、鞍部、外伸支脊与远近错位。只研究形体和空间，不复制写实纹理。当前 benchmark 不显示田块、Proxy 或正式资产；纯地形与云海使用同一相机和同一山体。</p><a href="/benchmark-geometry-report.json" target="_blank" rel="noreferrer">查看工程采样报告 ↗</a></div></details>
      <details className="structure-references"><summary>本轮 5 张统一形体参考</summary><div className="reference-strip">{[
        ['01-layered-masses.png','远近错位与尺度递减'],['02-branching-shoulders.png','支脊与展开坡脚'],['03-open-valleys.png','贯通谷地与群山间隔'],['04-asymmetric-saddle.png','不等高双峰与鞍部'],['05-simplified-mass.png','简化体块与明暗关系'],
      ].map(([file,label])=><figure key={file}><img src={`/reference/structure/${file}`} alt={label}/><figcaption>{label}</figcaption></figure>)}</div></details>
      <footer><span>参考：01_autumn_approved.png.png / autumn-approved.png</span><span>视觉状态：待作者审阅</span></footer>
    </>}
  </main>;
}
