export const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
export const smooth=(a:number,b:number,v:number)=>{const t=clamp01((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const bump=(u:number,d:number,x:number,z:number,rx:number,rz:number)=>Math.exp(-(((u-x)/rx)**2)-((d-z)/rz)**2);
export const HOME_HEIGHT=200;
// Terrain decisions do not depend on any SVG bounds or original asset coordinates.
export const LIVING_AREA={u:70,d:-190,radiusU:240,radiusD:260};
export function valleyHeight(u:number,d:number) {
  // The remote floor rolls below the sightline. Its mesh boundary cannot become a flat skyline.
  const farReturn=.00022*Math.max(0,d-4100)**2;
  return -440 - 0.16*Math.max(0,d-2300)*smooth(2300,2600,d)-farReturn
    +25*bump(u,d,-350,2800,700,1000)-27*bump(u,d,380,2450,430,850)
    +18*bump(u,d,80,4400,500,700)-9*bump(u,d,-450,4400,300,700);
}
export function shoulderDepth(u:number) {
  // A broad central headland, with both flanks receding into the near meadow.
  // No long western arm: that shape projected as a separate elevated farm hill.
  return -160+175*bump(u,0,70,0,380,1)-155*bump(u,0,-520,0,350,1)+65*bump(u,0,620,0,300,1);
}
export function shoulderWidth(u:number) {return 1270+100*bump(u,0,-500,0,500,1);}
// One continuous surface, shared by meadow, farm, and the descending valley apron.
export function groundHeight(u:number,d:number) {
  const hollow=44*bump(u,d,-470,-380,370,600)+25*bump(u,d,580,-230,320,440);
  const rolling=27*bump(u,d,-100,-1100,420,430)+19*bump(u,d,-720,-920,300,460)-16*bump(u,d,450,-870,330,460);
  const radius=Math.hypot((u-LIVING_AREA.u)/LIVING_AREA.radiusU,(d-LIVING_AREA.d)/LIVING_AREA.radiusD);
  const homePad=1-smooth(.65,1.6,radius);
  const top=HOME_HEIGHT+(rolling-hollow)*(1-homePad);
  const shoulder=shoulderDepth(u);
  const fall=smooth(shoulder,shoulder+shoulderWidth(u),d);
  return top*(1-fall)+valleyHeight(u,d)*fall;
}

export interface RidgeControl {u:number;d:number;h:number;w:number}
export interface RidgeDefinition {id:string;name:string;atmosphere:number;points:RidgeControl[];branches?:RidgeControl[][]}
const p=(u:number,d:number,h:number,w:number):RidgeControl=>({u,d,h,w});
// Each crest is authored individually. No random seed, sine hill repetition, or cone primitives.
export const RIDGES:RidgeDefinition[]=[
  {id:'west-drift',name:'西侧叠肩群',atmosphere:.59,points:[p(-800,3480,-630,55),p(-640,3490,-570,100),p(-530,3450,-510,115),p(-445,3500,-565,100),p(-370,3590,-545,95),p(-275,3680,-610,85),p(-150,3780,-685,45)],branches:[[p(-530,3450,-510,90),p(-480,3290,-545,110),p(-330,3130,-565,95),p(-200,3040,-575,45)]]},
  {id:'middle-saddle',name:'西谷近层低脊',atmosphere:.34,points:[p(-730,2740,-505,40),p(-585,2810,-460,80),p(-485,2900,-390,100),p(-410,2940,-435,95),p(-335,3060,-465,105),p(-230,3150,-555,50)],branches:[[p(-485,2900,-390,65),p(-430,2770,-440,80),p(-320,2650,-485,45)]]},
  {id:'near-fold',name:'主峰与错落缓肩',atmosphere:.35,points:[p(0,3330,-605,50),p(100,3290,-555,70),p(180,3200,-445,90),p(240,3280,-565,85),p(310,3360,-550,120),p(390,3430,-605,110),p(470,3520,-650,85),p(590,3650,-710,45)],branches:[[p(180,3200,-445,60),p(120,3090,-505,90),p(70,2960,-530,105),p(-55,2870,-545,45)],[p(310,3360,-550,70),p(365,3200,-555,105),p(430,3070,-570,55)]]},
  {id:'east-spur',name:'东谷退入长肩',atmosphere:.49,points:[p(520,3070,-560,45),p(660,3170,-515,90),p(745,3260,-475,115),p(825,3330,-535,110),p(960,3420,-575,110),p(1130,3540,-645,50)],branches:[[p(745,3260,-475,80),p(670,3060,-530,100),p(580,2910,-550,45)]]},
  {id:'quiet-islet',name:'远谷偏置低丘',atmosphere:.76,points:[p(-270,3910,-710,45),p(-120,3920,-655,75),p(-15,3980,-690,80),p(110,4040,-745,40)]},
  {id:'east-low',name:'后层宽鞍',atmosphere:.72,points:[p(250,3820,-685,45),p(350,3790,-605,90),p(470,3860,-650,85),p(580,3970,-720,40)]},
  {id:'horizon-west',name:'极远西岭',atmosphere:.88,points:[p(-1100,4200,-790,90),p(-800,4240,-740,120),p(-570,4210,-710,110),p(-360,4320,-760,130),p(-100,4350,-775,100),p(150,4370,-800,70)]},
  {id:'horizon-east',name:'极远东岭',atmosphere:.90,points:[p(-160,4370,-800,80),p(70,4290,-750,120),p(280,4350,-770,110),p(490,4300,-750,130),p(800,4400,-800,80)]},
];

// Unequal parcels interleave with grassy swales on both flanks of the living meadow.
export interface FieldDefinition {id:string; corners:[number,number][]; color:number; nearBend:number; farBend:number; sideBend:number}
export const FIELDS:FieldDefinition[]=[
  {id:'tractor-plot',color:0,corners:[[-500,-435],[-230,-350],[-270,-170],[-550,-250]],nearBend:-40,farBend:25,sideBend:16},
  {id:'lower-plot',color:1,corners:[[-650,-900],[-340,-790],[-365,-620],[-680,-720]],nearBend:-45,farBend:40,sideBend:-22},
  {id:'east-plot',color:2,corners:[[365,-380],[630,-310],[580,-70],[390,-160]],nearBend:45,farBend:-30,sideBend:35},
];
export function fieldPoint(field:FieldDefinition,s:number,t:number) {
  const [a,b,c,e]=field.corners;
  const u=(1-t)*(a[0]*(1-s)+b[0]*s)+t*(e[0]*(1-s)+c[0]*s)+field.sideBend*Math.sin(t*Math.PI)*(2*s-1);
  const d=(1-t)*(a[1]*(1-s)+b[1]*s)+t*(e[1]*(1-s)+c[1]*s)+Math.sin(s*Math.PI)*((1-t)*field.nearBend+t*field.farBend);
  return {u,d,h:groundHeight(u,d)};
}
export const WALK_ROUTE=[{u:LIVING_AREA.u,d:LIVING_AREA.d},{u:-110,d:-300},{u:-245,d:-455},{u:-380,d:-475},{u:-490,d:-420}];

export const GROUND_GRID={minU:-2400,width:4800,minD:-1800,depth:7400,cols:160,rows:255};
/** Height on the actual piecewise-linear rendered ground, for attachment diagnostics. */
export function renderedGroundHeight(u:number,d:number) {
  const g=GROUND_GRID,x=(u-g.minU)/g.width*g.cols,z=(d-g.minD)/g.depth*g.rows;
  const ix=Math.max(0,Math.min(g.cols-1,Math.floor(x))),iz=Math.max(0,Math.min(g.rows-1,Math.floor(z)));
  const fx=x-ix,fz=z-iz,du=g.width/g.cols,dd=g.depth/g.rows;
  const u0=g.minU+ix*du,d0=g.minD+iz*dd;
  const a=groundHeight(u0,d0),b=groundHeight(u0+du,d0),c=groundHeight(u0,d0+dd),e=groundHeight(u0+du,d0+dd);
  return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:e+(c-e)*(1-fx)+(b-e)*(1-fz);
}
