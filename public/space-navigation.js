(() => {
 'use strict';
 // Settings belongs to the space from which it was opened. Keep every
 // destination on this origin and select from a fixed set of root paths.
 if(document.body?.dataset.surface!=='settings')return;
 const host=document.querySelector('[data-space-navigation]');if(!host)return;
 let section='';
 try{const u=new URL(new URLSearchParams(location.search).get('returnTo')||'/',location.origin);if(u.origin===location.origin){if(/^\/work(?:\/|$)/.test(u.pathname))section='work';else if(/^\/paper(?:\/|$)/.test(u.pathname))section='paper';else if(/^\/personal(?:\/|$)/.test(u.pathname))section='personal';}}catch{}
 const spaces={work:['/work','Work 홈','briefcase-business'],paper:['/paper','Paper 홈','book-open'],personal:['/personal','Personal 홈','user-round']};
 host.querySelector('[data-space-parent]')?.remove();host.dataset.spaceNavigation=section;
 if(!section)return;
 const [href,label,icon]=spaces[section],link=document.createElement('a');link.className='space-nav-button';link.href=href;link.dataset.spaceParent='';link.setAttribute('aria-label',label);link.title=label;
 const img=document.createElement('img');img.src='/icons/ui-'+icon+'.svg';img.width=img.height=20;img.alt='';img.setAttribute('aria-hidden','true');link.append(img);host.prepend(link);
})();
