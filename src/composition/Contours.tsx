/** Normalized, manually traced composition landmarks from the approved autumn image.
 * These guides are annotations only: they never deform the camera, terrain or reference.
 */
export const REFERENCE_CONTOURS=[
  {id:'horizon',name:'远山上缘',color:'#64365d',points:[[0,.232],[.05,.222],[.08,.229],[.108,.215],[.16,.237],[.232,.213],[.286,.235],[.348,.231],[.373,.237],[.447,.218],[.49,.235],[.57,.228],[.64,.24],[.72,.236],[.81,.244],[.91,.237],[1,.23]]},
  {id:'foreground',name:'前景外缘',color:'#305a35',points:[[0,.37],[.1,.39],[.21,.43],[.32,.475],[.43,.51],[.54,.535],[.65,.567],[.73,.612],[.82,.65],[.9,.675],[1,.715]]},
  {id:'west',name:'左侧远肩',color:'#814e32',points:[[.15,.309],[.205,.285],[.25,.266],[.29,.295],[.322,.3],[.37,.28],[.41,.296],[.5,.33]]},
  {id:'center',name:'中央露峰',color:'#814e32',points:[[.405,.385],[.47,.35],[.527,.328],[.56,.36],[.59,.36],[.629,.322],[.66,.385],[.70,.42]]},
  {id:'right',name:'右侧近山',color:'#814e32',points:[[.77,.465],[.802,.41],[.832,.36],[.849,.373],[.869,.421],[.9,.435],[.94,.40],[1,.405]]},
] as const;
function areaBelow(points:readonly (readonly [number,number])[]) {
  return points.slice(1).reduce((sum,p,i)=>sum+(p[0]-points[i][0])*(p[1]+points[i][1])/2,0);
}
const sky=areaBelow(REFERENCE_CONTOURS[0].points),foreground=1-areaBelow(REFERENCE_CONTOURS[1].points);
export const REFERENCE_BANDS={sky,foreground,valleyAndMountains:1-sky-foreground};
export function ContourGuides() {
  return <svg className="contour-guides" viewBox="0 0 1600 900" aria-label="秋季定稿图的归一化构图轮廓">
    {[.25,.5,.75].map(n=><g key={n} stroke="#fff" strokeWidth="1" opacity=".6" strokeDasharray="6 7"><path d={`M ${1600*n} 0 V 900 M 0 ${900*n} H 1600`}/></g>)}
    {REFERENCE_CONTOURS.map(c=><polyline key={c.id} points={c.points.map(([x,y])=>`${x*1600},${y*900}`).join(' ')} fill="none" stroke={c.color} strokeWidth="3.5" strokeDasharray={c.id==='foreground'?'':'8 5'}/>)}
    <g fontFamily="Microsoft YaHei,sans-serif" fontSize="18" fill="#28352e" stroke="#fff7e3" strokeWidth="4" paintOrder="stroke"><text x="20" y="180">远山约 23% 高度</text><text x="650" y="440">谷地留白 / 分散露峰</text><text x="30" y="810">前景外缘：左上 → 右下</text></g>
  </svg>;
}
