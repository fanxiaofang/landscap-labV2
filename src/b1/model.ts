import {BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial} from 'three';
import {worldPoint} from '../world/projection';

/** A swept ridge: plan, crest height, front apron and back shoulder are separate controls.
 * No V0.8 heightfield is imported here. Each loft is a closed, independently editable mass.
 * Toes return to the floodplain datum with zero cross-slope; the valley overlaps
 * them by two units so shell edges remain buried during camera movement.
 */
export type Station={u:number;d:number;h:number;front:number;back:number};
export type Landform={id:string;layer:'mid'|'far1'|'far2'|'far3';color:string;stations:Station[]};
const s=(u:number,d:number,h:number,front:number,back:number):Station=>({u,d,h,front,back});
// Separate plan, height and apron controls; split layers leave the valley mouth open.
export const LANDFORMS:Landform[]=[
 {id:'west-open-shoulder',layer:'mid',color:'#8d9b4b',stations:[s(-1750,800,0,440,240),s(-1020,850,58,450,260),s(-430,870,182,570,270),s(-170,860,100,480,240),s(65,980,0,240,180)]},
 {id:'east-valley-shoulder',layer:'mid',color:'#8d9b4b',stations:[s(220,1110,0,180,150),s(460,1000,115,400,240),s(700,990,128,460,270),s(1100,1080,80,400,250),s(1640,1110,0,280,180)]},
 {id:'east-near-fold',layer:'mid',color:'#8d9b4b',stations:[s(500,360,0,220,200),s(810,410,130,470,240),s(1120,520,172,500,300),s(1500,460,100,420,260),s(1940,510,0,300,220)]},
 {id:'outer-dales',layer:'far3',color:'#9aabb3',stations:[s(-2600,1590,0,280,170),s(-1450,1560,95,350,180),s(-870,1570,130,320,175),s(-360,1590,48,280,150),s(80,1550,115,350,180),s(580,1600,53,280,170),s(1150,1560,118,350,190),s(1820,1580,80,320,160),s(2600,1600,0,270,150)]},
 {id:'western-distant-dale',layer:'far2',color:'#829b9c',stations:[s(-2300,1370,0,230,160),s(-1100,1370,72,290,170),s(-320,1340,145,340,190),s(-80,1400,45,240,150),s(50,1450,0,150,130)]},
 {id:'eastern-distant-dale',layer:'far2',color:'#829b9c',stations:[s(240,1450,0,150,130),s(670,1390,124,320,175),s(1080,1350,100,320,170),s(1510,1420,60,240,150),s(2400,1390,0,200,150)]},
 {id:'west-low-ridge',layer:'far1',color:'#748e83',stations:[s(-2300,1150,0,240,150),s(-1190,1130,80,300,170),s(-650,1180,142,340,180),s(-400,1240,68,290,150),s(-150,1300,0,190,140)]},
 {id:'east-low-ridge',layer:'far1',color:'#748e83',stations:[s(270,1300,0,180,140),s(520,1190,110,300,180),s(870,1160,135,320,190),s(1320,1230,60,290,150),s(2350,1250,0,220,140)]},
];

