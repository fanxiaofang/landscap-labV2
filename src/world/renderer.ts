import { Scene, WebGLRenderer, SRGBColorSpace, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { createOverviewCamera, FRAME } from './projection';
import { buildGround, buildFields, buildRidges, buildMeadowZones } from '../terrain/geometry';
import { AUTUMN } from './environment';

export function drawSky(ctx:CanvasRenderingContext2D,width=1200,height=800) {
  const gradient=ctx.createLinearGradient(0,0,0,height*.52);
  gradient.addColorStop(0,AUTUMN.sky.top);gradient.addColorStop(1,AUTUMN.sky.horizon);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
}
export class LandscapeRenderer {
  readonly renderer:WebGLRenderer;
  readonly scene=new Scene();
  readonly camera=createOverviewCamera();
  private wire=false;
  constructor(canvas:HTMLCanvasElement) {
    this.renderer=new WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(1);this.renderer.setSize(FRAME.width,FRAME.height,false);
    this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.setClearColor(0x000000,0);
    this.scene.add(buildGround(),buildRidges(),buildFields(),buildMeadowZones());
    this.render();
  }
  setWireframe(enabled:boolean) {
    this.wire=enabled;
    this.scene.traverse(o=>{if(o instanceof Mesh)(o.material as MeshBasicMaterial).wireframe=enabled;});
    this.render();
  }
  render() {this.renderer.render(this.scene,this.camera);}
  get stats() {return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,wireframe:this.wire};}
  dispose(){this.scene.traverse((o:Object3D)=>{if(o instanceof Mesh){o.geometry.dispose();(o.material as MeshBasicMaterial).dispose();}});this.renderer.dispose();}
}
