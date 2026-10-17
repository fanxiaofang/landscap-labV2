import { BufferGeometry, Float32BufferAttribute, Vector3, Color, Mesh, MeshBasicMaterial, Group, CatmullRomCurve3 } from 'three';
import Delaunator from 'delaunator';
import { worldPoint } from '../world/projection';
import { PALETTE } from '../world/environment';
import { groundHeight, valleyHeight, shoulderDepth, smooth, FIELDS, fieldPoint, RIDGES, GROUND_GRID, WALK_ROUTE, renderedGroundHeight, type RidgeDefinition } from './layout';

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
  const foreground=smooth(-150,-900,d);
  const sweep=Math.exp(-(((u+300+0.4*d)/850)**2))*foreground;
  c.lerp(new Color(PALETTE.meadowShade),sweep*.65);
  c.lerp(new Color(PALETTE.meadowLight),.45*Math.exp(-(((u-70)/400)**2)-((d+180)/500)**2));
  // Material bands live in the ground's vertex colors, so overlapping meadow zones cannot z-fight.
  const bands=[
    {color:'#93a33a',d0:-320,d1:-580,width:230,bend:280,u0:-1250,u1:1300},
    {color:'#7a9133',d0:-650,d1:-1100,width:370,bend:140,u0:-1300,u1:300},
    {color:'#6f852e',d0:-1280,d1:-570,width:490,bend:-180,u0:-350,u1:1700},
    {color:'#5f772f',d0:-1100,d1:-1510,width:540,bend:210,u0:-1400,u1:1200},
  ];
  for(const band of bands){
    const s=(u-band.u0)/(band.u1-band.u0);
    if(s<0||s>1)continue;
    const edge=band.d0+(band.d1-band.d0)*s+band.bend*Math.sin(s*Math.PI);
    const half=band.width*(.05+.95*Math.sin(s*Math.PI))/2;
    c.lerp(new Color(band.color),1-smooth(half-18,half+18,Math.abs(d-edge)));
  }
  c.lerp(new Color(PALETTE.shoulder),smooth(shoulder-100,shoulder+750,d));
  c.lerp(new Color(PALETTE.valley),smooth(shoulder+600,shoulder+1450,d));
  c.lerp(new Color(PALETTE.farValley),smooth(2600,4300,d));
  c.multiplyScalar(.82+.18*Math.max(0,n.dot(groundLight)));
  return c;
}

export function buildGround() {
  const grid=GROUND_GRID;
  const g=indexedSurface(grid.cols,grid.rows,(s,t)=>{const u=grid.minU+s*grid.width,d=grid.minD+t*grid.depth;return worldPoint(u,d,groundHeight(u,d));});
  colorize(g,(p,n)=>{const {u,d}=plan(p);return groundColor(u,d,n);});
  return mesh('continuous-meadow-farm-valley',g);
}

