/* DEMO  0:28.7 – 0:45.9
   "Ban redundancy. Every skill, multiply. Every hour, worth more." */
(function () {
  const F = window.F, A = F.A, C = F.C, E = F.E, I = A.icon;
  const { tw, kf, prog, set, h, clamp, lerp } = F;
  const watermark = () => `<div class="wm">${A.base44Logo('#fff', '#fff')}</div>`;

  /* ===========================================================
     S18 — automation flow; the camera flies down the tree
     =========================================================== */
  const NODES = [
    // id, kind, title, sub, x, y, appear
    ['T', 'trigger', 'Scheduled', 'Daily at 9:00 AM', -180, -304, 0.0],
    ['A1', 'action', 'Membership Expiring', 'Expiring in the next 7 days', -180, -152, 0.38],
    ['C1', 'condition', 'Auto-Renewal', 'None > end | Found > route', -180, 0, 1.12],
    ['L1', 'action', 'Charge Saved Card', 'Auto-renew payment attemt', -402, 193, 1.5],
    ['R1', 'action', 'Send Discount Email', 'Yearly-renewal discount offer', 37, 193, 1.5],
    ['L2', 'action', 'Send Approval SMS', 'Calls renrewalSendSMS', -402, 345, 1.72],
    ['R2', 'wait', 'Wait 6 Days', 'Wait 24 hours after login', 37, 345, 1.72],
    ['C2', 'condition', 'Renewed Subscription', 'Check if user renewed subscri…', 37, 497, 2.2],
    ['L3', 'action', 'Send Approval SMS', 'Calls renrewalSendSMS', -186, 688, 2.5],
    ['R3', 'action', 'Send Final Discount Email', 'Stronger offer - expires at midnight', 252, 688, 2.5],
    ['C3', 'condition', 'Renewed Subscription', 'Check if user renewed', 252, 840, 4.2],
    ['L4', 'action', 'Send Approval Email', 'Calls renrewalSendEmail', 29, 1031, 4.75],
    ['R4', 'wait', 'Wait 24 Hours', 'Wait P1D', 467, 1031, 4.75],
  ];
  const LABEL = { trigger: 'TRIGGER', action: 'ACTION', condition: 'CONDITION', wait: 'WAIT' };
  const ICON = { trigger: I.bolt, action: I.play, condition: I.branch, wait: I.clock };
  const CW = 360, CH = 78;

  F.scene({
    id: 'flow',
    start: 28.5,
    end: 34.0,
    build(root) {
      root.classList.add('dot-bg');
      const cam = h('<div class="abs flow-cam"></div>');
      root.appendChild(cam);
      const svg = h('<svg class="abs flow-wires" width="2000" height="2000" viewBox="-1000 -500 2000 2000"></svg>');
      cam.appendChild(svg);
      const byId = {};
      for (const [id, kind, title, sub, x, y, at] of NODES) {
        const el = h(`<div class="abs fnode ${kind}" style="left:${x}px;top:${y}px"><small>${LABEL[kind]}</small><div class="fcard"><span class="fi">${C.iconSpan(ICON[kind], 21)}</span><div><b>${title}</b><em>${sub}</em></div></div>${kind === 'trigger' ? `<span class="fside">${C.iconSpan(I.listBolt, 20)}</span>` : ''}</div>`);
        cam.appendChild(el);
        byId[id] = { el, x, y, at, kind };
      }
      // wires: straight drops and Yes/No forks with rounded corners
      const wires = [];
      const drop = (a, b, at) => {
        const A_ = byId[a], B = byId[b];
        const x = A_.x + CW / 2, y0 = A_.y + CH + 10, y1 = B.y - 34;
        wires.push({ d: `M${x} ${y0} L${x} ${y1}`, at, len: y1 - y0 });
      };
      const fork = (c, l, r, at) => {
        const P = byId[c], L = byId[l], R = byId[r];
        const cx = P.x + CW / 2, y0 = P.y + CH + 8, ym = P.y + CH + 52, rr = 18;
        const lx = L.x + CW / 2, rx = R.x + CW / 2, y1 = L.y - 34;
        wires.push({ d: `M${cx - 6} ${y0} L${cx - 6} ${ym - rr} Q${cx - 6} ${ym} ${cx - 6 - rr} ${ym} L${lx + rr} ${ym} Q${lx} ${ym} ${lx} ${ym + rr} L${lx} ${y1}`, at, len: 600 });
        wires.push({ d: `M${cx + 6} ${y0} L${cx + 6} ${ym - rr} Q${cx + 6} ${ym} ${cx + 6 + rr} ${ym} L${rx - rr} ${ym} Q${rx} ${ym} ${rx} ${ym + rr} L${rx} ${y1}`, at, len: 600 });
        for (const [lab, px] of [['Yes', (cx + lx) / 2 + 12], ['No', (cx + rx) / 2 - 12]]) {
          const pill = h(`<div class="abs fpill" style="left:${px - 37}px;top:${ym - 17}px">${lab}</div>`);
          cam.appendChild(pill);
          byId[c + lab] = { el: pill, at: at + 0.08, kind: 'pill' };
        }
      };
      drop('T', 'A1', 0.12);
      drop('A1', 'C1', 0.92);
      fork('C1', 'L1', 'R1', 1.28);
      drop('L1', 'L2', 1.62);
      drop('R1', 'R2', 1.62);
      drop('R2', 'C2', 2.05);
      fork('C2', 'L3', 'R3', 2.38);
      drop('R3', 'C3', 4.0);
      fork('C3', 'L4', 'R4', 4.5);
      svg.innerHTML = wires.map((w) => `<path d="${w.d}" fill="none" stroke="#a3a3a0" stroke-width="2.2" stroke-linecap="round"/>`).join('');
      const paths = F.$$(svg, 'path');
      paths.forEach((p, i) => {
        const L = p.getTotalLength ? 1000 : 1000;
        p.style.strokeDasharray = L;
        wires[i].el = p;
        wires[i].L = L;
      });
      // camera keyframes: [t, cx, cy, scale]
      const K = [
        [0, 0, -250, 3.0], [0.45, 0, -224, 3.0], [0.75, 0, -202, 3.0], [1.05, 0, 143, 2.06], [1.25, -9, 189, 1.94],
        [1.85, -9, 186, 1.94], [2.05, 46, 367, 1.225], [2.85, 46, 377, 1.225], [3.15, 222, 562, 3.27], [3.85, 222, 562, 3.27],
        [4.05, 419, 727, 3.27], [4.25, 419, 731, 3.27], [4.45, 417, 879, 3.27], [4.75, 417, 884, 3.27], [5.05, 206, 1053, 3.27], [5.5, 200, 1050, 3.3],
      ];
      const camAt = (lt) => {
        let i = 0;
        while (i < K.length - 2 && lt > K[i + 1][0]) i++;
        const a = K[i], b = K[i + 1];
        const p = E.inOutCubic(prog(lt, a[0], b[0]));
        // interpolate scale in log space
        return [lerp(a[1], b[1], p), lerp(a[2], b[2], p), Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), p))];
      };
      return (lt) => {
        const [cx, cy, s] = camAt(lt);
        set(cam, { x: 960 - cx * s, y: 540 - cy * s, s });
        for (const k in byId) {
          const n = byId[k];
          const p = prog(lt, n.at, n.at + 0.22);
          set(n.el, { o: clamp(p * 2), y: n.kind === 'pill' ? 0 : (1 - E.outCubic(p)) * 14 });
        }
        wires.forEach((w) => {
          const p = E.outCubic(prog(lt, w.at, w.at + 0.3));
          w.el.style.strokeDashoffset = String(w.L * (1 - p));
        });
      };
    },
  });

  /* ===========================================================
     S19 — a moodboard wall pulls into focus behind the email
     (coded stand-in for the blurred studio footage)
     =========================================================== */
  function moodboard() {
    const r = F.rng(19);
    const pins = [
      [140, 120, 300, 210, `background-image:url(${A.pitch('mb1', 300, 210, { c1: '#3f8a37', c2: '#4b9a41', stripeW: 40, players: [[0.4, 0.5], [0.6, 0.6, '#222']], ps: 9 })})`],
      [470, 90, 220, 300, `background:#b11a30`],
      [720, 140, 260, 180, `background-image:url(${A.park('mb2', 260, 180, { horizon: 0.6, dense: true, people: 3 })})`],
      [1010, 80, 240, 240, `background:#3e47df`],
      [1290, 130, 300, 200, `background-image:url(${A.felt()})`],
      [1620, 100, 200, 280, `background:#edff73`],
      [200, 380, 240, 300, `background:#f0e9dc`],
      [480, 420, 300, 210, `background-image:url(${A.indoor('mb3', 300, 210)})`],
      [830, 380, 200, 260, `background:#ee6a12`],
      [1080, 360, 320, 220, `background-image:url(${A.cityField('mb4', 320, 220)})`],
      [1440, 420, 260, 190, `background:#1f6b35`],
      [1730, 380, 160, 220, `background:#d9b6f2`],
      [120, 730, 280, 200, `background:#2b2b2b`],
      [450, 700, 220, 260, `background-image:url(${A.halftone('mb5', 220, 260, { bg: '#4f7044', fg: '#d7e6cc', step: 7 })})`],
      [710, 690, 330, 230, `background:#e9e3d6`],
      [1080, 650, 240, 300, `background:#c8312c`],
      [1360, 680, 300, 210, `background-image:url(${A.pitch('mb6', 300, 210, { c1: '#9aa09a', c2: '#b4b8b2', stripeW: 50, gray: true, players: [[0.3, 0.4], [0.7, 0.6]] })})`],
      [1690, 660, 200, 250, `background:#fbf3a8`],
    ];
    let s = '<div class="mood">';
    for (const [x, y, w, hh, bg] of pins) {
      s += `<div class="mood-pin" style="left:${x}px;top:${y}px;width:${w}px;height:${hh}px;${bg};transform:rotate(${((r() - 0.5) * 5).toFixed(2)}deg)"><i></i></div>`;
    }
    return s + '<div class="mood-brick"></div></div>';
  }

  F.scene({
    id: 'mail',
    start: 34.0,
    end: 36.46,
    build(root) {
      root.style.background = '#d9d2c4';
      root.innerHTML = `<div class="abs mood-cam">${moodboard()}</div>
        <div class="abs notif"><span class="nt-ic">${A.mailLogo()}</span><div class="nt-tx"><b>Membership Renewal</b><span>Hey, we noticed your membership is about<br>to expire and wanted to offer you 10% off</span></div><em>now</em></div>
        ${watermark()}<div class="grain" style="background-image:url(${A.grain(13)})"></div>`;
      const camEl = F.$(root, '.mood-cam');
      const mood = F.$(root, '.mood');
      const n = F.$(root, '.notif');
      const grain = F.$(root, '.grain');
      return (lt) => {
        const focus = E.inOutCubic(prog(lt, 1.35, 1.65));
        set(camEl, { x: -60 - lt * 22, y: -30, s: 1.06 + lt * 0.012 });
        mood.style.filter = `blur(${lerp(22, 0, focus).toFixed(1)}px) saturate(${lerp(0.85, 1, focus).toFixed(2)})`;
        const pn = prog(lt, 0.02, 0.2);
        set(n, { x: 438, y: 447 + (1 - E.outCubic(pn)) * 30, o: pn * (1 - prog(lt, 1.32, 1.5)), s: lerp(0.97, 1, E.outCubic(pn)) });
        grain.style.transform = `translate(${(Math.floor(lt * 24) * 37) % 200 - 100}px, ${(Math.floor(lt * 24) * 59) % 200 - 100}px)`;
      };
    },
  });

  /* ===========================================================
     S20 — theme picker over an aerial pitch
     =========================================================== */
  const appShot = (theme, opts = {}) => `<div class="mini-app t-${theme}">
      <div class="ma-map">${C.isoMap(theme, { viewBox: '-260 -40 560 420' })}</div>
      <div class="ma-panel"><b>${opts.title || 'Available Fields'}</b><small>Central Arena</small>${'<i></i>'.repeat(6)}</div>
      <div class="ma-tot"><span><small>Total Players</small><b>${opts.n || 453}</b></span><span><small>Total Fields</small><b>${opts.m || 453}</b></span></div>
    </div>`;

  F.scene({
    id: 'themes',
    start: 36.46,
    end: 37.46,
    build(root) {
      root.innerHTML = `<div class="photo" style="background-image:url(${A.pitch('themes', 1920, 1080, { c1: '#3d8a33', c2: '#47963b', stripeW: 150, stripeAngle: 1.57, players: [[0.32, 0.1], [0.57, 0.11, '#2a2a2a'], [0.09, 0.69], [0.17, 0.66, '#222']], ps: 30, vignette: 0.3, lines: [{ type: 'line', x1: 0.36, y1: 0, x2: 0.36, y2: 1 }, { type: 'line', x1: 0.5, y1: 0.34, x2: 1, y2: 0.34 }, { type: 'arc', x: 1.06, y: 0.62, r: 0.16 }] })})"></div>
        <div class="abs theme-grid">
          ${[['dark', 'Dark Olive', 'Mossy, amber accents'], ['sand', 'Light Sand', 'Cream, bright green'], ['earth', 'Natural Earth', 'Beige, light tones'], ['night', 'Night Green', 'Green tones']].map(([th, a, b]) => `<div class="tcard2"><div class="tc-img">${appShot(th, th === 'earth' || th === 'night' ? { n: 35, m: 5 } : {})}</div><b>${a}</b><small>${b}</small></div>`).join('')}
        </div>
        <div class="abs cur">${A.cursor('#111')}</div>${watermark()}`;
      const grid = F.$(root, '.theme-grid');
      const cards = F.$$(root, '.tcard2');
      const cur = F.$(root, '.cur');
      return (lt) => {
        set(grid, { x: 522, y: 180, s: tw(lt, 0, 1, 1, 1.015, E.linear) });
        cards.forEach((c, i) => set(c, { o: prog(lt, i * 0.04, i * 0.04 + 0.12), s: lerp(0.94, 1, E.outCubic(prog(lt, i * 0.04, i * 0.04 + 0.2))) }));
        const cx = kf(lt, [[0, 1500], [0.45, 1290, E.inOutCubic], [1, 1300]]);
        const cy = kf(lt, [[0, 700], [0.45, 440, E.inOutCubic], [1, 452]]);
        set(cur, { x: cx, y: cy, s: lt > 0.5 && lt < 0.6 ? 0.88 : 1 });
        cards[1].classList.toggle('picked', lt > 0.55);
      };
    },
  });

  /* ===========================================================
     S21 — the isometric "Available Fields" app, re-themed
     =========================================================== */
  F.scene({
    id: 'iso-app',
    start: 37.46,
    end: 39.46,
    build(root) {
      root.classList.add('bg-paper');
      root.innerHTML = `<div class="abs isoapp">
          <div class="ia-map">${C.isoMap('blue', { viewBox: '-330 -40 640 470' })}</div>
          <div class="ia-map light">${C.isoMap('sand', { viewBox: '-330 -40 640 470' })}</div>
          <div class="ia-dark"><b>AVAILABLE FIELDS</b><small>Central Arena</small></div>
          <div class="ia-panel"><div class="ia-brand"><span>‹</span>Open Fields.</div>
            <div class="ia-list">${C.availableFields({ more: true })}</div></div>
          <div class="ia-user">Elsa Nillson <i></i> <span>⋮⋮</span></div>
          <div class="ia-tot"><div class="b"><small>Total Players</small><b>35</b></div><div><small>Total Fields</small><b>5</b></div></div>
          <div class="ia-tabs"><span class="on">Soccer Fields</span><span>Training Grounds</span></div>
          <div class="ia-tools">${['⊞', '▣', '⚇', '⚲', '⬡'].map((x) => `<i>${x}</i>`).join('')}</div><div class="ia-zoom"><i>+</i><i>−</i></div>
        </div><div class="abs cur">${A.cursor('#111')}</div>`;
      const app = F.$(root, '.isoapp');
      const light = F.$(root, '.ia-map.light');
      const dark = F.$(root, '.ia-dark');
      const panel = F.$(root, '.ia-panel');
      const cur = F.$(root, '.cur');
      return (lt) => {
        const sw = E.inOutCubic(prog(lt, 0.42, 0.62));
        set(light, { o: sw });
        set(dark, { o: 1 - sw });
        panel.classList.toggle('lit', sw > 0.5);
        app.classList.toggle('lit', sw > 0.5);
        const wv = kf(lt, [[0, 1336], [1.0, 1336], [1.5, 1300, E.inOutCubic], [2, 1300]]);
        set(app, { x: 294, y: 66, w: wv });
        set(cur, { x: kf(lt, [[0, 1700], [0.9, 1640, E.inOutCubic], [1.0, 1636], [1.5, 1600, E.inOutCubic]]), y: kf(lt, [[0, 760], [0.9, 640, E.inOutCubic], [2, 650]]) });
      };
    },
  });

  /* ===========================================================
     S22 — the team on one canvas (multiplayer cursors)
     =========================================================== */
  function liveOps() {
    return `<div class="sc-card liveops"><h3>Live Ops Dashboard</h3><small>Monday, June 22, 2026</small>
      <div class="lo-k">${['65%', '4', '23', '2', '1'].map((v) => `<div><i></i><b>${v}</b></div>`).join('')}</div>
      <div class="lo-alerts"><b>Active Alerts</b>${['Server Response Degraded', 'High Queue Volume', 'Shift Coverage Gap', 'Shift Coverage Gap'].map((a, i) => `<div><i style="background:${['#e5484d', '#f5a524', '#f2d03b', '#f2d03b'][i]}"></i>${a}</div>`).join('')}</div>
      <div class="lo-time"><b>Today's Timeline</b><div class="lo-grid"></div></div>
      <div class="lo-foot"><span>Today's Shifts</span><span>Open Incidents</span></div></div>`;
  }
  function maint() {
    return `<div class="sc-card maint"><div class="mt-hero" style="background-image:url(${A.pitch('mt', 560, 220, { c1: '#2c6a2b', c2: '#347833', stripeW: 60, players: [[0.3, 0.5], [0.5, 0.4, '#111'], [0.68, 0.62]], ps: 10, vignette: 0.4 })})"><b>Field 4</b></div>
      <div class="mt-k"><div><b>42</b></div><div><b>57%</b></div><div class="bl"><b>$15,235</b></div><div class="li"><b>23</b></div></div>
      <div class="mt-row"><div class="mt-imgs"><b>Open Maintenance Issues</b><span></span><span></span><span></span></div><div class="mt-tab"><b>Field Details</b>${'<i></i>'.repeat(6)}</div></div></div>`;
  }
  function sched() {
    return `<div class="sc-card schedc"><h3>Schedule</h3><div class="sch-g">${'<i></i>'.repeat(42)}</div>
      <span class="ev" style="left:12%;top:38%;background:#e4f77a"></span><span class="ev" style="left:30%;top:46%;background:#c9b6f2"></span><span class="ev" style="left:46%;top:36%;background:#c9b6f2"></span><span class="ev" style="left:52%;top:58%;background:#f2d03b"></span><span class="ev" style="left:72%;top:66%;background:#9db8f5"></span><span class="ev" style="left:14%;top:80%;background:#e4f77a"></span></div>`;
  }

  F.scene({
    id: 'board',
    start: 39.46,
    end: 40.96,
    build(root) {
      root.style.background = '#eeece9';
      root.innerHTML = `<div class="abs board-cam">
          <div class="abs b-map" style="left:-40px;top:270px;width:420px;height:300px">${appShot('sand', { n: 453, m: 453 })}</div>
          <small class="abs b-lab" style="left:500px;top:248px">Live Ops Dashboard</small><div class="abs" style="left:500px;top:278px;width:430px;height:470px">${liveOps()}</div>
          <small class="abs b-lab" style="left:1030px;top:248px">Maintenance</small><div class="abs" style="left:1030px;top:278px;width:430px;height:420px">${maint()}</div>
          <small class="abs b-lab" style="left:1595px;top:248px">Schedule</small><div class="abs" style="left:1595px;top:278px;width:430px;height:290px">${sched()}</div>
          <div class="abs b-note" style="left:290px;top:200px;background:#f6d2ad">Can we add a subtle loading animation?</div>
          <div class="abs b-note" style="left:812px;top:780px;background:#fbf0a0">Really clean layout! could the font be a bit bigger?</div>
          <div class="abs b-note" style="left:1400px;top:312px;background:#d3ecd6">Could scheduling a field be a step shorter</div>
          <svg class="abs" width="1920" height="1080" style="left:0;top:0;overflow:visible"><path d="M428 254 h20 q12 0 12 12 v148 q0 12 -12 12 h-80" fill="none" stroke="#7b8af0" stroke-width="2"/><path d="M945 835 h20 q12 0 12 -12 v-214 q0 -12 -12 -12 h-40" fill="none" stroke="#7b8af0" stroke-width="2"/><circle cx="368" cy="426" r="6" fill="#fff" stroke="#7b8af0" stroke-width="2"/><circle cx="945" cy="835" r="6" fill="#fff" stroke="#7b8af0" stroke-width="2"/></svg>
        </div>
        <div class="b-top"><i>▢</i><i>▦</i><span>✳ Edit</span><i>◍</i></div>
        <div class="b-tools">${['➤', '✋', '✎', '▢', '▨'].map((x) => `<i>${x}</i>`).join('')}</div>
        <div class="b-zoom"><i>⛶</i><i>−</i><b>15%</b><i>+</i></div>
        ${[['Abby', '#5b4fe6'], ['Freddie', '#e23cc3'], ['Rachel', '#f0631f'], ['Abigail', '#e0244a']].map(([n, c]) => `<div class="abs mcur mc-${n}">${A.cursor(c)}<span style="background:${c}">${n}</span></div>`).join('')}`;
      const cam = F.$(root, '.board-cam');
      const curs = ['Abby', 'Freddie', 'Rachel', 'Abigail'].map((n) => F.$(root, '.mc-' + n));
      const paths = [
        [[0, 250, 470], [0.7, 262, 492], [1.5, 240, 470]],
        [[0, 1500, 360], [0.8, 1525, 395], [1.5, 1510, 380]],
        [[0, 1770, 600], [0.6, 1745, 620], [1.5, 1760, 600]],
        [[0, 900, 880], [0.9, 885, 905], [1.5, 900, 900]],
      ];
      return (lt) => {
        const s = tw(lt, 0, 1.5, 0.94, 1.0, E.inOutQuad);
        set(cam, { x: 960 * (1 - s) - 40 * lt, y: 540 * (1 - s), s });
        cam.style.transformOrigin = '0 0';
        curs.forEach((c, i) => {
          const P = paths[i];
          set(c, { x: kf(lt, P.map((p) => [p[0], p[1]])), y: kf(lt, P.map((p) => [p[0], p[2]])) });
        });
      };
    },
  });

  /* ===========================================================
     S23 — the prompt
     =========================================================== */
  F.scene({
    id: 'prompt',
    start: 40.96,
    end: 42.96,
    build(root) {
      root.style.background = '#efedea';
      root.innerHTML = `<div class="abs pbox"><p><span class="pt"></span><i class="caret"></i></p>
        <div class="pb-bar"><span class="pb-plus">${C.iconSpan(I.plus, 34)}</span><span class="pb-mode">Build ${C.iconSpan(I.chevron, 22)}</span><span class="pb-mic">${C.iconSpan(I.mic, 30)}</span><span class="pb-send">${C.iconSpan(I.arrowUp, 30, '#fff')}</span></div></div>
        <div class="abs cur big">${A.cursor('#111')}</div>`;
      const box = F.$(root, '.pbox');
      const txt = F.$(root, '.pt');
      const caret = F.$(root, '.caret');
      const send = F.$(root, '.pb-send');
      const cur = F.$(root, '.cur');
      const MSG = 'Recap client feedback and send it on slack';
      return (lt) => {
        set(box, { x: 471, y: 405, s: tw(lt, 0, 2, 1, 1.01, E.linear) });
        // typing started off-screen; ~14 characters a second
        F.text(txt, F.typed(MSG, lt, -1.96, 1.04));
        caret.style.opacity = lt > 1.6 ? '0' : Math.floor(lt * 4) % 2 ? '0.2' : '1';
        const pc = prog(lt, 1.45, 1.75);
        set(cur, { x: lerp(1500, 1430, E.outCubic(pc)), y: lerp(760, 690, E.outCubic(pc)), o: pc > 0 ? 1 : 0, s: lt > 1.72 && lt < 1.8 ? 0.85 : 1 });
        send.style.filter = lt > 1.72 ? 'brightness(.85)' : '';
      };
    },
  });

  /* ===========================================================
     S24 — client comments, up close
     =========================================================== */
  F.scene({
    id: 'notes',
    start: 42.96,
    end: 44.46,
    build(root) {
      root.style.background = '#e7e3dd';
      root.innerHTML = `
        <div class="fill nshot n1"><div class="cap-table"><div class="ct-r"><b>CAPACITY</b><em>HIGH</em></div><div class="ct-r alt"><b>CAPACITY</b></div><div class="ct-r"><b>CAPACITY</b></div></div>
          <div class="abs nwrap" style="left:575px;top:230px;width:772px;height:620px">${C.sticky('#fbf0a6', 'Love it! Add a skip option?', 'MJ')}</div>
          <svg class="abs" width="1920" height="1080" style="left:0;top:0"><path d="M1446 0 V480 q0 64 -64 64 h-36" fill="none" stroke="#4b4fe0" stroke-width="5"/><circle cx="1346" cy="544" r="22" fill="#fff" stroke="#4b4fe0" stroke-width="5"/></svg></div>
        <div class="fill nshot n2"><div class="fill" style="background:#e9e6df"></div><div class="abs" style="left:-240px;top:520px;width:1100px;height:900px">${C.isoMap('sand', { viewBox: '-80 120 240 200' })}</div>
          <div class="abs nwrap" style="left:575px;top:230px;width:772px;height:620px">${C.sticky('#f6d2ad', 'Can we add a subtle loading animation?', 'BG')}</div>
          <svg class="abs" width="1920" height="1080" style="left:0;top:0"><path d="M1370 362 h40 q60 0 60 60 V1080" fill="none" stroke="#4b4fe0" stroke-width="5"/><circle cx="1350" cy="362" r="22" fill="#fff" stroke="#4b4fe0" stroke-width="5"/></svg></div>
        <div class="fill nshot n3"><div class="fill" style="background:#efeee4"></div><div class="court"><b>Court B</b></div><div class="abs junior"><b>Juniors</b><small>04:00 - 06:30 PM</small></div>
          <div class="abs nwrap" style="left:575px;top:230px;width:772px;height:620px">${C.sticky('#d9cdf4', 'Love the layout! Less scroll?', 'MJ')}</div>
          <svg class="abs" width="1920" height="1080" style="left:0;top:0"><path d="M552 324 h-40 q-60 0 -60 60 V1080" fill="none" stroke="#4b4fe0" stroke-width="5"/><circle cx="572" cy="324" r="22" fill="#fff" stroke="#4b4fe0" stroke-width="5"/></svg></div>`;
      const shots = F.$$(root, '.nshot');
      return (lt) => {
        const k = lt < 0.5 ? 0 : lt < 1.0 ? 1 : 2;
        shots.forEach((s, i) => (s.style.display = i === k ? '' : 'none'));
        const local = lt - k * 0.5;
        // each cut lands mid-pan
        set(shots[k], { x: (k === 1 ? -1 : 1) * tw(local, 0, 0.5, 70, 0, E.outCubic), y: tw(local, 0, 0.5, 26, 0, E.outCubic) });
      };
    },
  });

  /* ===========================================================
     S25 — the recap lands in Slack
     =========================================================== */
  F.scene({
    id: 'slack',
    start: 44.46,
    end: 45.96,
    build(root) {
      root.style.background = '#fff';
      root.innerHTML = `<div class="sl-side">${watermark()}</div>
        <div class="abs sl-main">
          <div class="sl-h"><b>#OpenFields</b>${C.iconSpan(I.chevron, 30, '#1d1d1d')}<span>Track and coordinate tasks</span></div>
          <div class="sl-msg"><div class="sl-av">${A.agentAvatar()}</div>
            <div><div class="sl-who"><b>Base44 Superagent</b><em>APP</em><span>12:45</span></div>
              <p>Hey, Here’s a recap of the client’s feedback!</p>
              <div class="sl-q q1"><b>01 Dashboard Design</b><span>Increase the font size, it's a bit small</span></div>
              <div class="sl-q q2"><b>02 Dashboard UX</b><span>Shorten the booking flow by a step</span></div>
              <div class="sl-q q3"><b>03 Scheduling Layout</b><span>Update the design to reduce scrolling</span></div>
            </div></div></div>`;
      const main = F.$(root, '.sl-main');
      const qs = F.$$(root, '.sl-q');
      return (lt) => {
        const s = tw(lt, 0, 1.5, 1.0, 1.02, E.linear);
        set(main, { x: 444 - lt * 6, y: 140, s });
        main.style.transformOrigin = '0 0';
        qs.forEach((q, i) => set(q, { o: prog(lt, [0.45, 0.85, 1.05][i], [0.45, 0.85, 1.05][i] + 0.1) }));
      };
    },
  });
})();
