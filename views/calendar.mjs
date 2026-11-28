import {shell, privateHeader, publicHeader, footer} from './pages.mjs';

// Calendar: one place for the Selectstar, Paper and Personal schedules.
// Selectstar is read from Outlook; Personal and Paper are written here. Sample events from
// public/calendar/calendar-data.js appear only on the local dev server without signing in.
const CAL_V = '20261128-3';
const close = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const plus = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;

// One form for new and existing events. calendar.js fills it and decides which fields show.
const editor = `<dialog class="cal-editor" data-cal-editor aria-labelledby="cal-editor-title">
  <form data-editor-form novalidate>
    <header class="cal-editor-head">
      <h2 id="cal-editor-title" data-editor-title>새 일정</h2>
      <button type="button" class="cal-icon-btn" data-editor-cancel aria-label="닫기">${close}</button>
    </header>
    <input class="cal-editor-name" name="title" type="text" maxlength="200" placeholder="제목" aria-label="제목" autocomplete="off" required>
    <div class="cal-editor-cals" role="radiogroup" aria-label="캘린더" data-editor-cals></div>
    <div class="cal-editor-when">
      <label class="cal-editor-allday"><input type="checkbox" name="allDay"><span>종일</span></label>
      <div class="cal-editor-range">
        <span class="cal-editor-label" id="cal-editor-start">시작</span>
        <input type="date" name="startDate" aria-labelledby="cal-editor-start" required>
        <input type="time" name="startTime" step="300" aria-label="시작 시간" data-time>
        <span class="cal-editor-label" id="cal-editor-end">종료</span>
        <input type="date" name="endDate" aria-labelledby="cal-editor-end" required>
        <input type="time" name="endTime" step="300" aria-label="종료 시간" data-time>
      </div>
    </div>
    <label class="cal-editor-field"><span>장소</span><input name="place" type="text" maxlength="200" autocomplete="off"></label>
    <label class="cal-editor-field"><span>메모</span><textarea name="note" rows="3" maxlength="4000"></textarea></label>
    <p class="cal-editor-error" role="alert" data-editor-error hidden></p>
    <footer class="cal-editor-actions">
      <button type="button" class="cal-editor-delete" data-editor-delete hidden>삭제</button>
      <button type="button" class="btn btn--secondary" data-editor-cancel>취소</button>
      <button type="submit" class="btn btn--primary" data-editor-save>저장</button>
    </footer>
  </form>
</dialog>`;
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
      <div class="cal-sources-head"><h2 id="cal-sources-title">캘린더</h2>${access ? '<a href="/settings?returnTo=%2Fcalendar#calendar">순서와 색</a>' : ''}</div>
      <ul data-sources></ul>
      <p class="cal-source-note" data-source-note aria-live="polite">일정을 불러오는 중입니다.</p>
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
        <button type="button" class="cal-new btn btn--primary" data-new-event aria-keyshortcuts="N" title="새 일정 (N)">${plus}<span>새 일정</span></button>
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
  ${editor}
  <div class="cal-toast" data-cal-toast role="status" aria-live="polite" hidden></div>
</main>
${footer()}</div>
<script src="/calendar/calendar-palette.js?v=${CAL_V}" defer></script>
<script src="/calendar/calendar-data.js?v=${CAL_V}" defer></script>
<script src="/calendar/calendar.js?v=${CAL_V}" defer></script>`, 'calendar');
}
