/* Tiny deterministic timeline engine.
   Every scene is a pure function of time, so the film can be scrubbed,
   looped, and rendered frame-by-frame with identical results. */
(function () {
  const F = (window.F = {});

  F.W = 1920;
  F.H = 1080;
  F.FPS = 30;
  F.DURATION = 51.7;

  F.CHAPTERS = [
    { name: 'Intro', start: 0, end: 12.67 },
    { name: 'Problem', start: 12.67, end: 19.4 },
    { name: 'Features', start: 19.4, end: 28.9 },
    { name: 'Demo', start: 28.9, end: 46.1 },
    { name: 'Outro', start: 46.1, end: 51.7 },
  ];

  /* ---------- math ---------- */
  F.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  F.lerp = (a, b, p) => a + (b - a) * p;
  F.prog = (t, a, b) => (b === a ? (t >= b ? 1 : 0) : F.clamp((t - a) / (b - a)));

  const pow = Math.pow;
  F.E = {
    linear: (p) => p,
    inQuad: (p) => p * p,
    outQuad: (p) => 1 - (1 - p) * (1 - p),
    inOutQuad: (p) => (p < 0.5 ? 2 * p * p : 1 - pow(-2 * p + 2, 2) / 2),
    inCubic: (p) => p * p * p,
    outCubic: (p) => 1 - pow(1 - p, 3),
    inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - pow(-2 * p + 2, 3) / 2),
    inQuart: (p) => p * p * p * p,
    outQuart: (p) => 1 - pow(1 - p, 4),
    inOutQuart: (p) => (p < 0.5 ? 8 * p * p * p * p : 1 - pow(-2 * p + 2, 4) / 2),
    outQuint: (p) => 1 - pow(1 - p, 5),
    inOutQuint: (p) => (p < 0.5 ? 16 * pow(p, 5) : 1 - pow(-2 * p + 2, 5) / 2),
    inExpo: (p) => (p === 0 ? 0 : pow(2, 10 * p - 10)),
    outExpo: (p) => (p === 1 ? 1 : 1 - pow(2, -10 * p)),
    inOutExpo: (p) =>
      p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? pow(2, 20 * p - 10) / 2 : (2 - pow(2, -20 * p + 10)) / 2,
    outBack: (p) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * pow(p - 1, 3) + c1 * pow(p - 1, 2);
    },
    outBackSoft: (p) => {
      const c1 = 0.9, c3 = c1 + 1;
      return 1 + c3 * pow(p - 1, 3) + c1 * pow(p - 1, 2);
    },
  };
  const E = F.E;

  /* tween a value between two times */
  F.tw = (t, a, b, v0, v1, e = E.outCubic) => F.lerp(v0, v1, e(F.prog(t, a, b)));

  /* keyframes: [[t0, v0], [t1, v1, ease?], ...] — ease applies to the segment ending at that key */
  F.kf = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) return F.lerp(v0, v1, (e || E.inOutCubic)(F.prog(t, t0, t1)));
    }
    return keys[keys.length - 1][1];
  };

  /* seeded random (mulberry32) */
  F.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- DOM ---------- */
  F.h = (html) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  };
  F.$ = (root, sel) => root.querySelector(sel);
  F.$$ = (root, sel) => Array.from(root.querySelectorAll(sel));

  /* set transform/opacity/filter from a compact spec; skips unchanged writes */
  F.set = (el, o) => {
    if (!el) return;
    const st = el.style;
    if ('x' in o || 'y' in o || 's' in o || 'sx' in o || 'sy' in o || 'r' in o || 'rx' in o || 'ry' in o) {
      const x = o.x || 0, y = o.y || 0;
      const sx = o.sx != null ? o.sx : o.s != null ? o.s : 1;
      const sy = o.sy != null ? o.sy : o.s != null ? o.s : 1;
      let tf = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`;
      if (o.r) tf += ` rotate(${o.r.toFixed(3)}deg)`;
      if (o.rx) tf += ` rotateX(${o.rx.toFixed(3)}deg)`;
      if (o.ry) tf += ` rotateY(${o.ry.toFixed(3)}deg)`;
      if (sx !== 1 || sy !== 1) tf += ` scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
      if (st.transform !== tf) st.transform = tf;
    }
    if ('o' in o) {
      const v = String(F.clamp(o.o).toFixed(3));
      if (st.opacity !== v) st.opacity = v;
      const vis = o.o <= 0.001 ? 'hidden' : '';
      if (st.visibility !== vis) st.visibility = vis;
    }
    if ('blur' in o) {
      const v = o.blur > 0.05 ? `blur(${o.blur.toFixed(2)}px)` : '';
      if (st.filter !== v) st.filter = v;
    }
    if ('clip' in o) {
      if (st.clipPath !== o.clip) st.clipPath = o.clip;
    }
    if ('w' in o) st.width = o.w.toFixed(2) + 'px';
    if ('h' in o) st.height = o.h.toFixed(2) + 'px';
    if ('bg' in o && st.background !== o.bg) st.background = o.bg;
  };

  F.text = (el, s) => {
    if (el && el.textContent !== s) el.textContent = s;
  };

  /* text width in stage px (fonts are loaded before build) */
  const mctx = document.createElement('canvas').getContext('2d');
  F.measure = (text, font, trackingEm = 0, sizePx = 0) => {
    mctx.font = font;
    return mctx.measureText(text).width + trackingEm * sizePx * text.length;
  };

  /* integrate a piecewise-linear velocity curve → position lookup */
  F.path = (vkeys, dt = 1 / 240) => {
    const t0 = vkeys[0][0], t1 = vkeys[vkeys.length - 1][0];
    const xs = [0];
    const vel = (t) => F.kf(t, vkeys.map((k) => [k[0], k[1], F.E.linear]));
    for (let t = t0; t < t1; t += dt) xs.push(xs[xs.length - 1] + vel(t + dt / 2) * dt);
    return (t) => {
      if (t <= t0) return 0;
      const i = (t - t0) / dt;
      const k = Math.min(xs.length - 1, Math.floor(i));
      if (k >= xs.length - 1) return xs[xs.length - 1] + vel(t1) * (t - t1);
      return F.lerp(xs[k], xs[k + 1], i - k);
    };
  };

  /* smooth monotone curve through [t, value] points (Fritsch–Carlson) */
  F.spline = (pts) => {
    const n = pts.length;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], h2 = a * a + b * b;
      if (h2 > 9) { const k = 3 / Math.sqrt(h2); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return (t) => {
      if (t <= xs[0]) return ys[0];
      if (t >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (t - xs[n - 1]);
      let i = 0;
      while (t > xs[i + 1]) i++;
      const hh = xs[i + 1] - xs[i], u = (t - xs[i]) / hh;
      const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
      return h00 * ys[i] + h10 * hh * m[i] + h01 * ys[i + 1] + h11 * hh * m[i + 1];
    };
  };

  /* typewriter: reveal chars between a..b */
  F.typed = (str, t, a, b) => str.slice(0, Math.round(F.prog(t, a, b) * str.length));

  /* number counter */
  F.count = (t, a, b, v0, v1, e = E.outCubic) => Math.round(F.tw(t, a, b, v0, v1, e));

  /* a standard "pop in" used all over: fade + rise + scale */
  F.pop = (t, at, dur = 0.35, opts = {}) => {
    const p = F.prog(t, at, at + dur);
    const e = (opts.ease || E.outBack)(p);
    return {
      o: F.clamp(p * 2.2),
      s: F.lerp(opts.s0 != null ? opts.s0 : 0.82, 1, e),
      y: F.lerp(opts.y0 != null ? opts.y0 : 18, 0, E.outCubic(p)),
    };
  };

  /* images drawn on canvases must be decoded before the first frame */
  F.pending = [];
  F.loadImg = (src) => {
    const img = new Image();
    img.src = src;
    F.pending.push(img.decode().catch(() => {}));
    return img;
  };

  /* ---------- scenes ---------- */
  F.scenes = [];
  F.scene = (def) => {
    F.scenes.push(def);
    return def;
  };

  F.build = (stage) => {
    F.stage = stage;
    for (const sc of F.scenes) {
      sc.root = document.createElement('div');
      sc.root.className = 'scene ' + (sc.cls || '');
      sc.root.dataset.id = sc.id;
      if (sc.z) sc.root.style.zIndex = sc.z;
      stage.appendChild(sc.root);
      sc.update = sc.build(sc.root) || (() => {});
      sc.on = false;
    }
  };

  F.render = (t) => {
    F.t = t;
    for (const sc of F.scenes) {
      const active = t >= sc.start && t < sc.end;
      if (active !== sc.on) {
        sc.on = active;
        sc.root.classList.toggle('on', active);
      }
      if (active) sc.update(t - sc.start, t);
    }
  };
})();
