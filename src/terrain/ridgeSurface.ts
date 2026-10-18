import { BufferGeometry, Float32BufferAttribute } from 'three';
import { terrainSample, groundHeight, RIDGES, GROUND_GRID, type RidgeDefinition } from './layout';
import { worldPoint } from '../world/projection';
export function ridgeSampler(def:RidgeDefinition) {
  return {heightAt:groundHeight,chains:[def.points],bounds:{minU:Math.min(...def.points.map(p=>p.u-p.w*2)),maxU:Math.max(...def.points.map(p=>p.u+p.w*2)),minD:Math.min(...def.points.map(p=>p.d-def.depth*2)),maxD:Math.max(...def.points.map(p=>p.d+def.depth*2))}};
}
export function createTerrainSampler(){return {sample:terrainSample,ridges:RIDGES.map(def=>({def,...ridgeSampler(def)}))};}
// A single shared surface; crops use exactly the same triangle diagonal.
export function terrainGeometry() {
  return heightfieldGeometry(GROUND_GRID);
}
function heightfieldGeometry(grid:typeof GROUND_GRID) {
  const g=new BufferGeometry(),positions:number[]=[],indices:number[]=[],relief:number[]=[],air:number[]=[];
  for(let j=0;j<=grid.rows;j++)for(let i=0;i<=grid.cols;i++){
    const u=grid.minU+i*grid.width/grid.cols,d=grid.minD+j*grid.depth/grid.rows,v=terrainSample(u,d);
    positions.push(...worldPoint(u,d,v.h).toArray());relief.push(v.relief);air.push(v.atmosphere);
  }
  for(let j=0;j<grid.rows;j++)for(let i=0;i<grid.cols;i++){
    const a=j*(grid.cols+1)+i,b=a+1,c=a+grid.cols+1,e=c+1;indices.push(a,b,c,b,e,c);
  }
  g.setAttribute('position',new Float32BufferAttribute(positions,3));
  g.setAttribute('relief',new Float32BufferAttribute(relief,1));g.setAttribute('atmosphere',new Float32BufferAttribute(air,1));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
// Compatibility for historical inspection scripts: sample this hill's region
// of the connected landscape, rather than creating a disconnected mountain.
export function ridgeGeometry(def:RidgeDefinition){
  const {minU,maxU,minD,maxD}=ridgeSampler(def).bounds;
  return heightfieldGeometry({minU,minD,width:maxU-minU,depth:maxD-minD,cols:160,rows:100});
}
