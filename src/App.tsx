import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LandscapeRenderer } from './world/renderer';
import type { CameraView } from './world/inspection';
import { FRAME, INTEGRATION_FRAME } from './world/projection';
import { Calibration } from './composition/Calibration';
import { downloadUrl, exportFrame } from './composition/export';
import { Proxy, proxySvg } from './composition/Proxy';
import { sceneLayout, type CompositionView } from './composition/placements';
import { loadAssetComposition } from './composition/assets';
import './style.css';

declare global {interface Window {landscape?:{export:(view?:CompositionView,mist?:boolean)=>Promise<string>;stats:()=>unknown;ready:boolean;placements:typeof sceneLayout;proxySvg:typeof proxySvg;view:()=>CompositionView;setView:(view:CompositionView)=>void;setClouds:(enabled:boolean)=>void;setCameraView:(view:CameraView)=>void}}}
const params=new URLSearchParams(location.search),integration=params.get('frame')==='integration',frame=integration?INTEGRATION_FRAME:FRAME;
const labels:Record<CompositionView,string>={terrain:'纯地形',river:'河流 + 轻雾',proxy:'Proxy 布局',assets:'正式 SVG 对照'};
const modes=Object.keys(labels) as CompositionView[];
export default function App() {
  const capture=params.get('capture')==='1';
  const initial=modes.includes(params.get('view') as CompositionView)?params.get('view') as CompositionView:'terrain';
  const [view,setView]=useState<CompositionView>(initial),[clouds,setClouds]=useState(params.has('clouds')?params.get('clouds')==='1':initial!=='terrain');
  const [cameraView,setCameraView]=useState<CameraView>((['oblique','top','side'].includes(params.get('camera')??'')?params.get('camera'):'target') as CameraView);
  const [compare,setCompare]=useState(false),[comparison,setComparison]=useState('side'),[mix,setMix]=useState(50);
  const [calibrate,setCalibrate]=useState(false),[wire,setWire]=useState(false),[assetUrl,setAssetUrl]=useState('');
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[exporting,setExporting]=useState(false),[status,setStatus]=useState('');
  const viewRef=useRef(view);viewRef.current=view;const cloudsRef=useRef(clouds);cloudsRef.current=clouds;
  const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<LandscapeRenderer|null>(null);
  function selectView(next:CompositionView){setView(next);setClouds(next!=='terrain');}
  useEffect(()=>{
    try {
      const e=new LandscapeRenderer(canvas.current!,frame,false);engine.current=e;e.setClouds(cloudsRef.current);e.setRiver(viewRef.current!=='terrain');e.setCameraView(cameraView);setReady(true);
      window.landscape={ready:true,export:(mode=viewRef.current,mist=cloudsRef.current)=>exportFrame(e,mode,mist),stats:()=>e.stats,placements:sceneLayout,proxySvg,view:()=>viewRef.current,setView:selectView,setClouds,setCameraView};
      return ()=>{delete window.landscape;engine.current=null;e.dispose();};
    }catch(err){setError(`地形初始化失败：${String(err)}`);}
  },[]);
  useEffect(()=>{engine.current?.setClouds(clouds);engine.current?.setRiver(view!=='terrain');const url=new URL(location.href);url.searchParams.set('view',view);url.searchParams.set('clouds',clouds?'1':'0');history.replaceState(null,'',url);},[clouds,view]);
  useEffect(()=>{engine.current?.setWireframe(wire);},[wire]);
  useEffect(()=>{engine.current?.setCameraView(cameraView);const url=new URL(location.href);url.searchParams.set('camera',cameraView);history.replaceState(null,'',url);},[cameraView]);
  useEffect(()=>{let active=true;if(view==='assets')loadAssetComposition(frame).then(({url})=>{if(active)setAssetUrl(url);}).catch(err=>{if(active)setError(String(err));});return()=>{active=false;};},[view]);
  async function save() {
    if(!engine.current)return;setExporting(true);setStatus('');
    try{const src=await exportFrame(engine.current,view,clouds,calibrate?document.querySelector<SVGSVGElement>('svg.calibration'):null);downloadUrl(src,`landscape-v08-${cameraView}-${view}-${clouds?'mist':'clear'}-${frame.width}x${frame.height}.png`);setStatus(`已导出 ${frame.width} × ${frame.height} PNG`);}catch(e){setError(String(e));}finally{setExporting(false);}
  }
  const aligned=compare&&!integration&&cameraView==='target',overlay=aligned&&comparison!=='side';
  const frameStyle={'--frame-ratio':`${frame.width} / ${frame.height}`,'--frame-width':`${frame.width}px`,'--frame-height':`${frame.height}px`} as CSSProperties;
  return <main className={`app ${capture?'capture':''}`} style={frameStyle}>
    {!capture&&<>
      <header className="app-header"><a className="wordmark" href="/">Live With Me <span>/</span> <strong>Landscape</strong></a><span className="version">V0.8 · Pastoral Valley</span><span className="review-state">地形待审阅</span></header>
      <div className="workspace-heading"><div><h1>宽缓草丘 · 河谷 · 柔和远山</h1><p>{integration?'1200 × 800 · 正式 SVG 投影兼容检查':'1600 × 900 · 先检查连续地表，再查看分阶段构图'}</p></div><button className="primary" onClick={save} disabled={!ready||exporting}>{exporting?'正在导出…':'导出截图'}<span aria-hidden="true">↗</span></button></div>
      <div className="toolbar"><div className="view-switch" role="group" aria-label="交付阶段">{modes.map(mode=><button key={mode} aria-pressed={view===mode} onClick={()=>selectView(mode)}>{labels[mode]}</button>)}</div><div className="debug-controls"><label>检查视角<select aria-label="检查视角" value={cameraView} onChange={e=>setCameraView(e.target.value as CameraView)}><option value="target">目标正交</option><option value="oblique">自由斜视</option><option value="top">俯视结构</option><option value="side">侧向坡度</option></select></label><label><input type="checkbox" checked={clouds} onChange={e=>setClouds(e.target.checked)}/>轻薄雾</label><label><input type="checkbox" checked={calibrate} disabled={cameraView!=='target'} onChange={e=>setCalibrate(e.target.checked)}/>投影校准</label><label><input type="checkbox" checked={wire} onChange={e=>setWire(e.target.checked)}/>线框</label></div></div>
      {!integration&&<div className="comparison-controls"><label><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>参考效果图对照</label>{compare&&<><label>比较方式<select aria-label="比较方式" value={comparison} onChange={e=>setComparison(e.target.value)}><option value="side">并排同尺度</option><option value="overlay">透明叠图</option><option value="wipe">左右擦拭</option></select></label>{overlay&&<label className="mix-control">参考图比例<input aria-label="对照比例" type="range" min="0" max="100" value={mix} onChange={e=>setMix(+e.target.value)}/><output>{mix}%</output></label>}</>}</div>}
    </>}
    {error&&<p className="error" role="alert">{error}</p>}
    <div className={`preview-layout ${aligned&&comparison==='side'?'comparing':''}`}>
      <section className="viewport-panel" aria-label="当前构图">
        {!capture&&<div className="comparison-heading">V0.8 · {cameraView==='target'?labels[view]:'连续地表结构'} · {clouds?'局部薄雾':'清晰地形'}</div>}
        <div className="viewport" data-testid="viewport" data-view={view} data-clouds={clouds}>
          <canvas ref={canvas} width={frame.width} height={frame.height} aria-label="丘陵河谷三维地形"/>
          {view==='proxy'&&cameraView==='target'&&<Proxy frame={frame}/>}
          {view==='assets'&&cameraView==='target'&&assetUrl&&<img className="asset-overlay visible" src={assetUrl} alt="现有正式 SVG 资产叠加对照"/>}
          {calibrate&&cameraView==='target'&&<Calibration frame={frame}/>}
          {overlay&&!capture&&<img className="reference-overlay" src="/reference/pastoral-target.png" alt="田园参考效果图" style={comparison==='overlay'?{opacity:mix/100}:{clipPath:`inset(0 ${100-mix}% 0 0)`}}/>}
          {overlay&&comparison==='wipe'&&!capture&&<span className="wipe-divider" style={{left:`${mix}%`}}/>}
          {!ready&&!error&&<div className="loading">正在建立连续地表…</div>}
        </div>
        {!capture&&<div className="viewport-caption"><span><i/>{cameraView!=='target'?'拖动旋转 · 右键平移 · 滚轮缩放':view==='assets'?'正式 SVG 对照，检查新地形下的资产比例和落点':view==='terrain'?'仅地形与顺坡农田，河床清晰可见':'蜿蜒河流与宽缓谷地，薄雾可独立关闭'}</span><span>{frame.width} × {frame.height}</span></div>}
      </section>
      {aligned&&comparison==='side'&&!capture&&<aside className="reference-panel"><div className="comparison-heading">参考效果图 · 田园丘陵构图</div><div className="reference-image"><img src="/reference/pastoral-target.png" alt="本轮田园丘陵参考效果图"/></div><p>完整原图等比适配，观察草甸、河谷和远山层次。</p></aside>}
    </div>
    {!capture&&<><div className="status-line" role="status"><span>{status||'纯地形 → 河流与轻雾 → Proxy → 正式 SVG 对照'}</span><span>工程验证与人工美术验收分别记录</span></div><details className="checks"><summary><span>本轮地形调整</span><span>查看范围</span></summary><div className="checks-body"><p>宽平生活台地、左侧主田块与两个顺坡小田块、连续河床与缓岸、低矮圆润远山。农田向谷地延伸约 20%，越远越窄、越疏。</p><p>自由视角以中性材质检查同一张连续网格。轻雾为静态局部空气透视，不生成云海；本轮没有季节系统、动态云或新增植被。</p><a href="/benchmark-geometry-report.json" target="_blank" rel="noreferrer">查看几何检查报告 ↗</a></div></details><footer><span>V0.8 · 田园丘陵河谷重建</span><span>视觉状态：待作者审阅</span></footer></>}
  </main>;
}
