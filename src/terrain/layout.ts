export const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
export const smooth=(a:number,b:number,v:number)=>{const t=clamp01((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const bump=(u:number,d:number,x:number,z:number,rx:number,rz:number)=>Math.exp(-(((u-x)/rx)**2)-((d-z)/rz)**2);
export const HOME_HEIGHT=200;
export const LIVING_AREA={u:70,d:-240,radiusU:270,radiusD:290};
export function valleyHeight(u:number,d:number) {
  // A winding basin with overlapping shoulders. It remains inspectable with clouds off.
  const channel=u-170-200*Math.sin((d-900)/850);
  return -450-.00004*Math.max(0,d-1900)**2-.00012*Math.max(0,d-3600)**2
    -80*Math.exp(-((channel/340)**2))*bump(0,d,0,2100,1,1300)
    +110*bump(u,d,-580,1700,480,800)+75*bump(u,d,670,2300,450,780)
    +45*bump(u,d,-150,3400,650,650);
}
export function shoulderDepth(u:number) {
  // Reference-led diagonal: the left farming shoulder recedes, the right bank comes forward.
  return 290-.54*u+110*bump(u,0,-800,0,400,1)+70*bump(u,0,-420,0,420,1)-65*bump(u,0,580,0,290,1);
}
export function shoulderWidth(u:number) {return 850+110*bump(u,0,-600,0,500,1);}
export function groundHeight(u:number,d:number) {
  const hollow=37*bump(u,d,-490,20,400,520)+20*bump(u,d,600,-350,340,400);
  const rolling=33*bump(u,d,-470,-800,520,400)+25*bump(u,d,480,-1040,430,430)-20*bump(u,d,150,-650,300,320);
  const radius=Math.hypot((u-LIVING_AREA.u)/LIVING_AREA.radiusU,(d-LIVING_AREA.d)/LIVING_AREA.radiusD);
  const homePad=1-smooth(.7,1.65,radius);
  const top=HOME_HEIGHT+(rolling-hollow)*(1-homePad);
  const shoulder=shoulderDepth(u),fall=smooth(shoulder,shoulder+shoulderWidth(u),d);
  return top*(1-fall)+valleyHeight(u,d)*fall;
}
export interface RidgeControl {u:number;d:number;h:number;w:number}
export interface RidgeDefinition {id:string;name:string;atmosphere:number;flanks?:[number,number];points:RidgeControl[];branches?:RidgeControl[][]}
const p=(u:number,d:number,h:number,w:number):RidgeControl=>({u,d,h,w});
// Eight existing masses, redistributed in depth instead of adding more peaks.
export const RIDGES:RidgeDefinition[]=[
  {id:'west-drift',name:'远层错位长肩',atmosphere:.55,flanks:[.8,1.25],points:[p(-680,3270,-550,95),p(-450,3200,-365,145),p(-330,3150,-395,130),p(-210,3110,-350,150),p(-40,3000,-480,135)],branches:[[p(-450,3200,-365,95),p(-520,3020,-400,115),p(-640,2860,-520,85)],[p(-210,3110,-350,90),p(-160,2930,-430,135),p(-35,2810,-550,90)]]},
  {id:'middle-saddle',name:'中层低脊与西向缓肩',atmosphere:.36,flanks:[1.35,.8],points:[p(-220,2700,-440,100),p(-120,2640,-300,145),p(40,2500,-220,130),p(105,2440,-305,110),p(170,2390,-350,95)],branches:[[p(40,2500,-220,90),p(-35,2370,-275,130),p(-190,2250,-410,145)]]},
  {id:'near-fold',name:'非对称双峰与偏置支脊',atmosphere:.22,flanks:[.75,1.4],points:[p(-40,2380,-310,95),p(75,2300,-220,145),p(190,2160,-105,120),p(245,2090,-185,100),p(315,2020,-130,100),p(395,1960,-240,145),p(500,1850,-420,95)],branches:[[p(190,2160,-105,75),p(130,2020,-140,125),p(55,1850,-280,155),p(-45,1740,-470,115)],[p(315,2020,-130,70),p(365,1870,-175,110),p(470,1710,-350,155)]]},
  {id:'east-spur',name:'右近双峰与不等长坡脚',atmosphere:.13,flanks:[1.45,.7],points:[p(400,1760,-315,90),p(535,1590,5,115),p(615,1650,-105,110),p(690,1710,-75,100),p(810,1640,-210,175),p(1020,1480,-440,110)],branches:[[p(535,1590,5,70),p(490,1480,-70,110),p(395,1350,-250,160),p(320,1200,-470,100)],[p(690,1710,-75,65),p(735,1480,-155,120),p(880,1260,-385,155)]]},
  {id:'quiet-islet',name:'极远小尺度山岛',atmosphere:.72,flanks:[.8,1.4],points:[p(120,3750,-640,70),p(230,3700,-535,85),p(295,3680,-565,70),p(385,3590,-650,75)]},
  {id:'east-low',name:'右侧退后低肩',atmosphere:.54,flanks:[.75,1.5],points:[p(410,3050,-480,90),p(510,2960,-335,115),p(600,2900,-385,110),p(760,2810,-490,95)],branches:[[p(510,2960,-335,60),p(460,2800,-400,115),p(350,2700,-520,90)]]},
  {id:'horizon-west',name:'极远西岭',atmosphere:.76,points:[p(-1100,4700,-840,160),p(-780,4760,-780,180),p(-590,4730,-760,150),p(-390,4800,-800,170),p(-90,4780,-765,150),p(150,4820,-840,140)]},
  {id:'horizon-east',name:'极远东岭',atmosphere:.84,points:[p(-120,4880,-860,160),p(180,4820,-815,180),p(450,4860,-850,180),p(760,4800,-810,170),p(1100,4900,-880,130)]},
];
export interface FieldDefinition {id:string; corners:[number,number][]; color:number; nearBend:number; farBend:number; sideBend:number}
export const FIELDS:FieldDefinition[]=[
  {id:'tractor-plot',color:0,corners:[[-1080,185],[-190,-70],[-190,155],[-1080,585]],nearBend:-20,farBend:25,sideBend:15},
  {id:'lower-plot',color:1,corners:[[-1080,-620],[-420,-370],[-395,-145],[-1080,-325]],nearBend:-30,farBend:15,sideBend:10},
  {id:'east-plot',color:2,corners:[[-970,630],[315,-35],[350,70],[-970,750]],nearBend:18,farBend:25,sideBend:10},
];
export function fieldPoint(field:FieldDefinition,s:number,t:number) {
  const [a,b,c,e]=field.corners;
  const u=(1-t)*(a[0]*(1-s)+b[0]*s)+t*(e[0]*(1-s)+c[0]*s)+field.sideBend*Math.sin(t*Math.PI)*(2*s-1);
  const d=(1-t)*(a[1]*(1-s)+b[1]*s)+t*(e[1]*(1-s)+c[1]*s)+Math.sin(s*Math.PI)*((1-t)*field.nearBend+t*field.farBend);
  return {u,d,h:groundHeight(u,d)};
}
export const WALK_ROUTE=[{u:LIVING_AREA.u,d:LIVING_AREA.d},{u:-140,d:-160},{u:-300,d:-90},{u:-440,d:10},{u:-530,d:100}];
export const GROUND_GRID={minU:-2600,width:5200,minD:-1900,depth:7700,cols:200,rows:300};
export function renderedGroundHeight(u:number,d:number) {
  const g=GROUND_GRID,x=(u-g.minU)/g.width*g.cols,z=(d-g.minD)/g.depth*g.rows;
  const ix=Math.max(0,Math.min(g.cols-1,Math.floor(x))),iz=Math.max(0,Math.min(g.rows-1,Math.floor(z)));
  const fx=x-ix,fz=z-iz,du=g.width/g.cols,dd=g.depth/g.rows;
  const u0=g.minU+ix*du,d0=g.minD+iz*dd;
  const a=groundHeight(u0,d0),b=groundHeight(u0+du,d0),c=groundHeight(u0,d0+dd),e=groundHeight(u0+du,d0+dd);
  return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:e+(c-e)*(1-fx)+(b-e)*(1-fz);
}
