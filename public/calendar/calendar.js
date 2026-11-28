/* Calendar: day, week, month and year views over one list of events.
   The view and date live in the URL (?view=week&date=2026-11-28) so a reload or a shared link
   opens the same place. Keys: D W M Y switch views, T goes to today, the arrow keys step. */
(() => {
  'use strict';
  const app = document.querySelector('[data-cal-app]');
  const sample = window.CalendarSample;
  if (!app || !sample) return;

  const WEEK_START = 0; // Sunday first, as Korean wall calendars and Outlook in Korean do.
  const HOUR = 48;      // px per hour in the day and week grids
  const MONTH_LINES = 4; // event lines a month cell shows before "+n"
  const VIEWS = ['day', 'week', 'month', 'year'];
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

  const $ = (sel, root = app) => root.querySelector(sel);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addMonths = (d, n) => { const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate(); return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)); };
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const startOfWeek = d => addDays(startOfDay(d), -((d.getDay() - WEEK_START + 7) % 7));
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayKey = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const minutes = d => d.getHours() * 60 + d.getMinutes();
  const parseIso = value => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  };

  const fmt = (options) => new Intl.DateTimeFormat('ko-KR', options);
  const fLong = fmt({year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'});
  const fMonthDayWeek = fmt({month: 'long', day: 'numeric', weekday: 'short'});
  const time = d => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const shortTime = time;

  const calendars = new Map(sample.calendars.map(c => [c.id, c]));
  const byStart = (a, b) => a.start - b.start || b.end - a.end;
  let events = sample.events.slice().sort(byStart);
  let shownCalendars = sample.calendars;
  const holidays = sample.holidays;

  // ---------------------------------------------------------------- state
  const params = new URLSearchParams(location.search);
  const state = {
    view: VIEWS.includes(params.get('view')) ? params.get('view') : (matchMedia('(max-width: 640px)').matches ? 'day' : 'month'),
    date: parseIso(params.get('date')) || startOfDay(new Date()),
    mini: null,
    hidden: new Set(),
  };
  try { for (const id of JSON.parse(localStorage.getItem('kh-calendar-hidden') || '[]')) if (calendars.has(id)) state.hidden.add(id); } catch {}
  state.mini = new Date(state.date.getFullYear(), state.date.getMonth(), 1);

  const visible = () => events.filter(e => !state.hidden.has(e.cal));
  const between = (from, to) => visible().filter(e => e.start < to && e.end > from);
  const isSpan = e => e.allDay || e.end - e.start >= 864e5; // drawn as a bar, not in the time grid
  const isHoliday = d => holidays.has(dayKey(d)) && !state.hidden.has('holiday');
  const dayClass = d => {
    const out = [];
    if (sameDay(d, new Date())) out.push('is-today');
    if (d.getDay() === 0 || isHoliday(d)) out.push('is-sun');
    else if (d.getDay() === 6) out.push('is-sat');
    return out.join(' ');
  };

  // ---------------------------------------------------------------- shared pieces
  const eventLabel = e => {
    const c = calendars.get(e.cal);
    const when = e.allDay
      ? (e.end - e.start > 864e5 ? `${fMonthDayWeek.format(e.start)}부터 ${fMonthDayWeek.format(addDays(e.end, -1))}까지` : `${fMonthDayWeek.format(e.start)} 종일`)
      : `${fMonthDayWeek.format(e.start)} ${time(e.start)}부터 ${time(e.end)}까지`;
    return `${e.title}, ${when}, ${c.name}`;
  };
  const eventAttrs = e => `type="button" class="cal-event" data-cal="${e.cal}" data-event="${esc(e.id)}" aria-label="${esc(eventLabel(e))}"`;

  // Lanes for bars inside one row of days: first-fit by start date.
  function laneBars(list, first, count) {
    const last = addDays(first, count);
    const bars = list.filter(e => isSpan(e) && e.start < last && e.end > first).map(e => {
      const from = e.start < first ? first : startOfDay(e.start);
      const endDay = e.allDay ? addDays(e.end, -1) : startOfDay(new Date(e.end - 1));
      const to = endDay >= last ? addDays(last, -1) : endDay;
      const col = Math.round((from - first) / 864e5);
      const span = Math.round((to - from) / 864e5) + 1;
      return {e, col, span, cutStart: e.start < first, cutEnd: endDay >= last};
    }).sort((a, b) => a.col - b.col || b.span - a.span || a.e.start - b.e.start);
    const ends = [];
    for (const bar of bars) {
      let lane = ends.findIndex(end => end <= bar.col);
      if (lane < 0) lane = ends.length;
      ends[lane] = bar.col + bar.span;
      bar.lane = lane;
    }
    return {bars, lanes: ends.length};
  }
  const barHtml = (bar, row = null) => {
    const {e} = bar;
    const timeText = e.allDay ? '' : `<span class="cal-event-time">${shortTime(e.start)}</span>`;
    return `<button ${eventAttrs(e)} data-kind="bar"${bar.cutStart ? ' data-cut-start' : ''}${bar.cutEnd ? ' data-cut-end' : ''} style="grid-column:${bar.col + 1} / span ${bar.span};grid-row:${row ?? bar.lane + 1}">${timeText}<span class="cal-event-title">${esc(e.title)}</span></button>`;
  };

  // ---------------------------------------------------------------- day and week
  function layoutDay(list) {
    // Overlapping events share the width; each cluster gets as many columns as it needs.
    const items = list.slice().sort((a, b) => a.top - b.top || b.bottom - a.bottom);
    let cluster = [], columns = [], clusterEnd = -1;
    const close = () => { for (const item of cluster) item.cols = columns.length; cluster = []; columns = []; };
    for (const item of items) {
      if (item.top >= clusterEnd) close();
      let col = columns.findIndex(end => end <= item.top);
      if (col < 0) col = columns.length;
      columns[col] = item.bottom;
      item.col = col;
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.bottom);
    }
    close();
    return items;
  }

  function timeGrid(days) {
    const first = days[0], last = addDays(days[days.length - 1], 1);
    const list = between(first, last);
    const {bars, lanes} = laneBars(list, first, days.length);
    const now = new Date();
    const head = days.map(d => `<button type="button" class="cal-col-head ${dayClass(d)}" data-goto="${iso(d)}" aria-label="${esc(fLong.format(d))} 일간 보기"><span class="cal-col-name">${DAY_NAMES[d.getDay()]}</span><span class="cal-col-date">${d.getDate()}</span></button>`).join('');
    const cols = days.map(d => {
      const next = addDays(d, 1);
      const items = layoutDay(list.filter(e => !isSpan(e) && e.start < next && e.end > d).map(e => {
        const top = Math.max(0, (e.start - d) / 6e4), bottom = Math.min(1440, (e.end - d) / 6e4);
        return {e, top, bottom: Math.max(bottom, top + 20)};
      }));
      const blocks = items.map(({e, top, bottom, col, cols}) => {
        const short = bottom - top < 45;
        return `<button ${eventAttrs(e)} data-kind="block"${short ? ' data-short' : ''} style="top:${top / 60 * HOUR}px;height:${(bottom - top) / 60 * HOUR - 2}px;left:calc(${col / cols * 100}% + 2px);width:calc(${100 / cols}% - 4px)"><span class="cal-event-title">${esc(e.title)}</span><span class="cal-event-time">${time(e.start)}${short ? '' : ` – ${time(e.end)}`}</span>${!short && e.place && bottom - top >= 90 ? `<span class="cal-event-place">${esc(e.place)}</span>` : ''}</button>`;
      }).join('');
      const nowLine = sameDay(d, now) ? `<div class="cal-now" data-now style="top:${minutes(now) / 60 * HOUR}px" aria-hidden="true"></div>` : '';
      return `<div class="cal-col ${dayClass(d)}">${blocks}${nowLine}</div>`;
    }).join('');
    const hours = Array.from({length: 23}, (_, i) => `<span style="top:${(i + 1) * HOUR}px">${i + 1}시</span>`).join('');
    const grid = `<div class="cal-grid" style="--days:${days.length};--hour:${HOUR}px">
      <div class="cal-grid-scroll" data-grid-scroll tabindex="0" aria-label="시간대별 일정">
        <div class="cal-grid-sticky">
          ${days.length > 1 ? `<div class="cal-grid-head"><span class="cal-gutter" aria-hidden="true"></span>${head}</div>` : ''}
          <div class="cal-allday"${lanes ? '' : ' data-empty'}><span class="cal-gutter">종일</span><div class="cal-allday-lanes" style="grid-template-rows:repeat(${Math.max(lanes, 1)}, 24px)">${bars.map(b => barHtml(b)).join('')}</div></div>
        </div>
        <div class="cal-grid-body"><div class="cal-hours" aria-hidden="true">${hours}</div><div class="cal-cols">${cols}</div></div>
      </div>
    </div>`;
    return days.length > 1 ? grid : `<div class="cal-day">${grid}${dayAgenda(first, list)}</div>`;
  }

  // Day view: the same events as a readable list beside the grid, with place and memo.
  function dayAgenda(d, list) {
    const items = list.filter(e => e.cal !== 'holiday').sort((a, b) => (b.allDay - a.allDay) || a.start - b.start);
    const holiday = list.find(e => e.cal === 'holiday' && sameDay(e.start, d));
    const rows = items.map(e => {
      const c = calendars.get(e.cal);
      const span = isSpan(e);
      const when = e.allDay ? '종일' : span ? `${time(e.start)}부터` : time(e.start);
      const until = !e.allDay && !span ? time(e.end) : '';
      return `<li data-cal="${e.cal}"><button ${eventAttrs(e)} data-kind="agenda"><span class="cal-agenda-time">${when}${until ? `<small>${until}</small>` : ''}</span><span class="cal-agenda-body"><span class="cal-event-title">${esc(e.title)}</span><span class="cal-agenda-meta"><span class="cal-swatch" aria-hidden="true"></span>${esc(c.name)}${e.place ? `<span>${esc(e.place)}</span>` : ''}</span>${e.note ? `<span class="cal-agenda-note">${esc(e.note)}</span>` : ''}</span></button></li>`;
    }).join('');
    return `<aside class="cal-agenda" aria-labelledby="cal-agenda-title"><h2 id="cal-agenda-title">이날 일정 <span>${items.length}개</span></h2>${holiday ? `<p class="cal-agenda-holiday">${esc(holiday.title)}</p>` : ''}${rows ? `<ol>${rows}</ol>` : '<p class="cal-agenda-empty">잡힌 일정이 없습니다.</p>'}</aside>`;
  }

  // ---------------------------------------------------------------- month
  function monthView() {
    const first = new Date(state.date.getFullYear(), state.date.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const weeks = Math.ceil((Math.round((lastDay - gridStart) / 864e5) + 1) / 7);
    const names = Array.from({length: 7}, (_, i) => {
      const w = (i + WEEK_START) % 7;
      return `<span class="${w === 0 ? 'is-sun' : w === 6 ? 'is-sat' : ''}">${DAY_NAMES[w]}</span>`;
    }).join('');
    let rows = '';
    for (let w = 0; w < weeks; w++) {
      const ws = addDays(gridStart, w * 7);
      const list = between(ws, addDays(ws, 7));
      const {bars} = laneBars(list, ws, 7);
      // Rows 2..(MONTH_LINES+1) hold events; row 1 is the date number.
      const used = Array.from({length: 7}, () => new Set());
      const hiddenCount = Array(7).fill(0);
      const shown = [];
      for (const bar of bars) {
        if (bar.lane < MONTH_LINES - 1) {
          shown.push(barHtml(bar, bar.lane + 2));
          for (let c = bar.col; c < bar.col + bar.span; c++) used[c].add(bar.lane);
        } else for (let c = bar.col; c < bar.col + bar.span; c++) hiddenCount[c]++;
      }
      let cells = '', chips = '';
      for (let c = 0; c < 7; c++) {
        const d = addDays(ws, c);
        const timed = list.filter(e => !isSpan(e) && sameDay(e.start, d));
        const free = Array.from({length: MONTH_LINES}, (_, i) => i).filter(i => !used[c].has(i));
        const total = timed.length + hiddenCount[c];
        const room = total > free.length ? free.length - 1 : free.length;
        timed.slice(0, Math.max(room, 0)).forEach((e, i) => {
          chips += `<button ${eventAttrs(e)} data-kind="chip" style="grid-column:${c + 1};grid-row:${free[i] + 2}"><span class="cal-event-time">${shortTime(e.start)}</span><span class="cal-event-title">${esc(e.title)}</span></button>`;
        });
        const more = total - Math.max(room, 0);
        if (more > 0 && free.length) chips += `<button type="button" class="cal-more" data-goto="${iso(d)}" style="grid-column:${c + 1};grid-row:${free[free.length - 1] + 2}">${more}개 더</button>`;
        const outside = d.getMonth() !== first.getMonth();
        const holiday = isHoliday(d) ? events.find(e => e.cal === 'holiday' && sameDay(e.start, d)) : null;
        cells += `<div class="cal-cell ${dayClass(d)}${outside ? ' is-outside' : ''}${sameDay(d, state.date) ? ' is-selected' : ''}" style="grid-column:${c + 1}"><button type="button" class="cal-date" data-goto="${iso(d)}" aria-label="${esc(fLong.format(d))}${holiday ? ', ' + esc(holiday.title) : ''} 일간 보기">${d.getDate() === 1 ? `<span class="cal-date-unit">${d.getMonth() + 1}월&nbsp;</span>1<span class="cal-date-unit">일</span>` : d.getDate()}</button></div>`;
      }
      rows += `<div class="cal-week">${cells}${shown.join('')}${chips}</div>`;
    }
    return `<div class="cal-month" style="--weeks:${weeks};--lines:${MONTH_LINES}"><div class="cal-month-names" aria-hidden="true">${names}</div><div class="cal-month-rows">${rows}</div></div>`;
  }

  // ---------------------------------------------------------------- year
  function yearView() {
    const y = state.date.getFullYear();
    const counts = new Map(), spans = new Map();
    for (const e of visible()) {
      if (e.cal === 'holiday') continue;
      for (let d = startOfDay(e.start); d < e.end; d = addDays(d, 1)) {
        if (d.getFullYear() !== y) continue;
        counts.set(dayKey(d), (counts.get(dayKey(d)) || 0) + 1);
        // All-day blocks (trips, deadlines, leave) are underlined in their calendar's colour.
        if (e.allDay && !spans.has(dayKey(d))) spans.set(dayKey(d), e.cal);
      }
    }
    const level = n => n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4;
    const names = Array.from({length: 7}, (_, i) => `<span>${DAY_NAMES[(i + WEEK_START) % 7]}</span>`).join('');
    let months = '';
    for (let m = 0; m < 12; m++) {
      const first = new Date(y, m, 1), lead = (first.getDay() - WEEK_START + 7) % 7;
      const len = new Date(y, m + 1, 0).getDate();
      let total = 0, cells = '<span></span>'.repeat(lead);
      for (let d = 1; d <= len; d++) {
        const date = new Date(y, m, d), n = counts.get(dayKey(date)) || 0;
        total += n;
        const span = spans.get(dayKey(date));
        cells += `<button type="button" class="cal-yday ${dayClass(date)}" data-level="${level(n)}"${span ? ` data-span data-cal="${span}"` : ''} data-goto="${iso(date)}" aria-label="${esc(fLong.format(date))}, 일정 ${n}개">${d}</button>`;
      }
      months += `<section class="cal-ymonth${m === new Date().getMonth() && y === new Date().getFullYear() ? ' is-current' : ''}" aria-labelledby="ym-${m}"><header><button type="button" id="ym-${m}" data-goto-month="${iso(first)}">${m + 1}월</button><span>${total}개</span></header><div class="cal-ygrid"><div class="cal-ynames" aria-hidden="true">${names}</div>${cells}</div></section>`;
    }
    const legend = `<div class="cal-legend" aria-hidden="true"><span>일정 적음</span>${[0, 1, 2, 3, 4].map(l => `<i data-level="${l}"></i>`).join('')}<span>많음</span></div>`;
    return `<div class="cal-year">${months}</div>${legend}`;
  }

  // ---------------------------------------------------------------- sidebar
  function renderMini() {
    const first = state.mini, start = startOfWeek(first);
    $('[data-mini-title]').textContent = `${first.getFullYear()}년 ${first.getMonth() + 1}월`;
    const busy = new Set();
    for (const e of between(start, addDays(start, 42))) if (e.cal !== 'holiday') for (let d = startOfDay(e.start); d < e.end; d = addDays(d, 1)) busy.add(dayKey(d));
    let html = `<div class="cal-mini-names" role="row">${Array.from({length: 7}, (_, i) => `<span role="columnheader" aria-label="${DAY_NAMES[(i + WEEK_START) % 7]}요일">${DAY_NAMES[(i + WEEK_START) % 7]}</span>`).join('')}</div>`;
    for (let w = 0; w < 6; w++) {
      html += '<div class="cal-mini-row" role="row">';
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, w * 7 + i);
        const cls = [dayClass(d), d.getMonth() !== first.getMonth() ? 'is-outside' : '', sameDay(d, state.date) ? 'is-selected' : '', busy.has(dayKey(d)) ? 'has-events' : ''].filter(Boolean).join(' ');
        html += `<button type="button" role="gridcell" class="${cls}" data-mini-day="${iso(d)}" aria-label="${esc(fLong.format(d))}"${sameDay(d, state.date) ? ' aria-selected="true"' : ''}>${d.getDate()}</button>`;
      }
      html += '</div>';
    }
    $('[data-mini-grid]').innerHTML = html;
  }

  function renderSources() {
    $('[data-sources]').innerHTML = shownCalendars.map(c => `<li><label class="cal-source" data-cal="${c.id}"><input type="checkbox" value="${c.id}"${state.hidden.has(c.id) ? '' : ' checked'}><span class="cal-swatch" aria-hidden="true"></span><span class="cal-source-name">${esc(c.name)}</span><span class="cal-source-detail">${esc(c.detail)}</span></label></li>`).join('');
  }

  function renderUpcoming() {
    const now = new Date();
    const next = visible().filter(e => e.cal !== 'holiday' && e.end > now).sort((a, b) => a.start - b.start).slice(0, 6);
    const today = startOfDay(now);
    const dayName = d => sameDay(d, today) ? '오늘' : sameDay(d, addDays(today, 1)) ? '내일' : fMonthDayWeek.format(d);
    let lastDay = '';
    $('[data-upcoming]').innerHTML = next.map(e => {
      const label = e.start < now ? '진행 중' : dayName(startOfDay(e.start));
      const heading = label !== lastDay ? `<li class="cal-up-day">${label}</li>` : '';
      lastDay = label;
      return `${heading}<li><button ${eventAttrs(e)} data-kind="row"><span class="cal-swatch" aria-hidden="true"></span><span class="cal-event-title">${esc(e.title)}</span><span class="cal-event-time">${e.allDay ? '종일' : time(e.start)}</span></button></li>`;
    }).join('') || '<li class="cal-up-empty">남은 일정이 없습니다.</li>';
  }

  // ---------------------------------------------------------------- toolbar and render
  function titles() {
    const d = state.date, y = d.getFullYear();
    if (state.view === 'year') return [`${y}년`, ''];
    if (state.view === 'month') return [`${y}년 ${d.getMonth() + 1}월`, ''];
    if (state.view === 'day') {
      const holiday = isHoliday(d) ? events.find(e => e.cal === 'holiday' && sameDay(e.start, d))?.title : '';
      return [`${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`, [y + '년', holiday].filter(Boolean).join(', ')];
    }
    const s = startOfWeek(d), e = addDays(s, 6);
    const head = s.getMonth() === e.getMonth() ? `${s.getMonth() + 1}월 ${s.getDate()}일 – ${e.getDate()}일` : `${s.getMonth() + 1}월 ${s.getDate()}일 – ${e.getMonth() + 1}월 ${e.getDate()}일`;
    return [head, s.getFullYear() === e.getFullYear() ? `${y}년` : `${s.getFullYear()}년 – ${e.getFullYear()}년`];
  }

  const stepLabels = {day: ['전날', '다음 날'], week: ['이전 주', '다음 주'], month: ['이전 달', '다음 달'], year: ['이전 해', '다음 해']};
  let scrollMemo = null;

  function render({keepScroll = false} = {}) {
    closePop();
    const scroller = $('[data-grid-scroll]');
    scrollMemo = keepScroll && scroller ? scroller.scrollTop : null;
    app.dataset.view = state.view;
    const [title, sub] = titles();
    $('[data-cal-title]').textContent = title;
    $('[data-cal-subtitle]').textContent = sub;
    $('[data-cal-subtitle]').hidden = !sub;
    document.title = `${title} | Calendar | Kyohoon Jin`;
    for (const btn of app.querySelectorAll('[data-view-btn]')) btn.setAttribute('aria-pressed', String(btn.dataset.viewBtn === state.view));
    const [prev, next] = stepLabels[state.view];
    $('[data-step="-1"]').setAttribute('aria-label', prev);
    $('[data-step="1"]').setAttribute('aria-label', next);
    const view = $('[data-cal-view]');
    if (state.view === 'day') view.innerHTML = timeGrid([startOfDay(state.date)]);
    else if (state.view === 'week') view.innerHTML = timeGrid(Array.from({length: 7}, (_, i) => addDays(startOfWeek(state.date), i)));
    else if (state.view === 'month') view.innerHTML = monthView();
    else view.innerHTML = yearView();
    const grid = $('[data-grid-scroll]');
    if (grid) {
      const now = new Date();
      const showsToday = state.view === 'day' ? sameDay(state.date, now) : startOfWeek(state.date).getTime() === startOfWeek(now).getTime();
      // Open on the working day; on today's page keep the red line in view with a few hours before it.
      const visibleHours = grid.clientHeight / HOUR;
      const startHour = showsToday ? Math.max(7, Math.min(now.getHours() - 4, 24 - visibleHours)) : 7;
      grid.scrollTop = scrollMemo ?? Math.max(0, startHour * HOUR - 10);
    }
    renderMini();
    renderUpcoming();
    const url = new URL(location.href);
    url.searchParams.set('view', state.view);
    url.searchParams.set('date', iso(state.date));
    history.replaceState(null, '', url);
  }

  const go = (patch, options) => {
    Object.assign(state, patch);
    if (patch.date) state.mini = new Date(state.date.getFullYear(), state.date.getMonth(), 1);
    render(options);
  };
  const step = dir => {
    const d = state.date;
    const date = state.view === 'day' ? addDays(d, dir) : state.view === 'week' ? addDays(d, dir * 7) : state.view === 'month' ? addMonths(d, dir) : new Date(d.getFullYear() + dir, d.getMonth(), Math.min(d.getDate(), 28));
    go({date});
  };

  // ---------------------------------------------------------------- popover
  const pop = $('[data-cal-pop]');
  let popFrom = null;
  function openPop(button) {
    const e = events.find(item => item.id === button.dataset.event);
    if (!e) return;
    const c = calendars.get(e.cal);
    const days = Math.round((e.end - e.start) / 864e5);
    const when = e.allDay
      ? (days > 1 ? `${fMonthDayWeek.format(e.start)} – ${fMonthDayWeek.format(addDays(e.end, -1))}` : `${fLong.format(e.start)}`)
      : `${fLong.format(e.start)}`;
    const hours = e.allDay ? (days > 1 ? `종일, ${days}일` : '종일') : `${time(e.start)} – ${time(e.end)}`;
    pop.dataset.cal = e.cal;
    pop.innerHTML = `<div class="cal-pop-head"><span class="cal-pop-cal"><span class="cal-swatch" aria-hidden="true"></span>${esc(c.name)}</span><button type="button" class="cal-icon-btn" data-pop-close aria-label="닫기"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <h2 id="cal-pop-title">${esc(e.title)}</h2>
      <dl><div><dt>날짜</dt><dd>${esc(when)}</dd></div><div><dt>시간</dt><dd>${esc(hours)}</dd></div>${e.place ? `<div><dt>장소</dt><dd>${esc(e.place)}</dd></div>` : ''}${e.note ? `<div><dt>메모</dt><dd>${esc(e.note)}</dd></div>` : ''}</dl>`;
    pop.hidden = false;
    popFrom = button;
    app.querySelectorAll('.cal-event.is-open').forEach(el => el.classList.remove('is-open'));
    button.classList.add('is-open');
    placePop(button);
    pop.querySelector('[data-pop-close]').focus({preventScroll: true});
  }
  function placePop(button) {
    if (matchMedia('(max-width: 640px)').matches) { pop.style.left = pop.style.top = ''; return; }
    const r = button.getBoundingClientRect(), p = pop.getBoundingClientRect();
    const gap = 8, vw = innerWidth, vh = innerHeight;
    let left = r.right + gap;
    if (left + p.width > vw - 12) left = r.left - gap - p.width;
    if (left < 12) left = Math.min(Math.max(12, r.left), vw - p.width - 12);
    let top = left === r.right + gap || left === r.left - gap - p.width ? r.top : r.bottom + gap;
    top = Math.min(Math.max(12, top), vh - p.height - 12);
    pop.style.left = `${left + scrollX}px`;
    pop.style.top = `${top + scrollY}px`;
  }
  function closePop({restore = false} = {}) {
    if (pop.hidden) return;
    pop.hidden = true;
    popFrom?.classList.remove('is-open');
    if (restore && popFrom?.isConnected) popFrom.focus({preventScroll: true});
    popFrom = null;
  }

  // ---------------------------------------------------------------- events
  app.addEventListener('click', event => {
    const t = event.target.closest('button, input');
    if (!t) return;
    if (t.matches('[data-pop-close]')) return closePop({restore: true});
    if (t.matches('.cal-event')) { event.stopPropagation(); return popFrom === t ? closePop() : openPop(t); }
    if (t.dataset.viewBtn) return go({view: t.dataset.viewBtn});
    if (t.dataset.step) return step(Number(t.dataset.step));
    if (t.matches('[data-today]')) return go({date: startOfDay(new Date())});
    if (t.dataset.goto) return go({view: 'day', date: parseIso(t.dataset.goto)});
    if (t.dataset.gotoMonth) return go({view: 'month', date: parseIso(t.dataset.gotoMonth)});
    if (t.dataset.miniDay) return go({date: parseIso(t.dataset.miniDay)});
    if (t.dataset.miniStep) { state.mini = new Date(state.mini.getFullYear(), state.mini.getMonth() + Number(t.dataset.miniStep), 1); return renderMini(); }
  });
  app.addEventListener('change', event => {
    const input = event.target.closest('[data-sources] input');
    if (!input) return;
    if (input.checked) state.hidden.delete(input.value); else state.hidden.add(input.value);
    try { localStorage.setItem('kh-calendar-hidden', JSON.stringify([...state.hidden])); } catch {}
    render({keepScroll: true});
  });
  document.addEventListener('click', event => { if (!pop.hidden && !pop.contains(event.target)) closePop(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !pop.hidden) return closePop({restore: true});
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable]')) return;
    const keys = {d: 'day', w: 'week', m: 'month', y: 'year'};
    const k = event.key.toLowerCase();
    if (keys[k]) { event.preventDefault(); go({view: keys[k]}); }
    else if (k === 't') { event.preventDefault(); go({date: startOfDay(new Date())}); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (event.target.closest('[data-grid-scroll]') === null && event.target.closest('.cal-event, .cal-mini-grid')) return;
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  addEventListener('resize', () => { if (popFrom) placePop(popFrom); });

  // The red line follows the clock; a new day redraws everything.
  let renderedDay = startOfDay(new Date()).getTime();
  setInterval(() => {
    const now = new Date();
    if (startOfDay(now).getTime() !== renderedDay) { renderedDay = startOfDay(now).getTime(); return render({keepScroll: true}); }
    app.querySelectorAll('[data-now]').forEach(line => { line.style.top = `${minutes(now) / 60 * HOUR}px`; });
  }, 30000);

  // Outlook: the server reads the published .ics links and returns plain events. Until a link
  // is set, or when the viewer is not the owner (a preview without sign-in), the sample stays.
  const note = $('.cal-source-note');
  const fTimeOfDay = fmt({hour: 'numeric', minute: '2-digit'});
  const parseEventDate = (value, allDay) => {
    if (!allDay) return new Date(value);
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  async function loadOutlook() {
    let data;
    try {
      const response = await fetch('/api/calendar/events', {credentials: 'same-origin', headers: {accept: 'application/json'}});
      if (!response.ok) return;
      data = await response.json();
    } catch { return; }
    if (!data?.connected) {
      note.textContent = 'Outlook 게시 링크를 아직 등록하지 않아 예시 일정을 보여 줍니다.';
      return;
    }
    const real = data.events.filter(e => calendars.has(e.cal)).map(e => ({...e, start: parseEventDate(e.start, e.allDay), end: parseEventDate(e.end, e.allDay)}));
    events = [...sample.events.filter(e => e.cal === 'holiday'), ...real].sort(byStart);
    shownCalendars = sample.calendars.filter(c => c.id === 'holiday' || data.calendars.includes(c.id));
    app.dataset.source = 'outlook';
    const failed = data.errors.map(e => calendars.get(e.cal)?.name).filter(Boolean);
    note.textContent = failed.length
      ? `${failed.join(', ')} 캘린더를 새로 읽지 못해 마지막으로 받은 일정을 보여 줍니다.`
      : `Outlook에서 ${fTimeOfDay.format(new Date(data.fetchedAt))}에 불러온 일정입니다.`;
    note.classList.toggle('is-warning', failed.length > 0);
    renderSources();
    render({keepScroll: true});
  }

  renderSources();
  render();
  loadOutlook();
})();
