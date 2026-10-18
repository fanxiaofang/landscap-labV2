import { Scene, Group, WebGLRenderer, CanvasTexture, SRGBColorSpace, Mesh, MeshBasicMaterial, MeshStandardMaterial, HemisphereLight, DirectionalLight, type Object3D } from 'three';
import { createOverviewCamera, FRAME, type Frame } from './projection';
import { buildTerrain, buildRiver, buildFields, buildMeadowZones } from '../terrain/geometry';
import { AUTUMN } from './environment';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createInspectionCamera, setInspectionPose, type CameraView } from './inspection';

export function drawSky(ctx:CanvasRenderingContext2D,width=1600,height=900) {
  const gradient=ctx.createLinearGradient(0,0,0,height*.29);
  gradient.addColorStop(0,AUTUMN.sky.top);gradient.addColorStop(.55,'#ee9b7b');gradient.addColorStop(1,AUTUMN.sky.horizon);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
}
export class LandscapeRenderer {
  readonly renderer:WebGLRenderer;
  readonly scene=new Scene();
  readonly camera;
  readonly inspectionCamera;
  private readonly controls:OrbitControls;
  private cameraView:CameraView='target';
  private readonly inspectionMaterial=new MeshStandardMaterial({color:'#a3aca8',roughness:1});
  readonly clouds=new Group(); // Compatibility flag for the static, thin aerial wash.
  readonly river=buildRiver();
  private readonly sky:CanvasTexture;
  private wire=false;
  constructor(canvas:HTMLCanvasElement,readonly frame:Frame=FRAME,readonly benchmark=true) {
    this.camera=createOverviewCamera(frame);
    this.inspectionCamera=createInspectionCamera(frame);
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
    this.scene.add(buildTerrain(),buildFields(),buildMeadowZones(),this.river,this.clouds);
    this.river.visible=false;
    // Neutral clay reveals real normals in inspection; target baked colours and
    // the frozen cloud material are restored unchanged on returning to target.
    const fill=new HemisphereLight('#fff7e6','#52616b',.45);
    const sun=new DirectionalLight('#fff5df',2);sun.position.set(-2000,3500,1500);
    this.scene.add(fill,sun);
    this.controls=new OrbitControls(this.inspectionCamera,canvas);
    this.controls.enabled=false;this.controls.enableDamping=false;
    this.controls.minZoom=.35;this.controls.maxZoom=4;
    this.controls.maxPolarAngle=Math.PI*.49;
    this.controls.addEventListener('change',this.renderInspection);
    this.render();
  }
  private renderInspection=()=>{if(this.cameraView!=='target')this.render();};
  setCameraView(view:CameraView) {
    this.cameraView=view;this.controls.enabled=view!=='target';
    this.scene.traverse(o=>{
      if(!(o instanceof Mesh)||o.parent===this.clouds)return;
      if(!o.userData.targetMaterial)o.userData.targetMaterial=o.material;
      o.material=view==='target'?o.userData.targetMaterial:this.inspectionMaterial;
    });
    if(view!=='target'){
      this.controls.target.copy(setInspectionPose(this.inspectionCamera,view));
      this.controls.update();
    }
    this.renderer.domElement.style.touchAction=view==='target'?'auto':'none';
    this.render();
  }
  setClouds(enabled:boolean) {
    this.clouds.visible=enabled;
    this.scene.traverse(o=>{if(o instanceof Mesh&&o.userData.clearColors)o.geometry.setAttribute('color',enabled?o.userData.cloudColors:o.userData.clearColors);});
    this.render();
  }
  setRiver(enabled:boolean){this.river.visible=enabled;this.render();}
  setWireframe(enabled:boolean) {
    this.wire=enabled;
    this.inspectionMaterial.wireframe=enabled;
    this.scene.traverse(o=>{if(o instanceof Mesh){(o.material as MeshBasicMaterial).wireframe=enabled;if(o.userData.targetMaterial)o.userData.targetMaterial.wireframe=enabled;}});this.render();
  }
  render() {this.renderer.render(this.scene,this.cameraView==='target'?this.camera:this.inspectionCamera);}
  get stats() {return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,wireframe:this.wire,clouds:this.clouds.visible,river:this.river.visible,benchmark:this.benchmark,frame:this.frame,cameraView:this.cameraView,targetCameraMatrix:this.camera.matrixWorld.toArray(),inspectionCameraMatrix:this.inspectionCamera.matrixWorld.toArray()};}
  dispose(){this.controls.removeEventListener('change',this.renderInspection);this.controls.dispose();this.scene.traverse((o:Object3D)=>{if(o instanceof Mesh){o.geometry.dispose();(o.userData.targetMaterial??o.material).dispose();}});this.inspectionMaterial.dispose();this.sky.dispose();this.renderer.dispose();}
}