export const floorHeight=(u:number,d:number)=>46+.016*d+3*Math.sin(u/540+d/620);
export function interpolate<T extends Record<string,number>>(points:T[],t:number):T {
 const f=Math.max(0,Math.min(1,t))*(points.length-1),i=Math.min(points.length-2,Math.floor(f)),v=f-i;
 const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
 const out={} as T;
 for(const key of Object.keys(b) as (keyof T)[])out[key]=(.5*((2*b[key])+(-a[key]+c[key])*v+(2*a[key]-5*b[key]+4*c[key]-d[key])*v*v+(-a[key]+3*b[key]-3*c[key]+d[key])*v*v*v)) as T[keyof T];
 return out;
}
export function ridgePoint(def:Landform,t:number,cross:number) {
 const p=interpolate(def.stations,t),r=Math.abs(cross),endWidth=.025+.975*Math.pow(Math.sin(t*Math.PI),.5),depth=(cross<0?p.front:p.back)*endWidth;
 // Wide cosine shoulders have horizontal tangents at crest and toe. The plan
 // bends across the apron, giving the front slope broad spurs, not cones.
 const d=p.d+cross*depth;
 const u=p.u+Math.sin(t*Math.PI)*Math.sin(t*8.3+.5)*r*r*65;
 const envelope=Math.pow(Math.cos(r*Math.PI/2),2);
 const end=Math.min(1,t/.14,(1-t)/.14),taper=end*end*(3-2*end);
 const h=floorHeight(u,d)+Math.max(0,p.h)*taper*envelope*(1+.055*Math.sin(t*17+cross*3)*Math.sin(r*Math.PI));
 return {u,d,h};
}
function surface(cols:number,rows:number,point:(s:number,t:number)=>{u:number;d:number;h:number},color:string,closed=false) {
 const positions:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const p=point(i/cols,j/rows);positions.push(...worldPoint(p.u,p.d,p.h).toArray());
  // Albedo only: never bake normal/light into vertex colours.
  const wash=.026*Math.sin(p.u/175+p.d/230)*Math.cos(p.d/210-p.u/380);
  const c=new Color(color).multiplyScalar(1+wash);colors.push(...c.toArray());uv.push(p.u/350,p.d/350);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,e=c+1;indices.push(a,b,c,b,e,c);}
 if(closed){
  // A closed underside makes free inspection honest. The perimeter positions
  // coincide across smoothing groups; the base is never a target-view backdrop.
  const edge:number[]=[];
  for(let i=0;i<=cols;i++)edge.push(i);
  for(let j=1;j<=rows;j++)edge.push(j*(cols+1)+cols);
  for(let i=cols-1;i>=0;i--)edge.push(rows*(cols+1)+i);
  for(let j=rows-1;j>0;j--)edge.push(j*(cols+1));
  // Split the shell's smoothing group at its toe: a vertical underside must
  // never bend the ground normal into a dark outline on the top surface.
  const upper=positions.length/3;
  for(const a of edge){positions.push(...positions.slice(a*3,a*3+3));colors.push(...colors.slice(a*3,a*3+3));uv.push(uv[a*2],uv[a*2+1]);}
  const start=positions.length/3;
  for(const a of edge){positions.push(positions[a*3],-35,positions[a*3+2]);colors.push(...new Color(color).toArray());uv.push(uv[a*2],uv[a*2+1]);}
  let cx=0,cz=0;for(const a of edge){cx+=positions[a*3];cz+=positions[a*3+2];}
  const center=positions.length/3;positions.push(cx/edge.length,-35,cz/edge.length);colors.push(...new Color(color).toArray());uv.push(0,0);
  for(let i=0;i<edge.length;i++){const n=(i+1)%edge.length,a=upper+i,b=upper+n,c=start+i,d=start+n;indices.push(a,c,b,b,c,d,center,d,c);}
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();return g;
}
export const ridgeGeometry=(def:Landform)=>surface(160,64,(s,t)=>ridgePoint(def,s,t*2-1),def.color,true);
const riverKnots=[{u:550,d:-230,w:38},{u:400,d:60,w:32},{u:420,d:310,w:29},{u:180,d:580,w:24},{u:130,d:780,w:20},{u:135,d:1000,w:15},{u:75,d:1240,w:9},{u:70,d:1430,w:4}];
export const riverPoint=(t:number)=>interpolate(riverKnots,t);
export function buildMidFar(){
 const group=new Group();group.name='B1-mid-far-only';
 const add=(name:string,g:BufferGeometry,layer:string)=>{const m=new Mesh(g,new MeshLambertMaterial({vertexColors:true}));m.name=name;m.userData.layer=layer;group.add(m);return m;};
 for(const def of LANDFORMS)add(def.id,ridgeGeometry(def),def.layer);
 // A local floodplain, bounded in front of the hills. This does not contain a
 // home pad, building supports, fields, or the V0.8 foreground heightfield.
 add('open-floodplain',surface(190,150,(s,t)=>{const u=-2700+s*5400,d=-230+t*1710;return {u,d,h:floorHeight(u,d)+2};},'#8d9b4b'),'valley');
 const river=add('river',surface(8,380,(s,t)=>{const p=riverPoint(t),u=p.u+(s-.5)*2*p.w;return {u,d:p.d,h:floorHeight(u,p.d)+2.7};},'#a5c7bf'),'water');
 const banks=add('river-soft-banks',surface(12,380,(s,t)=>{const p=riverPoint(t),u=p.u+(s-.5)*2*(p.w+7);return {u,d:p.d,h:floorHeight(u,p.d)+2.4};},'#b7b67a'),'water');
 return {group,river,banks};
}
