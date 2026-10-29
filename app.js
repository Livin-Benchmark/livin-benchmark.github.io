const $ = (selector) => document.querySelector(selector);
const dialog = $('#lightbox');
document.querySelectorAll('[data-lightbox]').forEach(button => button.addEventListener('click', () => {
  const img = button.querySelector('img');$('#lightbox-image').src=img.currentSrc||img.src;$('#lightbox-image').alt=img.alt;$('#lightbox-caption').textContent=img.alt;dialog.showModal();document.body.style.overflow='hidden';
}));
$('#close-lightbox').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => document.body.style.overflow='');
dialog.addEventListener('click', event => {if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});


// Benchmarks remain visible in document order; header links scroll to each section.
const benchmarkPanels = [...document.querySelectorAll(".benchmark-panel")];
const siteHeader = $('.site-header');
const headerLinks = [...document.querySelectorAll('.site-header nav a[href^="#"]')];
function measureHeader() {
  document.documentElement.style.setProperty('--header-offset', `${siteHeader.offsetHeight + 16}px`);
}
measureHeader();
if ('ResizeObserver' in window) new ResizeObserver(measureHeader).observe(siteHeader);
else window.addEventListener('resize', measureHeader);
function highlightHeader(id) {
  headerLinks.forEach(link => {
    if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
let headerFrame = false;
function updateHeader() {
  headerFrame = false;
  const offset = siteHeader.offsetHeight + 32;
  let current = null;
  if ($('#scenes').getBoundingClientRect().top <= offset) current = 'scenes';
  for (const panel of benchmarkPanels) {
    if (panel.getBoundingClientRect().top <= offset) current = panel.id;
  }
  if ($('#bibtex').getBoundingClientRect().top <= offset) current = null;
  highlightHeader(current);
}
window.addEventListener('scroll', () => {
  if (!headerFrame) {headerFrame = true;requestAnimationFrame(updateHeader);}
}, {passive:true});
window.addEventListener('resize', updateHeader);
window.addEventListener('hashchange', () => requestAnimationFrame(updateHeader));
requestAnimationFrame(updateHeader);

// Native lazy loading prioritizes nearby images. After the first screen finishes,
// fill the remaining image cache one image at a time during idle periods.
async function warmImages(){
  const connection=navigator.connection;
  if(connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType))return;
  for(const img of document.querySelectorAll('img[loading="lazy"]')){
    if(img.complete&&img.naturalWidth)continue;
    await new Promise(resolve=>{
      if('requestIdleCallback' in window)requestIdleCallback(resolve,{timeout:2000});
      else setTimeout(resolve,100);
    });
    if(img.complete&&img.naturalWidth)continue;
    img.fetchPriority=img.getBoundingClientRect().top>innerHeight+300?'low':'auto';
    img.loading='eager';
    try{await img.decode();}catch{/* Normal image retry/error handling stays available. */}
  }
}
if(document.readyState==='complete')warmImages();
else window.addEventListener('load',warmImages,{once:true});

// Buffer demonstration clips just before they enter view without starting playback.
if('IntersectionObserver' in window){
  const videoObserver=new IntersectionObserver(entries=>{
    for(const {target:video,isIntersecting} of entries){
      if(!isIntersecting)continue;
      videoObserver.unobserve(video);
      video.preload='auto';
      if(video.paused&&video.readyState===0)video.load();
    }
  },{rootMargin:'200px'});
  document.querySelectorAll('.manipulation-videos video').forEach(video=>videoObserver.observe(video));
}

// Keep the citation readable and selectable even without clipboard permission.
const copyCitation = $('#copy-bibtex');
copyCitation.hidden = false;
copyCitation.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#bibtex-code').textContent);
    $('#citation-status').textContent = 'BibTeX copied.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('#bibtex-code'));
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    $('#citation-status').textContent = 'Citation selected. Press Ctrl+C or Command+C to copy.';
  }
});

// Scene modules are optional: their download or WebGL setup must not block navigation.
import('./scene-explorer.js').then(({ initExplorer }) => initExplorer()).catch(() => {
  const status = $('#gallery-status');
  if (status) {
    status.hidden = false;
    status.textContent = 'Scene selection unavailable. Showing the scene overview; reload to retry.';
  }
});
