// Static cutaway overviews with matching camera panoramas. No GLB or left-hand WebGL.
export async function initExplorer() {
  const $=selector=>document.querySelector(selector);
  const viewport=$('#scene-viewport'), overview=$('#main-scene'), overlay=$('#camera-markers');
  const picker=$('#point-picker'), pano=$('#panorama-view'), fallback=$('#panorama-fallback');
  let scenes=[], selected, point, sceneTicket=0, pointTicket=0, viewer, viewerPromise;
  // Let visible content finish first, then warm the panorama during idle time.
  // Approaching the panel bypasses the idle queue; data-saving connections stay lazy.
  const panoramaReady=new Promise(resolve=>{
    if(!('IntersectionObserver' in window)){resolve();return;}
    let started=false,idle;
    function start(){
      if(started)return;started=true;observer.disconnect();
      if(idle!==undefined&&'cancelIdleCallback' in window)cancelIdleCallback(idle);
      resolve();
    }
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting))start();
    },{rootMargin:'200px'});
    observer.observe($('#scene-panel'));
    function warmWhenIdle(){
      const connection=navigator.connection;
      if(started||connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType))return;
      if('requestIdleCallback' in window)idle=requestIdleCallback(start,{timeout:2000});
      else setTimeout(start,500);
    }
    if(document.readyState==='complete')warmWhenIdle();
    else window.addEventListener('load',warmWhenIdle,{once:true});
  });
  let markers=[];
  const anchor=document.createComment('Panorama home');pano.before(anchor);
  async function getViewer(){
    if(!viewerPromise)viewerPromise=import('./panorama-viewer.js').then(m=>{viewer=m.createPanoramaViewer(pano);return viewer;}).catch(()=>({show:async()=>false,clear(){}}));
    return viewerPromise;
  }
  function layoutMarkers(){
    const box=viewport.getBoundingClientRect(),data=selected?.overview;if(!data)return;
    const scale=Math.min(box.width/data.width,box.height/data.height),w=data.width*scale,h=data.height*scale;
    const left=(box.width-w)/2,top=(box.height-h)/2;
    Object.assign(overlay.style,{left:`${left}px`,top:`${top}px`,width:`${w}px`,height:`${h}px`,right:'auto',bottom:'auto'});
    const lines=overlay.querySelector('svg');lines.replaceChildren();lines.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const placed=[];
    for(const {button,data} of markers){
      const x=data.marker[0]*w,y=data.marker[1]*h;let bx=x,by=y;
      for(let n=0;n<100;n++){
        if(!placed.some(p=>Math.hypot(p[0]-bx,p[1]-by)<34))break;
        const angle=n*2.4,radius=18+Math.sqrt(n)*9;
        bx=Math.max(17,Math.min(w-17,x+Math.cos(angle)*radius));by=Math.max(17,Math.min(h-17,y+Math.sin(angle)*radius));
      }
      placed.push([bx,by]);button.style.left=`${bx}px`;button.style.top=`${by}px`;
      if(Math.hypot(x-bx,y-by)>2){
        const line=document.createElementNS('http://www.w3.org/2000/svg','line');
        for(const [key,val] of Object.entries({x1:x,y1:y,x2:bx,y2:by}))line.setAttribute(key,val);
        lines.append(line);
        const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','2.5');lines.append(dot);
      }
    }
  }
  function syncSelection(){
    for(const button of document.querySelectorAll('[data-point]'))button.setAttribute('aria-pressed',String(button.dataset.point===point?.id));
    const active=[...picker.children].find(b=>b.dataset.point===point?.id);
    if(active){const top=active.offsetTop;if(top<picker.scrollTop)picker.scrollTop=top;else if(top+active.offsetHeight>picker.scrollTop+picker.clientHeight)picker.scrollTop=top+active.offsetHeight-picker.clientHeight;}
  }
  async function selectPoint(data){
    point=data;const ticket=++pointTicket;syncSelection();viewer?.clear();fallback.hidden=true;fallback.removeAttribute('src');
    pano.hidden=false;$('#panorama-pending').hidden=true;$('.panorama-full').hidden=true;$('#panorama-retry').hidden=true;
    $('#panorama-status').textContent='Loading panorama…';pano.setAttribute('aria-busy','true');
    try{
      await panoramaReady;if(ticket!==pointTicket)return;
      const image=new Image();image.src=data.image;await image.decode();if(ticket!==pointTicket)return;
      fallback.src=data.image;fallback.alt=`Scene ${selected.id} · ${data.label} panorama`;fallback.hidden=false;
      const current=await getViewer();if(ticket!==pointTicket)return;
      await current.show(data.image,data.initialYaw);if(ticket!==pointTicket)return;
      $('.panorama-full').hidden=false;$('#panorama-status').textContent='';
    }catch{
      if(ticket!==pointTicket)return;$('#panorama-status').textContent='Panorama could not load.';$('#panorama-retry').hidden=false;
    }finally{if(ticket===pointTicket)pano.setAttribute('aria-busy','false');}
  }
  function setPoints(){
    picker.replaceChildren();overlay.querySelectorAll('button').forEach(b=>b.remove());markers=[];
    for(const data of selected.points){
      for(const isMarker of [false,true]){
        const b=document.createElement('button');b.type='button';b.dataset.point=data.id;b.className=isMarker?'camera-marker':'point-choice';
        b.textContent=isMarker?data.id:`${data.id}. ${data.label}`;b.setAttribute('aria-label',`${data.id}. ${data.label}`);
        b.addEventListener('click',()=>selectPoint(data));(isMarker?overlay:picker).append(b);
        if(isMarker)markers.push({button:b,data});
      }
    }
    layoutMarkers();
    if(selected.points.length)selectPoint(selected.points.find(p=>p.id===selected.defaultPoint)||selected.points[0]);
  }
  async function selectScene(data){
    const ticket=++sceneTicket;++pointTicket;selected=data;point=null;viewer?.clear();delete viewport.dataset.loadedScene;
    pano.hidden=true;$('#panorama-pending').hidden=false;$('.panorama-full').hidden=true;$('#panorama-retry').hidden=true;$('#panorama-status').textContent='';
    const sameOverview=overview.getAttribute('src')===data.overview.image;
    picker.replaceChildren();overlay.hidden=true;$('#gallery-status').textContent=sameOverview?'':'Loading image…';$('#gallery-retry').hidden=true;
    $('#selected-scene').textContent=`Scene ${data.id}`;$('#scene-count').textContent=`${String(scenes.indexOf(data)+1).padStart(2,'0')} / ${String(scenes.length).padStart(2,'0')} selected homes`;
    $('#scene-quality-note').textContent=data.status==='ready'?`2K overview · ${Math.round((data.points[0]?.width||2048)/1024)}K panoramas`:data.status==='sample'?'8K panorama sample · remaining viewpoints pending':data.status==='preview'?'Previous scene preview · updated renders pending':'Updated scene renders pending';
    for(const b of document.querySelectorAll('[data-scene]'))b.setAttribute('aria-pressed',String(b.dataset.scene===data.id));
    // Keep the default HTML preview visible; hide only a different home's old image.
    overview.hidden=!sameOverview;viewport.setAttribute('aria-busy','true');
    try{
      const image=new Image();image.src=data.overview.image;await image.decode();if(ticket!==sceneTicket)return;
      overview.src=data.overview.image;overview.width=data.overview.width;overview.height=data.overview.height;overview.alt=`Scene ${data.id} cutaway overview`;overview.hidden=false;
      $('#gallery-status').textContent='';overlay.hidden=false;setPoints();viewport.dataset.loadedScene=data.id;
    }catch{if(ticket===sceneTicket){$('#gallery-status').textContent='Scene image could not load.';$('#gallery-retry').hidden=false;}}
    finally{if(ticket===sceneTicket)viewport.setAttribute('aria-busy','false');}
  }
  async function loadCatalog(){
    try{
      const response=await fetch('assets/scene-gallery.json');if(!response.ok)throw new Error('Scene catalog unavailable');scenes=await response.json();
      $('#scene-thumbnails').replaceChildren();
      for(const data of scenes){
        const b=document.createElement('button');b.type='button';b.className='thumbnail';b.dataset.scene=data.id;b.setAttribute('aria-label',`Explore Scene ${data.id}`);
        const picture=document.createElement('span');picture.className='thumbnail-picture';const img=document.createElement('img');img.src=data.thumbnail||data.overview.image;img.loading='lazy';img.alt='';img.width=144;img.height=100;picture.append(img);
        const label=document.createElement('span');label.className='thumbnail-label';label.textContent=`Scene ${data.id}`;b.append(picture,label);b.addEventListener('click',()=>selectScene(data));$('#scene-thumbnails').append(b);
      }
      await selectScene(scenes[0]);
    }catch{$('#gallery-status').textContent='Scene list could not load.';$('#gallery-retry').hidden=false;}
  }
  $('#gallery-retry').addEventListener('click',()=>selected?selectScene(selected):loadCatalog());
  $('#panorama-retry').addEventListener('click',()=>point&&selectPoint(point));
  $('.panorama-full').addEventListener('click',()=>{
    const dialog=$('#lightbox');$('#lightbox-image').hidden=true;$('#lightbox-caption').textContent=`Scene ${selected.id} · ${point.label}`;
    dialog.classList.add('panorama-expanded');dialog.append(pano);dialog.showModal();document.body.style.overflow='hidden';
  });
  $('#lightbox').addEventListener('close',()=>{if(!$('#lightbox').classList.contains('panorama-expanded'))return;anchor.after(pano);$('#lightbox-image').hidden=false;$('#lightbox').classList.remove('panorama-expanded');});
  new ResizeObserver(layoutMarkers).observe(viewport);
  await loadCatalog();
}
