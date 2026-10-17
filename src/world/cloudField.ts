import { Color, Vector3 } from 'three';
import { smooth, valleyHeight } from '../terrain/layout';

const fract=(x:number)=>x-Math.floor(x);
const random=(n:number)=>fract(Math.sin(n*127.1+311.7)*43758.5453123);
// Fixed, staggered clusters with several sizes. No time, particles or textures.
export const CLOUD_BILLOWS=Array.from({length:21*27},(_,i)=>{
  const row=Math.floor(i/27),col=i%27,r=random(i+7);
  const d=650+row*190+(random(i+110)-.5)*130;
  const scale=1-.3*smooth(1000,4400,d);
  return {u:-2700+col*210+(row%2)*100+(r-.5)*160,d,ru:(90+random(i+36)*110)*scale,rd:125+random(i+71)*125,h:(34+random(i+19)*48)*scale};
});
const buckets=new Map<number,typeof CLOUD_BILLOWS>();
for(const puff of CLOUD_BILLOWS){
  for(let row=Math.floor((puff.d-puff.rd*1.5)/240);row<=Math.floor((puff.d+puff.rd*1.5)/240);row++){
    const bucket=buckets.get(row)??[];bucket.push(puff);buckets.set(row,bucket);
  }
}
export function cloudBase(d:number) {return -220-.18*Math.max(0,d-1600)-.08*Math.max(0,d-3400);}
export function cloudHeight(u:number,d:number) {
  let relief=0;
  for(const puff of buckets.get(Math.floor(d/240))??[]){
    const r2=((u-puff.u)/puff.ru)**2+((d-puff.d)/puff.rd)**2;
    if(r2>2.25)continue;
    const dome=puff.h*Math.exp(-r2*1.9);
    const blend=Math.max(0,1-Math.abs(relief-dome)/16);
    relief=Math.max(relief,dome)+blend*blend*4;
  }
  const corridor=58*Math.exp(-(((u-160)/550)**2)-((d-2700)/480)**2);
  const nearGap=52*Math.exp(-(((u-600)/350)**2)-((d-2250)/420)**2);
  const surface=cloudBase(d)+relief-corridor-nearGap+8*Math.sin(u/330+d/510)*Math.sin(d/470-u/630);
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

