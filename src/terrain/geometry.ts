import { BufferGeometry, Float32BufferAttribute, Vector3, Color, Mesh, MeshBasicMaterial, Group, CatmullRomCurve3 } from 'three';
import { terrainGeometry } from './ridgeSurface';
export { ridgeGeometry } from './ridgeSurface';
import { worldPoint } from '../world/projection';
import { groundHeight, smooth, bump, FIELDS, fieldPoint, WALK_ROUTE, renderedGroundHeight, riverCenter, riverWidth, riverHeight, riverDistance, RIVER_RANGE } from './layout';

export function indexedSurface(cols:number,rows:number,sample:(s:number,t:number)=>Vector3) {
  const positions:number[]=[],indices:number[]=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)positions.push(...sample(i/cols,j/rows).toArray());
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;indices.push(a,b,c,b,d,c);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function colorize(g:BufferGeometry,color:(p:Vector3,n:Vector3,index:number)=>Color) {
  const pos=g.getAttribute('position'),normals=g.getAttribute('normal'),colors:number[]=[];
  for(let i=0;i<pos.count;i++)colors.push(...color(new Vector3().fromBufferAttribute(pos,i),new Vector3().fromBufferAttribute(normals,i),i).toArray());
  g.setAttribute('color',new Float32BufferAttribute(colors,3));return g;
}
function mesh(name:string,g:BufferGeometry,overlay=false) {
  const m=new Mesh(g,new MeshBasicMaterial({vertexColors:true,polygonOffset:overlay,polygonOffsetFactor:overlay?-2:0,polygonOffsetUnits:overlay?-2:0}));m.name=name;return m;
}
const plan=(v:Vector3)=>({u:(v.x-v.z)*Math.SQRT1_2,d:-(v.x+v.z)*Math.SQRT1_2});
const light=new Vector3(-.45,.86,-.24).normalize();
const mistColor=new Color('#eee1d4');
function thinMist(u:number,d:number,h:number) {
  const low=1-smooth(24,82,h-riverHeight(d));
  return .16*low*(.8*bump(u,d,-560,1240,550,145)+.7*bump(u,d,620,1470,560,170)+.45*bump(u,d,-200,1790,650,90));
}
function withMist(m:Mesh) {
  const g=m.geometry,clear=g.getAttribute('color'),mist=clear.clone(),position=g.getAttribute('position');
  for(let i=0;i<position.count;i++){const p=new Vector3().fromBufferAttribute(position,i),{u,d}=plan(p),c=new Color().fromBufferAttribute(clear,i).lerp(mistColor,thinMist(u,d,p.y));mist.setXYZ(i,c.r,c.g,c.b);}
  m.userData.clearColors=clear;m.userData.cloudColors=mist;return m;
}
function groundColor(u:number,d:number,n:Vector3,h:number) {
  const daylight=Math.max(0,n.dot(light));
  const c=new Color('#718d43').lerp(new Color('#b8bd58'),daylight*.73);
  const wash=.5+.5*Math.sin(u/240+d/180)*Math.cos(d/210-u/630);
  c.lerp(new Color('#a5b550'),.17*wash);
  c.lerp(new Color('#79974c'),.34*bump(u,d,-600,-700,520,480)+.22*bump(u,d,620,-800,480,600));
  c.lerp(new Color('#bdc162'),.3*bump(u,d,100,-250,480,420));
  c.lerp(new Color('#c0b16d'),.17*bump(u,d,-700,470,530,390));
  const slope=1-n.y;
  c.lerp(new Color('#627d51'),smooth(.015,.24,slope)*.22);
  const distance=riverDistance(u,d),width=riverWidth(d);
  const bank=(1-smooth(width+3,width+18,distance))*smooth(210,400,d)*(1-smooth(1820,1930,d));
  c.lerp(new Color('#b6bb80'),bank*.56);
  const riverbed=1-smooth(width*.7,width+2,distance);
  c.lerp(new Color('#728d7b'),riverbed*smooth(210,400,d)*(1-smooth(1820,1930,d))*.48);
  // Atmospheric colour follows physical depth, leaving the low skyline quiet.
  const air=smooth(1030,2100,d);
  const distant=new Color('#718d87').lerp(new Color('#a2a1b9'),smooth(1430,2100,d));
  distant.multiplyScalar(.78+.22*daylight);
  c.lerp(distant,air*.9);
  c.lerp(new Color('#adb3bc'),smooth(1700,2180,d)*.24);
  c.lerp(new Color('#c4bf8b'),.08*bump(u,d,riverCenter(d),1000,230,700)*(1-smooth(25,75,h-riverHeight(d))));
  return c;
}
export function buildTerrain() {
  const g=terrainGeometry(),relief=g.getAttribute('relief'),air=g.getAttribute('atmosphere');
  colorize(g,(p,n,i)=>{
    const {u,d}=plan(p),base=groundColor(u,d,n,p.y),facing=Math.max(0,n.dot(light));
    const hill=new Color('#63834d').lerp(new Color('#b6bd6b'),smooth(.72,.97,facing));
    hill.lerp(new Color('#718d87'),smooth(.12,.46,air.getX(i))*.7);
    hill.lerp(new Color('#929db3'),smooth(.4,.85,air.getX(i))*.83);
    return base.lerp(hill,smooth(4,28,relief.getX(i))*.94);
  });
  return withMist(mesh('continuous-hills-riverbed-meadow',g));
}
export const buildGround=buildTerrain;
export function buildRiver() {
  const g=indexedSurface(12,850,(s,t)=>{
    const d=RIVER_RANGE.near+t*(RIVER_RANGE.far-RIVER_RANGE.near);
    return worldPoint(riverCenter(d)+(s-.5)*2*(riverWidth(d)+28),d,riverHeight(d));
  });
  colorize(g,(p,_n,i)=>{
    const {d}=plan(p),s=(i%13)/12;
    const c=new Color('#70a9a5').lerp(new Color('#d0d0b0'),.26+.22*Math.sin(d/190));
    c.lerp(new Color('#a8c6be'),Math.pow(Math.abs(s-.5)*2,3)*.55);
    c.lerp(new Color('#d7d6bb'),Math.pow(.5+.5*Math.sin(d*.22+s*15),18)*.12);
    return c.lerp(new Color('#adb7b7'),smooth(1350,1930,d)*.5);
  });
  return withMist(mesh('continuous-winding-river',g));
}
export function buildFields() {
  const group=new Group();group.name='slope-following-field-parcels';
  for(const field of FIELDS){
    const cols=88,rows=72;
    const g=indexedSurface(cols,rows,(s,t)=>{const p=fieldPoint(field,s,t);return worldPoint(p.u,p.d,renderedGroundHeight(p.u,p.d)+.36);});
    colorize(g,(p,n,i)=>{
      const s=(i%(cols+1))/cols,t=Math.floor(i/(cols+1))/rows,edge=Math.min(s,1-s,t,1-t),{u,d}=plan(p);
      const variation=.5+.5*Math.sin(s*19+t*7)*Math.cos(t*12-s*3);
      const c=new Color(['#c4ae59','#c0b56e','#b8b67b'][field.color]);
      c.lerp(new Color('#e0c476'),variation*.32).multiplyScalar(.87+.13*Math.max(0,n.dot(light)));
      c.lerp(groundColor(u,d,n,p.y),(1-smooth(0,.075,edge))*.83);
      return c;
    });
    group.add(withMist(mesh(field.id,g,true)));
    for(let k=1;k<field.rows;k++){
      const line=indexedSurface(90,1,(s,t)=>{const p=fieldPoint(field,.035+s*.93,(k+t*.13)/field.rows);return worldPoint(p.u,p.d,renderedGroundHeight(p.u,p.d)+.5);});
      colorize(line,(_p,_n,i)=>new Color('#ac984f').lerp(new Color('#d5bf76'),.3+.3*Math.sin(i*.13)));
      group.add(withMist(mesh(`${field.id}-crop-${k}`,line,true)));
    }
    // Two curved grass divisions in the main field form readable plots, not bands.
    if(field.color===0)for(const k of [.34,.69]){
      const divider=indexedSurface(1,72,(s,t)=>{const p=fieldPoint(field,k+(s-.5)*.012+.018*Math.sin(t*4),t);return worldPoint(p.u,p.d,renderedGroundHeight(p.u,p.d)+.65);});
      colorize(divider,()=>new Color('#929e58'));group.add(mesh('main-plot-grass-division',divider,true));
    }
  }
  return group;
}
export function buildMeadowZones() {
  const group=new Group(),route=new CatmullRomCurve3(WALK_ROUTE.map(p=>new Vector3(p.u,0,p.d)),false,'catmullrom',.3);
  const track=indexedSurface(100,2,(s,t)=>{const p=route.getPoint(s),v=route.getTangent(s),u=p.x-v.z*(t-.5)*5,d=p.z+v.x*(t-.5)*5;return worldPoint(u,d,renderedGroundHeight(u,d)+.5);});
  colorize(track,()=>new Color('#b8bb7d'));group.add(mesh('farm-access-track',track,true));return group;
}
