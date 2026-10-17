export const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
export const smooth=(a:number,b:number,v:number)=>{const t=clamp01((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const bump=(u:number,d:number,x:number,z:number,rx:number,rz:number)=>Math.exp(-(((u-x)/rx)**2)-((d-z)/rz)**2);
export const HOME_HEIGHT=200;
export const LIVING_AREA={u:70,d:-240,radiusU:270,radiusD:290};
export function valleyHeight(u:number,d:number) {
  // A winding basin with overlapping shoulders. It remains inspectable with clouds off.
  const channel=u-170-200*Math.sin((d-900)/850);
  return -450-.000075*Math.max(0,d-1900)**2-.00012*Math.max(0,d-3600)**2
    -80*Math.exp(-((channel/340)**2))*bump(0,d,0,2100,1,1300)
    +110*bump(u,d,-580,1700,480,800)+75*bump(u,d,670,2300,450,780)
    +45*bump(u,d,-150,3400,650,650);
}
export function shoulderDepth(u:number) {
  // Reference-led diagonal: the left farming shoulder recedes, the right bank comes forward.
  return -65-.45*u+70*Math.sin((u+160)/210)+110*bump(u,0,-800,0,400,1)+70*bump(u,0,-420,0,420,1)-65*bump(u,0,580,0,290,1);
}
export function shoulderWidth(u:number) {return 1450+110*bump(u,0,-600,0,500,1);}
export function groundHeight(u:number,d:number) {
  const hollow=37*bump(u,d,-490,20,400,520)+20*bump(u,d,600,-350,340,400);
  const rolling=33*bump(u,d,-470,-800,520,400)+25*bump(u,d,480,-1040,430,430)-20*bump(u,d,150,-650,300,320);
  const radius=Math.hypot((u-LIVING_AREA.u)/LIVING_AREA.radiusU,(d-LIVING_AREA.d)/LIVING_AREA.radiusD);
  const homePad=1-smooth(.7,1.65,radius);
  const top=HOME_HEIGHT+(rolling-hollow)*(1-homePad);
  const shoulder=shoulderDepth(u),fall=.22*smooth(shoulder,shoulder+800,d)+.78*smooth(shoulder+700,shoulder+shoulderWidth(u),d);
  return top*(1-fall)+valleyHeight(u,d)*fall;
}
export interface RidgeControl {u:number;d:number;h:number;w:number}
export interface RidgeDefinition {id:string;name:string;atmosphere:number;flanks?:[number,number];points:RidgeControl[];branches?:RidgeControl[][]}
const p=(u:number,d:number,h:number,w:number):RidgeControl=>({u,d,h,w});
// One shared vocabulary from all five references: unequal twin peaks, shoulders,
// a genuinely lower saddle, branching toes and staggered basin-sized gaps.
export const RIDGES:RidgeDefinition[]=[
  {id:'west-drift',name:'远层：展开的双峰长肩',atmosphere:.52,flanks:[.9,1.2],points:[p(-900,3360,-570,150),p(-710,3320,-495,220),p(-550,3250,-415,280),p(-435,3180,-460,230),p(-320,3220,-435,240),p(-140,3100,-560,175)],branches:[[p(-550,3250,-415,160),p(-590,3070,-405,165),p(-760,2900,-490,200),p(-880,2720,-550,150)],[p(-320,3220,-435,140),p(-260,3060,-460,150),p(-100,2870,-530,180)]]},
  {id:'middle-saddle',name:'中层：低峰与斜向长支脊',atmosphere:.34,flanks:[1.15,.8],points:[p(-430,2660,-530,140),p(-255,2630,-385,185),p(-125,2540,-275,190),p(-50,2500,-320,150),p(20,2450,-340,180),p(90,2320,-455,190)],branches:[[p(-125,2540,-275,90),p(-205,2400,-340,150),p(-375,2220,-420,220),p(-500,2110,-480,170)]]},
  {id:'near-fold',name:'中央：主峰、鞍部、低次峰与三条支脊',atmosphere:.18,flanks:[.92,1.25],points:[p(-45,2440,-440,160),p(100,2330,-305,260),p(165,2310,-220,300),p(195,2290,-210,310),p(235,2280,-224,290),p(280,2230,-258,220),p(350,2160,-235,180),p(440,2080,-320,205),p(560,1970,-450,210)],branches:[[p(180,2290,-210,180),p(150,2150,-275,215),p(75,1990,-320,190),p(-55,1850,-420,245),p(-155,1750,-480,180)],[p(350,2160,-235,95),p(350,2010,-300,150),p(430,1840,-395,225),p(540,1730,-460,170)],[p(150,2150,-275,140),p(220,2010,-330,130),p(205,1830,-430,160)]]},
  {id:'east-spur',name:'右近：宽主峰与错位次峰',atmosphere:.08,flanks:[1.3,.85],points:[p(400,1820,-380,150),p(505,1750,-180,200),p(545,1700,-74,310),p(575,1670,-55,325),p(610,1650,-78,300),p(665,1630,-185,230),p(755,1650,-150,280),p(850,1540,-270,220),p(1060,1420,-440,190)],branches:[[p(560,1670,-55,175),p(510,1550,-140,230),p(425,1400,-280,220),p(270,1250,-420,255)],[p(755,1650,-150,100),p(735,1480,-235,175),p(850,1280,-390,240),p(1040,1120,-470,180)],[p(510,1550,-140,90),p(585,1400,-275,130),p(625,1230,-420,180)]]},
  {id:'quiet-islet',name:'极远：低矮小山群',atmosphere:.69,flanks:[.8,1.2],points:[p(-90,3780,-720,100),p(20,3730,-595,130),p(100,3680,-560,120),p(155,3660,-605,110),p(215,3670,-580,115),p(330,3550,-700,120)]},
  {id:'east-low',name:'右后：错位退远山肩',atmosphere:.52,flanks:[.85,1.2],points:[p(390,3180,-610,100),p(500,3120,-485,140),p(595,3080,-420,155),p(680,3000,-465,130),p(780,2960,-435,140),p(950,2830,-580,150)],branches:[[p(595,3080,-420,75),p(530,2900,-485,130),p(380,2750,-560,160)]]},
  {id:'horizon-west',name:'极远西岭',atmosphere:.76,points:[p(-1300,4700,-900,180),p(-940,4760,-820,210),p(-780,4730,-785,175),p(-590,4800,-830,180),p(-390,4780,-790,160),p(-170,4820,-880,150)]},
  {id:'horizon-east',name:'极远东岭',atmosphere:.84,points:[p(-200,4880,-920,170),p(80,4820,-860,190),p(300,4860,-885,200),p(530,4800,-845,180),p(730,4900,-880,160),p(1100,4900,-930,170)]},
];
// Preserve the screen silhouette while moving each complete landform away from
// the meadow: this reveals real valley floor, rather than hiding oversized bases.
for(const ridge of RIDGES){
  const retreat=ridge.id==='near-fold'?400:ridge.id==='middle-saddle'?300:ridge.id==='east-spur'?530:0;
  if(!retreat)continue;
  for(const point of [ridge.points,...(ridge.branches??[])].flat()){
    point.d+=retreat;point.h-=retreat*(77/272)/Math.sqrt(1-(77/272)**2);
  }
}
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
