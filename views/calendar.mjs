import {shell, privateHeader, publicHeader, footer} from './pages.mjs';

// Calendar: one place for the Selectstar, Paper and Personal schedules.
// This first version is a design draft. public/calendar/calendar-data.js fills it with
// sample events until the Outlook connection lands.
const CAL_V = '20261128-1';
const chevron = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const VIEWS = [['day', '일', 'D'], ['week', '주', 'W'], ['month', '월', 'M'], ['year', '연', 'Y']];

export function calendarPage(access) {
  const header = access ? privateHeader('/', '') : publicHeader('');
  return shell('Calendar', `
<link rel="stylesheet" href="/calendar/calendar.css?v=${CAL_V}">
<div class="cal-shell">${header}
<main id="main" class="cal-app" data-cal-app data-view="month">
  <aside class="cal-side" aria-label="날짜와 캘린더">
    <section class="cal-mini" aria-labelledby="cal-mini-title">
      <div class="cal-mini-head">
        <h2 id="cal-mini-title" data-mini-title></h2>
        <div class="cal-mini-nav">
          <button type="button" class="cal-icon-btn" data-mini-step="-1" aria-label="이전 달">${chevron('m15 18-6-6 6-6')}</button>
          <button type="button" class="cal-icon-btn" data-mini-step="1" aria-label="다음 달">${chevron('m9 18 6-6-6-6')}</button>
        </div>
      </div>
      <div class="cal-mini-grid" data-mini-grid role="grid" aria-labelledby="cal-mini-title"></div>
    </section>
    <section class="cal-sources" aria-labelledby="cal-sources-title">
      <h2 id="cal-sources-title">캘린더</h2>
      <ul data-sources></ul>
      <p class="cal-source-note">Outlook을 연결하기 전이라 예시 일정을 보여 줍니다.</p>
    </section>
    <section class="cal-upcoming" aria-labelledby="cal-upcoming-title">
      <h2 id="cal-upcoming-title">다가오는 일정</h2>
      <ol data-upcoming></ol>
    </section>
  </aside>
  <section class="cal-stage" aria-labelledby="cal-title">
    <div class="cal-toolbar">
      <div class="cal-heading">
        <h1 id="cal-title" data-cal-title aria-live="polite"></h1>
        <p class="cal-subtitle" data-cal-subtitle></p>
      </div>
      <div class="cal-controls">
        <div class="cal-step">
          <button type="button" class="cal-icon-btn" data-step="-1" aria-label="이전">${chevron('m15 18-6-6 6-6')}</button>
          <button type="button" class="cal-today btn btn--secondary" data-today aria-keyshortcuts="T">오늘</button>
          <button type="button" class="cal-icon-btn" data-step="1" aria-label="다음">${chevron('m9 18 6-6-6-6')}</button>
        </div>
        <div class="cal-views" role="group" aria-label="보기 단위">
          ${VIEWS.map(([id, label, key]) => `<button type="button" data-view-btn="${id}" aria-pressed="${id === 'month'}" aria-keyshortcuts="${key}" title="${label} 보기 (${key})">${label}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="cal-view" data-cal-view></div>
  </section>
  <div class="cal-pop" data-cal-pop role="dialog" aria-modal="false" aria-labelledby="cal-pop-title" hidden></div>
</main>
${footer()}</div>
<script src="/calendar/calendar-data.js?v=${CAL_V}" defer></script>
<script src="/calendar/calendar.js?v=${CAL_V}" defer></script>`, 'calendar');
}
