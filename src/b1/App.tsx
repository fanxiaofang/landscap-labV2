import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {FRAME,INTEGRATION_FRAME,frameMapping} from '../world/projection';
import type {CameraView} from '../world/inspection';
import {Calibration} from './Calibration';
import {MidFarRenderer} from './renderer';
import {clampNavigation,HOME,LIMITS,type Navigation} from './camera';
import {foregroundSvg,svgUrl} from './foreground';
import {downloadUrl,exportB1} from './export';
import '../style.css';
import './style.css';

declare global{interface Window{b1?:{ready:boolean;stats:()=>MidFarRenderer['stats'];export:(foreground?:boolean)=>Promise<string>;setView:(view:CameraView)=>void;setNavigation:(n:Navigation)=>void;setForeground:(v:boolean)=>void;setNeutral:(v:boolean)=>void;setSun:(v:boolean)=>void;setParallax:(v:boolean)=>void;setRiver:(v:boolean)=>void}}}
const params=new URLSearchParams(location.search),frame=params.get('frame')==='integration'?INTEGRATION_FRAME:FRAME,capture=params.get('capture')==='1';
export default function B1App(){
 const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<MidFarRenderer|null>(null);
 const [view,setView]=useState<CameraView>((['oblique','top','side'].includes(params.get('camera')??'')?params.get('camera'):'target') as CameraView);
 const [foreground,setForeground]=useState(params.get('svg')==='1'),[nav,setNav]=useState<Navigation>({...HOME}),[parallax,setParallax]=useState(true);
 const [neutral,setNeutral]=useState(false),[wire,setWire]=useState(false),[reverse,setReverse]=useState(false),[river,setRiver]=useState(true),[calibration,setCalibration]=useState(false);
 const [ready,setReady]=useState(false),[asset,setAsset]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[status,setStatus]=useState('');
 const fgRef=useRef(foreground);fgRef.current=foreground;const navRef=useRef(nav);navRef.current=nav;
 const drag=useRef<{x:number;y:number;n:Navigation}|null>(null);
 useEffect(()=>{let e:MidFarRenderer|undefined;try{
  e=new MidFarRenderer(canvas.current!,frame);engine.current=e;e.setView(view);setReady(true);
  window.b1={ready:true,stats:()=>e!.stats,export:(fg=fgRef.current)=>exportB1(e!,fg),setView,setNavigation:n=>setNav(clampNavigation(n)),setForeground,setNeutral,setSun:setReverse,setParallax,setRiver};
 }catch(e){setError(String(e));}return()=>{delete window.b1;engine.current=null;e?.dispose();};},[]);
 useEffect(()=>{engine.current?.setView(view);const url=new URL(location.href);url.searchParams.set('camera',view);url.searchParams.set('svg',foreground?'1':'0');history.replaceState(null,'',url);},[view,foreground]);
 useEffect(()=>{engine.current?.setNavigation(nav);},[nav]);
 useEffect(()=>{engine.current?.setParallax(parallax);},[parallax]);
 useEffect(()=>{engine.current?.setNeutral(neutral);},[neutral]);
 useEffect(()=>{engine.current?.setWire(wire);},[wire]);
 useEffect(()=>{engine.current?.setSun(reverse);},[reverse]);
 useEffect(()=>{engine.current?.setRiver(river);},[river]);
 useEffect(()=>{let active=true,url='';if(foreground&&view==='target')foregroundSvg(frame).then(s=>{url=svgUrl(s);if(active)setAsset(url);else URL.revokeObjectURL(url);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[foreground,view]);
 useEffect(()=>{
  const el=canvas.current!;const wheel=(event:WheelEvent)=>{if(engine.current?.view!=='target')return;event.preventDefault();setNav(n=>clampNavigation({...n,zoom:n.zoom*Math.exp(-event.deltaY*.001)}));};
  el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
 },[]);
 async function save(){if(!engine.current)return;setSaving(true);try{downloadUrl(await exportB1(engine.current,foreground),`landscape-b1-${view}-${foreground?'composite':'3d-only'}-${frame.width}x${frame.height}.png`);setStatus('PNG 已导出');}catch(e){setError(String(e));}finally{setSaving(false);}}
 const style={'--frame-ratio':`${frame.width} / ${frame.height}`,'--frame-width':`${frame.width}px`,'--frame-height':`${frame.height}px`} as CSSProperties;
 const mapping=frameMapping(frame),fgStyle={transform:`translate(${nav.x*mapping.scale/frame.width*100}%, ${nav.y*mapping.scale/frame.height*100}%) scale(${nav.zoom})`};
 return <main className={`app b1 ${capture?'capture':''}`} style={style}>
  {!capture&&<><header className="app-header"><a className="wordmark" href="/?mode=b1">Live With Me <span>/</span><strong>中远景实验</strong></a><span className="version">Phase B1</span><a className="baseline-link" href="/?mode=v08">打开 V0.8 基线 ↗</a><span className="review-state">等待人工美术验收</span></header>
  <div className="workspace-heading"><div><h1>缓丘、河谷与层叠山脊</h1><p>独立 3D 中远景 · 原始 SVG 前景参照 · {frame.width} × {frame.height}</p></div><button className="primary" disabled={!ready||saving} onClick={save}>{saving?'正在导出…':'导出截图'}<span aria-hidden="true">↗</span></button></div>
  <div className="toolbar"><div className="view-switch" role="group" aria-label="合成模式"><button aria-pressed={!foreground} onClick={()=>setForeground(false)}>中远景 3D Only</button><button aria-pressed={foreground} onClick={()=>{setForeground(true);setView('target');}}>SVG Composite</button></div><div className="debug-controls"><label>检查视角<select aria-label="检查视角" value={view} onChange={e=>setView(e.target.value as CameraView)}><option value="target">目标正交</option><option value="oblique">自由斜视</option><option value="top">俯视结构</option><option value="side">侧向坡度</option></select></label><label><input type="checkbox" checked={neutral} onChange={e=>setNeutral(e.target.checked)}/>中性材质</label><label><input type="checkbox" checked={reverse} onChange={e=>setReverse(e.target.checked)}/>反向侧光</label><label><input type="checkbox" checked={wire} onChange={e=>setWire(e.target.checked)}/>线框</label></div></div>
  <div className="comparison-controls"><label><input type="checkbox" checked={river} onChange={e=>setRiver(e.target.checked)}/>河流</label><label><input type="checkbox" checked={parallax} onChange={e=>setParallax(e.target.checked)}/>轻微远景视差</label><label><input type="checkbox" checked={calibration} disabled={view!=='target'} onChange={e=>setCalibration(e.target.checked)}/>投影校准</label><label>目标缩放<input aria-label="目标缩放" type="range" min={LIMITS.minZoom} max={LIMITS.maxZoom} step=".01" value={nav.zoom} disabled={view!=='target'} onChange={e=>setNav(n=>({...n,zoom:+e.target.value}))}/><output>{Math.round(nav.zoom*100)}%</output></label><button onClick={()=>{setNav({...HOME});setView('target');}}>复位目标相机</button></div></>}
  {error&&<p className="error" role="alert">{error}</p>}
  <section className="viewport-panel" aria-label="B1 中远景构图"><div className="viewport" data-testid="viewport"><canvas ref={canvas} width={frame.width} height={frame.height} aria-label="B1 三维中远景" onPointerDown={e=>{if(view==='target'){e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,n:navRef.current};}}} onPointerMove={e=>{if(!drag.current||view!=='target')return;const s=1600/e.currentTarget.getBoundingClientRect().width;setNav(clampNavigation({...drag.current.n,x:drag.current.n.x+(e.clientX-drag.current.x)*s,y:drag.current.n.y+(e.clientY-drag.current.y)*s}));}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}/>
   {foreground&&view==='target'&&asset&&<img className="asset-overlay visible b1-foreground" style={fgStyle} src={asset} alt="原始 Live With Me 草甸、主屋与生活设施"/>}
   {calibration&&view==='target'&&<div className="b1-calibration" style={fgStyle}><Calibration frame={frame}/></div>}
   {!ready&&!error&&<div className="loading">正在建立中远景曲面…</div>}
  </div>{!capture&&<div className="viewport-caption"><span>{view==='target'?'拖动平移 · 滚轮缩放 · 原始 SVG 仅用于目标视角合成':'拖动旋转 · 右键平移 · 滚轮缩放 · 检查前坡、后坡和独立山体'}</span><span>{foreground&&view==='target'?'SVG 前景开启':'3D Only'}</span></div>}</section>
  {!capture&&<><div className="status-line" role="status"><span>{status||'3 组中景缓丘 · 3 层远山 · 开阔河谷'}</span><span>±15.806° 地面轴 · 16.445° 相机仰角</span></div><details className="checks"><summary><span>实验边界与验收方式</span><span>查看说明</span></summary><div className="checks-body"><p>3D Only 下方浅灰区域是未建模的 SVG 前景空间。自由视角保留独立山体的封闭底部及局部河谷边界，前景参照不参与三维检查。</p><p>中性材质与反向侧光用于确认体积来自曲面法线和真实灯光。目标相机支持横向 ±100、纵向 ±45、90%–118% 缩放，三层远山共享目标相机并使用少量平移视差。</p><p>沿用原始 SVG 草甸、房屋、羊群、羊圈及设施；桥、火车与左侧农田也来自原场景。B1 不创建建筑代理、近景地形、树林或天气。</p><p>工程检查不代表美术通过。完成后停在此阶段，等待作者验收。</p></div></details><footer><span>B1 · Curve loft / Lambert / single target camera</span><span>V0.8 保留为独立可回退入口</span></footer></>}
 </main>;
}
