/* Calendar colours, shared by the Calendar page and Settings. Each colour has a light and a dark
   pair: the hue for dots and fills, and a deeper "ink" for text on a tinted fill. The ink values
   keep 4.5:1 or more against the tinted event fill in their theme. The keys must match
   PALETTE_KEYS in server/calendar-routes.mjs. */
(() => {
  'use strict';
  const colors = {
    green:  {name: '초록',   light: ['#0f7a5c', '#0b5e47'], dark: ['#4cc79f', '#85dcbf']},
    cobalt: {name: '파랑',   light: ['#2350d8', '#1d44bd'], dark: ['#7d9bff', '#a9bcff']},
    amber:  {name: '호박',   light: ['#a16207', '#7a4a05'], dark: ['#e5a93b', '#f0c778']},
    red:    {name: '빨강',   light: ['#d92d20', '#b4231a'], dark: ['#ff7b72', '#ff9b94']},
    violet: {name: '보라',   light: ['#6d3fd1', '#5a2fb8'], dark: ['#b39cff', '#cbbcff']},
    teal:   {name: '청록',   light: ['#0e7490', '#0b5d73'], dark: ['#4fc3dc', '#8ad6e7']},
    pink:   {name: '분홍',   light: ['#c0267a', '#9f1f65'], dark: ['#f27bb8', '#f7a6cf']},
    orange: {name: '주황',   light: ['#c2410c', '#9a3409'], dark: ['#fb8f5a', '#fdb08a']},
    olive:  {name: '올리브', light: ['#5f7d14', '#4a6210'], dark: ['#a8cf5a', '#c3e08a']},
    slate:  {name: '회색',   light: ['#556070', '#3f4855'], dark: ['#a3adbb', '#c3cad4']},
  };
  const defaults = {order: ['personal', 'work', 'paper'], colors: {personal: 'green', work: 'cobalt', paper: 'amber', holiday: 'red'}};
  const names = {personal: 'Personal', work: 'Selectstar', paper: 'Paper', holiday: '공휴일'};

  // One small stylesheet sets --cal-<id> and --cal-<id>-ink for both themes.
  function apply(config, root = document) {
    const pick = id => colors[config?.colors?.[id]] || colors[defaults.colors[id]];
    const rules = theme => Object.keys(names).map(id => `--cal-${id}: ${pick(id)[theme][0]}; --cal-${id}-ink: ${pick(id)[theme][1]};`).join(' ');
    let style = root.getElementById('cal-colors');
    if (!style) {
      style = root.createElement('style');
      style.id = 'cal-colors';
      root.head.append(style);
    }
    // :root raises these above the defaults in calendar.css, which loads later in the page.
    style.textContent = `:root .cal-shell, :root .cal-settings { ${rules('light')} }\n:root[data-theme="dark"] .cal-shell, :root[data-theme="dark"] .cal-settings { ${rules('dark')} }`;
  }
  window.CalendarPalette = {colors, defaults, names, apply};
})();
