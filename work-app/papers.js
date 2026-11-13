/* Related papers are part of a task, so backups, duplication and sync retain them. */
(() => {
  'use strict';
  const fields = ['title', 'venue', 'year', 'summary', 'url', 'figure'];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeURL(value, image = false) {
    if (typeof value !== 'string' || !value) return '';
    if (image && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  }
  function normalize(items) {
    if (items === undefined) return [];
    if (!Array.isArray(items)) throw Error('관련 논문 목록 형식을 확인해 주세요.');
    return items.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('관련 논문 형식을 확인해 주세요.');
      const paper = {id: typeof item.id === 'string' && item.id ? item.id : `paper-${index}`};
      for (const name of fields) paper[name] = typeof item[name] === 'string' ? item[name] : '';
      paper.url = safeURL(paper.url); paper.figure = safeURL(paper.figure, true);
      return paper;
    });
  }
  function mount(host, task, {readOnly = false, onChange, toast, uid, autosave = false}) {
    task.papers = normalize(task.papers);
    let processing=0;
    const render = (openId = '') => {
      host.innerHTML = `<div class="papers-heading"><div><h3>관련 논문 <small>${task.papers.length}편</small></h3><p>이 연구와 연결된 논문과 핵심 Figure를 모아두세요.</p></div>${readOnly ? '' : '<button type="button" class="secondary-button" data-paper-add>＋ 논문 추가</button>'}</div><div class="paper-list">${task.papers.map((paper, index) => {
        const prefix = 'paper-' + index, figure = safeURL(paper.figure, true), url = safeURL(paper.url);
        const field = (name, label, type = 'text') => `<div class="form-field ${['title','summary','url','figure'].includes(name)?'field-full':''}"><label for="${prefix}-${name}">${label}</label>${name === 'summary' ? `<textarea id="${prefix}-${name}" data-paper-field="summary" rows="3" ${readOnly?'readonly':''}>${escape(paper.summary)}</textarea>` : `<input id="${prefix}-${name}" data-paper-field="${name}" type="${type}" value="${escape(name==='figure'&&paper.figure.startsWith('data:')?'':paper[name])}" ${name==='title'?'required maxlength="500"':''} ${name==='year'?'min="1800" max="9999"':''} ${readOnly?'readonly':''} ${name==='figure'?'placeholder="이미지 URL 또는 아래에서 파일 선택"':''}>`}</div>`;
        return `<article class="paper-card" data-paper-id="${escape(paper.id)}"><div class="paper-preview">${figure?`<a href="${escape(figure)}" target="_blank" rel="noopener noreferrer" class="paper-figure-link" aria-label="${escape(paper.title||'논문')} 대표 Figure 크게 보기"><img class="paper-figure" src="${escape(figure)}" alt="${escape(paper.title||'논문')} 대표 Figure" loading="lazy" referrerpolicy="no-referrer"></a>`:''}<div><span class="paper-meta">${escape([paper.venue,paper.year].filter(Boolean).join(' / ')||'학회와 연도 미입력')}</span><h4>${escape(paper.title||'새로운 논문')}</h4>${paper.summary?`<p class="paper-summary">${escape(paper.summary)}</p>`:''}${url?`<a class="text-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">논문 열기 ↗</a>`:''}</div></div><details class="paper-fields" ${paper.id===openId?'open':''}><summary>${readOnly?'논문 정보 보기':'논문 정보 편집'}</summary><div class="form-grid">${field('title','논문명')}${field('venue','학회 또는 저널')}${field('year','연도','number')}${field('summary','짧은 요약')}${field('url','논문 링크','url')}${field('figure','대표 Figure 이미지 URL','url')}${readOnly?'':`<div class="form-field field-full"><label for="${prefix}-upload">대표 Figure 파일</label><input id="${prefix}-upload" type="file" accept="image/png,image/jpeg,image/webp" data-paper-upload><span class="field-help" data-paper-image-status>PNG, JPG, WebP 이미지를 선택하세요.</span><button type="button" class="text-button" data-paper-clear-figure>Figure 제거</button></div><button type="button" class="danger-button" data-paper-remove>논문 제거</button>`}</div></details></article>`;
      }).join('')||'<p class="paper-empty">아직 연결된 논문이 없습니다.</p>'}</div><p class="field-help">${readOnly?'연결된 논문은 연구별로 보관됩니다.':(autosave?'논문 정보는 입력하는 즉시 자동 저장됩니다.':'논문 정보를 작성한 뒤 아래 ‘연구 구간 저장’을 눌러 반영하세요.')}</p>`;
      host.querySelectorAll('.paper-figure').forEach(image => image.onerror = () => { image.hidden = true; image.parentElement.textContent = 'Figure를 불러오지 못했습니다. 이미지 주소를 확인해 주세요.'; });
    };
    const paperFor = element => task.papers.find(paper => paper.id === element.closest('[data-paper-id]')?.dataset.paperId);
    host.addEventListener('input', event => {
      if (readOnly || !event.target.matches('[data-paper-field]')) return;
      const paper = paperFor(event.target); if (!paper) return;
      paper[event.target.dataset.paperField] = event.target.value;
      const card=event.target.closest('[data-paper-id]');
      card.querySelector('h4').textContent=paper.title||'새로운 논문';
      card.querySelector('.paper-meta').textContent=[paper.venue,paper.year].filter(Boolean).join(' / ')||'학회와 연도 미입력';
      onChange();
    });
    host.addEventListener('change', async event => {
      if (readOnly || !event.target.matches('[data-paper-upload]')) return;
      const input = event.target, file = input.files[0], paper = paperFor(input);
      if (!file || !paper) return;
      const status = input.parentElement.querySelector('[data-paper-image-status]');
      processing++;host.dataset.processing='true';
      try {
        status.textContent = '이미지를 준비하고 있습니다…';
        paper.figure = await imageData(file); onChange(); render(paper.id);
      } catch (error) { status.textContent = error.message; toast(error.message); }
      finally { processing--;host.dataset.processing=String(processing>0); }
    });
    host.addEventListener('click', event => {
      const figure=event.target.closest('.paper-figure-link');
      if(figure){
        event.preventDefault();
        const viewer=document.createElement('dialog');viewer.className='paper-figure-dialog';
        const close=document.createElement('button');close.type='button';close.textContent='닫기 ×';close.className='secondary-button';
        const image=document.createElement('img');image.src=figure.href;image.alt=figure.getAttribute('aria-label');image.referrerPolicy='no-referrer';
        viewer.append(close,image);document.body.append(viewer);close.onclick=()=>viewer.close();viewer.onclose=()=>viewer.remove();viewer.showModal();return;
      }
      if (readOnly) return;
      if (event.target.closest('[data-paper-add]')) {
        const paper = {id:uid(),...Object.fromEntries(fields.map(name => [name,'']))};
        task.papers.push(paper); onChange(); render(paper.id);
        host.querySelector(`[data-paper-id="${paper.id}"] [data-paper-field="title"]`)?.focus();
      } else if (event.target.closest('[data-paper-remove]')) {
        const paper = paperFor(event.target); task.papers = task.papers.filter(item => item !== paper); onChange(); render();
      } else if (event.target.closest('[data-paper-clear-figure]')) {
        const paper = paperFor(event.target); paper.figure = ''; onChange(); render(paper.id);
      }
    });
    render();
  }
  async function imageData(file) {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 8*1024*1024) throw Error('8MB 이하의 PNG, JPG, WebP 파일을 선택해 주세요.');
    const source = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = source; await image.decode();
      const scale = Math.min(1,1400/image.width,1400/image.height);
      const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width*scale); canvas.height = Math.round(image.height*scale);
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      let data = canvas.toDataURL('image/webp',0.82);
      if (data.length > 280000) data = canvas.toDataURL('image/webp',0.55);
      if (data.length > 360000) throw Error('이 이미지는 너무 복잡합니다. Figure 영역만 잘라 다시 선택해 주세요.');
      return data;
    } finally { URL.revokeObjectURL(source); }
  }
  window.ResearchPapers = {normalize, safeURL, mount};
})();
