// Pin the package in package-lock.json; serve all browser dependencies locally.
import {mkdir,copyFile} from 'node:fs/promises';
const target=new URL('../assets/vendor/',import.meta.url);
const source=new URL('../node_modules/three/',import.meta.url);
await mkdir(target,{recursive:true});
for(const file of ['three.module.js','three.core.js'])await copyFile(new URL(`build/${file}`,source),new URL(file,target));
await copyFile(new URL('LICENSE',source),new URL('THREE-LICENSE',target));
