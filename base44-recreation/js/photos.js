/* Procedural "photography": grass, pitches, parks, halftones.
   Each image is painted once on a canvas and cached as a data URL. */
(function () {
  const F = window.F;
  const A = F.A;
  const cache = {};

  function make(key, w, h, draw, type = 'image/jpeg') {
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    cache[key] = c.toDataURL(type, 0.9);
    return cache[key];
  }
  A.img = make;

  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

  /* ---------- grass ---------- */
  function grass(ctx, w, h, seed, scale = 1, light = 0) {
    const r = F.rng(seed);
    ctx.fillStyle = hsl(105, 45, 17 + light);
    ctx.fillRect(0, 0, w, h);
    const n = Math.round((w * h) / (26 * scale * scale));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n / 2; i++) {
        const x = r() * w, y = r() * h;
        const len = (6 + r() * 16) * scale;
        const ang = -Math.PI / 2 + (r() - 0.5) * 1.1;
        const bend = (r() - 0.5) * 6 * scale;
        const L = pass === 0 ? 14 + r() * 12 : 24 + r() * 20;
        ctx.strokeStyle = hsl(92 + r() * 22, 40 + r() * 25, L + light);
        ctx.lineWidth = (0.9 + r() * 1.6) * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + bend, y + Math.sin(ang) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
    // soft light/shadow patches
    for (let i = 0; i < 18; i++) {
      const x = r() * w, y = r() * h, rad = (60 + r() * 160) * scale;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() > 0.5;
      g.addColorStop(0, dark ? 'rgba(0,20,0,0.22)' : 'rgba(220,255,160,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }
  A.grass = (w = 1200, h = 800, seed = 7, scale = 1, light = 0) =>
    make(`grass-${w}-${h}-${seed}-${scale}-${light}`, w, h, (c, W, H) => grass(c, W, H, seed, scale, light));

  /* ---------- aerial pitch with players & long shadows ---------- */
  function topPlayer(ctx, x, y, s, shirt, r) {
    const ang = r() * Math.PI * 2;
    // shadow
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(8,25,8,0.55)';
    ctx.rotate(0.62);
    ctx.beginPath();
    ctx.ellipse(s * 2.6, 0, s * 3.0, s * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // legs
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = '#d9b48f';
    ctx.lineWidth = s * 0.32;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, 0); ctx.lineTo(-s * 0.5, s * 1.1);
    ctx.moveTo(s * 0.25, 0); ctx.lineTo(s * 0.6, -s * 0.9);
    ctx.stroke();
    // body
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b1d14';
    ctx.beginPath();
    ctx.arc(0, -s * 0.05, s * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function pitch(ctx, w, h, o) {
    const r = F.rng(o.seed || 3);
    const c1 = o.c1 || '#3f8a37', c2 = o.c2 || '#4b9a41';
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(o.stripeAngle || 0);
    const sw = o.stripeW || 120;
    for (let x = -w * 1.5; x < w * 1.5; x += sw * 2) {
      ctx.fillStyle = c2;
      ctx.fillRect(x, -h * 1.5, sw, h * 3);
    }
    ctx.restore();
    // turf noise
    for (let i = 0; i < (w * h) / 14; i++) {
      const v = r();
      ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(r() * w, r() * h, 1.6, 1.6);
    }
    // markings
    ctx.strokeStyle = o.line || 'rgba(255,255,255,0.88)';
    ctx.lineWidth = o.lineW || 5;
    for (const L of o.lines || []) {
      ctx.beginPath();
      if (L.type === 'line') { ctx.moveTo(L.x1 * w, L.y1 * h); ctx.lineTo(L.x2 * w, L.y2 * h); }
      if (L.type === 'arc') ctx.arc(L.x * w, L.y * h, L.r * w, L.a0 || 0, L.a1 || Math.PI * 2);
      ctx.stroke();
    }
    for (const p of o.players || []) topPlayer(ctx, p[0] * w, p[1] * h, (o.ps || 14) * (p[3] || 1), p[2] || '#f2f2f2', r);
    // vignette
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${o.vignette != null ? o.vignette : 0.25})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (o.gray) {
      const d = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) {
        const y = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2];
        const v = 70 + y * 0.9;
        d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v * 0.97;
      }
      ctx.putImageData(d, 0, 0);
    }
  }
  A.pitch = (key, w, h, o) => make('pitch-' + key, w, h, (c, W, H) => pitch(c, W, H, o));

  /* ---------- eye-level park / field photo ---------- */
  function park(ctx, w, h, o) {
    const r = F.rng(o.seed || 11);
    const horizon = h * (o.horizon || 0.55);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, o.sky0 || '#8fbbe6');
    sky.addColorStop(1, o.sky1 || '#e4eef3');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);
    // tree band
    const top = horizon - h * (o.treeH || 0.22);
    if (o.dense) {
      ctx.fillStyle = hsl(110, 38, 13);
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let x = 0; x <= w; x += w / 24) ctx.lineTo(x, top + Math.sin(x * 0.02) * h * 0.03 + r() * h * 0.04);
      ctx.lineTo(w, horizon);
      ctx.fill();
      for (let i = 0; i < (w * (horizon - top)) / 14; i++) {
        const x = r() * w, y = top + h * 0.02 + r() * (horizon - top);
        const L = 12 + r() * 30 + (1 - (y - top) / (horizon - top)) * 8;
        ctx.fillStyle = hsl(95 + r() * 35, 35 + r() * 25, L);
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + r() * 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < (o.dense ? 0 : w / 3); i++) {
      const x = r() * w;
      const y = top + r() * (horizon - top) * 0.9 + Math.sin(x / 90) * h * 0.03;
      const rad = (h * 0.035) * (0.6 + r());
      ctx.fillStyle = hsl(105 + r() * 30, 35 + r() * 20, 14 + r() * 16);
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = hsl(110, 30, 16);
    ctx.fillRect(0, horizon - h * 0.04, w, h * 0.05);
    // field with perspective mowing bands
    const fg = ctx.createLinearGradient(0, horizon, 0, h);
    fg.addColorStop(0, o.f0 || '#78a84a');
    fg.addColorStop(1, o.f1 || '#3f7a2c');
    ctx.fillStyle = fg;
    ctx.fillRect(0, horizon, w, h - horizon);
    for (let i = -10; i < 10; i++) {
      if (i % 2) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * w * 0.05, horizon);
      ctx.lineTo(w / 2 + (i + 1) * w * 0.05, horizon);
      ctx.lineTo(w / 2 + (i + 1) * w * 0.5, h);
      ctx.lineTo(w / 2 + i * w * 0.5, h);
      ctx.fill();
    }
    for (let i = 0; i < (w * (h - horizon)) / 9; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      const y = horizon + r() * (h - horizon);
      ctx.fillRect(r() * w, y, 1.5, 1.5 + ((y - horizon) / h) * 2);
    }
    // touchline
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = h * 0.006;
    ctx.beginPath();
    ctx.moveTo(0, horizon + h * 0.12);
    ctx.lineTo(w, horizon + h * 0.08);
    ctx.stroke();
    // goal
    if (o.goal !== false) {
      const gx = w * (o.goalX || 0.12), gy = horizon + h * 0.1, gw = w * 0.16, gh = h * 0.13;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = h * 0.008;
      ctx.beginPath();
      ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gh); ctx.lineTo(gx + gw, gy - gh * 1.05); ctx.lineTo(gx + gw, gy - h * 0.005);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 12; i++) {
        ctx.beginPath(); ctx.moveTo(gx + (gw * i) / 12, gy - gh * (1 + i * 0.004)); ctx.lineTo(gx + (gw * i) / 12 - w * 0.02, gy - gh * 0.3); ctx.stroke();
      }
    }
    // a few distant players
    for (let i = 0; i < (o.people || 0); i++) {
      const x = w * (0.3 + r() * 0.6), y = horizon + h * (0.03 + r() * 0.05);
      ctx.fillStyle = r() > 0.5 ? '#f2f2f2' : '#c0392b';
      ctx.fillRect(x, y - h * 0.03, h * 0.008, h * 0.025);
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(x, y - h * 0.006, h * 0.008, h * 0.012);
    }
  }
  A.park = (key, w, h, o = {}) => make('park-' + key, w, h, (c, W, H) => park(c, W, H, o));

  /* ---------- stadium seen from above (for the "Book a field" app) ---------- */
  function cityField(ctx, w, h, o) {
    const r = F.rng(o.seed || 5);
    ctx.fillStyle = '#8a8f86';
    ctx.fillRect(0, 0, w, h);
    // buildings
    for (let i = 0; i < 9; i++) {
      const bw = w * (0.08 + r() * 0.12), bh = h * (0.25 + r() * 0.2);
      const x = (i / 8) * w - bw * 0.3;
      ctx.fillStyle = ['#9b4a37', '#b5704f', '#c9b79a', '#7d3b2c', '#d4cbb8'][i % 5];
      ctx.fillRect(x, 0, bw, bh);
      ctx.fillStyle = 'rgba(30,30,40,0.55)';
      for (let yy = h * 0.02; yy < bh - h * 0.03; yy += h * 0.045)
        for (let xx = x + w * 0.01; xx < x + bw - w * 0.015; xx += w * 0.022) ctx.fillRect(xx, yy, w * 0.011, h * 0.022);
    }
    // trees
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = hsl(100 + r() * 30, 35, 22 + r() * 15);
      ctx.beginPath();
      ctx.arc(r() * w, h * (0.38 + r() * 0.06), h * (0.03 + r() * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
    // pitch
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.02, h * 0.46); ctx.lineTo(w * 0.98, h * 0.46); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.clip();
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? '#4f9e3b' : '#5aad44';
      ctx.fillRect(0, h * 0.46 + i * h * 0.04 * (1 + i * 0.09), w, h * 0.04 * (1 + i * 0.09));
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = h * 0.007;
    ctx.strokeRect(w * 0.08, h * 0.52, w * 0.84, h * 0.44);
    ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.52); ctx.lineTo(w * 0.5, h * 0.96); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.74, w * 0.09, h * 0.07, 0, 0, Math.PI * 2); ctx.stroke();
  }
  A.cityField = (key, w, h, o = {}) => make('city-' + key, w, h, (c, W, H) => cityField(c, W, H, o));

  /* ---------- indoor pitch ---------- */
  function indoor(ctx, w, h) {
    const roof = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    roof.addColorStop(0, '#5a5f62');
    roof.addColorStop(1, '#c9d1d3');
    ctx.fillStyle = roof;
    ctx.fillRect(0, 0, w, h * 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.03, h * 0.42); ctx.lineTo(w / 2 + i * w * 0.16, 0); ctx.stroke();
    }
    for (let j = 0; j < 6; j++) {
      ctx.beginPath(); ctx.moveTo(0, h * (0.06 + j * 0.065)); ctx.lineTo(w, h * (0.06 + j * 0.065)); ctx.stroke();
    }
    ctx.fillStyle = '#e8eef0';
    ctx.fillRect(0, h * 0.42, w, h * 0.08);
    const f = ctx.createLinearGradient(0, h * 0.5, 0, h);
    f.addColorStop(0, '#4fa040');
    f.addColorStop(1, '#2f7a2a');
    ctx.fillStyle = f;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.52); ctx.lineTo(0, h * 0.9); ctx.moveTo(w * 0.8, h * 0.52); ctx.lineTo(w, h * 0.9); ctx.moveTo(w * 0.2, h * 0.52); ctx.lineTo(w * 0.8, h * 0.52); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.68, w * 0.12, h * 0.06, 0, 0, Math.PI * 2); ctx.stroke();
  }
  A.indoor = (key, w, h) => make('indoor-' + key, w, h, indoor);

  /* ---------- halftone texture ---------- */
  function halftone(ctx, w, h, o) {
    const r = F.rng(o.seed || 9);
    ctx.fillStyle = o.bg || '#b8d36a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = o.fg || '#2c4a1e';
    const step = o.step || 14;
    const cx = w * (o.cx != null ? o.cx : 0.3), cy = h * (o.cy != null ? o.cy : 0.4);
    for (let y = 0; y < h + step; y += step)
      for (let x = (y / step) % 2 ? step / 2 : 0; x < w + step; x += step) {
        const d = Math.hypot(x - cx, y - cy) / Math.hypot(w, h);
        const n = 0.5 + 0.5 * Math.sin(x * 0.013 + r() * 0.4) * Math.cos(y * 0.011);
        const rad = step * 0.55 * F.clamp(1.1 - d * 1.8 + (n - 0.5) * 0.6, 0, 1);
        if (rad < 0.6) continue;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
  }
  A.halftone = (key, w, h, o = {}) => make('ht-' + key, w, h, (c, W, H) => halftone(c, W, H, o), 'image/png');

  /* ---------- green felt (printed-merch backdrop) ---------- */
  A.felt = (w = 640, h = 640) =>
    make('felt', w, h, (ctx) => {
      const r = F.rng(12);
      ctx.fillStyle = '#2f8d3d';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < w * h * 0.6; i++) {
        const v = r();
        ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.04 + r() * 0.05})` : `rgba(0,30,0,${0.05 + r() * 0.08})`;
        ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
      }
    });

  /* ---------- soft sunset gradient ---------- */
  A.sunset = (w = 600, h = 400) =>
    make('sunset', w, h, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#f2c9c9');
      g.addColorStop(0.35, '#e9d3b8');
      g.addColorStop(0.55, '#a8c08f');
      g.addColorStop(1, '#3f6b33');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.filter = 'blur(18px)';
      ctx.fillStyle = 'rgba(40,80,40,0.6)';
      ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.75, w * 0.7, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    });

  /* ---------- film grain tile (PNG, alpha) ---------- */
  A.grain = (seed = 1) =>
    make('grain-' + seed, 256, 256, (ctx, w, h) => {
      const d = ctx.createImageData(w, h);
      const r = F.rng(seed);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = r() * 255;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
      ctx.putImageData(d, 0, 0);
    }, 'image/png');
})();
