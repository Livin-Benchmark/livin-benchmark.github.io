import * as THREE from './assets/vendor/three.module.js';

// The texture is a full 360° camera render, never an overview photograph.
export function createPanoramaViewer(container) {
  let renderer;
  try {renderer=new THREE.WebGLRenderer({antialias:true});} catch {return {show:()=>{},clear:()=>{}};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','360 degree panorama. Drag or use arrow keys to look around.');canvas.hidden=true;container.append(canvas);
  const hint=document.createElement('span');hint.className='panorama-hint';hint.textContent='360° · Drag to look around';container.append(hint);
  const toolbar=document.createElement('div');toolbar.className='panorama-controls';toolbar.setAttribute('aria-label','Panorama controls');container.append(toolbar);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(75,1,.1,100);
  const geometry=new THREE.SphereGeometry(20,48,32);geometry.scale(-1,1,1);
  const material=new THREE.MeshBasicMaterial();scene.add(new THREE.Mesh(geometry,material));
  let initialYaw=-Math.PI/2; // Center of the equirectangular image on the inward-facing sphere.
  let yaw=initialYaw,pitch=0,sequence=0,drag=null,lost=false;
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;sequence++;canvas.hidden=true;delete container.dataset.interactive;});
  for(const [label,text,action] of [
    ['Look left','←',()=>{yaw-=.3;}],['Look right','→',()=>{yaw+=.3;}],
    ['Zoom in','+',()=>{camera.fov=Math.max(35,camera.fov-10);}],
    ['Zoom out','−',()=>{camera.fov=Math.min(100,camera.fov+10);}],
    ['Reset panorama','↺',()=>{yaw=initialYaw;pitch=0;camera.fov=75;}]
  ]){
    const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label);
    button.addEventListener('click',()=>{action();camera.updateProjectionMatrix();draw();});toolbar.append(button);
  }
  function draw(){if(lost)return;camera.lookAt(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));renderer.render(scene,camera);}
  new ResizeObserver(()=>{const r=container.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();draw();}).observe(container);
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.005;pitch=Math.max(-1.45,Math.min(1.45,pitch+(e.clientY-drag.y)*.005));drag={x:e.clientX,y:e.clientY};draw();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null;});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;if(e.key==='ArrowUp')pitch+=.1;if(e.key==='ArrowDown')pitch-=.1;if(e.key==='Home'){yaw=initialYaw;pitch=0;}pitch=Math.max(-1.45,Math.min(1.45,pitch));draw();});
  function clear(){sequence++;delete container.dataset.interactive;canvas.hidden=true;material.map?.dispose();material.map=null;}
  return {
    clear,
    async show(url,preferredYaw){if(lost)return false;initialYaw=Number.isFinite(preferredYaw)?preferredYaw:-Math.PI/2;clear();const ticket=sequence;yaw=initialYaw;pitch=0;camera.fov=75;camera.updateProjectionMatrix();
      try{const texture=await new THREE.TextureLoader().loadAsync(url);if(ticket!==sequence){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.needsUpdate=true;canvas.hidden=false;container.dataset.interactive="true";draw();}
      catch{canvas.hidden=true;}
    }
  };
}
