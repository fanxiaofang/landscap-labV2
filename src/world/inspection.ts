import { OrthographicCamera } from 'three';
import { worldPoint, type Frame } from './projection';

export type InspectionPose='oblique'|'top'|'side';
export type CameraView='target'|InspectionPose;

// Debug framing only. The target projection is constructed in projection.ts
// and never touched by orbit controls or by an inspection preset.
export function createInspectionCamera(frame:Frame) {
  const span=3300,halfY=span*frame.height/frame.width/2;
  return new OrthographicCamera(-span/2,span/2,halfY,-halfY,1,30000);
}
export function setInspectionPose(camera:OrthographicCamera,pose:InspectionPose) {
  const target=worldPoint(0,pose==='top'?600:1050,80);
  const positions={
    oblique:worldPoint(-2000,-1900,2200),
    top:worldPoint(0,600,9000),
    side:worldPoint(-6500,700,600),
  };
  camera.zoom=pose==='side'?.9:pose==='top'?.82:1;
  camera.up.copy(pose==='top'?worldPoint(0,1,0):worldPoint(0,0,1));
  camera.position.copy(positions[pose]);camera.lookAt(target);
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  return target;
}
