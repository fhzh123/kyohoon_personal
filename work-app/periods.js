// Pure calendar-period helpers. Dates are local calendar dates; day arithmetic uses UTC ordinals.
(() => {
  'use strict';
  const MIN_DATE = '2026-11-01';
  const pad = n => String(n).padStart(2, '0');
  const iso = value => {
    const d = Object.prototype.toString.call(value) === '[object Date]' ? value : date(value);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  function date(value) {
    if (Object.prototype.toString.call(value) === '[object Date]') return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(NaN);
    const [y, m, d] = value.split('-').map(Number);
    const result = new Date(0); result.setFullYear(y, m - 1, d); result.setHours(12, 0, 0, 0);
    return result.getFullYear() === y && result.getMonth() === m - 1 && result.getDate() === d ? result : new Date(NaN);
  }
  const validDate = value => typeof value === 'string' && !!iso(value);
  const ordinal = value => { const d = date(value); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000; };
  const addDays = (value, n) => { const d = date(value); d.setDate(d.getDate() + n); return iso(d); };
  const daysBetween = (a, b) => ordinal(a) - ordinal(b);
  const startOfWeek = value => { const d = date(value); return addDays(value, -((d.getDay() + 6) % 7)); };
  const endOfWeek = value => addDays(startOfWeek(value), 6);
  const monthStart = value => { const d = date(value); d.setDate(1); return iso(d); };
  const monthEnd = value => { const d = date(value); d.setMonth(d.getMonth() + 1, 0); return iso(d); };
  const yearStart = value => `${date(value).getFullYear()}-01-01`;
  const yearEnd = value => `${date(value).getFullYear()}-12-31`;
  function step(value, n, unit) {
    if (unit === 'week') return addDays(value, n * 7);
    if (unit !== 'month' && unit !== 'year') throw new Error('Unknown period unit: ' + unit);
    const d = date(value), day = d.getDate(); d.setDate(1);
    if (unit === 'month') d.setMonth(d.getMonth() + n); else d.setFullYear(d.getFullYear() + n);
    const last = date(monthEnd(iso(d))).getDate(); d.setDate(Math.min(day, last)); return iso(d);
  }
  const bounds = { week: [startOfWeek, endOfWeek], month: [monthStart, monthEnd], year: [yearStart, yearEnd] };
  function cover(start, end, unit) {
    if (!validDate(start) || !validDate(end) || start > end || !bounds[unit]) throw new Error('올바른 기간을 입력하세요.');
    const [first, last] = bounds[unit];
    return { start: first(start) < MIN_DATE ? MIN_DATE : first(start), end: last(end) < MIN_DATE ? MIN_DATE : last(end) };
  }
  function toWeek(value) {
    if (!validDate(value)) return '';
    const thursday = addDays(startOfWeek(value), 3), year = date(thursday).getFullYear();
    const first = startOfWeek(`${year}-01-04`);
    return `${year}-W${pad(Math.floor(daysBetween(thursday, first) / 7) + 1)}`;
  }
  function fromWeek(value) {
    const match = typeof value === 'string' && value.match(/^(\d{4})-W(\d{2})$/);
    if (!match || +match[2] < 1 || +match[2] > 53) return '';
    const monday = addDays(startOfWeek(`${match[1]}-01-04`), (+match[2] - 1) * 7);
    return toWeek(monday) === value ? monday : '';
  }
  const weekLabel = value => { const d = date(value); return `${d.getMonth() + 1}/${d.getDate()}주`; };
  function columns(anchor, unit) {
    if (!validDate(anchor) || !bounds[unit]) throw new Error('올바른 기간을 입력하세요.');
    anchor = anchor < MIN_DATE ? MIN_DATE : anchor;
    const first = bounds[unit][0](anchor), count = { week: 13, month: 12, year: 5 }[unit];
    return Array.from({ length: count }, (_, i) => {
      const original = step(first, i, unit), start = original < MIN_DATE ? MIN_DATE : original, end = bounds[unit][1](original), d = date(original);
      if (unit === 'week') {
        const a = date(start), b = date(end);
        return { key: toWeek(original), start, end, label: original < MIN_DATE ? '11월 시작 주' : weekLabel(start), group: `${a.getFullYear()}년 ${a.getMonth() + 1}월`, detail: `${a.getMonth() + 1}.${a.getDate()}–${b.getMonth() + 1}.${b.getDate()}` };
      }
      return { key: unit === 'month' ? original.slice(0, 7) : original.slice(0, 4), start, end, label: unit === 'month' ? `${d.getMonth() + 1}월` : `${d.getFullYear()}년`, group: unit === 'month' ? `${d.getFullYear()}년` : '장기 연구 방향', detail: '' };
    });
  }
  function spanLabel(task) {
    if (!task || !validDate(task.start) || !validDate(task.end) || task.start > task.end) return '기간 미정';
    const unit = bounds[task.planUnit] ? task.planUnit : 'week', a = date(task.start), b = date(task.end);
    if (unit === 'year') return a.getFullYear() === b.getFullYear() ? `${a.getFullYear()}년` : `${a.getFullYear()} — ${b.getFullYear()}년`;
    if (unit === 'month') {
      const count = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
      return count === 1 ? `${a.getFullYear()}년 ${a.getMonth() + 1}월 · 1개월` : `${a.getFullYear()}.${a.getMonth() + 1} — ${a.getFullYear() === b.getFullYear() ? '' : b.getFullYear() + '.'}${b.getMonth() + 1}월 · ${count}개월`;
    }
    const count = Math.floor(daysBetween(startOfWeek(task.end), startOfWeek(task.start)) / 7) + 1;
    const first = startOfWeek(task.start), last = startOfWeek(task.end);
    const firstLabel = first < MIN_DATE ? '11월 시작 주' : weekLabel(first);
    const lastLabel = last < MIN_DATE ? '11월 시작 주' : weekLabel(last);
    const firstYear = date(first < MIN_DATE ? MIN_DATE : first).getFullYear(), lastYear = date(last < MIN_DATE ? MIN_DATE : last).getFullYear();
    return `${firstYear} · ${firstLabel} — ${firstYear === lastYear ? '' : lastYear + ' · '}${lastLabel} · ${count}주`;
  }
  window.ResearchPeriods = { MIN_DATE, iso, date, addDays, daysBetween, validDate, startOfWeek, endOfWeek, monthStart, monthEnd, yearStart, yearEnd, step, cover, columns, spanLabel, toWeek, fromWeek };
})();
