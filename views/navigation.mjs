const spaces={work:{href:'/work',label:'Work 홈',icon:'briefcase-business'},paper:{href:'/paper',label:'Paper 홈',icon:'book-open'},personal:{href:'/personal',label:'Personal 홈',icon:'user-round'}};
export function spaceNavigation(section='',className=''){
 const parent=spaces[section];
 const link=(href,label,icon,kind)=>`<a class="space-nav-button" href="${href}" aria-label="${label}" title="${label}" ${kind==='parent'?'data-space-parent':''}><img src="/icons/ui-${icon}.svg" width="20" height="20" alt="" aria-hidden="true"></a>`;
 return `<nav class="space-navigation ${className}" data-space-navigation="${parent?section:''}" aria-label="홈 이동">${parent?link(parent.href,parent.label,parent.icon,'parent'):''}${link('/','전체 홈','house','home')}</nav>`;
}
export function addDemoNavigation(html){
 if(html.includes('data-space-navigation'))return html;
 const style='<link rel="stylesheet" href="/space-navigation.css?v=20261117-1">';
 const bar=`<div class="demo-spacebar">${spaceNavigation('work')}</div>`;
 return html.replace(/<\/head>/i,style+'</head>').replace(/(<body\b[^>]*>)/i,'$1'+bar);
}
