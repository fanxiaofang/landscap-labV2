import { BufferGeometry, Float32BufferAttribute, Vector3, Color, Mesh, MeshBasicMaterial, Group, CatmullRomCurve3 } from 'three';
import { ridgeGeometry, terrainGeometry } from './ridgeSurface';
export { ridgeGeometry } from './ridgeSurface';
import { cloudHeight, cloudColor } from '../world/cloudField';
import { worldPoint } from '../world/projection';
import { PALETTE } from '../world/environment';
import { groundHeight, valleyHeight, shoulderDepth, smooth, FIELDS, fieldPoint, RIDGES, GROUND_GRID, WALK_ROUTE, renderedGroundHeight } from './layout';

export function indexedSurface(cols:number,rows:number,sample:(s:number,t:number)=>Vector3) {
  const positions:number[]=[],indices:number[]=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)positions.push(...sample(i/cols,j/rows).toArray());
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  // u,d mapping has orientation -Y with the default winding; ensure all surface normals face up.
  const n=geometry.getAttribute('normal');
  let sum=0;for(let i=0;i<n.count;i++)sum+=n.getY(i);
  if(sum<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];geometry.setIndex(indices);geometry.computeVertexNormals();}
  return geometry;
}
function colorize(g:BufferGeometry,color:(p:Vector3,n:Vector3,index:number)=>Color) {
  const pos=g.getAttribute('position'), normals=g.getAttribute('normal'), colors:number[]=[];
  for(let i=0;i<pos.count;i++)colors.push(...color(new Vector3().fromBufferAttribute(pos,i),new Vector3().fromBufferAttribute(normals,i),i).toArray());
  g.setAttribute('color',new Float32BufferAttribute(colors,3));return g;
}
function mesh(name:string,g:BufferGeometry) {const overlay=name.includes('plot')||name.includes('pasture')||name.includes('shoulder')||name.includes('bank')||name.includes('foreground')||name.includes('track');const m=new Mesh(g,new MeshBasicMaterial({vertexColors:true,polygonOffset:overlay,polygonOffsetFactor:overlay?-2:0,polygonOffsetUnits:overlay?-2:0}));m.name=name;return m;}
const plan=(v:Vector3)=>({u:(v.x-v.z)*Math.SQRT1_2,d:-(v.x+v.z)*Math.SQRT1_2});
const groundLight=new Vector3(.4,.8,-.3).normalize();
function groundColor(u:number,d:number,n:Vector3) {
  const shoulder=shoulderDepth(u),c=new Color(PALETTE.meadow);
  // Broad material variation follows landforms, without parallel contour bands.
  const patch=(x:number,z:number,rx:number,rz:number)=>Math.exp(-(((u-x)/rx)**2)-((d-z)/rz)**2);
  c.lerp(new Color(PALETTE.meadowLight),.52*patch(80,-260,520,600)+.23*patch(-680,50,440,730));
  c.lerp(new Color(PALETTE.meadowShade),.38*patch(-270,-780,340,580)+.28*patch(760,-1020,550,540));
  c.lerp(new Color('#8b963e'),.34*patch(-730,-650,470,510));
  // Elevation loss and slope locate the transition. No dark stripe follows the
  // entire rear edge; the upper shoulder remains grass and the apron dries out.
  const descent=smooth(shoulder+180,shoulder+1850,d);
  c.lerp(new Color('#929266'),descent*.75);
  c.lerp(new Color(PALETTE.valley),smooth(shoulder+1000,shoulder+2420,d));
  c.lerp(new Color(PALETTE.farValley),smooth(2600,4300,d));
  const grass=1-smooth(shoulder+300,shoulder+1800,d);
  c.lerp(new Color('#b0ae4d'),.3*patch(-690,-550,460,350)*grass);
  c.lerp(new Color('#667c3c'),.52*patch(-350,220,240,790)*grass);
  c.lerp(new Color('#76904a'),.36*patch(680,160,290,650)*grass);
  c.multiplyScalar(.63+.37*Math.max(0,n.dot(groundLight)));
  return c;
}

export function buildGround() {
  const grid=GROUND_GRID;
  const g=indexedSurface(grid.cols,grid.rows,(s,t)=>{const u=grid.minU+s*grid.width,d=grid.minD+t*grid.depth;return worldPoint(u,d,groundHeight(u,d));});
  colorize(g,(p,n)=>{const {u,d}=plan(p);return groundColor(u,d,n);});
  return mesh('continuous-meadow-farm-valley',g);
}

