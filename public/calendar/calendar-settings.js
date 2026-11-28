/* Settings > 캘린더: the order of the calendars and the colour of each one.
   Saved for the site owner; the Calendar page reads it on every load. */
(() => {
  'use strict';
  const root = document.querySelector('[data-calendar-settings]');
  const palette = window.CalendarPalette;
  if (!root || !palette) return;
  const details = {personal: '직접 입력', work: 'Outlook에서 읽기', paper: '직접 입력', holiday: '대한민국'};
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const arrow = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  let saved = null, draft = null, revision = null, busy = false;

  const swatches = id => `<div class="cal-set-colors" role="radiogroup" aria-label="${esc(palette.names[id])} 색">${Object.entries(palette.colors).map(([key, c]) =>
    `<label class="cal-set-color" title="${esc(c.name)}" style="--sw-light:${c.light[0]};--sw-dark:${c.dark[0]}"><input type="radio" name="color-${id}" value="${key}"${draft.colors[id] === key ? ' checked' : ''} aria-label="${esc(c.name)}"><span aria-hidden="true"></span></label>`).join('')}</div>`;
  const row = (id, index) => `<li class="cal-set-row" data-cal="${id}">
      ${index == null ? '<span class="cal-set-rank" aria-hidden="true"></span>' : `<span class="cal-set-rank">${index + 1}</span>`}
      <span class="cal-set-name"><span class="cal-swatch" aria-hidden="true"></span><strong>${esc(palette.names[id])}</strong><small>${esc(details[id])}</small></span>
      ${index == null ? '<span class="cal-set-move"></span>' : `<span class="cal-set-move">
        <button type="button" class="cal-set-step" data-move="${id}" data-dir="-1" aria-label="${esc(palette.names[id])} 위로"${index === 0 ? ' disabled' : ''}>${arrow('m18 15-6-6-6 6')}</button>
        <button type="button" class="cal-set-step" data-move="${id}" data-dir="1" aria-label="${esc(palette.names[id])} 아래로"${index === draft.order.length - 1 ? ' disabled' : ''}>${arrow('m6 9 6 6 6-6')}</button>
      </span>`}
      ${swatches(id)}
    </li>`;
  const changed = () => JSON.stringify(draft) !== JSON.stringify(saved);

  function render(focus) {
    root.innerHTML = `<ol class="cal-set-list" aria-label="캘린더 순서">${draft.order.map(row).join('')}</ol>
      <ul class="cal-set-list cal-set-extra">${row('holiday', null)}</ul>
      <div class="cal-set-preview" aria-label="미리보기"><span class="cal-set-preview-label">같은 시각에 겹친 일정</span><div>${draft.order.map(id => `<span class="cal-set-chip" data-cal="${id}"><b>10:00</b>${esc(palette.names[id])}</span>`).join('')}</div></div>
      <div class="cal-set-actions"><button type="button" class="paper-btn primary" data-cal-save${changed() ? '' : ' disabled'}>저장</button><button type="button" class="paper-btn" data-cal-reset>기본값으로</button><span class="paper-subtle" role="status" data-cal-status>${changed() ? '저장하지 않은 변경이 있습니다.' : ''}</span></div>`;
    palette.apply(draft);
    if (focus) root.querySelector(focus)?.focus();
  }
  const status = text => { const n = root.querySelector('[data-cal-status]'); if (n) n.textContent = text; };

  async function api(method, payload) {
    const response = await fetch('/api/calendar/settings', {method, credentials: 'same-origin', headers: {'Content-Type': 'application/json', accept: 'application/json'}, body: payload ? JSON.stringify(payload) : undefined});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '캘린더 설정을 처리하지 못했습니다.');
    return result;
  }

  root.addEventListener('click', async event => {
    const t = event.target.closest('button');
    if (!t || busy) return;
    if (t.dataset.move) {
      const i = draft.order.indexOf(t.dataset.move), j = i + Number(t.dataset.dir);
      if (j < 0 || j >= draft.order.length) return;
      [draft.order[i], draft.order[j]] = [draft.order[j], draft.order[i]];
      // Keep the keyboard on the row that moved; at an end, the other arrow is the one left.
      const id = t.dataset.move, dir = t.dataset.dir, edge = j === 0 || j === draft.order.length - 1;
      return render(`[data-move="${id}"][data-dir="${edge ? -dir : dir}"]`);
    }
    if (t.matches('[data-cal-reset]')) { draft = clone(palette.defaults); return render(); }
    if (t.matches('[data-cal-save]')) {
      busy = true; t.disabled = true; status('저장하는 중입니다.');
      try {
        const result = await api('PUT', {config: draft, expectedRevision: revision});
        saved = clone(result.config); draft = clone(result.config); revision = result.revision;
        render(); status('저장했습니다. Calendar에 바로 반영됩니다.');
      } catch (error) { t.disabled = false; status(error.message); }
      finally { busy = false; }
    }
  });
  root.addEventListener('change', event => {
    const input = event.target.closest('.cal-set-color input');
    if (!input) return;
    draft.colors[input.name.slice('color-'.length)] = input.value;
    render(`[name="${input.name}"][value="${input.value}"]`);
  });

  (async () => {
    try {
      const result = await api('GET');
      saved = clone(result.config); draft = clone(result.config); revision = result.revision;
      render();
    } catch (error) {
      root.innerHTML = `<p class="paper-subtle">${esc(error.message)}</p>`;
    } finally { root.setAttribute('aria-busy', 'false'); }
  })();
})();
