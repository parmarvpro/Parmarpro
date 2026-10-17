/* FEATURES  0:19.2 – 0:28.7
   "Expand. Build tools wired into your stack. Automate." */
(function () {
  const F = window.F, A = F.A, C = F.C, E = F.E, I = A.icon;
  const { tw, kf, prog, set, h, clamp, lerp } = F;

  /* ===========================================================
     S13 — "Expand": one project card pulls back into a wall of them
     =========================================================== */
  const expandCard = (txt, n = '01') => `<div class="xcard"><b>Expand</b><i></i><small>INPUT</small><small>&gt;</small><p>${txt}</p><span class="xc-n"><em>${n}</em>/<em>03</em></span><span class="xc-b">Building <u>by Base44</u></span></div>`;
  const PROMPTS = [
    "Build a live music app that recommends nearby concerts and generates playlists based on each user's listening history.",
    'Recommend healthier product alternatives based on nutritional values and price.',
    'Create a booking portal for a design studio with deposits and reminders.',
    'Turn our product catalogue into a storefront with bundles and gift cards.',
    'Build an internal tool that tracks shoots, crews and deliverables.',
  ];
  const tiles = {
    vol: () => '<div class="vol"><b>VOL</b><small>THE EVENING — OPEN STAGE NIGHTS — LIVE LINEUP</small></div>',
    arrowTile: () => C.tileIcon('var(--orange)', C.glyph.arrow),
    runners: () => `<div class="photo" style="background-image:url(${A.halftone('run2', 360, 240, { bg: '#4f7044', fg: '#d7e6cc', step: 7, cx: 0.5, cy: 0.5 })})"></div>`,
    woods: () => '<div class="woods"><span style="background:#3b2a20"></span><span style="background:#b88a55"></span><span style="background:#d9b46a"></span><em>MODULAR VERNEER</em></div>',
    chair: () => '<div class="chair"><svg viewBox="0 0 100 80"><path d="M28 18h40l6 34H24z" fill="#f4f0e6" stroke="#b9b2a3" stroke-width="1.5"/><path d="M22 52h56v6H22z" fill="#d8d1c2"/><path d="M26 58l-4 18M74 58l4 18M30 58v14M70 58v14" stroke="#8d8576" stroke-width="2.5"/></svg></div>',
    lumea: () => '<div class="lumea"><small>ROUTINE</small><b>Lumea A<br>Protect S</b></div>',
    temp: () => '<div class="temp"><small>Today</small><b>113°</b></div>',
    darkui: () => '<div class="darkui"><i></i><i></i><i></i><span></span></div>',
    apples: () => '<div class="apples"><span style="background:#c8312c"></span><span style="background:#8fb43a"></span><span style="background:#d9532d"></span></div>',
    ear: () => '<div class="ear"><span></span></div>',
    bottle: () => `<div class="bottleT"><div style="width:44%;height:90%">${A.bottle('#2e5fd3')}</div></div>`,
    ope: () => '<div class="opeT">Ope</div>',
    redpat: () => '<div class="redpat"></div>',
    num45: () => '<div class="num45"><small>Total Players</small><b>45</b></div>',
    ball: () => `<div class="ballT"><div style="width:46%">${A.ball({ id: 'bt' })}</div></div>`,
    glyph: (g) => `<div class="glyphT">${C.glyph[g]}</div>`,
    city: () => '<div class="cityT"><i></i><i></i><i></i><i></i></div>',
    face: () => '<div class="faceT"></div>',
    plate: () => '<div class="plateT"><span></span></div>',
  };

  F.scene({
    id: 'expand',
    start: 19.48,
    end: 21.62,
    build(root) {
      root.classList.add('bg-paper');
      const grid = h('<div class="abs xgrid"></div>');
      root.appendChild(grid);
      const CW = 300, CH = 236;
      const cells = [];
      // [col, row, kind, w, h, dx, dy, extra] — centre column is a stack: poster / project / output
      const layout = [
        [0, 0, 'card', 176, 190, 88, 60, 0],
        [0, 0, 'vol', 176, 61, 83.5, -106],
        [0, 0, 'cycle', 176, 74, 83.5, 149.5],
        [0, 0, 'num15', 150, 150, -176, 32.5],
        [-1, -0.92, 'arrowTile', 120, 86, 20, 0],
        [-1, 0.42, 'runners', 120, 84, 30, 0],
        [-1.05, 1.32, 'card', 140, 120, 60, 40, 1],
        [1.02, 0.85, 'chair', 122, 84, 0, 0],
        [1.62, 0.85, 'lumea', 122, 84, 0, 0],
        [1, -0.25, 'card', 140, 120, 60, 40, 2],
      ];
      const kinds = ['card', 'apples', 'card', 'temp', 'glyph:puzzle', 'darkui', 'card', 'ear', 'redpat', 'card', 'glyph:arrow', 'bottle', 'card', 'ope', 'city', 'card', 'lumea', 'chair', 'card', 'ball', 'face', 'glyph:star4', 'card', 'plate', 'woods', 'num45', 'card', 'runners'];
      const rr = F.rng(44);
      let ki = 0;
      for (let r = -3; r <= 3; r++)
        for (let c = -5; c <= 5; c++) {
          if (Math.abs(c) <= 1 && Math.abs(r) <= 1) continue;
          if (c === 2 && r === 1) continue;
          const kind = kinds[ki++ % kinds.length];
          const isCard = kind === 'card';
          const w = isCard ? 150 : kind.startsWith('glyph') ? 90 + rr() * 22 : 140 + rr() * 40;
          const hh = isCard ? 128 : kind.startsWith('glyph') ? w : 92 + rr() * 26;
          layout.push([c, r, kind, w, hh, (rr() - 0.5) * 120, (rr() - 0.5) * 80, ki % 5]);
        }
      for (const [c, r, kind, w, hh, dx, dy, extra] of layout) {
        let html;
        if (kind === 'card') html = expandCard(PROMPTS[extra || 0], ['01', '02', '03', '01', '02'][extra || 0]);
        else if (kind === 'num15') html = '<div class="bignum"><small>Players</small><b>15</b></div>';
        else if (kind === 'cycle') html = `<div class="cyc">${tiles.runners()}</div><div class="cyc">${tiles.woods()}</div><div class="cyc">${tiles.chair()}</div>`;
        else if (kind.startsWith('glyph:')) html = tiles.glyph(kind.slice(6));
        else html = tiles[kind]();
        const el = h(`<div class="abs xt ${kind === 'card' ? 'is-card' : ''}" style="width:${w}px;height:${hh}px">${html}</div>`);
        grid.appendChild(el);
        cells.push({ el, x: c * CW + dx - w / 2, y: r * CH + dy - hh / 2, main: c === 0 && r === 0 && kind === 'card' });
      }
      const main = cells[0];
      const cyc = F.$$(grid, '.cyc');
      const mainP = F.$(main.el, 'p');
      const mainTxt = PROMPTS[0];
      return (lt) => {
        // zoom: 3.4× on the first card → whole wall
        // holds on the card, snaps back fast, then drifts out (log-space keyframes)
        const s = Math.exp(kf(lt, [[0, Math.log(3.35)], [0.42, Math.log(3.15), E.linear], [0.66, Math.log(1.55), E.inOutCubic], [0.9, Math.log(1.25), E.outQuad], [1.35, Math.log(0.95), E.inOutQuad], [2.14, Math.log(0.9), E.linear]]));
        const fx = main.x + 82, fy = main.y + 60;
        const focusX = lerp(fx, 60, E.inOutCubic(prog(lt, 0.42, 1.2)));
        const focusY = lerp(fy, 40, E.inOutCubic(prog(lt, 0.42, 1.2)));
        set(grid, { x: 960 - focusX * s, y: 540 - focusY * s, s });
        // the stack spreads apart as we pull back
        const spread = E.inOutCubic(prog(lt, 0.42, 0.9));
        cells.forEach((c, i) => set(c.el, { x: c.x, y: c.y + (i === 1 ? -80 * spread : i === 2 ? 76 * spread : 0) }));
        // the prompt finishes typing, the bottom tile flips through variations
        F.text(mainP, F.typed(mainTxt, lt, -0.6, 0.3));
        const k = Math.min(2, Math.floor(lt / 0.24) % 3);
        cyc.forEach((c, i) => (c.style.opacity = i === k ? '1' : '0'));
      };
    },
  });

  /* ===========================================================
     S14 — build log + dashboard close-ups
     =========================================================== */
  F.scene({
    id: 'building',
    start: 21.62,
    end: 24.52,
    build(root) {
      root.innerHTML = `
        <div class="bl-left"><div class="abs blog">
          <div class="bl-row r0"><span class="bl-ic">${A.base44Mark('var(--orange)')}</span><span class="bl-t">Building<span class="dots">...</span></span></div>
          <div class="bl-row r1"><span class="bl-ic">${C.iconSpan(I.globe, 44, '#6b6b6b')}</span><span>Connecting to database</span></div>
          <div class="bl-row r2"><span class="bl-ic">${C.iconSpan(I.file, 44, '#6b6b6b')}</span><span>Syncing client assets</span></div>
          <div class="bl-row r3"><span class="bl-ic">${C.iconSpan(I.calendar, 44, '#6b6b6b')}</span><span>Preparing preview</span></div>
        </div></div>
        <div class="bl-right">
          <div class="abs panel donutP"><svg class="donut" viewBox="-100 -100 200 200"></svg><div class="dn-c"><b>31</b><small>ACTIVE PROJECTS</small></div><span class="pct p1">15%</span><span class="pct p2">24%</span></div>
          <div class="abs panel schedP"><div class="sc-h">${C.iconSpan(I.calendar, 62, 'var(--orange)')}<b>TODAY'S SCHEDULE</b></div><small class="sc-s">ACROSS ALL LIVE ENGAGEMENTS</small>
            <div class="sc-r sr1"><b>MORNING SYNC</b><small>OPEN FIELDS</small></div><div class="sc-r sr2"><b>DESIGN REVIEW</b><small>AEROH AI</small></div><div class="sc-r sr3"><b>CLIENT FEEDBACK</b><small>MERIDIAN</small></div></div>
          <div class="abs panel deadP"><div class="dd-h">${C.iconSpan(I.flag, 56, 'var(--orange)')}<b>UPCOMING DEADLINES</b></div>
            <div class="dd-card"><div class="dd-track"><i></i></div><b>WEB REDESIGN</b><small><span class="dd-n">16</span> / 36 TASKS &nbsp; &nbsp; <span class="dd-p">71</span>% COMPLETE</small></div></div>
        </div>`;
      const rows = F.$$(root, '.bl-row');
      const blog = F.$(root, '.blog');
      const dots = F.$(root, '.dots');
      const donutP = F.$(root, '.donutP'), schedP = F.$(root, '.schedP'), deadP = F.$(root, '.deadP');
      const svg = F.$(root, '.donut');
      const num = F.$(root, '.dn-c b');
      const p1 = F.$(root, '.pct.p1'), p2 = F.$(root, '.pct.p2');
      const scRows = F.$$(root, '.sc-r');
      const ddTrack = F.$(root, '.dd-track i');
      const ddN = F.$(root, '.dd-n'), ddP = F.$(root, '.dd-p');
      const arc = (a0, a1, r0, r1) => {
        const p = (a, r) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        return `M${p(a0, r1)} A${r1} ${r1} 0 ${large} 1 ${p(a1, r1)} L${p(a1, r0)} A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)}Z`;
      };
      return (lt) => {
        // log rows appear; the stack re-centres as it grows
        const RT = [0, 0.3, 0.88, 1.83];
        const shown = RT.filter((t0) => lt >= t0).length;
        rows.forEach((r, i) => set(r, { o: prog(lt, RT[i], RT[i] + 0.12) }));
        const target = 540 - ((shown - 1) * 115) / 2 - 60;
        const prev = 540 - ((Math.max(1, shown - 1) - 1) * 115) / 2 - 60;
        const ts = RT[shown - 1];
        set(blog, { x: 80, y: lerp(prev, target, E.outCubic(prog(lt, ts, ts + 0.25))) });
        F.text(dots, ['.', '..', '...'][Math.floor(lt * 4) % 3]);
        // which panel is on screen
        const seg = lt < 0.83 ? 0 : lt < 1.83 ? 1 : 2;
        donutP.style.display = seg === 0 ? '' : 'none';
        schedP.style.display = seg === 1 ? '' : 'none';
        deadP.style.display = seg === 2 ? '' : 'none';
        if (seg === 0) {
          const k = prog(lt, 0, 0.83);
          const orange = lerp(0.15, 0.3, E.outCubic(k)), gray = 0.17, purple = 1 - orange - gray;
          const shownO = lerp(0.15, 0.32, E.outCubic(k)), shownP = lerp(0.24, 0.41, E.outCubic(k));
          const start = -Math.PI / 2 + 0.25;
          const a1 = start + orange * Math.PI * 2, a2 = a1 + gray * Math.PI * 2, a3 = a2 + purple * Math.PI * 2;
          svg.innerHTML = `<path d="${arc(start, a1, 60, 98)}" fill="#ee6a12"/><path d="${arc(a1, a2, 60, 98)}" fill="#5d5d5d"/><path d="${arc(a2, a3, 60, 98)}" fill="#d9b6f2"/>`;
          F.text(num, String(F.count(lt, 0, 0.7, 31, 34)));
          F.text(p1, Math.round(shownO * 100) + '%');
          F.text(p2, Math.round(shownP * 100) + '%');
          const lab = (a, el) => { const R = 79 * 1.08; set(el, { x: 185 + 540 + Math.cos(a) * R * 5 - 50, y: -10 + 540 + Math.sin(a) * R * 5 - 26 }); };
          lab((start + a1) / 2, p1);
          lab((a2 + a3) / 2, p2);
          set(donutP, { x: tw(lt, 0, 0.83, 20, -20, E.linear), y: tw(lt, 0, 0.83, -20, 30, E.inOutQuad), s: tw(lt, 0, 0.83, 1.0, 1.04, E.linear) });
        } else if (seg === 1) {
          const k = lt - 0.83;
          scRows.forEach((r, i) => r.classList.toggle('sub', k > 0.12 + i * 0.22));
          scRows[1].classList.toggle('blue', k > 0.3 && k < 0.5);
          set(schedP, { x: 60 - k * 20, y: 30 - k * 10 });
        } else {
          const k = lt - 1.83;
          const p = tw(k, 0, 0.9, 0.44, 0.86, E.outQuad);
          set(ddTrack, { sx: p });
          F.text(ddN, String(Math.round(p * 36)));
          F.text(ddP, String(Math.round(p * 100)));
          set(deadP, { x: 50 - k * 16, y: 40 });
        }
      };
    },
  });

  /* ===========================================================
     S15 — the finished client dashboard on orange
     =========================================================== */
  function dashboard() {
    let bars = '';
    for (let i = 0; i < 48; i++) bars += '<i></i>';
    return `<div class="dash">
      <div class="ds-side"><div class="ds-av"></div>${C.iconSpan(I.gear, 26, '#bbb')}<small>Alex Rivera<br><span>Director</span></small></div>
      <div class="ds-main">
        <div class="ds-top"><b>${C.iconSpan(C.glyph.gearBold.replace('<svg ', '<svg fill="#ee6a12" '), 20, 'var(--orange)')} IN PROGRESS.</b><span class="on">DASHBOARD</span><span>PROJECTS</span><span>CLIENTS</span><span>REPORTS</span><span>CAREERS</span><em>⌕ Search</em></div>
        <div class="ds-title"><h1>CLIENT OVERVIEW</h1><small>PROJECTS //<br>DIRECTOR OVERVIEW</small><span>+ New Project</span></div>
        <div class="ds-grid">
          <div class="ds-chart"><small>▲ BUSINESS GROWTH MAP</small><div class="ds-leg"><span>● Brand</span><span class="o">● Product</span><span>● Strategy</span></div><i class="ds-btn"></i><div class="bars">${bars}</div><div class="ds-q"><span>Q1 2026</span><span>Q2 2026</span><span>Q3 2026</span><span>Q4 2026</span></div></div>
          <div class="ds-sched"><small>▣ TODAY'S SCHEDULE</small><em>ACROSS ALL LIVE ENGAGEMENTS</em>${['DESIGN REVIEW', 'CLIENT FEEDBACK', 'CONTENT UPLOAD', 'TEAM LUNCH'].map((x, i) => `<div><b>${x}</b><span>${['10:00', '11:30', '14:00', '13:00'][i]} — ${['10:45', '12:15', '14:30', '14:00'][i]}</span></div>`).join('')}</div>
        </div>
        <div class="ds-cards">
          <div><small>▣ PROJECT PIPELINE</small><div class="dc"><em>ACTIVE PROJECTS</em><b>34</b><i class="dc-donut"></i></div></div>
          <div><small>▣ NEXT SESSION</small><div class="dc"><em>MORNING SYNC</em><b>7AM</b></div></div>
          <div><small>⚑ UPCOMING DEADLINES</small><div class="dc"><em>WEB REDESIGN</em><i class="dc-bar"></i></div></div>
        </div>
      </div>
    </div>`;
  }
  F.dashboardHTML = dashboard;

  F.scene({
    id: 'dashboard',
    start: 24.52,
    end: 25.92,
    build(root) {
      root.style.background = '#eb6528';
      root.innerHTML = `<div class="abs dash-wrap">${dashboard()}</div>`;
      const wrap = F.$(root, '.dash-wrap');
      const bars = F.$$(root, '.bars i');
      const cols = bars.map((_, i) => (i < 6 ? '#5a5a5a' : i < 16 ? (i % 3 === 0 ? '#ee6a12' : '#d9b6f2') : i % 4 === 0 ? '#ee6a12' : i % 5 === 0 ? '#5a5a5a' : '#d9b6f2'));
      bars.forEach((b, i) => (b.style.background = cols[i]));
      return (lt) => {
        const s = tw(lt, 0, 1.4, 0.985, 1.01, E.linear);
        set(wrap, { x: 960 - 690 * s, y: 545 - 482 * s, s });
        wrap.style.transformOrigin = '0 0';
        // growth map: a decaying profile morphs into a wave
        const m = E.inOutCubic(prog(lt, 0.7, 1.35));
        bars.forEach((b, i) => {
          const u = i / 47;
          const decay = 0.95 * Math.exp(-u * 3.2) + 0.18 + 0.05 * Math.sin(i * 1.7);
          const wave = 0.25 + 0.7 * Math.exp(-Math.pow((u - 0.55) / 0.22, 2)) + 0.06 * Math.sin(i * 2.3);
          set(b, { sy: clamp(lerp(decay, wave, m), 0.06, 1) * 0.62 });
        });
      };
    },
  });

  /* ===========================================================
     S16 — integrations slide along their wires into one line
     (also bridges the 1.5s the source recording lost to black)
     =========================================================== */
  F.scene({
    id: 'wired',
    start: 25.92,
    end: 27.92,
    build(root) {
      root.style.background = '#f6f2ee';
      const glyphs = ['gearBold', 'plusBold', 'cc', 'eye', 'castle', 'globeBold', 'swirl', 'puzzle'];
      const xs = [195, 395, 665, 980, 1295, 1560, 1765, 1880];
      let s = '';
      xs.forEach((x, i) => (s += `<div class="wire" style="left:${x}px"><i class="w-top"></i><i class="w-bot"></i><span class="w-ic">${C.glyph[glyphs[i]]}</span></div>`));
      for (const x of [60, 290, 520, 820, 1140, 1440, 1660]) s += `<i class="wire-x" style="left:${x}px"></i>`;
      root.innerHTML = s + '<i class="w-h"></i>';
      const extra = F.$$(root, '.wire-x');
      const wires = F.$$(root, '.wire').map((el, i) => ({ el, top: F.$(el, '.w-top'), bot: F.$(el, '.w-bot'), ic: F.$(el, '.w-ic'), i }));
      const hline = F.$(root, '.w-h');
      const start = [415, 400, 470, 560, 640, 630, 560, 405];
      return (lt) => {
        const row = 535;
        wires.forEach((w) => {
          const yy = lerp(start[w.i], row, E.inOutCubic(prog(lt, -0.3 + w.i * 0.01, 0.16 + w.i * 0.01)));
          const gap = 58;
          set(w.top, { h: Math.max(0, yy - gap - 40) });
          w.bot.style.top = yy + gap + 'px';
          set(w.ic, { x: -42, y: yy - 42 });
          // converge on the centre wire
          const pc = E.inOutCubic(prog(lt, 1.05, 1.75));
          const dx = (980 - xs[w.i]) * pc;
          set(w.el, { x: dx, o: w.i === 3 ? 1 : 1 - prog(lt, 1.45, 1.75) });
        });
        set(hline, { sx: E.inOutCubic(prog(lt, 0.5, 0.95)) * (1 - E.inQuad(prog(lt, 1.2, 1.6))), o: 1 });
        extra.forEach((x) => set(x, { o: 1 - prog(lt, 1.0, 1.4) }));
      };
    },
  });

  /* ===========================================================
     S17 — "Automate"
     =========================================================== */
  F.scene({
    id: 'automate',
    start: 27.92,
    end: 28.5,
    build(root) {
      root.classList.add('dot-bg');
      root.innerHTML = '<i class="am-line t"></i><i class="am-line b"></i><div class="am-word">Automate</div>';
      const w = F.$(root, '.am-word');
      const lt1 = F.$(root, '.am-line.t'), lb = F.$(root, '.am-line.b');
      return (lt) => {
        set(w, { o: prog(lt, 0, 0.06), s: tw(lt, 0, 0.58, 1, 1.03, E.linear) });
        set(lt1, { sy: tw(lt, 0, 0.12, 0.4, 1, E.outCubic) });
        set(lb, { sy: tw(lt, 0, 0.12, 0.4, 1, E.outCubic) });
      };
    },
  });
})();
