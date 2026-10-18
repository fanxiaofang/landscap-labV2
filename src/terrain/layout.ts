export const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
export const smooth=(a:number,b:number,v:number)=>{const t=clamp01((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
export const bump=(u:number,d:number,x:number,z:number,rx:number,rz:number)=>Math.exp(-(((u-x)/rx)**2)-((d-z)/rz)**2);
export const HOME_HEIGHT=200;
export const LIVING_AREA={u:70,d:-240,radiusU:620,radiusD:440};
// One C1 plan-space centreline controls the bed, banks and water.
const RIVER_POINTS=[[100,1200],[450,790],[760,390],[1010,65],[1260,240],[1510,30],[1830,-130],[2100,-240]];
export const RIVER_RANGE={near:100,far:1930};
export function riverCenter(d:number) {
  let i=RIVER_POINTS.findIndex((_,k)=>k<RIVER_POINTS.length-1&&d<=RIVER_POINTS[k+1][0]);
  if(i<0)i=RIVER_POINTS.length-2;
  const a=RIVER_POINTS[i],b=RIVER_POINTS[i+1],prev=RIVER_POINTS[Math.max(0,i-1)],next=RIVER_POINTS[Math.min(RIVER_POINTS.length-1,i+2)];
  const t=clamp01((d-a[0])/(b[0]-a[0])),t2=t*t,t3=t2*t;
  const m0=(b[1]-prev[1])/(b[0]-prev[0]),m1=(next[1]-a[1])/(next[0]-a[0]);
  return (2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*(b[0]-a[0])*m0+(-2*t3+3*t2)*b[1]+(t3-t2)*(b[0]-a[0])*m1;
}
export function riverWidth(d:number){return 32-12*smooth(400,1850,d)+3*Math.sin(d/240);}
export function riverHeight(d:number){return 4+.012*d;}
// Cross-sections use the plan's u axis. Dividing by the local tangent created
// curvature-dependent bank creases away from the centreline at spline knots.
export function riverDistance(u:number,d:number){return Math.abs(u-riverCenter(d));}
export function valleyHeight(_u:number,d:number){return 18+.005*d-250*smooth(1770,2440,d);}
export function shoulderDepth(u:number){return 120-250*smooth(-300,350,u)-750*smooth(250,950,u);}
export function shoulderWidth(u:number){return 1600-300*smooth(-300,350,u)-300*smooth(250,950,u);}
export interface RidgeControl {u:number;d:number;h:number;w:number}
export interface RidgeDefinition {id:string;name:string;atmosphere:number;flanks?:[number,number];points:RidgeControl[];branches?:RidgeControl[][];depth:number}
// Broad overlapping volumes: h is relief, w/depth are physical plan radii.
export const RIDGES:RidgeDefinition[]=[
  {id:'west-pasture',name:'西侧长缓丘',atmosphere:.1,depth:250,points:[{u:-680,d:1000,h:68,w:480},{u:-1150,d:1200,h:35,w:500}]},
  {id:'east-pasture',name:'东侧河岸缓丘',atmosphere:.15,depth:260,points:[{u:710,d:970,h:74,w:460},{u:1180,d:1200,h:40,w:540}]},
  {id:'middle-west',name:'中远景西岭',atmosphere:.39,depth:165,points:[{u:-960,d:1460,h:70,w:480},{u:-250,d:1490,h:58,w:470}]},
  {id:'middle-east',name:'中远景东岭',atmosphere:.43,depth:165,points:[{u:550,d:1470,h:66,w:500},{u:1310,d:1500,h:68,w:530}]},
  {id:'far-ridge',name:'远景圆缓横岭',atmosphere:.68,depth:135,points:[{u:-1450,d:1750,h:30,w:430},{u:-600,d:1800,h:48,w:370},{u:150,d:1730,h:22,w:360},{u:850,d:1830,h:40,w:420},{u:1550,d:1770,h:35,w:380}]},
  {id:'horizon-ridge',name:'极远低丘',atmosphere:.82,depth:130,points:[{u:-1580,d:1930,h:20,w:380},{u:-950,d:1940,h:32,w:350},{u:0,d:1970,h:36,w:350},{u:1050,d:1930,h:28,w:400},{u:1700,d:1960,h:34,w:420}]},
];
export function ridgeRelief(def:RidgeDefinition,u:number,d:number){return def.points.reduce((h,p)=>h+p.h*bump(u,d,p.u,p.d,p.w,def.depth),0);}
export function terrainSample(u:number,d:number) {
  const shoulder=shoulderDepth(u),descent=smooth(shoulder,shoulder+shoulderWidth(u),d);
  const pad=1-smooth(.7,1.45,Math.hypot((u-LIVING_AREA.u)/LIVING_AREA.radiusU,(d-LIVING_AREA.d)/LIVING_AREA.radiusD));
  const rolling=-8*bump(u,d,-1000,-600,650,700)+12*bump(u,d,940,-700,700,650)-11*bump(u,d,-480,-420,470,430);
  const meadow=HOME_HEIGHT+rolling*(1-pad),base=meadow*(1-descent)+valleyHeight(u,d)*descent;
  let relief=0,weightedAir=0;
  for(const def of RIDGES){const r=ridgeRelief(def,u,d);relief+=r;weightedAir+=r*def.atmosphere;}
  const distance=riverDistance(u,d),width=riverWidth(d),riverEnvelope=smooth(50,220,d)*(1-smooth(1800,2030,d));
  const floodplain=(1-smooth(width+55,width+740,distance))*riverEnvelope;
  const bed=riverHeight(d)-5+13*smooth(width*.6,width+55,distance);
  const h=(base+relief)*(1-floodplain)+bed*floodplain;
  return {h,relief:relief*(1-floodplain),atmosphere:relief>0?weightedAir/relief:0};
}
export function groundHeight(u:number,d:number){return terrainSample(u,d).h;}
export interface FieldDefinition {id:string;corners:[number,number][];color:number;nearBend:number;farBend:number;sideBend:number;rows:number}
export const FIELDS:FieldDefinition[]=[
  {id:'main-plot',color:0,corners:[[-1010,-230],[-400,-90],[-410,470],[-990,390]],nearBend:42,farBend:68,sideBend:28,rows:22},
  {id:'lower-plot',color:1,corners:[[-928,440],[-605,503],[-565,645],[-855,615]],nearBend:25,farBend:32,sideBend:18,rows:11},
  {id:'river-plot',color:2,corners:[[-548,510],[-420,495],[-345,595],[-482,625]],nearBend:14,farBend:22,sideBend:12,rows:7},
];
export function fieldPoint(field:FieldDefinition,s:number,t:number) {
  const [a,b,c,e]=field.corners;
  const u=(1-t)*(a[0]*(1-s)+b[0]*s)+t*(e[0]*(1-s)+c[0]*s)+field.sideBend*Math.sin(t*Math.PI)*(2*s-1);
  const d=(1-t)*(a[1]*(1-s)+b[1]*s)+t*(e[1]*(1-s)+c[1]*s)+Math.sin(s*Math.PI)*((1-t)*field.nearBend+t*field.farBend);
  return {u,d,h:groundHeight(u,d)};
}
export const WALK_ROUTE=[{u:-130,d:-210},{u:-245,d:-110},{u:-330,d:30},{u:-350,d:180},{u:-385,d:330}];
export const GROUND_GRID={minU:-3200,width:6400,minD:-1900,depth:4300,cols:480,rows:430};
export function renderedGroundHeight(u:number,d:number) {
  const g=GROUND_GRID,x=(u-g.minU)/g.width*g.cols,z=(d-g.minD)/g.depth*g.rows;
  const ix=Math.max(0,Math.min(g.cols-1,Math.floor(x))),iz=Math.max(0,Math.min(g.rows-1,Math.floor(z)));
  const fx=clamp01(x-ix),fz=clamp01(z-iz),du=g.width/g.cols,dd=g.depth/g.rows,u0=g.minU+ix*du,d0=g.minD+iz*dd;
  const a=groundHeight(u0,d0),b=groundHeight(u0+du,d0),c=groundHeight(u0,d0+dd),e=groundHeight(u0+du,d0+dd);
  return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:e+(c-e)*(1-fx)+(b-e)*(1-fz);
}
