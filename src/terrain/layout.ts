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
  // Two unequal promontories and a recessed western valley mouth. This is a
  // terrain boundary, not a straight screen-space band or an asset footprint.
  return 35-.28*u+115*bump(u,0,-700,0,430,1)
    -155*bump(u,0,-260,0,280,1)+85*bump(u,0,220,0,350,1)
    -110*bump(u,0,660,0,350,1);
}
export function shoulderWidth(u:number) {
  return 2160+280*bump(u,0,-280,0,420,1)-180*bump(u,0,600,0,320,1);
}
export function groundHeight(u:number,d:number) {
  const rolling=85*bump(u,d,-630,-610,520,460)
    +70*bump(u,d,530,-870,500,560)+24*bump(u,d,120,-1240,720,430)
    -55*bump(u,d,-260,-610,270,490)-30*bump(u,d,650,-260,330,390);
  const radius=Math.hypot((u-LIVING_AREA.u)/LIVING_AREA.radiusU,(d-LIVING_AREA.d)/LIVING_AREA.radiusD);
  const homePad=1-smooth(.65,1.5,radius);
  const valleyMouth=125*bump(u,d,-360,230,260,840)+55*bump(u,d,720,320,320,650);
  const top=HOME_HEIGHT+(rolling-valleyMouth)*(1-homePad);
  const shoulder=shoulderDepth(u),width=shoulderWidth(u);
  // A broad upper shoulder flows into an unequal lower apron. The hollow
  // between them opens a valley mouth; only the small living area stays level.
  const fall=.44*smooth(shoulder-250,shoulder+width*.66,d)
    +.56*smooth(shoulder+380,shoulder+width,d);
  const apron=45*bump(u,d,-640,1200,380,700)
    +32*bump(u,d,530,950,300,600)-38*bump(u,d,-200,1100,220,720);
  return top*(1-fall)+valleyHeight(u,d)*fall+apron*fall*(1-fall)*4;
}
export interface RidgeControl {u:number;d:number;h:number;w:number}
export interface RidgeDefinition {id:string;name:string;atmosphere:number;flanks?:[number,number];points:RidgeControl[];branches?:RidgeControl[][]}
const p=(u:number,d:number,h:number,w:number):RidgeControl=>({u,d,h,w});
// V0.7: authored world-space crests, not uniformly scaled V0.5 silhouettes.
// Long descending branches share their parent's shoulder and end at the basin.
export const RIDGES:RidgeDefinition[]=[
  {id:'west-drift',name:'西远群：错峰与展开长肩',atmosphere:.52,flanks:[.9,1.22],points:[
    p(-1220,3460,-650,190),p(-940,3520,-570,260),p(-690,3500,-535,260),
    p(-580,3450,-530,240),p(-455,3350,-550,240),p(-230,3200,-610,240),
  ],branches:[
    [p(-690,3500,-535,200),p(-770,3280,-530,230),p(-970,3000,-540,280),p(-1170,2730,-470,220)],
    [p(-455,3350,-550,150),p(-410,3160,-535,210),p(-520,2930,-525,250)],
  ]},
  {id:'middle-saddle',name:'中西群：低主峰、偏置鞍部与长支脊',atmosphere:.37,flanks:[1.15,.9],points:[
    p(-610,3180,-570,150),p(-400,3220,-510,205),p(-245,3160,-470,225),
    p(-160,3070,-475,200),p(-65,3000,-475,185),p(70,2880,-550,200),
  ],branches:[
    [p(-245,3160,-470,150),p(-330,2920,-445,200),p(-480,2730,-455,250),p(-730,2440,-460,260)],
  ]},
  {id:'near-fold',name:'中央群：主峰、低鞍、次峰与扇形山脚',atmosphere:.21,flanks:[.96,1.2],points:[
    p(-250,2860,-520,170),p(-60,2900,-405,250),p(110,2810,-350,270),
    p(155,2760,-338,280),p(205,2700,-355,260),p(300,2570,-410,240),
    p(385,2540,-365,250),p(490,2410,-425,240),p(710,2250,-500,210),
  ],branches:[
    [p(155,2760,-338,180),p(70,2580,-330,240),p(-80,2360,-380,280),p(-330,2130,-440,310)],
    [p(385,2540,-365,145),p(310,2350,-395,210),p(410,2120,-435,260),p(650,1880,-460,270)],
    [p(70,2580,-330,140),p(70,2380,-385,195),p(-35,2190,-435,230)],
  ]},
  {id:'east-spur',name:'右近群：高主峰、宽肩与低次峰',atmosphere:.12,flanks:[1.22,.88],points:[
    p(310,2440,-480,180),p(485,2390,-340,250),p(640,2260,-205,285),
    p(675,2210,-180,300),p(715,2140,-210,300),p(820,2070,-320,265),
    p(955,2140,-275,280),p(1130,2080,-360,280),p(1370,1840,-455,240),
  ],branches:[
    [p(675,2210,-180,190),p(590,2020,-255,245),p(460,1820,-335,280),p(300,1580,-400,300)],
    [p(955,2140,-275,155),p(930,1910,-325,210),p(1100,1630,-400,300),p(1390,1410,-440,250)],
    [p(590,2020,-255,135),p(680,1830,-340,200),p(700,1620,-415,260)],
  ]},
  {id:'quiet-islet',name:'远中群：低脊与开阔谷地',atmosphere:.7,flanks:[.85,1.25],points:[
    p(-100,4070,-800,130),p(60,4030,-710,160),p(170,4000,-680,170),
    p(250,3910,-730,150),p(355,3880,-700,165),p(540,3740,-760,170),
  ]},
  {id:'east-low',name:'右远群：宽缓后肩',atmosphere:.6,flanks:[.95,1.15],points:[
    p(450,3620,-690,150),p(660,3670,-625,230),p(825,3610,-565,240),
    p(980,3500,-615,220),p(1110,3490,-585,230),p(1390,3270,-650,230),
  ],branches:[
    [p(825,3610,-565,160),p(740,3380,-580,210),p(550,3170,-580,250)],
  ]},
  {id:'horizon-west',name:'极远西岭：低脊、缓肩与东向缺口',atmosphere:.82,flanks:[1,1.1],points:[
    p(-1540,4350,-940,220),p(-1220,4480,-870,250),p(-960,4550,-840,230),
    p(-730,4450,-890,240),p(-520,4390,-855,220),p(-310,4250,-900,180),
  ]},
  {id:'horizon-east',name:'极远东岭：后移的低峰组',atmosphere:.88,flanks:[1.1,.95],points:[
    p(310,4750,-1090,180),p(560,4850,-1040,230),p(800,4820,-990,240),
    p(1030,4700,-1040,220),p(1260,4630,-1000,240),p(1550,4500,-1080,190),
  ]},
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
export const GROUND_GRID={minU:-4200,width:8400,minD:-2600,depth:9500,cols:320,rows:370};
export function renderedGroundHeight(u:number,d:number) {
  const g=GROUND_GRID,x=(u-g.minU)/g.width*g.cols,z=(d-g.minD)/g.depth*g.rows;
  const ix=Math.max(0,Math.min(g.cols-1,Math.floor(x))),iz=Math.max(0,Math.min(g.rows-1,Math.floor(z)));
  const fx=x-ix,fz=z-iz,du=g.width/g.cols,dd=g.depth/g.rows;
  const u0=g.minU+ix*du,d0=g.minD+iz*dd;
  const a=groundHeight(u0,d0),b=groundHeight(u0+du,d0),c=groundHeight(u0,d0+dd),e=groundHeight(u0+du,d0+dd);
  return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:e+(c-e)*(1-fx)+(b-e)*(1-fz);
}
