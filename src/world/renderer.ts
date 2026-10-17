import { Scene, WebGLRenderer, CanvasTexture, SRGBColorSpace, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { createOverviewCamera, FRAME, type Frame } from './projection';
import { buildGround, buildFields, buildRidges, buildMeadowZones } from '../terrain/geometry';
import { buildCloudSea } from './cloudSea';
import { AUTUMN } from './environment';

export function drawSky(ctx:CanvasRenderingContext2D,width=1600,height=900) {
  const gradient=ctx.createLinearGradient(0,0,0,height*.29);
  gradient.addColorStop(0,AUTUMN.sky.top);gradient.addColorStop(.55,'#ee9b7b');gradient.addColorStop(1,AUTUMN.sky.horizon);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
}
export class LandscapeRenderer {
  readonly renderer:WebGLRenderer;
  readonly scene=new Scene();
  readonly camera;
  readonly clouds=buildCloudSea();
  private readonly sky:CanvasTexture;
  private wire=false;
  constructor(canvas:HTMLCanvasElement,readonly frame:Frame=FRAME,readonly benchmark=true) {
    this.camera=createOverviewCamera(frame);
    this.renderer=new WebGLRenderer({canvas,alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(1);this.renderer.setSize(frame.width,frame.height,false);
    this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.setClearColor(AUTUMN.sky.top,1);
    // Sky is part of the actual rendered frame, including raw canvas captures.
    // CSS backgrounds cannot survive canvas export or an opaque screenshot consumer.
    const skyCanvas=document.createElement('canvas');skyCanvas.width=frame.width;skyCanvas.height=frame.height;
    const skyContext=skyCanvas.getContext('2d');if(!skyContext)throw new Error('无法创建秋季天空画布');
    drawSky(skyContext,frame.width,frame.height);
    this.sky=new CanvasTexture(skyCanvas);this.sky.colorSpace=SRGBColorSpace;
    this.scene.background=this.sky;
    this.scene.add(buildGround(),buildRidges(),this.clouds);
    if(!benchmark)this.scene.add(buildFields(),buildMeadowZones());
    this.render();
  }
  setClouds(enabled:boolean) {
    this.clouds.visible=enabled;
    this.scene.traverse(o=>{if(o instanceof Mesh&&o.userData.clearColors)o.geometry.setAttribute('color',enabled?o.userData.cloudColors:o.userData.clearColors);});
    this.render();
  }
  setWireframe(enabled:boolean) {
    this.wire=enabled;
    this.scene.traverse(o=>{if(o instanceof Mesh)(o.material as MeshBasicMaterial).wireframe=enabled;});this.render();
  }
  render() {this.renderer.render(this.scene,this.camera);}
  get stats() {return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,wireframe:this.wire,clouds:this.clouds.visible,benchmark:this.benchmark,frame:this.frame};}
  dispose(){this.scene.traverse((o:Object3D)=>{if(o instanceof Mesh){o.geometry.dispose();(o.material as MeshBasicMaterial).dispose();}});this.sky.dispose();this.renderer.dispose();}
}
