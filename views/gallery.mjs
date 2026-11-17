import {readFile} from 'node:fs/promises';
import {shell,privateHeader,publicHeader} from './pages.mjs';

const content=await readFile(new URL('./gallery.html',import.meta.url),'utf8');

export function galleryPage(access=null){
 const header=access?privateHeader('/personal'):publicHeader('personal');
 return shell('갤러리',content.replace('<!--GALLERY_HEADER-->',header),'gallery');
}
