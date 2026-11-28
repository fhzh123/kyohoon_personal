/* Sample schedule for the Calendar design draft. Outlook will replace this file's output.
   Events are built around today so every view has something to show whenever the page opens.
   Each event: {id, cal, title, start: Date, end: Date, allDay, place?, note?}. All-day ends are exclusive. */
(() => {
  'use strict';
  const CALENDARS = [
    {id: 'work', name: 'Selectstar', detail: '회의와 업무'},
    {id: 'paper', name: 'Paper', detail: '리뷰와 마감'},
    {id: 'personal', name: 'Personal', detail: '운동과 약속'},
    {id: 'holiday', name: '공휴일', detail: '대한민국'},
  ];

  // Fixed-date public holidays, plus the 2026 lunar ones. Substitute holidays are left out;
  // a real holiday feed replaces this list when Outlook is connected.
  const FIXED = [['01-01', '신정'], ['03-01', '삼일절'], ['05-05', '어린이날'], ['06-06', '현충일'], ['08-15', '광복절'], ['10-03', '개천절'], ['10-09', '한글날'], ['12-25', '성탄절']];
  const LUNAR = {2026: [['02-16', '설날 연휴'], ['02-17', '설날'], ['02-18', '설날 연휴'], ['05-24', '부처님오신날'], ['09-24', '추석 연휴'], ['09-25', '추석'], ['09-26', '추석 연휴']]};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const Y = today.getFullYear();
  const day = (y, m, d) => new Date(y, m, d);
  const add = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  const at = (date, h, m = 0) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
  const key = date => date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

  // Small seeded generator so the sample is the same on every load.
  let seed = Y * 31 + 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = list => list[Math.floor(rand() * list.length)];

  const events = [];
  let n = 0;
  const push = (cal, title, start, end, extra = {}) => events.push({id: 'e' + (++n), cal, title, start, end, allDay: false, ...extra});
  const allDay = (cal, title, first, days, extra = {}) => events.push({id: 'e' + (++n), cal, title, start: first, end: add(first, days), allDay: true, ...extra});

  const holidays = new Set();
  for (const y of [Y - 1, Y, Y + 1]) {
    for (const [md, name] of [...FIXED, ...(LUNAR[y] || [])]) {
      const [m, d] = md.split('-').map(Number);
      const date = day(y, m - 1, d);
      holidays.add(key(date));
      allDay('holiday', name, date, 1);
    }
  }

  // Trip and leave days: no routine meetings on them.
  const trip = add(today, 16), leave = add(today, -6);
  const away = new Set([key(leave), ...[0, 1, 2, 3].map(i => key(add(trip, i)))]);

  const from = day(Y, 0, 1), to = day(Y + 1, 1, 1);
  const extras = {
    work: [['데이터 품질 점검', '회의실 B'], ['평가 결과 공유', '온라인'], ['고객사 요구사항 정리', ''], ['채용 인터뷰', '회의실 C'], ['라벨링 가이드 검토', '']],
    paper: [['리뷰 초안 작성', ''], ['실험 결과 정리', ''], ['공동저자 미팅', '온라인']],
    personal: [['저녁 약속', '을지로'], ['치과 예약', ''], ['PT', '체육관'], ['장보기', '']],
  };
  let week = 0;
  for (let d = from; d < to; d = add(d, 1)) {
    const w = d.getDay(), k = key(d);
    if (w === 0) week++;
    if (holidays.has(k) || away.has(k)) continue;
    if (w === 1) push('work', 'AI 1팀 주간 회의', at(d, 10), at(d, 11), {place: '회의실 A', note: '지난주 과업 진행 상황과 이번 주 배정'});
    if (w === 3) push('work', '연구일지 리뷰', at(d, 14), at(d, 15), {place: '회의실 B'});
    if (w === 2 || w === 4) push('personal', '수영', at(d, 7), at(d, 8), {place: '구민 수영장'});
    if (w === 5 && week % 2 === 0) push('work', '팀장 1:1', at(d, 16), at(d, 16, 30));
    if (w === 4 && week % 2 === 1) push('paper', '논문 읽기 모임', at(d, 20), at(d, 21, 30), {place: '온라인', note: '이번 주 발표 논문 1편'});
    if (w === 2 && d.getDate() <= 7) push('work', '고객사 정기 미팅', at(d, 15), at(d, 16), {place: '고객사'});
    // A few extra events per week give the year view its uneven rhythm.
    if (w >= 1 && w <= 5 && rand() < 0.34) {
      const [title, place] = pick(extras.work);
      const h = 9 + Math.floor(rand() * 8);
      push('work', title, at(d, h, rand() < 0.5 ? 0 : 30), at(d, h + 1, rand() < 0.5 ? 0 : 30), place ? {place} : {});
    }
    if (rand() < 0.16) {
      const [title, place] = pick(extras.paper);
      const h = w === 0 || w === 6 ? 10 + Math.floor(rand() * 5) : 19;
      push('paper', title, at(d, h), at(d, h + 2), place ? {place} : {});
    }
    if ((w === 5 || w === 6) && rand() < 0.42) {
      const [title, place] = pick(extras.personal);
      push('personal', title, at(d, 18, 30), at(d, 21), place ? {place} : {});
    }
  }

  // Around today: a busy day, deadlines and multi-day blocks.
  push('paper', '리뷰 2편 읽기', at(today, 9, 30), at(today, 11, 30), {note: '담당 논문 2편 중 실험 설계 위주로'});
  push('personal', '점심 약속', at(today, 12, 30), at(today, 13, 30), {place: '성수'});
  push('work', '평가 지표 정리', at(today, 14), at(today, 15, 30), {note: '고객사 공유 전 지표 정의 확인'});
  push('paper', '리뷰탈 초안 다듬기', at(today, 15), at(today, 17));
  push('personal', '자전거 수리 맡기기', at(today, 16), at(today, 16, 30), {place: '동네 자전거 가게'});
  push('personal', '가족 저녁', at(today, 19), at(today, 21));
  allDay('work', '평가 데이터 납품 주간', add(today, -2), 4, {note: '고객사 납품 일정'});
  allDay('paper', '리뷰탈 제출 마감', add(today, 2), 1, {note: '리뷰어 3명에게 답변'});
  allDay('paper', '학회 참석', add(today, 5), 3, {place: '부산'});
  push('personal', '건강검진', at(add(today, 10), 8, 30), at(add(today, 10), 10, 30), {place: '건강검진센터'});
  allDay('personal', '제주 여행', trip, 4, {place: '제주'});
  allDay('personal', '연차', leave, 1);
  push('work', '분기 회고', at(add(today, 3), 16), at(add(today, 3), 18), {place: '대회의실'});
  push('paper', '논문 리뷰 3편 마감', at(add(today, 12), 23), at(add(today, 12), 23, 59));

  window.CalendarSample = {calendars: CALENDARS, events, holidays};
})();
