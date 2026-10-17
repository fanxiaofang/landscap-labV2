export const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
export const smooth=(a:number,b:number,v:number)=>{const t=clamp01((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const bump=(u:number,d:number,x:number,z:number,rx:number,rz:number)=>Math.exp(-(((u-x)/rx)**2)-((d-z)/rz)**2);
export const HOME_HEIGHT=200;
export function valleyHeight(u:number,d:number) {
  // The remote floor rolls below the sightline. Its mesh boundary cannot become a flat skyline.
  const farReturn=.00022*Math.max(0,d-4100)**2;
  return -440 - 0.16*Math.max(0,d-2300)*smooth(2300,2600,d)-farReturn
    +20*bump(u,d,-350,2800,700,1000)-16*bump(u,d,480,2200,500,620)
    +18*bump(u,d,80,4400,500,700)-9*bump(u,d,-450,4400,300,700);
}
export function shoulderDepth(u:number) {
  // A west farming arm opens into a recessed overlook, then a low eastern shoulder.
  // This outline is authored before placing any of the SVG assets.
  return 60+700*(1-smooth(-420,20,u))+110*bump(u,0,430,0,240,1)-95*bump(u,0,130,0,160,1);
}
export function shoulderWidth(u:number) {return 1120+340*(1-smooth(-600,-220,u));}
// One continuous surface, shared by meadow, farm, and the descending valley apron.
export function groundHeight(u:number,d:number) {
  const left=1-smooth(-850,100,u);
  const farmDescent=104*left*smooth(-160,1230,d);
  const rolling=26*bump(u,d,-490,-490,270,420)-19*bump(u,d,470,-730,340,470)+31*bump(u,d,-120,-1120,420,370);
  // Keep a quiet, stable pad under the house; let the outer pasture rise and dip.
  const homePad=bump(u,d,35,-280,250,230);
  const top=HOME_HEIGHT-farmDescent+rolling*(1-homePad);
  const shoulder=shoulderDepth(u);
  const fall=smooth(shoulder,shoulder+shoulderWidth(u),d);
  return top*(1-fall)+valleyHeight(u,d)*fall;
}

export interface RidgeControl {u:number;d:number;h:number;w:number}
export interface RidgeDefinition {id:string;name:string;atmosphere:number;points:RidgeControl[];branches?:RidgeControl[][]}
const p=(u:number,d:number,h:number,w:number):RidgeControl=>({u,d,h,w});
// Each crest is authored individually. No random seed, sine hill repetition, or cone primitives.
export const RIDGES:RidgeDefinition[]=[
  {id:'west-drift',name:'西侧远肩',atmosphere:.60,points:[p(-740,3260,-580,65),p(-580,3280,-510,95),p(-465,3240,-470,110),p(-405,3280,-495,95),p(-305,3370,-545,90),p(-220,3450,-625,50)],branches:[[p(-465,3240,-470,80),p(-400,3140,-520,75),p(-290,3060,-570,50)]]},
  {id:'middle-saddle',name:'中谷低鞍',atmosphere:.52,points:[p(-310,2990,-545,50),p(-230,3080,-490,80),p(-145,3150,-455,90),p(-70,3130,-485,80),p(40,3220,-585,40)],branches:[[p(-145,3150,-455,65),p(-165,3000,-510,75),p(-260,2920,-550,50)]]},
  {id:'near-fold',name:'谷中折脊',atmosphere:.34,points:[p(65,3050,-565,35),p(130,3140,-525,50),p(180,3200,-485,65),p(205,3220,-495,70),p(245,3250,-525,70),p(300,3290,-565,50),p(355,3380,-620,30)],branches:[[p(180,3200,-485,45),p(220,3080,-535,50),p(275,3010,-560,30)],[p(180,3200,-485,45),p(120,3290,-560,50),p(60,3340,-610,30)]]},
  {id:'east-spur',name:'东侧独立支脊',atmosphere:.41,points:[p(365,2830,-530,35),p(435,2940,-485,50),p(480,3030,-445,65),p(520,3060,-475,70),p(580,3130,-520,70),p(675,3210,-590,35)],branches:[[p(480,3030,-445,45),p(525,2910,-510,50),p(600,2850,-530,35)]]},
  {id:'quiet-islet',name:'远谷偏西余脉',atmosphere:.73,points:[p(-240,3690,-670,45),p(-120,3710,-600,75),p(-20,3780,-620,85),p(110,3850,-690,40)]},
  {id:'east-low',name:'远谷横肩',atmosphere:.72,points:[p(260,3560,-645,45),p(350,3600,-570,90),p(460,3680,-605,95),p(560,3760,-690,40)]},
  {id:'horizon-west',name:'极远西岭',atmosphere:.88,points:[p(-1100,4200,-790,90),p(-800,4240,-740,120),p(-570,4210,-710,110),p(-360,4320,-760,130),p(-100,4350,-775,100),p(150,4370,-800,70)]},
  {id:'horizon-east',name:'极远东岭',atmosphere:.90,points:[p(-160,4370,-800,80),p(70,4290,-750,120),p(280,4350,-770,110),p(490,4300,-750,130),p(800,4400,-800,80)]},
];

// Curved field parcels occupy only the west approach. Each vertex uses the terrain sampler.
export interface FieldDefinition {id:string; corners:[number,number][]; color:number}
export const FIELDS:FieldDefinition[]=[
  {id:'lower-plot',color:0,corners:[[-940,-50],[-295,105],[-280,240],[-900,120]]},
  {id:'tractor-plot',color:1,corners:[[-900,145],[-290,265],[-310,440],[-860,325]]},
  {id:'middle-plot',color:2,corners:[[-860,355],[-325,470],[-390,590],[-830,530]]},
  {id:'upper-plot',color:3,corners:[[-820,560],[-410,615],[-470,735],[-810,700]]},
];
export function fieldPoint(field:FieldDefinition,s:number,t:number) {
  const [a,b,c,e]=field.corners;
  const u=(1-t)*(a[0]*(1-s)+b[0]*s)+t*(e[0]*(1-s)+c[0]*s)+14*Math.sin(t*Math.PI)*s;
  const d=(1-t)*(a[1]*(1-s)+b[1]*s)+t*(e[1]*(1-s)+c[1]*s)+65*Math.sin(s*Math.PI)*(1-.35*t);
  return {u,d,h:groundHeight(u,d)};
}
export const WALK_ROUTE=[{u:35,d:-280},{u:-170,d:-130},{u:-260,d:100},{u:-320,d:330},{u:-470,d:690}];

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
