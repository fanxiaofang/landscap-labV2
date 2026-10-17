import { Color, Vector3 } from 'three';
import { smooth, valleyHeight } from '../terrain/layout';

interface CloudMass {u:number;d:number;ru:number;rd:number;h:number;angle?:number}
// Six broad, unequal cloud regions organize the basin. Open corridors between
// them are intentionally quiet; detail is confined to a few bank edges.
export const CLOUD_REGIONS:CloudMass[]=[
  {u:-700,d:2670,ru:610,rd:460,h:48,angle:-.35},
  {u:700,d:1860,ru:690,rd:420,h:65,angle:.27},
  {u:-580,d:1120,ru:900,rd:430,h:46,angle:-.18},
  {u:1040,d:2980,ru:660,rd:650,h:52,angle:-.48},
  {u:-80,d:4040,ru:1080,rd:470,h:44,angle:.12},
  {u:-1440,d:3380,ru:640,rd:720,h:43,angle:.30},
];
// Local billows only, clustered at selected banks; no rows, columns or tiled seed.
export const CLOUD_BILLOWS:CloudMass[]=[
  // Broken west bank, with a quiet central channel beyond it.
  {u:-810,d:2920,ru:160,rd:185,h:36},
  {u:-630,d:3000,ru:115,rd:155,h:42},
  {u:-450,d:2790,ru:140,rd:175,h:31},
  {u:-950,d:3100,ru:125,rd:160,h:27},
  {u:-710,d:2660,ru:180,rd:150,h:26},
  {u:-340,d:2730,ru:85,rd:120,h:29},
  // Local central bank wraps a few toes; the rest of the basin stays broad.
  {u:-20,d:2500,ru:155,rd:190,h:34},
  {u:130,d:2410,ru:105,rd:150,h:39},
  {u:260,d:2490,ru:130,rd:140,h:27},
  {u:-160,d:2570,ru:100,rd:140,h:22},
  // A denser edge to the large right bank, irregular in depth and scale.
  {u:400,d:2140,ru:160,rd:175,h:49},
  {u:580,d:2240,ru:115,rd:150,h:46},
  {u:710,d:2130,ru:150,rd:165,h:38},
  {u:850,d:2290,ru:120,rd:150,h:41},
  {u:1010,d:2190,ru:185,rd:210,h:29},
  {u:660,d:1950,ru:125,rd:190,h:35},
  {u:1140,d:2880,ru:190,rd:240,h:29},
  {u:850,d:3050,ru:140,rd:210,h:23},
  {u:1280,d:3180,ru:200,rd:190,h:30},
  // Two sparse back-bank clusters, separate from the nearer rolled edges.
  {u:-270,d:3330,ru:160,rd:190,h:45},
  {u:-100,d:3410,ru:110,rd:140,h:31},
  {u:300,d:3580,ru:190,rd:220,h:36},
  {u:490,d:3520,ru:120,rd:150,h:25},
  {u:-420,d:3700,ru:160,rd:150,h:13},
  {u:-210,d:3840,ru:130,rd:180,h:17},
  {u:540,d:3660,ru:160,rd:200,h:13},
  {u:-1380,d:3120,ru:200,rd:250,h:24},
  {u:-1120,d:3490,ru:150,rd:170,h:19},
];
const LOCAL_CLOUDS=CLOUD_BILLOWS.map(b=>b.d<3200?{...b,ru:b.ru*.78,rd:b.rd*.8,h:b.h*2.1}:b);
function influence(m:CloudMass,u:number,d:number){
  const c=Math.cos(m.angle??0),s=Math.sin(m.angle??0),x=u-m.u,z=d-m.d;
  const r2=((x*c-z*s)/m.ru)**2+((x*s+z*c)/m.rd)**2;
  return m.h*Math.exp(-r2*1.6);
}
export function cloudBase(d:number) {return -220-.18*Math.max(0,d-1600)-.08*Math.max(0,d-3400);}
export function cloudHeight(u:number,d:number) {
  let relief=0;
  for(const region of CLOUD_REGIONS){
    const height=influence(region,u,d),blend=Math.max(0,1-Math.abs(relief-height)/12);
    relief=Math.max(relief,height)+blend*blend*3;
  }
  for(const billow of LOCAL_CLOUDS)relief+=influence(billow,u,d);
  // A broad, oblique opening separates the main banks without exposing the floor.
  const corridor=28*Math.exp(-(((u+100+(d-2600)*.35)/590)**2)-((d-2680)/700)**2);
  const surface=cloudBase(d)+relief-corridor;
  const far=smooth(4600,5400,d);
  return surface*(1-far)+(valleyHeight(u,d)-50)*far;
}
const light=new Vector3(-.22,.86,-.46).normalize();
export function cloudColor(u:number,d:number,normal?:Vector3) {
  const relief=cloudHeight(u,d)-cloudBase(d),n=normal??new Vector3(0,1,0);
  const lit=Math.max(0,n.dot(light));
  const c=new Color('#c19bab').lerp(new Color('#ffe2b6'),smooth(.35,.97,lit)*.7+smooth(5,78,relief)*.24);
  c.lerp(new Color('#f4ccaa'),smooth(2600,4700,d)*.35);
  return c;
}
