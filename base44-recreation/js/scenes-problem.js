/* PROBLEM  0:12.45 – 0:19.2
   "Unlimited by your title. Your agency can move faster. Go further." */
(function () {
  const F = window.F, A = F.A, C = F.C, E = F.E, I = A.icon;
  const { tw, kf, prog, set, h, clamp, lerp } = F;

  const watermark = () => `<div class="wm">${A.base44Logo('#fff', '#fff')}</div>`;

  /* ===========================================================
     S09 — giant blue serif over close-up grass
     =========================================================== */
  F.scene({
    id: 'open-grass',
    start: 12.96,
    end: 13.46,
    build(root) {
      root.innerHTML = `<div class="photo grass-bg" style="background-image:url(${A.grass(1920, 1080, 31, 2.4, -4)})"></div>
        <div class="abs big-of">Open Fields</div>`;
      const word = F.$(root, '.big-of');
      return (lt) => {
        const s = tw(lt, 0, 0.5, 1.03, 0.99, E.outCubic);
        set(word, { x: 54 - lt * 24, y: 196, s });
      };
    },
  });

  /* ===========================================================
     S10 — split: code | recolouring letters | checklist
     =========================================================== */
  const CODE = [
    ['c', '// Top Fields — ranked listings'],
    ['', "const <w>Field</w> = <w>require</w>(<s>'@/entities'</s>);"],
    ['', 'const <w>app</w> = <w>express</w>'],
    ['gap'],
    ['c', '// Ranking config'],
    ['', "const <b>SORT_BY</b> = <s>'rating'</s>;"],
    ['', "const <b>LOCATION</b> = <s>'Brooklyn, NY'</s>;"],
    ['', 'const <b>MIN_RATING</b> = <s>4.0</s>;'],
    ['', 'const <b>RADIUS_KM</b> = <s>5</s>;'],
    ['gap'],
    ['c', '// Step 1: Fetch and rank fields'],
    ['i', "<w>app.get</w>(<s>'/top-fields'</s>, (req, res) => {"],
    ['i', "const fields = <w>Field.list</w>(<s>'-rating'</s>)"],
    ['', '.filter(f => f.rating >= <b>MIN_RATING</b>)'],
    ['', '.filter(f => f.distanceKm <= <b>RADIUS_KM</b>)'],
    ['', '.slice(0, 10);'],
    ['gap'],
    ['ic', '// Step 2: Attach booking counts'],
    ['i', 'const ranked = fields.<w>map</w>((f, i) => ({'],
    ['ii', 'rank: i + 1,'],
    ['ii', 'name: f.name,'],
    ['ii', 'rating: f.rating'],
  ];

  function topFieldsApp() {
    return `<div class="tf-app">
      <div class="tf-head"><b>Top Fields</b>${C.iconSpan(I.user, 34, '#1d1d1d')}</div>
      <div class="tf-chips"><span class="lime"></span><span>Outdoors</span><span>Indoors</span><span>Nearby</span></div>
      <div class="tf-photo" style="background-image:url(${A.park('tf', 680, 760, { horizon: 0.66, treeH: 0.16, sky0: '#3f8fe0', sky1: '#a9cdee', goalX: 0.62, people: 8, dense: true, f0: '#5f9a3e', f1: '#3d7a2c' })})">
        <div class="tf-cap">Los Angeles CA, North Field</div>
        <div class="tf-tags"><span>01</span><span>Outdoor</span><span>★ 4.9</span></div>
        <div class="tf-tags t2"><span>1.2k reviews</span></div>
      </div>
    </div>`;
  }

  /* "Picnic on the field" stamp: two balls in a badge */
  A.picnicBadge = () => {
    const ball = (cx, id) => `<g transform="translate(${cx} 0)">${A.ball({ id, base: '#f2f5ee', ink: '#2d8a3e' }).replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g>`;
    return `<svg viewBox="-70 -70 260 140"><path d="M-62 0 A62 62 0 0 1 62 -40 L80 -40 A62 62 0 1 1 80 40 L62 40 A62 62 0 0 1 -62 0z" fill="#f2f5ee"/>${ball(0, 'pa')}${ball(110, 'pb')}
      <path id="arcp" d="M-48 30 A56 56 0 0 0 40 50" fill="none"/><text font-family="Inter" font-weight="800" font-size="13" fill="#2d8a3e" letter-spacing="1"><textPath href="#arcp">PICNIC ON THE FIELD</textPath></text>
      <text x="120" y="-50" font-family="Inter" font-weight="800" font-size="13" fill="#2d8a3e" transform="rotate(14 120 -50)">SATURDAY</text></svg>`;
  };

  C.igPost = () => `<div class="ig">
      <div class="ig-head">${A.ofBadge('#1f6b35', '#f4e96b', 44)}<div><b>Open_fields</b><small>${C.iconSpan(I.pin, 14, '#555')} Brooklyn NYC • 2h ago</small></div></div>
      <div class="ig-img" style="background-image:url(${A.felt()})"><div class="ig-badge">${A.picnicBadge()}</div></div>
      <div class="ig-foot">${C.iconSpan(I.heart, 26)} 45 ${C.iconSpan(I.comment, 24)} 5</div>
    </div>`;

  F.scene({
    id: 'split',
    start: 13.46,
    end: 15.96,
    build(root) {
      const code = CODE.map(([k, l]) => (k === 'gap' ? '<div class="cl gap"></div>' : `<div class="cl ${k}"><span>${l}</span></div>`)).join('');
      root.innerHTML = `
        <div class="sp-left">${watermark()}<div class="code">${code}</div><div class="sp-swap tf-wrap">${topFieldsApp()}</div></div>
        <div class="sp-mid" style="background-image:url(${A.grass(660, 1080, 41, 2.2, -4)})">
          <div class="abs sp-word">pen</div>
          <div class="abs picker"><div class="pk-top"><span>Custom</span>${C.iconSpan(I.pin, 26, '#888', 'transform:rotate(45deg)')}</div><div class="pk-bar"><i></i></div></div>
        </div>
        <div class="sp-right">
          <div class="abs checklist">
            ${['Using Your Strategy', 'Adapting Content For', 'Writing Post Copy', 'Creating Visuals For'].map((tx) => `<div class="ck"><span class="ck-i">${C.iconSpan(I.check, 34)}</span><span class="ck-l">${C.iconSpan(I.loader, 34)}</span><span class="ck-t">${tx}</span></div>`).join('')}
          </div>
          <div class="sp-swap ig-wrap">${C.igPost()}</div>
        </div>`;
      const lines = F.$$(root, '.cl:not(.gap) > span');
      const lens = lines.map((l) => l.textContent.length);
      const total = lens.reduce((a, b) => a + b, 0);
      // wrap each line's characters so we can reveal by count
      const full = lines.map((l) => l.innerHTML);
      const word = F.$(root, '.sp-word');
      const picker = F.$(root, '.picker');
      const knob = F.$(root, '.pk-bar i');
      const items = F.$$(root, '.ck');
      const tf = F.$(root, '.tf-wrap');
      const ig = F.$(root, '.ig-wrap');
      const colors = [[0, '#3e47df'], [0.95, '#3e47df'], [1.05, '#2ea4e6'], [1.18, '#5fd6a0'], [1.3, '#8de85a'], [1.42, '#e9fb6c']];
      const lerpHex = (a, b, p) => {
        const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
        const r = Math.round(lerp(pa >> 16, pb >> 16, p)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, p)), bl = Math.round(lerp(pa & 255, pb & 255, p));
        return `rgb(${r},${g},${bl})`;
      };
      let lastN = -1;
      return (lt) => {
        // typing: reveal characters across lines, highlight the freshest token
        const n = Math.floor(kf(lt, [[0, 110], [0.6, 330, E.linear], [1.5, total, E.linear]]));
        if (n !== lastN) {
          lastN = n;
          let left = n;
          lines.forEach((el, i) => {
            const len = lens[i];
            const show = clamp(left, 0, len);
            left -= len;
            el.parentNode.style.visibility = show > 0 ? '' : 'hidden';
            if (show >= len) {
              el.innerHTML = full[i];
            } else if (show > 0) {
              const plain = (() => { const d = document.createElement('div'); d.innerHTML = full[i]; return d.textContent; })();
              const hi = Math.max(0, show - 11);
              el.innerHTML = `${plain.slice(0, hi)}<mark>${plain.slice(hi, show)}</mark>`;
            }
          });
        }
        // giant letters punch in on the "e", then drift; colour cycles once the picker shows up
        const zs = kf(lt, [[0.08, 1], [0.56, 2.25, E.inOutCubic], [2.5, 2.36, E.linear]]);
        const PX = 238, PY = 471, X = -80 - lt * 6, Y = 173;
        set(word, { x: PX + (X - PX) * zs - (lt > 0.56 ? (lt - 0.56) * 22 : 0), y: PY + (Y - PY) * zs, s: zs });
        let col = colors[0][1];
        for (let i = 1; i < colors.length; i++) {
          if (lt >= colors[i - 1][0]) col = lerpHex(colors[i - 1][1], colors[i][1], prog(lt, colors[i - 1][0], colors[i][0]));
        }
        word.style.color = col;
        const pp = prog(lt, 0.48, 0.64);
        set(picker, { x: 104, y: 466 + (1 - E.outCubic(pp)) * 30, o: pp * (1 - prog(lt, 2.1, 2.2)), s: lerp(0.92, 1, E.outBack(pp)) });
        set(knob, { x: tw(lt, 0.9, 1.5, 228, 120, E.inOutCubic) });
        // checklist
        const done = [0, 0.74, 1.34, 1.75];
        items.forEach((it, i) => it.classList.toggle('done', lt >= done[i]));
        // panels swap
        const pt = prog(lt, 1.45, 1.6);
        set(tf, { y: (1 - E.outCubic(pt)) * 1080, o: pt > 0 ? 1 : 0 });
        const pi = prog(lt, 2.05, 2.2);
        set(ig, { y: (1 - E.outCubic(pi)) * 1080, o: pi > 0 ? 1 : 0 });
      };
    },
  });

  /* ===========================================================
     S11 — "After Match Beers" collage
     =========================================================== */
  A.person = (pal) => {
    const L = (d, w, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    // mid-kick, arms out, seen slightly from the side (viewBox 0 0 200 300)
    let s = '';
    s += L('M88 150 L70 196 L52 236', 15, pal.skin);
    s += L('M52 236 L44 262', 13, pal.sock);
    s += `<path d="M30 262 L58 258 L62 270 L28 274z" fill="${pal.shoe}"/>`;
    s += L('M104 150 L132 182 L150 220', 15, pal.skin);
    s += L('M146 214 L154 236', 13, pal.sock);
    s += `<path d="M146 232 L176 240 L174 252 L142 246z" fill="${pal.shoe}"/>`;
    s += `<path d="M78 120 L118 116 L124 156 L102 162 L96 150 L88 164 L70 158 Z" fill="${pal.shorts}"/>`;
    s += L('M84 58 L56 84 L30 86', 11, pal.sleeve);
    s += L('M114 56 L146 40 L176 18', 11, pal.sleeve);
    s += `<circle cx="27" cy="86" r="6" fill="${pal.skin}"/><circle cx="179" cy="16" r="6" fill="${pal.skin}"/>`;
    s += `<path d="M80 52 Q100 44 120 52 L120 122 L78 124 Z" fill="${pal.shirt}"/>`;
    s += `<rect x="94" y="36" width="12" height="14" fill="${pal.skin}"/>`;
    s += `<ellipse cx="100" cy="26" rx="14" ry="16" fill="${pal.skin}"/><path d="M84 28 Q84 6 101 6 Q118 6 117 30 Q114 18 102 16 Q90 16 88 34z" fill="${pal.hair}"/>`;
    return `<svg viewBox="0 0 200 280"><g stroke="#fff" stroke-width="8" stroke-linejoin="round" fill="none" opacity=".0"></g>${s}</svg>`;
  };

  function afterMatch() {
    return `<div class="amb">
      <div class="photo" style="background-image:url(${A.grass(860, 520, 55, 0.9, 6)})"></div>
      <div class="amb-ball">${A.ball({ id: 'amb', shade: true })}</div>
      <div class="amb-cup"><i></i></div>
      <div class="amb-shirt"></div>
      <div class="amb-nav"><span class="b">● Book a field</span><span class="t">Open Fields</span><span class="r">Community &nbsp; Shop &nbsp;☰</span></div>
      <div class="amb-meta"><span>SUN JUL 20,<br>6PM</span><span>Chelsea Park,<br>450 W 27th St, NYC</span></div>
      <div class="amb-rsvp">RSVP Now!</div>
      <div class="amb-title">After Match Beers</div>
    </div>`;
  }

  function matchesSchedule() {
    const marks = { 5: 1, 6: 1, 10: 1, 12: 1, 13: 1 };
    let s = '<div class="msched"><div class="ms-h"><b>Matches schedule</b><span>2026</span></div><div class="ms-g">';
    [30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].forEach((d, i) => {
      s += `<span class="${marks[d] && i > 0 ? 'm' : ''} ${i < 4 ? 'dim' : ''}" data-d="${d}">${d}</span>`;
    });
    return s + '</div></div>';
  }

  F.scene({
    id: 'collage-2',
    start: 15.96,
    end: 17.46,
    build(root) {
      root.innerHTML = `<div class="fill c2-bg"><div class="fill" style="background-image:url(${A.halftone('c2', 1920, 1080, { bg: '#e9e5de', fg: '#d9d4cb', step: 10, cx: 0.5, cy: 0.5 })});opacity:.6"></div></div>
        <div class="abs c2-cam"></div>`;
      const cam = F.$(root, '.c2-cam');
      const items = [];
      const add = (x, y, w, hh, html, pop, cls = '') => {
        const el = h(`<div class="abs citem ${cls}" style="width:${w}px;height:${hh}px">${html}</div>`);
        cam.appendChild(el);
        items.push({ el, x, y, pop });
        return el;
      };
      add(0, 86, 259, 313, '<div class="mapsnip"><i class="m1"></i><i class="m2"></i><i class="m3"></i><span class="out">OUT</span><span class="th">TH 254</span><b>⬇</b></div>', 0.02);
      add(111, -20, 333, 486, A.person({ skin: '#e2b08f', sock: '#f4f4f4', shoe: '#f0a3b8', shorts: '#cfc6b4', sleeve: '#9a9a9a', shirt: '#d8382b', hair: '#1b1414' }), 0.32, 'sticker');
      add(303, 172, 310, 66, '<div class="label-chip">Schedule Match</div>', 0.06);
      add(163, 377, 62, 62, '<div class="dot-m"></div>', 0.34);
      add(61, 562, 404, 600, `<div class="tf-phone">${topFieldsApp()}</div>`, 0.1);
      add(541, 290, 843, 503, afterMatch(), 0.04);
      add(1128, 130, 330, 110, A.arrowDoodle('#1d1d1d', true), 0.12);
      add(1546, 0, 374, 707, C.igPost(), 0.08);
      add(1183, 828, 42, 62, A.xMark(), 0.5);
      add(1242, 836, 533, 400, matchesSchedule(), 0.48);
      add(1605, 796, 66, 66, '<div class="dot-m"></div>', 0.52);
      const days = F.$$(root, '.ms-g span');
      return (lt) => {
        const s = tw(lt, 0, 1.5, 1, 1.035, E.linear);
        set(cam, { x: 960 * (1 - s), y: 540 * (1 - s), s });
        cam.style.transformOrigin = '0 0';
        for (const it of items) {
          const p = prog(lt, it.pop, it.pop + 0.22);
          set(it.el, { x: it.x, y: it.y + (1 - E.outCubic(p)) * 24, s: lerp(0.9, 1, E.outBack(p)), o: clamp(p * 2.5) });
        }
        // the schedule fills in
        const order = [5, 6, 10, 12, 13];
        days.forEach((d) => {
          const k = order.indexOf(+d.dataset.d);
          if (k >= 0 && !d.classList.contains('dim')) d.classList.toggle('m', lt > 0.55 + k * 0.12);
        });
      };
    },
  });

  /* ===========================================================
     S12 — side-by-side at the laptop (coded stand-in): two cursors
     collaborating, then the next ideas start stacking up
     =========================================================== */
  F.scene({
    id: 'duo',
    start: 17.46,
    end: 19.48,
    build(root) {
      root.style.background = '#cfc6b8';
      root.innerHTML = `
        <div class="abs duo-cam"></div><div class="duo-shoulder"></div>
        <div class="abs laptop2">
          <div class="l2-screen">
            <div class="l2-side"><div class="lp-brand">${A.base44Mark('var(--orange)')}<b>Base44</b></div>
              <div class="l2-item on">Live Ops</div><div class="l2-item">Bookings</div><div class="l2-item">Fields</div><div class="l2-item">Merch</div></div>
            <div class="l2-main">
              <div class="l2-title">Live Ops Dashboard</div>
              <div class="l2-kpis"><div><small>Utilisation</small><b>65%</b></div><div><small>Bookings</small><b>23</b></div><div><small>Active alerts</small><b>4</b></div></div>
              <div class="l2-rows">${['North Field — 6:00 PM', 'Court B — Juniors', 'Field 4 — Maintenance', 'Central Arena — 8:30 PM'].map((r, i) => `<div><i style="background:${['#c9ef5c', '#f1d64b', '#ee6a12', '#c9ef5c'][i]}"></i>${r}</div>`).join('')}</div>
            </div>
          </div>
          <div class="l2-base"></div>
        </div>
        <div class="abs mcur c1">${A.cursor('#4b55e0')}<span style="background:#4b55e0">Abby</span></div>
        <div class="abs mcur c2">${A.cursor('#e23cc3')}<span style="background:#e23cc3">Freddie</span></div>
        ${watermark()}
        <div class="abs ov ov-num"><div class="bignum"><small>Players</small><b>15</b></div></div>
        <div class="abs ov ov-vol"><div class="vol"><b>VOL</b><small>THE EVENING — OPEN STAGE NIGHTS — LIVE LINEUP TONIGHT</small></div></div>
        <div class="abs ov ov-run"><div class="photo" style="background-image:url(${A.halftone('run', 600, 300, { bg: '#5d7d4f', fg: '#cfe0c4', step: 8, cx: 0.5, cy: 0.5 })})"></div></div>
        <div class="grain" style="background-image:url(${A.grain(9)})"></div>`;
      const cam = F.$(root, '.duo-cam');
      cam.innerHTML = F.officeHTML({ seed: 8, winX: 700, winY: 40, plants: [[1500, 420, 1.2], [200, 520, 1.1]], desks: [{ x: 0, y: 760, w: 2200, mon: [1150, 1450] }], people: [{ x: 120, y: 360, c: '#4a2c22', k: 1.9 }, { x: 560, y: 380, c: '#2f3f5f', k: 1.7 }] });
      F.$(cam, '.office').style.filter = 'blur(20px) saturate(.85)';
      const lap = F.$(root, '.laptop2');
      const c1 = F.$(root, '.mcur.c1'), c2 = F.$(root, '.mcur.c2');
      const rows = F.$$(root, '.l2-rows > div');
      const ovs = F.$$(root, '.ov');
      const grain = F.$(root, '.grain');
      return (lt) => {
        set(cam, { x: -160 - lt * 30, y: -80, s: 1.05 + lt * 0.01 });
        set(lap, { x: 520 - lt * 26, y: 210 + lt * 4, s: 1 + lt * 0.025 });
        set(c1, { x: kf(lt, [[0, 900], [0.6, 1130], [1.2, 1180], [1.9, 1010]]), y: kf(lt, [[0, 560], [0.6, 640], [1.2, 700], [1.9, 590]]) });
        set(c2, { x: kf(lt, [[0, 1520], [0.7, 1380], [1.4, 1440], [1.9, 1300]]), y: kf(lt, [[0, 420], [0.7, 520], [1.4, 470], [1.9, 760]]) });
        rows.forEach((r, i) => set(r, { o: prog(lt, 0.15 + i * 0.22, 0.3 + i * 0.22), x: (1 - E.outCubic(prog(lt, 0.15 + i * 0.22, 0.35 + i * 0.22))) * 20 }));
        const pops = [1.62, 1.66, 1.78];
        ovs.forEach((o, i) => {
          const p = prog(lt, pops[i], pops[i] + 0.16);
          set(o, { o: p > 0 ? 1 : 0, s: lerp(0.94, 1, E.outCubic(p)) });
        });
        grain.style.transform = `translate(${(Math.floor(lt * 24) * 37) % 200 - 100}px, ${(Math.floor(lt * 24) * 59) % 200 - 100}px)`;
      };
    },
  });
})();
