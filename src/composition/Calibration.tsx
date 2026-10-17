import { projectPoint, measureProjection, PROJECTION } from '../world/projection';
import { groundHeight, WALK_ROUTE, RIDGES } from '../terrain/layout';

export function Calibration() {
  const projection=measureProjection();
  const center={u:-39.6,d:42,h:200};
  const line=(dx:number,dz:number)=>{
    const a=projectPoint(center.u-dx,center.d-dz,center.h+.5),b=projectPoint(center.u+dx,center.d+dz,center.h+.5);
    return `${a.x},${a.y} ${b.x},${b.y}`;
  };
  const samples=[{name:'草甸 +200',u:-40,d:42,h:200},{name:'农田',u:-350,d:690,h:groundHeight(-350,690)},...RIDGES.slice(0,4).map(r=>{const p=r.points.reduce((a,b)=>a.h>b.h?a:b);return {...p,name:r.name};})];
  return <svg className="calibration" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" aria-label="投影轴与高程校准">
    <g fill="none" stroke="#f9f7e8" strokeWidth="1.2" opacity=".7">
      {[-180,-120,-60,0,60,120,180].map(n=><g key={n}>
        <polyline points={line(200,200)} transform={`translate(${n} ${n*PROJECTION.groundSlope})`}/>
        <polyline points={line(200,-200)} transform={`translate(${n} ${-n*PROJECTION.groundSlope})`}/>
      </g>)}
    </g>
    <polyline points={line(220,220)} fill="none" stroke="#fff7d1" strokeWidth="3"/>
    <polyline points={line(220,-220)} fill="none" stroke="#3c4a56" strokeWidth="3"/>
    <polyline points={WALK_ROUTE.map(p=>{const q=projectPoint(p.u,p.d,groundHeight(p.u,p.d)+1);return `${q.x},${q.y}`;}).join(' ')} fill="none" stroke="#f7eee0" strokeDasharray="6 5" strokeWidth="2"/>
    {samples.map(p=>{const q=projectPoint(p.u,p.d,p.h);return <g key={p.name} transform={`translate(${q.x},${q.y})`}><circle r="4" fill="#fff" stroke="#334139"/><text x="8" y="-9" fill="#28382b" stroke="#fff8df" strokeWidth="3" paintOrder="stroke" fontSize="13" fontFamily="sans-serif">{p.name} · {p.h.toFixed(1)}</text></g>;})}
    <rect x="20" y="20" width="382" height="66" fill="#fbf8ed" opacity=".94" rx="5"/>
    <text x="34" y="45" fontSize="14" fill="#28382b" fontFamily="sans-serif">地面轴 ±{Math.abs(projection.anglesDegrees[0]).toFixed(3)}° · 相机仰角 {projection.elevationDegrees.toFixed(3)}°</text>
    <text x="34" y="68" fontSize="12" fill="#4c594d" fontFamily="sans-serif">白线：下行路径 / 地面网格只在主屋平台校准</text>
  </svg>;
}
