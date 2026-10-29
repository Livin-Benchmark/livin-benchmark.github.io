import { mkdir, rm, copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const dist=path.join(root,'dist');
const entryFiles=['index.html','styles.css','app.js','scene-explorer.js','panorama-viewer.js','favicon.svg'];
const files=new Set([
 ...entryFiles,
 'assets/scene-gallery.json',
 'assets/fonts/LICENSE-Lato.txt',
 'assets/vendor/three.module.js',
 'assets/vendor/three.core.js',
 'assets/vendor/THREE-LICENSE',
]);

// Copy referenced media only, including the static HTML fallback independently
// of the active gallery catalog. Historical files can never leak into a build.
for(const entry of ['index.html','styles.css']){
 const source=await readFile(path.join(root,entry),'utf8');
 for(const [file] of source.matchAll(/assets\/[A-Za-z0-9_./-]+/g))files.add(file);
}
const gallery=JSON.parse(await readFile(path.join(root,'assets/scene-gallery.json'),'utf8'));
for(const scene of gallery){
 if(process.env.LIVIN_REQUIRE_READY==='1'&&scene.status!=='ready')throw new Error(`Scene ${scene.id} awaits updated renders`);
 for(const file of [scene.overview.image,scene.thumbnail,...scene.points.map(point=>point.image)].filter(Boolean)){
  if(!file.startsWith('assets/')||file.includes('..')||/\.glb(?:\.gz)?$/.test(file))throw new Error('Invalid gallery image: '+file);
  files.add(file);
 }
}
await rm(dist,{recursive:true,force:true});
for(const file of files){
 if(path.isAbsolute(file)||file.split('/').includes('..'))throw new Error('Invalid build path: '+file);
 await mkdir(path.dirname(path.join(dist,file)),{recursive:true});
 await copyFile(path.join(root,file),path.join(dist,file));
}
console.log(`Static site ready in dist/: ${files.size} referenced files; archives and render sources excluded.`);
