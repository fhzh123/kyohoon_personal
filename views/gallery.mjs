import {readFile} from 'node:fs/promises';
import {shell,privateHeader,publicHeader} from './pages.mjs';

const content=await readFile(new URL('./gallery.html',import.meta.url),'utf8');

const data = JSON.parse(content.match(/<script type="application\/json" id="gallery-data">([\s\S]*?)<\/script>/)?.[1] ?? '{}');

export const homeMascotOptions = (data.items ?? []).flatMap(item => {
 const src = data.assets?.[item.image]?.src;
 if (!src || item.kind !== 'still' || ['site-original', 'site-walk'].includes(item.id)) return [];
 return [{src, title:item.title, group:item.group}];
});

export function galleryPage(access=null){
 const header=access?privateHeader('/personal'):publicHeader('personal');
 return shell('갤러리',content.replace('<!--GALLERY_HEADER-->',header),'gallery');
}
