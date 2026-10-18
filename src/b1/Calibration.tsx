import {frameMapping,measureProjection,type Frame} from '../world/projection';
export function Calibration({frame}:{frame:Frame}){
 const {scale,offsetY}=frameMapping(frame),p=measureProjection();
 return <svg className="calibration" viewBox={`0 0 ${frame.width} ${frame.height}`} aria-label="Legacy 地面轴校准"><g transform={`translate(0 ${offsetY}) scale(${scale})`}>
  <path d="M580 537.72 L1020 662.28 M580 662.28 L1020 537.72" stroke="#fff7df" strokeWidth="3"/>
  <circle cx="800" cy="600" r="5" fill="#263c39"/>
  <rect x="24" y="24" width="430" height="44" fill="#f5f5e9" rx="4"/><text x="38" y="52" fontSize="15" fill="#263c39">地面轴 ±{Math.abs(p.anglesDegrees[0]).toFixed(3)}° · 相机仰角 {p.elevationDegrees.toFixed(3)}°</text>
 </g></svg>;
}
