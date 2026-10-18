import {CanvasTexture, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshLambertMaterial, OrthographicCamera, Scene, SRGBColorSpace, WebGLRenderer} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createOverviewCamera, FRAME, worldPoint, type Frame} from '../world/projection';
import type {CameraView} from '../world/inspection';
import {buildMidFar} from './model';
import {clampNavigation, HOME, layerOffset, navigate, type Navigation} from './camera';

export class MidFarRenderer{
 readonly renderer:WebGLRenderer;readonly scene=new Scene();readonly camera;readonly inspectionCamera;
 readonly terrain=buildMidFar();readonly controls:OrbitControls;
 readonly sun=new DirectionalLight('#fff0cd',3.2);
 readonly clay=new MeshLambertMaterial({color:'#9ca99a'});
 private sky:CanvasTexture;view:CameraView='target';navigation={...HOME};parallax=true;wire=false;neutral=false;river=true;
 constructor(canvas:HTMLCanvasElement,readonly frame:Frame=FRAME){
  this.camera=createOverviewCamera(frame);
  const span=5400,h=span*frame.height/frame.width;
  this.inspectionCamera=new OrthographicCamera(-span/2,span/2,h/2,-h/2,1,30000);
  this.renderer=new WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  this.renderer.setPixelRatio(1);this.renderer.setSize(frame.width,frame.height,false);this.renderer.outputColorSpace=SRGBColorSpace;
  const sky=document.createElement('canvas');sky.width=32;sky.height=900;const ctx=sky.getContext('2d')!;
  const g=ctx.createLinearGradient(0,0,0,900);g.addColorStop(0,'#b7c7cf');g.addColorStop(.24,'#e9c9a0');g.addColorStop(.52,'#eee1bd');g.addColorStop(.82,'#e3e3d4');g.addColorStop(1,'#e3e3d4');ctx.fillStyle=g;ctx.fillRect(0,0,32,900);
  this.sky=new CanvasTexture(sky);this.sky.colorSpace=SRGBColorSpace;this.scene.background=this.sky;
  this.scene.fog=new Fog('#d4cdb6',12900,15800);
  this.sun.position.copy(worldPoint(-1800,-800,1400));
  this.scene.add(this.terrain.group,new HemisphereLight('#fff8df','#637655',1.2),this.sun);
  this.controls=new OrbitControls(this.inspectionCamera,canvas);this.controls.enabled=false;this.controls.enableDamping=false;this.controls.minZoom=.5;this.controls.maxZoom=3;this.controls.maxPolarAngle=Math.PI*.49;
  this.controls.addEventListener('change',this.onOrbit);this.render();
 }
 private onOrbit=()=>{if(this.view!=='target')this.render();};
 setNavigation(n:Navigation){this.navigation=clampNavigation(n);navigate(this.camera,this.frame,this.navigation);this.updateLayers();this.render();}
 private updateLayers(){for(const m of this.terrain.group.children)m.position.copy(layerOffset(m.userData.layer,this.navigation,this.parallax&&this.view==='target'));}
 setParallax(enabled:boolean){this.parallax=enabled;this.updateLayers();this.render();}
 setView(view:CameraView){
  this.view=view;this.controls.enabled=view!=='target';this.updateLayers();
  if(view!=='target'){
   const target=worldPoint(0,1050,80),poses={oblique:worldPoint(-3000,-3300,3100),top:worldPoint(0,1050,9000),side:worldPoint(-6500,800,1000)};
   this.inspectionCamera.position.copy(poses[view]);this.inspectionCamera.up.copy(view==='top'?worldPoint(0,1,0):worldPoint(0,0,1));this.inspectionCamera.zoom=view==='top'?.9:1;
   this.inspectionCamera.lookAt(target);this.inspectionCamera.updateProjectionMatrix();this.controls.target.copy(target);this.controls.update();
  }
  this.scene.fog=view==='target'?new Fog('#d4cdb6',12900,15800):null;
  this.scene.background=view==='target'?this.sky:new Color('#e1e5e0');
  this.renderer.domElement.style.touchAction='none';this.render();
 }
 setNeutral(enabled:boolean){this.neutral=enabled;for(const m of this.terrain.group.children){if(!(m instanceof Mesh))continue;if(!m.userData.material)m.userData.material=m.material;m.material=enabled?this.clay:m.userData.material;}this.setWire(this.wire);}
 setWire(enabled:boolean){this.wire=enabled;this.clay.wireframe=enabled;for(const m of this.terrain.group.children)if(m instanceof Mesh){(m.material as MeshLambertMaterial).wireframe=enabled;if(m.userData.material)m.userData.material.wireframe=enabled;}this.render();}
 setRiver(enabled:boolean){this.river=enabled;this.terrain.river.visible=enabled;this.terrain.banks.visible=enabled;this.render();}
 setSun(reverse:boolean){this.sun.position.copy(worldPoint(reverse?1800:-1800,-800,1400));this.render();}
 render(){this.renderer.render(this.scene,this.view==='target'?this.camera:this.inspectionCamera);}
 get stats(){return {mode:'b1',frame:this.frame,view:this.view,navigation:this.navigation,parallax:this.parallax,neutral:this.neutral,wire:this.wire,river:this.river,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,targetMatrix:this.camera.matrixWorld.toArray(),inspectionMatrix:this.inspectionCamera.matrixWorld.toArray(),meshNames:this.terrain.group.children.map(m=>m.name)};}
 dispose(){this.controls.removeEventListener('change',this.onOrbit);this.controls.dispose();for(const m of this.terrain.group.children)if(m instanceof Mesh){m.geometry.dispose();(m.userData.material??m.material).dispose();}this.clay.dispose();this.sky.dispose();this.renderer.dispose();}
}
