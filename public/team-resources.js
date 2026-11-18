(() => {
  "use strict";
  const DATA = JSON.parse(document.getElementById("resource-data").textContent),
    $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  const notionHref = (url) => {
    try {
      const parsed = new URL(url);
      if (parsed.origin === "https://app.notion.com" && /^\/(p\/)?[\da-f]{32}$/.test(parsed.pathname)) return esc(parsed.href);
    } catch {}
    return "https://app.notion.com/";
  };
  const icons = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    book: '<path d="M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zM14 7a3 3 0 0 1 3-3h3v15h-2a4 4 0 0 0-4 2"/>',
    chart: '<path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/>',
    layers: '<path d="m12 3 10 6-10 6L2 9zM3 14l9 5 9-5M3 18l9 5 9-5"/>',
    wallet:
      '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M17 14h4"/>',
    moon: '<path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',
    database:
      '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m10 6 6 6-6 6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  };
  const icon = (n) =>
    `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[n] || icons.info}</svg>`;
  $$("[data-icon]").forEach((e) => (e.innerHTML = icon(e.dataset.icon)));
  const PEOPLE = new Map(DATA.people.map((p) => [p.id, p])),
    PROJECTS = new Map(DATA.projects.map((p) => [p.id, p]));
  const palette = [
    "#3d77d6",
    "#289e9b",
    "#d59a49",
    "#788ba5",
    "#c97869",
    "#5c9dc9",
    "#8c9f5a",
    "#d1b25d",
    "#497fa0",
    "#a98160",
    "#68a89a",
    "#a2b8c8",
    "#bd777f",
    "#7fa561",
    "#b5a47e",
    "#6590b6",
    "#9aa891",
    "#b9978e",
    "#497499",
    "#b3a25c",
    "#589987",
    "#d88c73",
    "#8aa7b1",
    "#a98849",
    "#5f9aab",
    "#b0b87b",
    "#b78c75",
    "#5c8994",
    "#d5ad83",
    "#8b9aaa",
    "#83a588",
  ];
  const totals = new Map();
  DATA.rows.forEach((r) =>
    r.tasks.forEach((t) =>
      totals.set(t.project, (totals.get(t.project) || 0) + t.hours),
    ),
  );
  [...totals]
    .sort((a, b) => b[1] - a[1])
    .forEach(
      ([id], i) => (PROJECTS.get(id).color = palette[i % palette.length]),
    );
  const state = {
    month: DATA.months.at(-1),
    people: new Set(DATA.people.map((p) => p.id)),
    tab: "overview",
    allTasks: false,
    query: "",
    page: 0,
    detail: null,
    trendPerson: DATA.people[0].id,
  };
  const f = (v, d = 1) =>
      new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: d,
        minimumFractionDigits: 0,
      }).format(v || 0),
    pct = (v, t) => (t ? (100 * v) / t : 0),
    pc = (v, t) => f(pct(v, t), 1) + "%",
    monthName = (m) =>
      m === "all"
        ? "전체 기간"
        : Number(m.slice(0, 4)) + "년 " + Number(m.slice(5)) + "월",
    shortMonth = (m) => Number(m.slice(5)) + "월",
    personColor = (id) => `var(--p${PEOPLE.get(id).index})`;
  const daysCache = new Map();
  function monthDays(m) {
    if (daysCache.has(m)) return daysCache.get(m);
    const [y, n] = m.split("-").map(Number),
      days = [];
    for (
      let d = new Date(Date.UTC(y, n - 1, 1));
      d.getUTCMonth() === n - 1;
      d.setUTCDate(d.getUTCDate() + 1)
    )
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
        days.push(d.toISOString().slice(0, 10));
    daysCache.set(m, days);
    return days;
  }
  function aggregate(month = state.month, ids = state.people) {
    const projects = new Map();
    const people = new Map();
    const covered = new Set();
    const rows = [];
    let total = 0;

    for (const row of DATA.rows) {
      if (!ids.has(row.person)) continue;
      const days = row.days.filter(
        (day) => month === "all" || day.startsWith(month),
      );
      if (!days.length) continue;
      rows.push(row);
      for (const day of days) covered.add(row.person + "|" + day);
      const weight = days.length / row.days.length;
      let personHours = 0;
      for (const task of row.tasks) {
        const project = PROJECTS.get(task.project);
        const hours = task.hours * weight;
        total += hours;
        personHours += hours;
        if (!projects.has(project.id)) {
          projects.set(project.id, { ...project, hours: 0, people: new Map() });
        }
        const entry = projects.get(project.id);
        entry.hours += hours;
        const contributor = entry.people.get(row.person) || { hours: 0 };
        contributor.hours += hours;
        entry.people.set(row.person, contributor);
      }
      const person = people.get(row.person) || { hours: 0 };
      person.hours += personHours;
      people.set(row.person, person);
    }

    const expectedDays =
      month === "all"
        ? DATA.months.reduce((count, key) => count + monthDays(key).length, 0)
        : monthDays(month).length;
    return {
      total,
      projects: [...projects.values()].sort((a, b) => b.hours - a.hours),
      people,
      coverage: pct(covered.size, expectedDays * ids.size),
      rows,
    };
  }
  function legend() {
    return `<div class="legend">${DATA.people
      .filter((p) => state.people.has(p.id))
      .map(
        (p) =>
          `<span><i class="dot" style="background:${personColor(p.id)}"></i>${esc(p.name)}</span>`,
      )
      .join("")}</div>`;
  }

  function coverage(a) {
    return a.coverage < 99.99
      ? `<div class="record-note">${icon("info")}<span>${state.month === "all" ? "일부 기간의" : monthName(state.month) + "은 일부"} 주간 기록이 비어 있습니다. 배분 비중은 확인된 기록으로 계산합니다.</span><button data-action="method">집계 기준</button></div>`
      : "";
  }
  function taskName(id) {
    return PROJECTS.get(id)?.name || "그 외 과업";
  }
  function taskColor(id) {
    return PROJECTS.get(id)?.color || "#a6b2c2";
  }
  function allPersonProjects(id, m = state.month) {
    return aggregate(m, new Set([id]));
  }
  function displaySegments(a, max = 5) {
    const list = a.projects
      .slice(0, max)
      .map((p) => ({ ...p, share: pct(p.hours, a.total) }));
    const rest = a.projects.slice(max);
    if (rest.length)
      list.push({
        id: "other",
        name: `그 외 ${rest.length}개 과업`,
        color: "var(--other)",
        hours: rest.reduce((s, p) => s + p.hours, 0),
        share: pct(
          rest.reduce((s, p) => s + p.hours, 0),
          a.total,
        ),
        other: true,
      });
    return list;
  }
  function donutArcPath(cx, cy, r, start, span) {
    const x1 = cx + r * Math.cos(start),
      y1 = cy + r * Math.sin(start),
      end = start + span,
      x2 = cx + r * Math.cos(end),
      y2 = cy + r * Math.sin(end);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${span > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
  }
  function donut(one, person) {
    const segs = displaySegments(one, 5),
      R = 72,
      C = 2 * Math.PI * R,
      cx = 105,
      cy = 105;
    let offset = 0;
    const paths = segs
      .map((s) => {
        const length = (s.share / 100) * C,
          arc = `<path class="donut-segment" ${s.other ? 'data-other="' + person.id + '"' : 'data-project="' + s.id + '" data-task-key="' + s.id + '"'} data-donut-person="${person.id}" data-segment-name="${esc(s.name)}" data-segment-share="${s.share}" tabindex="0" role="button" aria-label="${esc(person.name)}, ${esc(s.name)} ${f(s.share)}퍼센트, ${s.other ? "모든 과업 펼치기" : "과업 상세 보기"}" d="${donutArcPath(cx, cy, R, -Math.PI / 2 + offset / R, Math.max(0, length - 0.9) / R)}" fill="none" stroke="${s.color}" stroke-width="25"><title>${esc(s.name)} ${f(s.share)}%</title></path>`;
        offset += length;
        return arc;
      })
      .join("");
    const top = segs[0];
    return `<div class="donut-wrap"><svg class="donut-svg" viewBox="0 0 210 210" aria-label="${esc(person.name)} 과업 비중, 기록된 업무를 100퍼센트로 표시"><circle cx="105" cy="105" r="72" fill="none" stroke="var(--track)" stroke-width="25"/>${paths}<text class="donut-center-label" x="105" y="89" text-anchor="middle">가장 집중한 과업</text><text class="donut-center-value" id="donut-value-${person.id}" x="105" y="122" text-anchor="middle">${top ? f(top.share) : "—"}<tspan class="donut-percent">${top ? "%" : ""}</tspan></text></svg><p class="donut-selected" id="donut-name-${person.id}" ${top ? `style="--task-color:${top.color}"` : ""}>${top ? esc(top.name) : "기록 없음"}</p></div>`;
  }
  function personCards() {
    return `<div class="people-grid allocation-people">${DATA.people
      .filter((p) => state.people.has(p.id))
      .map((person) => {
        const one = allPersonProjects(person.id),
          segs = displaySegments(one, 5),
          top = one.projects[0];
        return `<article class="panel allocation-person" data-person-card="${person.id}"><div class="allocation-person-head"><div class="avatar" style="--person:${personColor(person.id)}">${person.name.slice(1)}</div><h3>${esc(person.name)}</h3><span class="person-task-count">${one.projects.length}개 과업</span></div>${donut(one, person)}<div class="donut-legend">${segs.map((s) => (s.other ? `<button class="donut-legend-row other-row" data-other="${person.id}"><span class="color-square" style="--task-color:${s.color}"></span><span class="donut-task-name">${s.name} <span class="expand-sign">+</span></span><b>${f(s.share)}<small>%</small></b></button>` : `<button class="donut-legend-row" data-project="${s.id}" data-task-key="${s.id}"><span class="color-square" style="--task-color:${s.color}"></span><span class="donut-task-name" title="${esc(s.name)}">${esc(s.name)}</span><b>${f(s.share)}<small>%</small></b></button>`)).join("") || '<p class="empty">이 기간의 기록이 없습니다.</p>'}</div>${
          one.projects.length > 5
            ? `<div id="other-${person.id}" class="other-tasks" hidden>${one.projects
                .slice(5)
                .map(
                  (s) =>
                    `<button class="donut-legend-row" data-project="${s.id}" data-task-key="${s.id}"><span class="color-square" style="--task-color:${s.color}"></span><span class="donut-task-name">${esc(s.name)}</span><b>${f(pct(s.hours, one.total))}<small>%</small></b></button>`,
                )
                .join("")}</div>`
            : ""
        }</article>`;
      })
      .join("")}</div>`;
  }
  // Binary split treemap: every tile's area is exactly proportional to its task share.
  function tileLayout(items, x, y, w, h, out = []) {
    if (!items.length) return out;
    if (items.length === 1) {
      out.push({ ...items[0], x, y, w, h });
      return out;
    }
    const total = items.reduce((s, p) => s + p.hours, 0);
    let best = 1,
      sum = items[0].hours,
      delta = Math.abs(sum - total / 2);
    for (let k = 2; k < items.length; k++) {
      sum += items[k - 1].hours;
      const d = Math.abs(sum - total / 2);
      if (d < delta) {
        best = k;
        delta = d;
      }
    }
    const first = items.slice(0, best),
      second = items.slice(best),
      ratio = first.reduce((s, p) => s + p.hours, 0) / total;
    if (w >= h) {
      tileLayout(first, x, y, w * ratio, h, out);
      tileLayout(second, x + w * ratio, y, w * (1 - ratio), h, out);
    } else {
      tileLayout(first, x, y, w, h * ratio, out);
      tileLayout(second, x, y + h * ratio, w, h * (1 - ratio), out);
    }
    return out;
  }
  function wrapText(text, width, fontSize, maxLines = 3) {
    const lines = [];
    let current = "",
      size = 0;
    for (const char of text) {
      const step = char.charCodeAt(0) > 255 ? fontSize : fontSize * 0.56;
      if (size + step > width && current) {
        lines.push(current);
        current = "";
        size = 0;
      }
      current += char;
      size += step;
    }
    if (current) lines.push(current);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…";
    }
    return lines;
  }
  function treemap(a, mobile = false) {
    if (!a.total) return '<div class="empty">이 기간의 기록이 없습니다.</div>';
    const items = a.projects.slice(0, 8),
      rest = a.projects.slice(8);
    if (rest.length)
      items.push({
        id: "other",
        name: "그 외 " + rest.length + "개",
        color: "var(--other)",
        hours: rest.reduce((s, p) => s + p.hours, 0),
        other: true,
      });
    const boxes = tileLayout(
        items,
        0,
        0,
        mobile ? 520 : 760,
        mobile ? 440 : 330,
      ),
      svg = boxes
        .map((t) => {
          const fs = t.w > 190 ? 20 : 17,
            lines = wrapText(t.name, t.w - 30, fs, t.h > 120 ? 3 : 2),
            textheight = lines.length * 25,
            hasRoom = t.h > textheight + 40 && t.w > 90;
          return `<g class="treemap-tile" ${t.other ? 'data-action="all-tasks"' : 'data-project="' + t.id + '" data-task-key="' + t.id + '"'} role="button" tabindex="0" aria-label="${esc(t.name)}, 팀 전체 과업의 ${pc(t.hours, a.total)}, ${t.other ? "전체 과업 목록 보기" : "과업 상세 보기"}"><title>${esc(t.name)} ${pc(t.hours, a.total)}</title><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="${t.color}" stroke="var(--surface)" stroke-width="4"/>${hasRoom ? `<text x="${t.x + 15}" y="${t.y + 26}" font-size="${fs}" font-weight="550">${lines.map((line, i) => `<tspan x="${t.x + 15}" dy="${i ? 25 : 0}">${esc(line)}</tspan>`).join("")}</text><text class="treemap-value" x="${t.x + 15}" y="${t.y + t.h - 17}" font-size="${t.h > 100 ? 30 : 20}">${f(pct(t.hours, a.total))}<tspan font-size="12">%</tspan></text>` : `<text x="${t.x + t.w / 2}" y="${t.y + t.h / 2 + 4}" text-anchor="middle" font-size="12">${pc(t.hours, a.total)}</text>`}</g>`;
        })
        .join("");
    return `<svg class="team-treemap ${mobile ? "mobile-treemap" : "desktop-treemap"}" viewBox="0 0 ${mobile ? 520 : 760} ${mobile ? 440 : 330}" role="group" aria-label="팀 전체 과업 비중 면적 차트. 각 면적은 과업별 비중에 비례합니다.">${svg}</svg>`;
  }
  function matrix(a, all = false) {
    const people = DATA.people.filter((p) => state.people.has(p.id)),
      rows = all ? a.projects : a.projects.slice(0, 7);
    return `<div class="matrix-wrap"><table class="allocation-matrix"><thead><tr><th>과업</th>${people.map((p) => `<th>${esc(p.name)}</th>`).join("")}</tr></thead><tbody>${rows
      .map(
        (t) =>
          `<tr><th><button data-project="${t.id}" data-task-key="${t.id}"><i class="color-square" style="--task-color:${t.color}"></i><span>${esc(t.name)}</span></button></th>${people
            .map((p) => {
              const one = a.people.get(p.id),
                share = pct(t.people.get(p.id)?.hours || 0, one?.hours || 0);
              return `<td><button data-project="${t.id}" class="matrix-value" data-task-key="${t.id}" aria-label="${esc(p.name)}의 업무 중 ${esc(t.name)} ${f(share)}퍼센트" style="--cell-color:${t.color};--cell-opacity:${share ? Math.min(0.8, 0.08 + share / 125) : 0}">${share ? f(share) + "%" : "—"}</button></td>`;
            })
            .join("")}</tr>`,
      )
      .join("")}</tbody></table></div>`;
  }
  function teamSummary(a) {
    const top = a.projects[0],
      shared = a.projects.filter((t) => t.people.size > 1),
      top3 = a.projects.slice(0, 3).reduce((s, t) => s + t.hours, 0);
    return `<div class="team-summary"><div><span class="summary-label">가장 비중이 큰 과업</span><b>${top ? esc(top.name) : "—"}</b><span class="summary-note">${top ? pc(top.hours, a.total) + " / 팀 전체 업무 중" : ""}</span></div><div><span class="summary-label">상위 3개 과업</span><b>${pc(top3, a.total)}</b><span class="summary-note">${a.projects.length}개 과업 중</span></div><div><span class="summary-label">함께 진행한 과업</span><b>${shared.length}<small>개</small></b><span class="summary-note">선택한 팀원 중 2명 이상 투입</span></div></div>`;
  }
  function overview(a) {
    return (
      coverage(a) +
      `<div class="allocation-section-head"><div><h2>팀원별 과업 배분</h2><p>각자의 업무를 100%로 보았습니다.</p></div><span class="chart-interaction-hint">조각이나 과업명을 누르면 상세 보기</span></div>${personCards()}<section class="team-section"><div class="allocation-section-head"><div><h2>팀 전체 과업 배분</h2><p>선택한 팀원의 업무를 합산한 과업별 비중입니다.</p></div></div>${teamSummary(a)}<div class="team-comparison-grid"><section class="panel treemap-panel"><div class="panel-head"><div><h3>과업별 비중</h3><p class="panel-subtitle">면적이 클수록 팀 전체에서 비중이 큰 과업입니다.</p></div><button class="text-button" data-action="all-tasks">${state.allTasks ? "주요 과업만" : "전체 과업 보기"} ${state.allTasks ? "↑" : "↓"}</button></div><div class="treemap-container">${treemap(a)}${treemap(a, true)}</div></section><section class="panel matrix-panel"><div class="panel-head"><div><h3>누가 어떤 과업을 맡았을까</h3><p class="panel-subtitle">각 팀원 업무 중 해당 과업의 비중입니다.</p></div></div>${matrix(a, state.allTasks)}<div class="matrix-foot">진한 칸은 해당 팀원에게 비중이 큰 과업입니다.</div></section></div>${state.allTasks ? `<section class="panel all-tasks-panel"><div class="panel-head"><h3>전체 과업 ${a.projects.length}개</h3></div><div class="task-share-list">${a.projects.map((t) => `<button data-project="${t.id}" data-task-key="${t.id}"><i class="color-square" style="--task-color:${t.color}"></i><span>${esc(t.name)}</span><b>${pc(t.hours, a.total)}</b></button>`).join("")}</div></section>` : ""}</section>`
    );
  }
  function trendPerson() {
    return (
      DATA.people.find(
        (p) => p.id === state.trendPerson && state.people.has(p.id),
      ) || DATA.people.find((p) => state.people.has(p.id))
    );
  }
  function trendData(id) {
    const monthly = DATA.months.map((m) => ({
        m,
        a: aggregate(m, new Set([id])),
      })),
      totals = new Map();
    monthly.forEach(({ a }) =>
      a.projects.forEach((t) =>
        totals.set(t.id, (totals.get(t.id) || 0) + t.hours),
      ),
    );
    const top = [...totals]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id),
      rest = [...totals].filter(([id]) => !top.includes(id));
    return {
      monthly,
      series: [
        ...top.map((id) => ({ id, name: taskName(id), color: taskColor(id) })),
        ...(rest.length
          ? [{ id: "other", name: "그 외 과업", color: "var(--other)" }]
          : []),
      ],
    };
  }
  function areaChart(id) {
    const { monthly, series } = trendData(id),
      W = 1000,
      H = 320,
      L = 42,
      R = 18,
      T = 16,
      B = 44,
      pw = W - L - R,
      ph = H - T - B,
      x = (i) => L + (pw * i) / Math.max(1, monthly.length - 1),
      y = (v) => T + ph * (1 - v / 100);
    let svg = "";
    for (let i = 0; i <= 4; i++) {
      const v = i * 25;
      svg += `<line class="axis-line" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-tick" x="${L - 8}" y="${y(v) + 3}" text-anchor="end">${v}%</text>`;
    }
    const cum = monthly.map(() => 0);
    series.forEach((s) => {
      const bottom = [...cum],
        top = monthly.map(({ a }, i) => {
          const hours =
            s.id === "other"
              ? a.projects
                  .filter((t) => !series.some((s) => s.id === t.id))
                  .reduce((n, t) => n + t.hours, 0)
              : a.projects.find((t) => t.id === s.id)?.hours || 0;
          cum[i] += pct(hours, a.total);
          return cum[i];
        });
      let path = top.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
      path +=
        " " +
        bottom
          .map((v, i) => ({ v, i }))
          .reverse()
          .map(({ v, i }) => `L${x(i)},${y(v)}`)
          .join(" ") +
        " Z";
      svg += `<path class="area-shape" data-task-key="${s.id}" d="${path}" fill="${s.color}" fill-opacity=".86"><title>${esc(s.name)}</title></path>`;
    });
    monthly.forEach(({ m, a }, i) => {
      const top = a.projects[0],
        selected = m === state.month;
      svg += `<g class="area-month" data-chart-month="${m}" role="button" tabindex="0" aria-label="${monthName(m)} ${top ? esc(top.name) + " " + pc(top.hours, a.total) : "기록 없음"}${a.coverage < 99.99 ? ", 부분 기록" : ""}, 이 달 보기"><title>${monthName(m)}${a.coverage < 99.99 ? " (부분 기록)" : ""}\n${a.projects.map((t) => t.name + " " + pc(t.hours, a.total)).join("\n")}</title><line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}" class="month-guide ${selected ? "is-selected" : ""}"/><rect x="${x(i) - (pw / Math.max(1, monthly.length - 1)) * 0.43}" y="${T}" width="${(pw / Math.max(1, monthly.length - 1)) * 0.86}" height="${ph}" fill="transparent"/><text class="chart-tick ${selected ? "selected-month" : ""}" x="${x(i)}" y="${H - 19}" text-anchor="middle">${shortMonth(m)}${a.coverage < 99.99 ? "*" : ""}</text></g>`;
    });
    return `<svg class="allocation-area" viewBox="0 0 ${W} ${H}" role="group" aria-label="${PEOPLE.get(id).name}의 월별 과업 비중, 매달 업무를 100퍼센트로 환산">${svg}</svg>`;
  }
  function monthlyCards(id) {
    const { monthly } = trendData(id);
    return `<div class="month-focus-grid">${monthly
      .map(({ m, a }) => {
        const top = a.projects[0],
          sel = state.month === m;
        return `<button class="month-focus-card ${sel ? "is-selected" : ""}" data-chart-month="${m}"><span class="month-focus-label">${shortMonth(m)}${a.coverage < 99.99 ? "<small>부분 기록</small>" : ""}</span><span class="month-focus-task"><i class="color-square" style="--task-color:${top?.color || "var(--other)"}"></i>${top ? esc(top.name) : "기록 없음"}</span><span class="month-focus-share">${top ? pc(top.hours, a.total) : "—"}<small>이 달의 주된 과업</small></span></button>`;
      })
      .join("")}</div>`;
  }
  function peopleView(a) {
    const p = trendPerson(),
      series = trendData(p.id).series;
    return (
      coverage(a) +
      `<div class="allocation-section-head"><div><h2>월별 집중 과업</h2><p>월마다 업무를 100%로 환산해 과업 구성의 변화를 봅니다.</p></div><div class="trend-people" aria-label="월별 변화를 볼 팀원">${DATA.people
        .filter((p) => state.people.has(p.id))
        .map(
          (person) =>
            `<button data-trend-person="${person.id}" aria-pressed="${person.id === p.id}">${esc(person.name)}</button>`,
        )
        .join(
          "",
        )}</div></div><section class="panel allocation-trend-panel"><div class="panel-head"><h3>${esc(p.name)}의 월별 과업 배분</h3><span class="panel-subtitle">${DATA.months[0].slice(0, 4)}년</span></div><div class="allocation-area-container">${areaChart(p.id)}</div><div class="area-legend">${series.map((s) => `<span><i class="color-square" style="--task-color:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div><div class="chart-note">* 일부 주간 기록만 있는 달입니다. 전체 월의 배분과 다를 수 있습니다.</div></section><div class="allocation-section-head month-focus-heading"><div><h2>각 달의 주된 과업</h2><p>월을 누르면 그 달의 상세 배분으로 이동합니다.</p></div></div>${monthlyCards(p.id)}`
    );
  }
  function percentageLineChart(projectId) {
    const W = 450,
      H = 210,
      L = 38,
      R = 14,
      T = 15,
      B = 30,
      pw = W - L - R,
      ph = H - T - B,
      x = (i) => L + (i * pw) / Math.max(1, DATA.months.length - 1),
      y = (v) => T + (1 - v / 100) * ph;
    let svg = "";
    for (const v of [0, 50, 100])
      svg += `<line class="axis-line" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-tick" x="${L - 8}" y="${y(v) + 3}" text-anchor="end">${v}%</text>`;
    DATA.people
      .filter((p) => state.people.has(p.id))
      .forEach((p) => {
        let path = "",
          drawing = false;
        const points = DATA.months.map((m, i) => {
          const a = aggregate(m, new Set([p.id]));
          if (!a.total) {
            drawing = false;
            return null;
          }
          const share = pct(
            a.projects.find((t) => t.id === projectId)?.hours || 0,
            a.total,
          );
          path += `${drawing ? " L" : " M"}${x(i)},${y(share)}`;
          drawing = true;
          return { i, m, share, a };
        });
        svg += `<path d="${path}" stroke="${personColor(p.id)}" fill="none" stroke-width="2"/>`;
        points
          .filter(Boolean)
          .forEach(
            ({ i, m, share, a }) =>
              (svg += `<circle data-chart-month="${m}" role="button" tabindex="0" cx="${x(i)}" cy="${y(share)}" r="4" fill="${personColor(p.id)}" stroke="var(--surface)" stroke-width="1.5" opacity="${a.coverage < 99.99 ? 0.6 : 1}" aria-label="${esc(p.name)}, ${monthName(m)}, 개인 업무의 ${f(share)}퍼센트. 해당 월 보기"><title>${esc(p.name)} / ${shortMonth(m)} ${f(share)}%${a.coverage < 99.99 ? " (부분 기록)" : ""}</title></circle>`),
          );
      });
    DATA.months.forEach(
      (m, i) =>
        (svg += `<text class="chart-tick" x="${x(i)}" y="${H - 9}" text-anchor="middle">${Number(m.slice(5))}</text>`),
    );
    return `<svg class="percentage-lines" viewBox="0 0 ${W} ${H}" aria-label="각 팀원의 업무에서 이 과업이 차지하는 월별 비중">${svg}</svg>`;
  }

  function recordTable(a) {
    const query = state.query.trim().toLowerCase(),
      rows = a.rows
        .filter((r) =>
          [
            PEOPLE.get(r.person).name,
            r.title,
            ...r.tasks.map((t) => PROJECTS.get(t.project).name),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
        .sort(
          (a, b) =>
            b.start.localeCompare(a.start) ||
            PEOPLE.get(a.person).index - PEOPLE.get(b.person).index,
        ),
      pages = Math.max(1, Math.ceil(rows.length / 18));
    state.page = Math.min(state.page, pages - 1);
    const shown = rows.slice(state.page * 18, (state.page + 1) * 18);
    return `<div class="panel"><div class="table-wrap"><table class="records-table"><thead><tr><th>팀원</th><th>주간 기록</th><th>과업과 원본 주간 시간</th><th>원본</th></tr></thead><tbody>${shown.map((r) => `<tr><td><div class="record-person"><i class="dot" style="background:${personColor(r.person)}"></i>${esc(PEOPLE.get(r.person).name)}</div></td><td>${esc(r.title)}<p class="record-dates">${r.start.slice(5).replace("-", ".")}–${r.end.slice(5).replace("-", ".")}</p></td><td><div class="record-tasks">${r.tasks.map((t) => `<button data-project="${t.project}">${esc(PROJECTS.get(t.project).name)}<b>${f(t.hours)}h</b></button>`).join("")}</div></td><td><a class="row-link" href="${notionHref(r.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(PEOPLE.get(r.person).name)} ${esc(r.title)} Notion 원본 열기">↗</a></td></tr>`).join("") || '<tr><td colspan="4" class="empty">검색 결과가 없습니다.</td></tr>'}</tbody></table></div><div class="pagination"><span>${rows.length}개 중 ${rows.length ? state.page * 18 + 1 : 0}–${Math.min((state.page + 1) * 18, rows.length)}개</span><div><button class="icon-button" data-action="page-prev" aria-label="이전 기록" ${state.page === 0 ? "disabled" : ""}>${icon("left")}</button><span>${state.page + 1} / ${pages}</span><button class="icon-button" data-action="page-next" aria-label="다음 기록" ${state.page >= pages - 1 ? "disabled" : ""}>${icon("right")}</button></div></div></div>`;
  }
  function recordsView(a) {
    return (
      coverage(a) +
      `<div class="records-toolbar"><label class="search-box">${icon("search")}<input id="record-search" value="${esc(state.query)}" type="search" placeholder="팀원, 과업, 주차 검색" aria-label="원본 기록 검색"></label><span class="records-note">원본에 입력된 과업과 시간을 확인합니다. 개인 간 근무량 비교는 제공하지 않습니다.</span></div><div id="records-data">${recordTable(a)}</div>`
    );
  }

  function render() {
    const a = aggregate();
    $("#record-count").textContent = a.rows.length;
    $("#month").value = state.month;
    $$("[data-tab]").forEach((b) => {
      const active = b.dataset.tab === state.tab;
      b.setAttribute("aria-selected", active);
      b.tabIndex = active ? 0 : -1;
    });
    $("#view").setAttribute("aria-labelledby", "tab-" + state.tab);
    $("#people-filters").innerHTML = DATA.people
      .map(
        (p) =>
          `<button class="person-chip" style="--person:${personColor(p.id)}" data-person="${p.id}" aria-pressed="${state.people.has(p.id)}"><i class="dot"></i>${esc(p.name)}</button>`,
      )
      .join("");
    $("#view").classList.remove("is-highlighting");
    $("#view").innerHTML =
      state.tab === "overview"
        ? overview(a)
        : state.tab === "people"
          ? peopleView(a)
          : recordsView(a);
    const i = DATA.months.indexOf(state.month);
    $("[data-action=prev]").disabled = i <= 0;
    $("[data-action=next]").disabled = i < 0 || i >= DATA.months.length - 1;
    $("#announcer").textContent =
      `${monthName(state.month)}, ${state.people.size}명, ${a.projects.length}개 과업의 배분`;
    if (state.detail) openDetail(state.detail);
  }
  function openDetail(id) {
    const p = PROJECTS.get(id),
      a = aggregate();
    if (!p) return;
    const sum = a.projects.find((t) => t.id === id) || {
      hours: 0,
      people: new Map(),
    };
    state.detail = id;
    const rows = a.rows
      .filter((r) => r.tasks.some((t) => t.project === id))
      .sort((a, b) => b.start.localeCompare(a.start));
    $("#detail").innerHTML =
      `<div class="detail-heading"><div><div class="eyebrow">과업 상세 / ${esc(p.category)}</div><h2 id="detail-title">${esc(p.name)}</h2></div><button class="icon-button" data-action="close-detail" aria-label="과업 상세 닫기">✕</button></div><p class="detail-meta">${monthName(state.month)} / ${state.people.size}명 선택${p.code ? " / " + esc(p.code) : ""}</p><div class="detail-share">${f(pct(sum.hours, a.total))}<small>%</small></div><p class="detail-caption">선택한 팀원 전체 업무 중 이 과업의 비중</p><div class="detail-section"><h3>각 팀원의 업무에서 차지하는 비중</h3>${DATA.people
        .filter((person) => state.people.has(person.id))
        .map((person) => {
          const v = sum.people.get(person.id) || { hours: 0 },
            one = a.people.get(person.id),
            share = pct(v.hours, one?.hours || 0);
          return `<div class="contribution" style="--person:${personColor(person.id)}"><div class="contribution-head"><span><i class="dot" style="background:var(--person)"></i>${esc(person.name)}</span><span>${f(share)}%</span></div><div class="contribution-track"><i style="width:${share}%"></i></div></div>`;
        })
        .join(
          "",
        )}</div><div class="detail-section"><h3>이 과업의 월별 비중 변화</h3>${percentageLineChart(id)}${legend()}<p class="detail-caption detail-chart-note">각 팀원의 업무를 100%로 보았습니다. 옅은 점은 부분 기록입니다.</p></div><div class="detail-section"><h3>근거가 되는 주간 기록 <span class="muted">${rows.length}</span></h3>${
        rows
          .map((r) => {
            const taskHours = r.tasks
                .filter((t) => t.project === id)
                .reduce((s, t) => s + t.hours, 0),
              weekHours = r.tasks.reduce((s, t) => s + t.hours, 0);
            return `<a class="detail-record" href="${notionHref(r.url)}" target="_blank" rel="noopener noreferrer"><div><b>${esc(PEOPLE.get(r.person).name)}</b><p>${esc(r.title)} / ${r.start.slice(5)}–${r.end.slice(5)}</p></div><span class="num">${pc(taskHours, weekHours)}<small class="detail-record-basis">주간 업무 중</small></span><span class="muted">↗</span></a>`;
          })
          .join("") ||
        '<p class="empty">선택한 기간에 이 과업의 기록이 없습니다.</p>'
      }</div><a class="detail-source" href="${notionHref(p.url)}" target="_blank" rel="noopener noreferrer"><span>Notion에서 이 과업 열기</span><span>↗</span></a>`;
    const dialog = $("#detail");
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-action="close-detail"]').focus();
  }
  function closeDetail() {
    state.detail = null;
    $("#detail").close();
  }
  function changeMonth(m, overview = false) {
    if (!m) return;
    state.month = m;
    state.page = 0;
    if (overview && !state.detail) state.tab = "overview";
    render();
  }
  function changeTab(t) {
    state.tab = t;
    state.page = 0;
    render();
  }
  function toggleOther(id) {
    const target = $("#other-" + id);
    if (!target) return;
    target.hidden = !target.hidden;
    const button = $(`[data-other="${id}"].other-row`);
    button?.setAttribute("aria-expanded", !target.hidden);
    const sign = button?.querySelector(".expand-sign");
    if (sign) sign.textContent = target.hidden ? "+" : "−";
  }
  function highlight(key, source = null) {
    const view = $("#view");
    if (key && key !== "other") {
      view.classList.add("is-highlighting");
      $$("#view [data-task-key]").forEach((el) =>
        el.classList.toggle("is-task-active", el.dataset.taskKey === key),
      );
    } else {
      view.classList.remove("is-highlighting");
      $$("#view .is-task-active").forEach((el) =>
        el.classList.remove("is-task-active"),
      );
    }
    const personId = source?.dataset.donutPerson;
    if (personId) {
      const one = allPersonProjects(personId),
        top = one.projects[0],
        name = $("#donut-name-" + personId),
        value = $("#donut-value-" + personId);
      if (name && value) {
        const label = source
          .closest("svg")
          ?.querySelector(".donut-center-label");
        if (label) label.textContent = key ? "선택한 과업" : "가장 집중한 과업";
        const s = key
          ? source?.dataset.segmentShare
          : top
            ? pct(top.hours, one.total)
            : null;
        name.textContent = key
          ? source.dataset.segmentName
          : top?.name || "기록 없음";
        name.style.setProperty(
          "--task-color",
          key ? source.getAttribute("stroke") : top?.color || "var(--other)",
        );
        value.innerHTML =
          s != null
            ? `${f(Number(s))}<tspan class="donut-percent">%</tspan>`
            : "—";
      }
    }
  }
  $("#month").innerHTML =
    DATA.months
      .map((m) => `<option value="${m}">${monthName(m)}</option>`)
      .join("") + '<option value="all">전체 기간</option>';
  $("#month").addEventListener("change", (e) => changeMonth(e.target.value));
  const targetSelector =
    "[data-action],[data-tab],[data-person],[data-project],[data-view],[data-chart-month],[data-other],[data-trend-person]";
  function activate(el) {
    if (el.dataset.project) {
      openDetail(el.dataset.project);
      return;
    }
    if (el.dataset.other) {
      toggleOther(el.dataset.other);
      return;
    }
    if (el.dataset.person) {
      const id = el.dataset.person;
      if (state.people.has(id)) {
        if (state.people.size === 1) {
          $("#announcer").textContent = "최소 한 명을 선택해 주세요.";
          return;
        }
        state.people.delete(id);
      } else state.people.add(id);
      state.page = 0;
      render();
      $(`[data-person="${id}"]`)?.focus();
      return;
    }
    if (el.dataset.tab) {
      changeTab(el.dataset.tab);
      return;
    }
    if (el.dataset.view) {
      changeTab(el.dataset.view);
      return;
    }
    if (el.dataset.trendPerson) {
      state.trendPerson = el.dataset.trendPerson;
      render();
      return;
    }
    if (el.dataset.chartMonth) {
      changeMonth(el.dataset.chartMonth, true);
      return;
    }
    switch (el.dataset.action) {
      case "method":
        $("#method").showModal();
        break;
      case "close-method":
        $("#method").close();
        break;
      case "prev":
        changeMonth(DATA.months[DATA.months.indexOf(state.month) - 1]);
        break;
      case "next":
        changeMonth(DATA.months[DATA.months.indexOf(state.month) + 1]);
        break;
      case "all-tasks":
        state.allTasks = !state.allTasks;
        render();
        break;
      case "page-prev":
        state.page--;
        $("#records-data").innerHTML = recordTable(aggregate());
        break;
      case "page-next":
        state.page++;
        $("#records-data").innerHTML = recordTable(aggregate());
        break;
      case "close-detail":
        closeDetail();
        break;
    }
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest(targetSelector);
    if (el && !el.disabled) activate(el);
  });
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest("[data-task-key]");
    if (el) highlight(el.dataset.taskKey, el);
  });
  document.addEventListener("pointerout", (e) => {
    const el = e.target.closest("[data-task-key]");
    if (el && !el.contains(e.relatedTarget)) highlight(null, el);
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest("[data-task-key]");
    if (el) highlight(el.dataset.taskKey, el);
  });
  document.addEventListener("focusout", (e) => {
    const el = e.target.closest("[data-task-key]");
    if (el) highlight(null, el);
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "record-search") {
      state.query = e.target.value;
      state.page = 0;
      $("#records-data").innerHTML = recordTable(aggregate());
    }
  });
  $("#detail").addEventListener("close", () => { state.detail = null; });
  for (const dialog of [$("#detail"), $("#method")]) {
    if ("closedBy" in dialog) continue;
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) {
        dialog.close();
      }
    });
  }
  document.addEventListener("keydown", (e) => {
    const interactive = e.target.closest("svg [role=button]");
    if (interactive && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      activate(interactive);
      return;
    }
    const tab = e.target.closest("[data-tab]");
    if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const tabs = $$("[data-tab]"),
        i = tabs.indexOf(tab),
        next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                tabs.length;
      changeTab(tabs[next].dataset.tab);
      tabs[next].focus();
      return;
    }
  });
  render();
})();
