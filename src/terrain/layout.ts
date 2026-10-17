export const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
export const smooth=(a:number,b:number,v:number)=>{const t=clamp01((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const bump=(u:number,d:number,x:number,z:number,rx:number,rz:number)=>Math.exp(-(((u-x)/rx)**2)-((d-z)/rz)**2);
export const HOME_HEIGHT=200;
export function valleyHeight(u:number,d:number) {
  return -440 - 0.16*Math.max(0,d-2300)*smooth(2300,2600,d) + 20*bump(u,d,-350,2800,700,1000)-16*bump(u,d,480,2200,500,620);
}
export function shoulderDepth(u:number) {
  return 230+650*(1-smooth(-400,-50,u))+55*Math.exp(-(((u-450)/310)**2));
}
export function shoulderWidth(u:number) {return 1050+300*(1-smooth(-400,-50,u));}
// One C2-continuous surface, shared by meadow, farm, and the descending valley apron.
export function groundHeight(u:number,d:number) {
  const left=1-smooth(-400,-50,u);
  const farmDescent=62*left*smooth(220,1120,d);
  const rolling=36*bump(u,d,-680,-650,470,520)-20*bump(u,d,700,-950,700,950)+12*bump(u,d,350,-1100,400,450);
  const top=HOME_HEIGHT-farmDescent+rolling*(1-smooth(-350,60,d));
  const shoulder=shoulderDepth(u);
  const fall=smooth(shoulder,shoulder+shoulderWidth(u),d);
  return top*(1-fall)+valleyHeight(u,d)*fall;
}

export interface RidgeControl {u:number;d:number;h:number;w:number}
export interface RidgeDefinition {id:string;name:string;atmosphere:number;points:RidgeControl[];branches?:RidgeControl[][]}
const p=(u:number,d:number,h:number,w:number):RidgeControl=>({u,d,h,w});
// Each crest is authored individually. No random seed, sine hill repetition, or cone primitives.
export const RIDGES:RidgeDefinition[]=[
  {id:'west-drift',name:'西侧长肩',atmosphere:.38,points:[p(-930,2760,-430,150),p(-700,2730,-345,210),p(-500,2570,-285,270),p(-410,2640,-310,250),p(-290,2635,-295,225),p(-70,2810,-435,140)],branches:[[p(-500,2570,-285,180),p(-420,2410,-350,130),p(-270,2290,-430,100)]]},
  {id:'middle-saddle',name:'中谷双肩脊',atmosphere:.22,points:[p(-330,2150,-430,140),p(-170,2115,-270,210),p(-10,2020,-178,240),p(65,2050,-202,220),p(105,2130,-225,240),p(240,2360,-435,110)],branches:[[p(-10,2020,-178,140),p(-60,1870,-290,140),p(-185,1710,-435,150)]]},
  {id:'near-fold',name:'主观景折脊',atmosphere:.10,points:[p(-25,1580,-440,110),p(75,1735,-245,160),p(170,1850,-106,220),p(205,1870,-128,240),p(235,1905,-175,235),p(310,1960,-210,230),p(350,2050,-310,210),p(500,2230,-440,140)],branches:[[p(170,1850,-106,130),p(225,1685,-270,150),p(360,1510,-440,120)],[p(170,1850,-106,130),p(50,2040,-260,170),p(-90,2220,-430,120)]]},
  {id:'east-spur',name:'东侧分叉山脊',atmosphere:.16,points:[p(250,1540,-445,130),p(395,1690,-300,180),p(465,1800,-182,190),p(505,1835,-148,240),p(550,1890,-210,230),p(640,1985,-245,270),p(770,2060,-287,235),p(930,2240,-440,120)],branches:[[p(505,1835,-148,150),p(565,1670,-275,180),p(690,1530,-440,130)]]},
  {id:'quiet-islet',name:'后谷低丘',atmosphere:.46,points:[p(160,2870,-485,60),p(320,2830,-380,110),p(460,2920,-405,130),p(620,3100,-510,70)]},
  {id:'east-low',name:'东谷余脉',atmosphere:.42,points:[p(660,2790,-460,60),p(780,2780,-330,160),p(960,2820,-395,170),p(1220,3070,-530,100)]},
  {id:'horizon-west',name:'极远西岭',atmosphere:.72,points:[p(-1700,4020,-750,160),p(-1300,4120,-665,180),p(-1060,4100,-650,160),p(-790,4050,-690,180),p(-520,4170,-675,200),p(-180,4240,-725,160),p(180,4350,-800,100)]},
  {id:'horizon-east',name:'极远东岭',atmosphere:.78,points:[p(-120,4210,-780,110),p(150,4250,-695,180),p(390,4160,-730,160),p(650,4300,-710,190),p(930,4330,-735,180),p(1220,4290,-710,160),p(1600,4400,-830,150)]},
];

// Curved field parcels occupy only the west approach. Each vertex uses the terrain sampler.
export interface FieldDefinition {id:string; corners:[number,number][]; color:number}
export const FIELDS:FieldDefinition[]=[
  {id:'lower-plot',color:0,corners:[[-920,430],[-565,450],[-410,655],[-880,710]]},
  {id:'tractor-plot',color:1,corners:[[-548,460],[-285,478],[-280,680],[-398,651]]},
  {id:'middle-plot',color:2,corners:[[-890,745],[-410,690],[-388,895],[-910,980]]},
  {id:'upper-plot',color:3,corners:[[-390,708],[-298,722],[-315,900],[-367,919]]},
];
export function fieldPoint(field:FieldDefinition,s:number,t:number) {
  const [a,b,c,e]=field.corners;
  const u=(1-t)*(a[0]*(1-s)+b[0]*s)+t*(e[0]*(1-s)+c[0]*s);
  const d=(1-t)*(a[1]*(1-s)+b[1]*s)+t*(e[1]*(1-s)+c[1]*s)+18*Math.sin(s*Math.PI)*Math.sin(t*Math.PI);
  return {u,d,h:groundHeight(u,d)};
}
export const WALK_ROUTE=[{u:-40,d:40},{u:-180,d:250},{u:-280,d:430},{u:-350,d:690},{u:-470,d:930}];

export const GROUND_GRID={minU:-2400,width:4800,minD:-1800,depth:6100,cols:160,rows:210};
/** Height on the actual piecewise-linear rendered ground, for attachment diagnostics. */
export function renderedGroundHeight(u:number,d:number) {
  const g=GROUND_GRID,x=(u-g.minU)/g.width*g.cols,z=(d-g.minD)/g.depth*g.rows;
  const ix=Math.max(0,Math.min(g.cols-1,Math.floor(x))),iz=Math.max(0,Math.min(g.rows-1,Math.floor(z)));
  const fx=x-ix,fz=z-iz,du=g.width/g.cols,dd=g.depth/g.rows;
  const u0=g.minU+ix*du,d0=g.minD+iz*dd;
  const a=groundHeight(u0,d0),b=groundHeight(u0+du,d0),c=groundHeight(u0,d0+dd),e=groundHeight(u0+du,d0+dd);
  return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:e+(c-e)*(1-fx)+(b-e)*(1-fz);
}