export function buildTerrain() {
  const g=terrainGeometry(),relief=g.getAttribute('relief'),air=g.getAttribute('atmosphere');
  const light=new Vector3(.25,.8,-.6).normalize();
  colorize(g,(p,n,i)=>{
    const {u,d}=plan(p),base=groundColor(u,d,n);
    if(relief.getX(i)<=0)return base;
    const c=new Color(PALETTE.ridgeShadow).lerp(new Color(PALETTE.ridgeLight),Math.max(0,n.dot(light)));
    c.lerp(new Color(PALETTE.ridgeRock),smooth(90,320,relief.getX(i))*.38);
    c.lerp(new Color(PALETTE.atmosphere),air.getX(i));
    return base.lerp(c,smooth(0,55,relief.getX(i)));
  });
  const clear=g.getAttribute('color'),mist=clear.clone(),position=g.getAttribute('position');
  for(let i=0;i<position.count;i++){
    const v=new Vector3().fromBufferAttribute(position,i),{u,d}=plan(v);
    const contact=(1-smooth(0,35,v.y-cloudHeight(u,d)))*smooth(0,55,relief.getX(i));
    const c=new Color().fromBufferAttribute(clear,i).lerp(cloudColor(u,d),contact*.62);
    mist.setXYZ(i,c.r,c.g,c.b);
  }
  const m=mesh('continuous-terrain-foundation',g);
  m.userData.clearColors=clear;m.userData.cloudColors=mist;
  return m;
}

export function buildRidges() {
  const group=new Group();group.name='authored-ridge-masses';
  const light=new Vector3(.25,.8,-.6).normalize();
  for(const def of RIDGES){
    const g=ridgeGeometry(def);
    colorize(g,(p,n)=>{
      const {u,d}=plan(p);
      const facing=Math.max(0,n.dot(light));
      const c=new Color(PALETTE.ridgeShadow).lerp(new Color(PALETTE.ridgeLight),facing);
      const high=smooth(valleyHeight(0,d)+90,valleyHeight(0,d)+320,p.y);
      c.lerp(new Color(PALETTE.ridgeRock),high*.38);
      c.lerp(new Color(PALETTE.atmosphere),def.atmosphere);
      // Match the valley at the toes instead of leaving an outlined, isolated mound.
      const base=groundColor(u,d,new Vector3(0,1,0));
      c.lerp(base,1-smooth(0,38,p.y-groundHeight(u,d)));
      return c;
    });
    const clear=g.getAttribute('color'),mist=clear.clone(),position=g.getAttribute('position');
    for(let i=0;i<position.count;i++){
      const v=new Vector3().fromBufferAttribute(position,i),{u,d}=plan(v);
      const contact=1-smooth(0,35,v.y-cloudHeight(u,d));
      const c=new Color().fromBufferAttribute(clear,i).lerp(cloudColor(u,d),contact*.62);
      mist.setXYZ(i,c.r,c.g,c.b);
    }
    const m=mesh(def.id,g);m.userData.clearColors=clear;m.userData.cloudColors=mist;
    group.add(m);
  }
  return group;
}
export function buildFields() {
  const group=new Group();group.name='conforming-farm-parcels';
  for(const field of FIELDS){
    const g=indexedSurface(48,36,(s,t)=>{const p=fieldPoint(field,s,t);return worldPoint(p.u,p.d,renderedGroundHeight(p.u,p.d)+.8);});
    colorize(g,(_p,n,i)=>{
      const s=(i%49)/48,t=Math.floor(i/49)/36;
      const edge=Math.min(s,1-s,t,1-t);
      const c=new Color(PALETTE.field[field.color]);
      c.lerp(new Color(PALETTE.meadow),.16*(1-smooth(0,.09,edge)));
      return c.multiplyScalar(.85+.15*Math.max(0,n.dot(groundLight)));
    });
    group.add(mesh(field.id,g));
    // Sparse cultivation furrows follow the exact surface sampler; they never float as a flat card.
    for(let k=1;k<8;k++){
      const line=indexedSurface(48,1,(s,t)=>{const p=fieldPoint(field,s,(k+t*.08)/8);return worldPoint(p.u,p.d,renderedGroundHeight(p.u,p.d)+.86);});
      const color=new Color(PALETTE.field[field.color]).multiplyScalar(.94);
      colorize(line,()=>color);group.add(mesh(`${field.id}-furrow-${k}`,line));
    }
  }
  return group;
}

// Large, quiet material zones on the same rolling ground, with no added prop detail.
export function buildMeadowZones() {
  const group=new Group();group.name='meadow-material-zones';
  // One narrow access track makes the descent from the living pad to the fields readable.
  const route=new CatmullRomCurve3(WALK_ROUTE.map(p=>new Vector3(p.u,0,p.d)),false,'catmullrom',.3);
  const track=indexedSurface(100,2,(s,t)=>{
    const p=route.getPoint(s),v=route.getTangent(s),width=9;
    const u=p.x-v.z*(t-.5)*width,d=p.z+v.x*(t-.5)*width;
    return worldPoint(u,d,renderedGroundHeight(u,d)+2);
  });
  colorize(track,()=>new Color('#b0ad70'));group.add(mesh('farm-access-track',track));
  return group;
}