export function ridgeGeometry(def:RidgeDefinition) {
  const chains=[def.points,...(def.branches??[])];
  const all=chains.flat();
  const extent=Math.max(1,...(def.flanks??[1,1]));
  const minU=Math.min(...all.map(p=>p.u-p.w*extent)),maxU=Math.max(...all.map(p=>p.u+p.w*extent));
  const minD=Math.min(...all.map(p=>p.d-p.w*extent*1.5)),maxD=Math.max(...all.map(p=>p.d+p.w*extent*1.5));
  // A small, independent surface around an explicitly authored branching ridge network.
  // Distances use a stretched depth axis to give long shoulders, rather than radial cones.
  const segments=chains.flatMap(chain=>chain.slice(1).map((b,i)=>({a:chain[i],b})));
  const heightAt=(u:number,d:number)=>{
    const base=valleyHeight(u,d)-5;
    let height=base;
    for(const {a,b} of segments){
      const dx=b.u-a.u,dz=(b.d-a.d)/1.5;
      const f=Math.max(0,Math.min(1,((u-a.u)*dx+(d-a.d)/1.5*dz)/(dx*dx+dz*dz)));
      const cu=a.u+f*(b.u-a.u),cd=a.d+f*(b.d-a.d),crest=a.h+f*(b.h-a.h),width=a.w+f*(b.w-a.w);
      const length=Math.hypot(dx,dz),offsetU=u-cu,offsetD=(d-cd)/1.5;
      const across=(dx*offsetD-dz*offsetU)/length,along=(dx*offsetU+dz*offsetD)/length;
      // Only stretch the cross-slope component. Scaling the end-cap radius by a
      // side sign would introduce a height discontinuity beyond a segment end.
      const radius=Math.hypot(along,across/(def.flanks?.[across>0?0:1]??1))/width;
      // A compact smooth apron reaches the valley with a horizontal tangent.
      const influence=radius<.22?1-radius*.95:radius<.62?.791-(radius-.22)*1.5:radius<1?.191*((1-radius)/.38)**2:0;
      height=Math.max(height,base+Math.max(0,crest-base)*influence);
    }
    return height;
  };
  const sites:[number,number][]=[];
  // Seed the exact crests and their parallel slope shoulders before triangulating.
  // This removes the staircase silhouette of a regular grid crossing a narrow ridge.
  for(const {a,b} of segments){
    const steps=Math.max(2,Math.ceil(Math.hypot(b.u-a.u,b.d-a.d)/28));
    for(let i=0;i<=steps;i++){
      const t=i/steps,u=a.u+(b.u-a.u)*t,d=a.d+(b.d-a.d)*t;
      sites.push([u,d]);
      const len=Math.hypot(b.u-a.u,b.d-a.d),nu=-(b.d-a.d)/len,nd=(b.u-a.u)/len;
      for(const side of [-1,1])sites.push([u+nu*side*28,d+nd*side*28]);
    }
  }
  const cols=Math.ceil((maxU-minU)/36),rows=Math.ceil((maxD-minD)/46);
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=minU+(maxU-minU)*(i+(j%2)*.32)/cols,d=minD+(maxD-minD)*j/rows;
    sites.push([u,d]);
  }
  const unique=[...new Map(sites.map(p=>[`${p[0].toFixed(3)},${p[1].toFixed(3)}`,p])).values()];
  const elevations=unique.map(([u,d])=>heightAt(u,d));
  const triangulation=Delaunator.from(unique);
  const positions=unique.flatMap(([u,d],i)=>worldPoint(u,d,elevations[i]).toArray());
  const indices:number[]=[];
  for(let i=0;i<triangulation.triangles.length;i+=3){
    const ids=[triangulation.triangles[i],triangulation.triangles[i+1],triangulation.triangles[i+2]];
    // Buried portions must not extend past the valley's horizon as rectangular cards.
    if(ids.every(k=>elevations[k]<valleyHeight(...unique[k])+.15))continue;
    const [a,b,c]=ids.map(k=>worldPoint(unique[k][0],unique[k][1],elevations[k]));
    if(b.clone().sub(a).cross(c.clone().sub(a)).y<0)[ids[1],ids[2]]=[ids[2],ids[1]];
    indices.push(...ids);
  }
  // Compact unused sites so every normal in the exported surface is meaningful.
  const used=[...new Set(indices)],remap=new Map(used.map((v,i)=>[v,i]));
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(used.flatMap(k=>positions.slice(k*3,k*3+3)),3));
  g.setIndex(indices.map(i=>remap.get(i)!));g.computeVertexNormals();return g;
}
export function buildRidges() {
  const group=new Group();group.name='authored-ridge-masses';
  const light=new Vector3(.6,.75,-.2).normalize();
  for(const def of RIDGES){
    const indexed=ridgeGeometry(def),g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();
    colorize(g,(p,n)=>{
      const {u,d}=plan(p);
      const facing=Math.max(0,n.dot(light));
      const c=new Color(PALETTE.ridgeShadow).lerp(new Color(PALETTE.ridgeLight),facing);
      const high=smooth(valleyHeight(0,d)+90,valleyHeight(0,d)+320,p.y);
      c.lerp(new Color(PALETTE.ridgeRock),high*.38);
      c.lerp(new Color(PALETTE.atmosphere),def.atmosphere);
      // Match the valley at the toes instead of leaving an outlined, isolated mound.
      const base=groundColor(u,d,new Vector3(0,1,0));
      c.lerp(base,1-smooth(0,38,p.y-valleyHeight(u,d)));
      return c;
    });
    group.add(mesh(def.id,g));
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
