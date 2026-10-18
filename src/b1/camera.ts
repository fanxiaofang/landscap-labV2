import {Vector3, type OrthographicCamera} from 'three';
import {createOverviewCamera, frameMapping, worldPoint, type Frame} from '../world/projection';
export type Navigation={x:number;y:number;zoom:number};
export const HOME:Navigation={x:0,y:0,zoom:1};
export const LIMITS={x:100,y:45,minZoom:.9,maxZoom:1.18} as const;
export const clampNavigation=(n:Navigation):Navigation=>({x:Math.max(-LIMITS.x,Math.min(LIMITS.x,n.x)),y:Math.max(-LIMITS.y,Math.min(LIMITS.y,n.y)),zoom:Math.max(LIMITS.minZoom,Math.min(LIMITS.maxZoom,n.zoom))});
/** Camera pan/zoom and SVG share this same affine transform about frame center.
 * Orthographic translation has no physical depth parallax; optional small
 * layer offsets below emulate Live With Me's existing 2.5D camera convention.
 */
export function navigate(camera:OrthographicCamera,frame:Frame,n:Navigation){
 const base=createOverviewCamera(frame);
 camera.copy(base);camera.zoom=n.zoom;
 const right=new Vector3().setFromMatrixColumn(base.matrixWorld,0),up=new Vector3().setFromMatrixColumn(base.matrixWorld,1);
 camera.position.addScaledVector(right,-n.x/n.zoom).addScaledVector(up,n.y/n.zoom);
 // Existing projection's asymmetric frustum is preserved. Its center, not its
 // lookAt point, is the 2D zoom pivot shared with SVG.
 camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
export function overlayTransform(frame:Frame,n:Navigation){const {scale}=frameMapping(frame);return `translate(${frame.width/2+n.x*scale} ${frame.height/2+n.y*scale}) scale(${n.zoom}) translate(${-frame.width/2} ${-frame.height/2})`;}
export function layerOffset(layer:string,n:Navigation,parallax:boolean){
 const strength=parallax?({far3:.16,far2:.10,far1:.05} as Record<string,number>)[layer]??0:0;
 return worldPoint(-n.x*strength/n.zoom,n.y*strength/(n.zoom*(77/272)),0);
}
