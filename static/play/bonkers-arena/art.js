// Bonkers Arena — neon look: skins, living-eye orbs, arenas and effects.
(function (root) {
  const TAU = Math.PI * 2;

  // c = neon rim color, c2 = second color for some patterns
  const SKINS = [
  // trail = what the orb leaves behind when it moves; season skins can only be bought during their season
    { n: 'Cyan', c: '#46e6ff', pat: 'core', trail: 'glow', price: 0 },
    { n: 'Magenta', c: '#ff4fd8', pat: 'core', trail: 'glow', price: 0 },
    { n: 'Lime', c: '#7dff9b', pat: 'core', trail: 'glow', price: 0 },
    { n: 'Amber', c: '#ffcc3d', pat: 'core', trail: 'glow', price: 0 },
    { n: 'Circuit', c: '#b77dff', pat: 'circuit', trail: 'glow', price: 60 },
    { n: 'Racer', c: '#ff4d6a', pat: 'stripes', trail: 'glow', price: 80 },
    { n: 'Frost', c: '#9fe8ff', pat: 'cracks', trail: 'ice', price: 100 },
    { n: 'Toxic', c: '#a8ff3d', pat: 'dots', trail: 'glow', price: 120 },
    { n: 'Magma', c: '#ff6a2a', c2: '#ffcc3d', pat: 'cracks', trail: 'fire', price: 150 },
    { n: 'Plasma', c: '#46e6ff', c2: '#ff4fd8', pat: 'plasma', trail: 'zap', price: 180 },
    { n: 'Galaxy', c: '#8a7dff', pat: 'stars', trail: 'stars', price: 220 },
    { n: 'Hologram', c: '#ffffff', pat: 'core', holo: true, trail: 'rainbow', price: 260 },
    { n: 'Shadow', c: '#dfe6ff', pat: 'smoke', trail: 'smoke', price: 300 },
    { n: 'Gold', c: '#ffd84d', pat: 'circuit', trail: 'gold', price: 400 },
    { n: 'Diamond', c: '#e8fbff', pat: 'facets', trail: 'gold', price: 500 },
    { n: 'Champion', c: '#ffcc3d', pat: 'stars', holo: true, crown: true, trail: 'rainbow', price: 700 },
    { n: 'Aurora', c: '#3dffb8', c2: '#b77dff', pat: 'plasma', trail: 'aurora', price: 300, season: 1 },
    { n: 'Vortex', c: '#7d8cff', c2: '#46e6ff', pat: 'plasma', trail: 'zap', price: 350, season: 1 },
    { n: 'Phantom', c: '#c9fff1', pat: 'smoke', trail: 'aurora', price: 450, season: 1 },
  ];
  const SEASON = { id: 1, name: 'Season 1: Neon Genesis', ends: '2026-12-31T23:59:59Z' };
  const BOSS = { n: 'Titan', c: '#ff3b3b', c2: '#ff9a3b', pat: 'cracks', boss: true, trail: 'fire' };
  const PU_COLORS = { shield: '#46e6ff', magnet: '#b77dff', mega: '#ff4d6a', boost: '#7dff9b', freeze: '#bfefff' };
  const skinOf = i => i === 99 ? BOSS : (SKINS[i] || SKINS[0]);
  // a bot keeps its skin's pattern but wears its own colour (see Sim.COLORS)
  const tintCache = new Map();
  function skinFor(b) {
    if (b.col == null || b.col < 0 || b.skin === 99) return skinOf(b.skin);
    const key = b.skin + ':' + b.col;
    if (!tintCache.has(key)) {
      const base = skinOf(b.skin), c = Sim.COLORS[b.col];
      tintCache.set(key, Object.assign({}, base, { c, c2: base.c2 ? '#ffffff' : undefined, holo: false, crown: false, trail: base.trail === 'rainbow' ? 'glow' : base.trail }));
    }
    return tintCache.get(key);
  }

  // soft glow sprites, drawn additively; much richer than flat dots
  const spriteCache = new Map();
  function glowSprite(col) {
    if (spriteCache.has(col)) return spriteCache.get(col);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, col); g.addColorStop(.45, hexA(col, .35)); g.addColorStop(1, hexA(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    spriteCache.set(col, cv); return cv;
  }
  const PELLET_COLORS = ['#46e6ff', '#ff4fd8', '#ffcc3d', '#7dff9b'];

  const THEMES = {
    cyber: { bg: ['#121c46', '#03050d'], floor: ['#1b2654', '#0a0f28'], grid: 'rgba(70,230,255,.11)', rim: '#46e6ff', rim2: '#ffffff', accent: '#ff4fd8', star: '140,210,255' },
    frost: { bg: ['#10304d', '#020812'], floor: ['#1d3a5e', '#0a1a30'], grid: 'rgba(170,235,255,.15)', rim: '#9fe8ff', rim2: '#ffffff', accent: '#46e6ff', star: '200,240,255' },
    synth: { bg: ['#2b0f45', '#06020e'], floor: ['#2c1552', '#110726'], grid: 'rgba(255,79,216,.15)', rim: '#ff4fd8', rim2: '#ffcc3d', accent: '#46e6ff', star: '255,150,230' },
    inferno: { bg: ['#3d1008', '#0a0302'], floor: ['#2e130f', '#120605'], grid: 'rgba(255,120,50,.15)', rim: '#ff6a2a', rim2: '#ffcc3d', accent: '#ffcc3d', star: '255,180,120' },
    aurora: { bg: ['#06302e', '#02060a'], floor: ['#0f3a3a', '#061618'], grid: 'rgba(61,255,184,.14)', rim: '#3dffb8', rim2: '#b77dff', accent: '#b77dff', star: '160,255,220' },
  };

  function ellipse(c, x, y, rx, ry, rot, fill) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); c.fillStyle = fill; c.fill(); }
  // blend a hex colour toward white (k>0) or black (k<0)
  function tone(hex, k) { const n = parseInt(hex.slice(1), 16), t = k > 0 ? 255 : 0, f = Math.abs(k); const m = v => Math.round(v + (t - v) * f); return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`; }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  // ---------- orb ----------
  function rimColor(s, t) { return s.holo ? `hsl(${(t * 90) % 360},100%,70%)` : s.c; }

  function drawPattern(c, r, s, t) {
    const col = s.c, c2 = s.c2 || s.c;
    c.lineCap = 'round';
    switch (s.pat) {
      case 'core':
        c.strokeStyle = hexA(s.holo ? '#ffffff' : col, .35); c.lineWidth = Math.max(1, r * .04);
        c.beginPath(); c.arc(0, 0, r * .62, 0, TAU); c.stroke(); break;
      case 'circuit':
        c.strokeStyle = hexA(col, .55); c.lineWidth = Math.max(1, r * .05);
        for (const [a, b] of [[-.6, .2], [.3, -.5], [.7, .4], [-.2, -.7]]) {
          c.beginPath(); c.moveTo(a * r, b * r); c.lineTo(a * r + r * .3, b * r); c.lineTo(a * r + r * .45, b * r + r * .25); c.stroke();
          ellipse(c, a * r, b * r, r * .05, r * .05, 0, hexA(col, .8));
        } break;
      case 'stripes':
        c.strokeStyle = hexA(col, .3); c.lineWidth = r * .16;
        for (const x of [-.5, 0, .5]) { c.beginPath(); c.moveTo(x * r - r * .5, -r); c.lineTo(x * r + r * .5, r); c.stroke(); } break;
      case 'cracks':
        c.strokeStyle = hexA(c2, .7); c.lineWidth = Math.max(1, r * .05);
        for (let i = 0; i < 5; i++) { c.beginPath(); let a = i * 1.26 + .3, d = r * .15; c.moveTo(Math.cos(a) * d, Math.sin(a) * d); while (d < r) { d += r * .28; a += i % 2 ? .35 : -.35; c.lineTo(Math.cos(a) * d, Math.sin(a) * d); } c.stroke(); } break;
      case 'dots':
        for (let i = 0; i < 9; i++) { const a = i * 2.4, d = r * (.2 + .65 * ((i * 37) % 10) / 10); ellipse(c, Math.cos(a) * d, Math.sin(a) * d, r * .07, r * .07, 0, hexA(col, .7)); } break;
      case 'plasma':
        c.lineWidth = r * .08;
        for (let k = 0; k < 2; k++) { c.strokeStyle = hexA(k ? c2 : col, .55); c.beginPath(); for (let a = 0; a < 7; a += .25) { const d = r * (.15 + a / 9), aa = a + t * 1.5 + k * Math.PI; c.lineTo(Math.cos(aa) * d, Math.sin(aa) * d); } c.stroke(); } break;
      case 'stars':
        for (let i = 0; i < 12; i++) { const a = i * 2.1, d = r * (.15 + .75 * ((i * 53) % 10) / 10), tw = .4 + .6 * Math.abs(Math.sin(t * 2 + i)); ellipse(c, Math.cos(a) * d, Math.sin(a) * d, r * .035, r * .035, 0, `rgba(255,255,255,${tw})`); } break;
      case 'smoke':
        for (let i = 0; i < 4; i++) { const a = t * .6 + i * 1.6; ellipse(c, Math.cos(a) * r * .35, Math.sin(a) * r * .35, r * .45, r * .3, a, 'rgba(255,255,255,.07)'); } break;
      case 'facets':
        c.strokeStyle = 'rgba(232,251,255,.35)'; c.lineWidth = Math.max(1, r * .03);
        c.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.moveTo(0, -r * .1); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        c.stroke(); break;
    }
  }

  // o: { face, expr: 'n'|'dash'|'dizzy'|'fall'|'happy', blink, alpha, t, glow }
  function drawBall(c, x, y, r, s, o) {
    if (r < 2) return;
    const t = o.t || 0, col = rimColor(s, t);
    c.save(); c.translate(x, y);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    if (o.glow !== false) {
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, 0, r * .8, 0, 0, r * 1.75);
      g.addColorStop(0, s.holo ? 'rgba(255,255,255,.35)' : hexA(s.c, .45)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.75, 0, TAU); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    const body = c.createRadialGradient(-r * .3, -r * .35, r * .05, 0, 0, r);
    // the body itself carries the orb's colour, so every orb is recognisable without a shell
    const bc = s.holo ? '#b77dff' : s.c;
    body.addColorStop(0, tone(bc, .45)); body.addColorStop(.55, bc); body.addColorStop(1, tone(bc, -.55));
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = body; c.fill();
    c.save(); c.clip(); drawPattern(c, r, s, t); c.restore();
    if (s.holo) {
      const cg = c.createConicGradient ? c.createConicGradient(t * 1.2, 0, 0) : null;
      if (cg) { ['#ff4fd8', '#ffcc3d', '#7dff9b', '#46e6ff', '#b77dff', '#ff4fd8'].forEach((h, i) => cg.addColorStop(i / 5, h)); c.strokeStyle = cg; } else c.strokeStyle = col;
    } else c.strokeStyle = col;
    // the coloured shell shows only when asked (in play: when the dash is charged)
    if (o.rim !== false) { if (!s.holo) c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = Math.max(2.5, r * .1); c.beginPath(); c.arc(0, 0, r - c.lineWidth / 2, 0, TAU); c.stroke(); }
    
    ellipse(c, -r * .36, -r * .46, r * .26, r * .11, -.6, 'rgba(255,255,255,.32)');
    if (s.crown || s.boss) drawHalo(c, r, s, t);
    if (o.front) drawFrontEyes(c, r, s, o);
    else { c.rotate(o.face || 0); drawEyes(c, r, s, o); }
    c.restore();
  }

  function drawHalo(c, r, s, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    if (s.boss) {
      c.fillStyle = hexA(s.c, .9);
      for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * .35, -r * .82); c.lineTo(sx * r * .62, -r * 1.3); c.lineTo(sx * r * .72, -r * .62); c.closePath(); c.fill(); }
    } else {
      c.strokeStyle = 'rgba(255,204,61,.85)'; c.lineWidth = r * .07;
      c.beginPath(); c.ellipse(0, -r * 1.12, r * .5, r * .14, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; ellipse(c, Math.cos(a) * r * .5, -r * 1.12 + Math.sin(a) * r * .14, r * .05, r * .05, 0, '#fff4c2'); }
    }
    c.restore();
  }

  // Eyes looking straight at the viewer (shop and menus)
  function drawFrontEyes(c, r, s, o) {
    const iris = s.holo ? '#ffffff' : s.c;
    for (const sx of [-1, 1]) {
      const x = sx * r * .3, y = -r * .06, rx = r * .19, ry = r * .24;
      if (o.blink) { c.strokeStyle = '#ffffff'; c.lineWidth = r * .07; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - rx * .8, y); c.lineTo(x + rx * .8, y); c.stroke(); continue; }
      ellipse(c, x, y, rx * 1.25, ry * 1.2, 0, hexA(s.holo ? '#ffffff' : s.c, .25));
      ellipse(c, x, y, rx, ry, 0, '#f4fbff');
      const pr = r * .11, py = y + ry * .18;
      ellipse(c, x, py, pr * 1.3, pr * 1.3, 0, iris);
      ellipse(c, x, py, pr, pr, 0, '#050816');
      ellipse(c, x - pr * .35, py - pr * .45, pr * .38, pr * .38, 0, '#ffffff');
    }
  }

  // Eyes in the orb's own frame: x points where it is heading.
  function drawEyes(c, r, s, o) {
    const expr = o.expr || 'n';
    const ex = r * .34, ey = r * .34, rx = r * .2, ry = r * .24;
    const iris = s.holo ? '#ffffff' : s.c;
    c.lineCap = 'round';
    for (const sy of [-1, 1]) {
      const y = sy * ey;
      if (expr === 'happy') {
        c.strokeStyle = '#ffffff'; c.lineWidth = r * .08;
        c.beginPath(); c.ellipse(ex, y, rx * .9, ry * .8, 0, Math.PI * .65, Math.PI * 1.35, true); c.stroke();
        continue;
      }
      if (o.blink && expr === 'n') {
        c.strokeStyle = '#ffffff'; c.lineWidth = r * .07;
        c.beginPath(); c.moveTo(ex - rx * .3, y - sy * ry * .1); c.lineTo(ex + rx * .9, y + sy * ry * .1); c.stroke();
        continue;
      }
      const big = expr === 'fall' ? 1.25 : 1;
      // glow behind the eye
      ellipse(c, ex, y, rx * big * 1.25, ry * big * 1.25, 0, hexA(s.holo ? '#ffffff' : s.c, .25));
      ellipse(c, ex, y, rx * big, ry * big, 0, '#f4fbff');
      if (expr === 'dizzy') {
        c.strokeStyle = '#0a0f28'; c.lineWidth = r * .045; c.beginPath();
        for (let a = 0; a < 9; a += .4) { const d = a / 9 * rx * .9, aa = a + (o.t || 0) * 8 * sy; c.lineTo(ex + Math.cos(aa) * d, y + Math.sin(aa) * d); }
        c.stroke(); continue;
      }
      const pr = expr === 'fall' ? r * .055 : r * .11, px = ex + rx * (expr === 'fall' ? 0 : .32);
      ellipse(c, px, y, pr * 1.3, pr * 1.3, 0, iris);
      ellipse(c, px, y, pr, pr, 0, '#050816');
      ellipse(c, px + pr * .35, y - sy * pr * .45, pr * .38, pr * .38, 0, '#ffffff');
      if (expr === 'dash' || s.boss) {
        // angry lid: cover the outer half of the eye with the body color, slanting toward the front
        const P = (u, v) => [ex + u * rx, y + sy * v * ry];
        c.save();
        c.beginPath(); c.ellipse(ex, y, rx * 1.05, ry * 1.05, 0, 0, TAU); c.clip();
        c.beginPath();
        for (const [u, v] of [[-1.4, .5], [1.4, -.2], [1.4, 2], [-1.4, 2]]) c.lineTo(...P(u, v));
        c.closePath(); c.fillStyle = '#0c1230'; c.fill();
        c.restore();
        c.strokeStyle = s.boss ? s.c : '#ffffff'; c.lineWidth = r * .065;
        c.beginPath(); c.moveTo(...P(-1.15, .85)); c.lineTo(...P(1.15, .05)); c.stroke();
      }
    }
    // mouth for strong feelings
    c.strokeStyle = '#ffffff'; c.lineWidth = r * .055;
    if (expr === 'fall') ellipse(c, r * .66, 0, r * .07, r * .09, 0, '#f4fbff');
    else if (expr === 'happy') { c.beginPath(); c.arc(r * .52, 0, r * .14, -1.1, 1.1); c.stroke(); }
  }

  // ---------- blockers ----------
  function drawBlocker(c, p, bl, th, t) {
    const col = bl.k === 'sweep' ? th.accent : th.rim2 === '#ffffff' ? th.accent : th.rim2;
    c.save();
    c.globalAlpha = p.active ? 1 : .15;
    c.lineCap = 'round';
    // drop shadow on the floor
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = p.w * 2; c.beginPath(); c.moveTo(p.ax + 4, p.ay + 10); c.lineTo(p.bx + 4, p.by + 10); c.stroke();
    // glow body
    c.shadowColor = col; c.shadowBlur = 26;
    c.strokeStyle = col; c.lineWidth = p.w * 2; c.beginPath(); c.moveTo(p.ax, p.ay); c.lineTo(p.bx, p.by); c.stroke();
    c.shadowBlur = 0;
    c.strokeStyle = '#0a0f28'; c.lineWidth = p.w * 2 - 7; c.beginPath(); c.moveTo(p.ax, p.ay); c.lineTo(p.bx, p.by); c.stroke();
    // moving hazard stripes inside
    const len = Math.hypot(p.bx - p.ax, p.by - p.ay);
    if (len > 1) {
      c.setLineDash([10, 12]); c.lineDashOffset = -t * 40; c.strokeStyle = hexA(col, .8); c.lineWidth = p.w * 2 - 14;
      c.beginPath(); c.moveTo(p.ax, p.ay); c.lineTo(p.bx, p.by); c.stroke(); c.setLineDash([]);
    } else {
      c.fillStyle = hexA(col, .5); c.beginPath(); c.arc(p.ax, p.ay, p.w * .45, 0, TAU); c.fill();
    }
    // bright ends
    c.globalCompositeOperation = 'lighter';
    for (const [x, y] of [[p.ax, p.ay], [p.bx, p.by]]) { const g = p.w * 2.4; c.drawImage(glowSprite(col), x - g, y - g, g * 2, g * 2); }
    if (bl.k === 'sweep') {
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#0a0f28'; c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(p.cx, p.cy, p.w * 1.6, 0, TAU); c.fill(); c.stroke();
      c.globalCompositeOperation = 'lighter'; const g = p.w * 3; c.drawImage(glowSprite(col), p.cx - g, p.cy - g, g * 2, g * 2);
    }
    c.restore();
  }

  // ---------- power-ups ----------
  function drawPuIcon(c, type, x, y, s) {
    c.save(); c.translate(x, y); c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineWidth = s * .14; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    if (type === 'shield') { c.moveTo(0, -s * .6); c.lineTo(s * .5, -s * .35); c.lineTo(s * .4, s * .25); c.lineTo(0, s * .6); c.lineTo(-s * .4, s * .25); c.lineTo(-s * .5, -s * .35); c.closePath(); c.stroke(); }
    else if (type === 'magnet') { c.arc(0, 0, s * .4, Math.PI, 0, true); c.moveTo(-s * .4, 0); c.lineTo(-s * .4, -s * .45); c.moveTo(s * .4, 0); c.lineTo(s * .4, -s * .45); c.stroke(); }
    else if (type === 'mega') { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = i % 2 ? s * .3 : s * .62; c.lineTo(Math.cos(a) * d, Math.sin(a) * d); } c.closePath(); c.fill(); }
    else if (type === 'boost') { for (const dx of [-s * .2, s * .2]) { c.moveTo(dx - s * .2, -s * .4); c.lineTo(dx + s * .2, 0); c.lineTo(dx - s * .2, s * .4); } c.stroke(); }
    else { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.moveTo(-Math.cos(a) * s * .55, -Math.sin(a) * s * .55); c.lineTo(Math.cos(a) * s * .55, Math.sin(a) * s * .55); } c.stroke(); }
    c.restore();
  }

  function drawPowerup(c, p, t) {
    const col = PU_COLORS[p.type], bob = Math.sin(t * 3 + p.x) * 3, s = 15;
    c.save(); c.translate(p.x, p.y + bob);
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 2.4); g.addColorStop(0, hexA(col, .55)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(-s * 2.4, -s * 2.4, s * 4.8, s * 4.8);
    c.globalCompositeOperation = 'source-over';
    c.rotate(t * .8);
    c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(Math.cos(a) * s * 1.15, Math.sin(a) * s * 1.15); } c.closePath();
    c.fillStyle = 'rgba(8,12,30,.85)'; c.fill(); c.strokeStyle = col; c.lineWidth = 3; c.stroke();
    c.rotate(-t * .8);
    drawPuIcon(c, p.type, 0, 0, s);
    c.restore();
  }

  // effect around an orb that holds a power-up
  function drawPuAura(c, b, t) {
    const col = PU_COLORS[b.pu]; if (!col) return;
    const blinkOut = b.puT < 1.2 && (t * 8 | 0) % 2 === 0;
    if (blinkOut) return;
    c.save(); c.translate(b.x, b.y);
    if (b.pu === 'shield') {
      c.strokeStyle = hexA(col, .9); c.lineWidth = 3; c.rotate(t);
      c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(Math.cos(a) * (b.r + 12), Math.sin(a) * (b.r + 12)); } c.closePath(); c.stroke();
      c.fillStyle = hexA(col, .1); c.fill();
    } else if (b.pu === 'magnet') {
      const k = (t * 1.5) % 1; c.strokeStyle = hexA(col, .6 * (1 - k)); c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, b.r + 10 + (1 - k) * 60, 0, TAU); c.stroke();
    } else if (b.pu === 'mega') {
      c.globalCompositeOperation = 'lighter'; c.fillStyle = hexA(col, .9); c.rotate(t * 3);
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(b.r + 2, -4); c.lineTo(b.r + 14, 0); c.lineTo(b.r + 2, 4); c.fill(); }
    } else if (b.pu === 'boost') {
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(col, .6); c.lineWidth = 2; c.rotate(b.face + Math.PI);
      for (const dy of [-b.r * .5, 0, b.r * .5]) { c.beginPath(); c.moveTo(b.r + 4, dy); c.lineTo(b.r + 24 + Math.random() * 12, dy); c.stroke(); }
    } else if (b.pu === 'freeze') {
      c.strokeStyle = hexA(col, .8); c.lineWidth = 2; c.setLineDash([4, 6]); c.beginPath(); c.arc(0, 0, b.r + 9, t, t + TAU); c.stroke();
    }
    c.restore();
  }

  // ---------- arena ----------
  const floorCache = new Map();
  function floorFor(lv) {
    const key = lv.theme + ':' + lv.rMax;
    if (floorCache.has(key)) return floorCache.get(key);
    const th = THEMES[lv.theme] || THEMES.cyber, R = lv.rMax, S = Math.ceil(R * 2 + 20);
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d'); c.translate(S / 2, S / 2);
    const g = c.createRadialGradient(-R * .25, -R * .3, 0, 0, 0, R);
    g.addColorStop(0, th.floor[0]); g.addColorStop(1, th.floor[1]);
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.strokeStyle = th.grid; c.lineWidth = 1.5;
    const s = 34;
    for (let col = -Math.ceil(R / (s * 1.5)) - 1; col <= Math.ceil(R / (s * 1.5)) + 1; col++)
      for (let row = -Math.ceil(R / (s * 1.73)) - 1; row <= Math.ceil(R / (s * 1.73)) + 1; row++) {
        const hx = col * s * 1.5, hy = row * s * 1.732 + (col & 1 ? s * .866 : 0);
        c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(hx + Math.cos(a) * s, hy + Math.sin(a) * s); } c.closePath(); c.stroke();
      }
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * R;
      ellipse(c, Math.cos(a) * d, Math.sin(a) * d, 2, 2, 0, hexA(i % 2 ? th.rim : th.accent, .35));
    }
    c.restore();
    c.strokeStyle = hexA(th.accent, .35); c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.stroke();
    const out = { cv, S }; floorCache.set(key, out); return out;
  }

  const STARS = Array.from({ length: 140 }, () => ({ x: Math.random() * 3000 - 1500, y: Math.random() * 3000 - 1500, s: Math.random() * 1.8 + .4, a: Math.random() * .6 + .2 }));
  const trails = new Map();
  const happyUntil = new Map();
  function happy(id, now) { happyUntil.set(id, now + .9); }

  function exprOf(b, t) {
    if (b.falling) return 'fall';
    if (b.dizzy > 0) return 'dizzy';
    if ((happyUntil.get(b.id) || 0) > t) return 'happy';
    if (b.dashT > 0) return 'dash';
    return 'n';
  }

  function starPath(c, x, y, R, r, rot) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2 + (rot || 0), d = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    c.closePath();
  }

  function drawTrail(c, b, tr, k, t) {
    const s = skinFor(b), col = rimColor(s, t), style = s.trail || 'glow', n = tr.length - 1;
    if (style === 'zap') {
      for (const [w, a, cc] of [[6, .35, col], [2, .9, '#ffffff']]) {
        c.globalAlpha = a * k; c.strokeStyle = cc; c.lineWidth = w; c.beginPath();
        for (let i = 0; i < n; i++) { const j = i === n - 1 ? 0 : (Math.random() - .5) * b.r * .9; c.lineTo(tr[i].x + j, tr[i].y - j); }
        c.lineTo(b.x, b.y); c.stroke();
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      const f = i / n, p = tr[i];
      let cc = col, rad = b.r * (.4 + f * .55), a = f * .35 * k;
      if (style === 'fire') { cc = i % 2 ? '#ff6a2a' : '#ffcc3d'; rad *= .8 + Math.random() * .3; a *= 1.4; }
      else if (style === 'rainbow' || style === 'aurora') { cc = style === 'aurora' ? `hsl(${150 + Math.sin(t * 2 + i * .6) * 60},100%,65%)` : `hsl(${(t * 120 + i * 40) % 360},100%,65%)`; a *= 1.3; }
      else if (style === 'smoke') { cc = 'rgba(160,170,200,1)'; rad *= 1.25 - f * .3; a *= .7; }
      else if (style === 'ice') { c.globalAlpha = a * 1.4; c.save(); c.translate(p.x, p.y); c.rotate(i); c.fillStyle = '#d8f6ff'; c.fillRect(-rad * .35, -rad * .35, rad * .7, rad * .7); c.restore(); continue; }
      else if (style === 'stars' || style === 'gold') {
        c.globalAlpha = Math.min(1, a * 2.5); c.fillStyle = style === 'gold' ? '#ffe680' : '#ffffff';
        starPath(c, p.x + Math.sin(i * 7) * b.r * .4, p.y + Math.cos(i * 5) * b.r * .4, b.r * .22, b.r * .09, t * 2 + i); c.fill(); continue;
      }
      c.globalAlpha = a; c.fillStyle = cc;
      c.beginPath(); c.arc(p.x, p.y, rad, 0, TAU); c.fill();
    }
  }

  // ---------- space scenery behind each arena (screen space, slow parallax) ----------
  const GALAXY = Array.from({ length: 260 }, (_, i) => ({ arm: i % 3, d: Math.pow(Math.random(), .7), j: Math.random() - .5, s: Math.random() * 1.6 + .5 }));
  const CRATERS = Array.from({ length: 9 }, () => ({ a: Math.random() * TAU, d: Math.random() * .75, r: .06 + Math.random() * .12 }));
  function drawScene(c, scene, th, W, H, cam, clock) {
    const M = Math.max(W, H), px = -cam.x * .04, py = -cam.y * .04;
    c.save();
    if (scene === 'planet') {
      const x = W * .84 + px, y = H * .8 + py, r = M * .2;
      const g = c.createRadialGradient(x - r * .4, y - r * .4, r * .1, x, y, r);
      g.addColorStop(0, hexA(th.accent, .55)); g.addColorStop(.7, hexA(th.rim, .22)); g.addColorStop(1, 'rgba(5,6,20,.9)');
      c.globalAlpha = .9; ellipse(c, x, y, r, r, 0, g);
      for (let i = 0; i < 5; i++) { c.globalAlpha = .12; ellipse(c, x, y - r * .5 + i * r * .25, r * .95, r * .05, 0, '#ffffff'); }
      c.globalAlpha = .55; c.strokeStyle = hexA(th.rim2 === '#ffffff' ? th.rim : th.rim2, .8); c.lineWidth = r * .06;
      c.beginPath(); c.ellipse(x, y, r * 1.75, r * .38, -.35, 0, TAU); c.stroke();
      c.lineWidth = r * .02; c.beginPath(); c.ellipse(x, y, r * 1.95, r * .44, -.35, 0, TAU); c.stroke();
    } else if (scene === 'blackhole') {
      const x = W * .18 + px, y = H * .22 + py, r = M * .07;
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        c.strokeStyle = hexA(i % 2 ? th.accent : '#ff9a3b', .35 - i * .06); c.lineWidth = r * (.5 - i * .08);
        c.beginPath(); c.ellipse(x, y, r * (2.4 + i * .5), r * (.55 + i * .1), -.3, clock * .3 + i, clock * .3 + i + 5); c.stroke();
      }
      const halo = c.createRadialGradient(x, y, r * .9, x, y, r * 2.2);
      halo.addColorStop(0, hexA('#ffcc3d', .5)); halo.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = halo; c.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      c.globalCompositeOperation = 'source-over';
      ellipse(c, x, y, r, r, 0, '#000000');
    } else if (scene === 'galaxy') {
      const x = W * .2 + px, y = H * .3 + py, r = M * .28;
      c.globalCompositeOperation = 'lighter';
      const core = c.createRadialGradient(x, y, 0, x, y, r * .3);
      core.addColorStop(0, hexA(th.rim2 === '#ffffff' ? '#ffe6ff' : th.rim2, .45)); core.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = core; c.fillRect(x - r * .3, y - r * .3, r * .6, r * .6);
      for (const p of GALAXY) {
        const a = p.arm * TAU / 3 + p.d * 4.2 + clock * .03 + p.j * .5, d = p.d * r;
        c.globalAlpha = .55 * (1 - p.d * .6); c.fillStyle = p.arm === 1 ? th.accent : th.rim;
        c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d * .45, p.s, p.s);
      }
    } else if (scene === 'sun') {
      const x = W * .92 + px, y = H * .1 + py, r = M * .17, pulse = 1 + Math.sin(clock * .8) * .03;
      c.globalCompositeOperation = 'lighter';
      const co = c.createRadialGradient(x, y, r * .6, x, y, r * 2.4 * pulse);
      co.addColorStop(0, hexA('#ffb347', .45)); co.addColorStop(.4, hexA(th.rim, .18)); co.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = co; c.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
      const body = c.createRadialGradient(x - r * .2, y + r * .2, 0, x, y, r);
      body.addColorStop(0, '#fff3c4'); body.addColorStop(.6, '#ffb347'); body.addColorStop(1, '#ff5a1f');
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = .85; ellipse(c, x, y, r, r, 0, body);
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA('#ffcc3d', .35); c.lineWidth = 4;
      for (let i = 0; i < 4; i++) { const a = 1.6 + i * .5 + Math.sin(clock * .4 + i) * .2; c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * (.18 + .06 * Math.sin(clock + i)), a + 1.6, a + 4.6); c.stroke(); }
    } else if (scene === 'moon') {
      const x = W * .14 + px, y = H * .82 + py, r = M * .16;
      const g = c.createRadialGradient(x + r * .35, y - r * .35, r * .1, x, y, r);
      g.addColorStop(0, '#d9e6ff'); g.addColorStop(.75, '#6c7aa3'); g.addColorStop(1, '#1b2242');
      c.globalAlpha = .75; ellipse(c, x, y, r, r, 0, g);
      for (const k of CRATERS) { c.globalAlpha = .25; ellipse(c, x + Math.cos(k.a) * k.d * r, y + Math.sin(k.a) * k.d * r, k.r * r, k.r * r * .85, 0, '#2a335a'); }
      const ex = W * .86 + px * 1.5, ey = H * .14 + py * 1.5, er = M * .035;
      const eg = c.createRadialGradient(ex - er * .3, ey - er * .3, 0, ex, ey, er);
      eg.addColorStop(0, '#9ff3ff'); eg.addColorStop(.6, '#2b7bff'); eg.addColorStop(1, '#08183d');
      c.globalAlpha = .9; ellipse(c, ex, ey, er, er, 0, eg);
    }
    // shooting stars / comets cross every few seconds in every scene; many more in the comet arenas
    c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
    const n = scene === 'comets' ? 5 : 1;
    for (let i = 0; i < n; i++) {
      const per = scene === 'comets' ? 5 + i * 1.3 : 9, ph = ((clock + i * 2.7) % per) / per;
      if (ph > .35) continue;
      const k = ph / .35, seed = Math.floor((clock + i * 2.7) / per) * 7.1 + i;
      const sx0 = (Math.sin(seed) * .5 + .5) * W, sy0 = -40 + (Math.cos(seed * 1.3) * .5 + .5) * H * .3;
      const ang = .5 + Math.sin(seed * 2) * .25, len = scene === 'comets' ? M * .16 : M * .1;
      const hx = sx0 + Math.cos(ang) * k * M * .6, hy = sy0 + Math.sin(ang) * k * M * .6;
      const tg = c.createLinearGradient(hx, hy, hx - Math.cos(ang) * len, hy - Math.sin(ang) * len);
      tg.addColorStop(0, hexA(i % 2 ? th.accent : '#ffffff', .8)); tg.addColorStop(1, 'rgba(0,0,0,0)');
      c.strokeStyle = tg; c.lineWidth = scene === 'comets' ? 4 : 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - Math.cos(ang) * len, hy - Math.sin(ang) * len); c.stroke();
      c.drawImage(glowSprite(i % 2 ? th.accent : th.rim), hx - 12, hy - 12, 24, 24);
    }
    c.restore();
  }

  // ---------- floor features ----------
  function drawFloorFx(c, view, th, clock, R) {
    const lv = view.lv;
    c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip();
    // conveyor belts: chevrons rolling the way they push
    for (const bt of lv.belts || []) {
      c.save(); c.translate(bt.x, bt.y); c.rotate(bt.ang);
      c.fillStyle = 'rgba(4,6,16,.75)'; c.fillRect(-bt.len, -bt.w, bt.len * 2, bt.w * 2);
      c.strokeStyle = hexA(th.rim, .7); c.lineWidth = 3; c.strokeRect(-bt.len, -bt.w, bt.len * 2, bt.w * 2);
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(th.accent, .5); c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
      const gap = 56, off = (clock * bt.speed * .35) % gap;
      for (let x = -bt.len - gap + off; x < bt.len; x += gap) {
        if (x < -bt.len + 6) continue;
        c.beginPath(); c.moveTo(x - 12, -bt.w * .55); c.lineTo(x + 6, 0); c.lineTo(x - 12, bt.w * .55); c.stroke();
      }
      c.restore();
    }
    // crumbling tiles
    if (lv.crumble) {
      const T = Sim.TILE;
      c.strokeStyle = hexA(th.rim, .12); c.lineWidth = 1.5; c.beginPath();
      for (let v = -Math.ceil(R / T) * T; v <= R; v += T) { c.moveTo(v, -R); c.lineTo(v, R); c.moveTo(-R, v); c.lineTo(R, v); }
      c.stroke();
      for (const tl of (view.tiles ? view.tiles.values() : [])) {
        const x = tl.i * T, y = tl.j * T;
        if (tl.gone) {
          const back = Math.max(0, Math.min(1, (tl.back - (view.t || 0)) / 7));
          c.fillStyle = '#010104'; c.fillRect(x + 2, y + 2, T - 4, T - 4);
          c.strokeStyle = hexA(th.rim, .3 + (1 - back) * .5); c.lineWidth = 2; c.strokeRect(x + 3, y + 3, T - 6, T - 6);
        } else {
          const k = Math.min(1, tl.dmg / 1.6);
          c.fillStyle = `rgba(255,70,40,${k * .28})`; c.fillRect(x + 1, y + 1, T - 2, T - 2);
          c.strokeStyle = `rgba(255,200,150,${.25 + k * .6})`; c.lineWidth = 2; c.beginPath();
          const cx = x + T / 2, cy = y + T / 2, n = 2 + Math.floor(k * 4);
          for (let i = 0; i < n; i++) { const a = i * 2.1 + tl.i, d = T * (.2 + .25 * k); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); c.lineTo(cx + Math.cos(a + .4) * d * 1.6, cy + Math.sin(a + .4) * d * 1.6); }
          c.stroke();
        }
      }
    }
    // sinkholes: a red warning, then a hole in the floor
    for (const sk of view.sinks || []) {
      if (!sk.open) {
        const pulse = .5 + .5 * Math.sin(clock * 14);
        ellipse(c, sk.x, sk.y, sk.r, sk.r, 0, `rgba(255,60,80,${.12 + sk.k * .2})`);
        c.setLineDash([8, 8]); c.lineDashOffset = -clock * 30; c.strokeStyle = `rgba(255,90,110,${.5 + pulse * .5})`; c.lineWidth = 3;
        c.beginPath(); c.arc(sk.x, sk.y, sk.r * (1.15 - sk.k * .15), 0, TAU); c.stroke(); c.setLineDash([]);
      } else {
        const g = c.createRadialGradient(sk.x, sk.y, 0, sk.x, sk.y, sk.r);
        g.addColorStop(0, '#000000'); g.addColorStop(.8, '#03020a'); g.addColorStop(1, hexA(th.accent, .6));
        ellipse(c, sk.x, sk.y, sk.r, sk.r, 0, g);
        c.strokeStyle = th.accent; c.lineWidth = 3; c.beginPath(); c.arc(sk.x, sk.y, sk.r, 0, TAU); c.stroke();
      }
    }
    c.restore();
  }

  function drawMeteors(c, view, clock) {
    for (const m of view.meteors || []) {
      const k = Math.min(1, m.t / 1.3);
      c.strokeStyle = `rgba(255,120,60,${.4 + .5 * Math.abs(Math.sin(clock * 12))})`; c.lineWidth = 3;
      c.beginPath(); c.arc(m.x, m.y, 105 * (1 - k * .3), 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(m.x - 16, m.y); c.lineTo(m.x + 16, m.y); c.moveTo(m.x, m.y - 16); c.lineTo(m.x, m.y + 16); c.stroke();
      ellipse(c, m.x, m.y, 105 * k, 105 * k, 0, 'rgba(255,90,40,.12)');
      // the rock itself, coming down from the top left
      const hx = m.x - 420 * (1 - k), hy = m.y - 620 * (1 - k);
      c.save(); c.globalCompositeOperation = 'lighter';
      const tg = c.createLinearGradient(hx, hy, hx - 120, hy - 180);
      tg.addColorStop(0, 'rgba(255,200,90,.9)'); tg.addColorStop(1, 'rgba(255,60,20,0)');
      c.strokeStyle = tg; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - 120, hy - 180); c.stroke();
      c.drawImage(glowSprite('#ff8a3b'), hx - 34, hy - 34, 68, 68);
      c.restore();
      ellipse(c, hx, hy, 15, 15, 0, '#ffe2b0');
    }
  }

  function drawEmote(c, b, k, z) {
    const s = 1 / Math.max(.7, z), y = b.y - b.r - 58 * s, bw = 46 * s;
    c.save();
    c.fillStyle = 'rgba(8,10,28,.88)'; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2 * s;
    c.beginPath(); c.roundRect(b.x - bw / 2, y - bw / 2, bw, bw, 12 * s); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(b.x - 7 * s, y + bw / 2 - 1); c.lineTo(b.x, y + bw / 2 + 9 * s); c.lineTo(b.x + 7 * s, y + bw / 2 - 1); c.fill();
    c.font = `${28 * s}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(k, b.x, y + 1);
    c.restore();
  }

  // env: { W, H, DPR, cam, clock, shake, reduce, parts, texts, windBits, dashCd, emotes }
  function render(ctx, view, env) {
    const th = THEMES[view.lv.theme] || THEMES.cyber, { W, H, cam, clock } = env;
    ctx.setTransform(env.DPR, 0, 0, env.DPR, 0, 0);
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .75);
    bg.addColorStop(0, th.bg[0]); bg.addColorStop(1, th.bg[1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // nebula clouds in the arena's colours, drifting slowly with the camera
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const neb = [[th.rim, -.6, -.4], [th.accent, .7, .3], [th.rim2 === '#ffffff' ? th.accent : th.rim2, -.2, .8]];
    neb.forEach(([col, nx, ny], i) => {
      const x = W / 2 + nx * W * .5 - cam.x * .08 + Math.sin(clock * .05 + i) * 30, y = H / 2 + ny * H * .5 - cam.y * .08 + Math.cos(clock * .04 + i) * 30;
      const rad = Math.max(W, H) * .55, g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, hexA(col, .14)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    ctx.restore();
    // parallax stars
    for (const s of STARS) {
      const x = ((s.x - cam.x * .3) * cam.z % (W + 200) + W + 200) % (W + 200) - 100;
      const y = ((s.y - cam.y * .3) * cam.z % (H + 200) + H + 200) % (H + 200) - 100;
      ctx.fillStyle = `rgba(${th.star},${s.a * (.6 + .4 * Math.sin(clock * 2 + s.x))})`;
      ctx.fillRect(x, y, s.s, s.s);
    }
    drawScene(ctx, view.lv.scene, th, W, H, cam, clock);
    const sx = env.reduce ? 0 : (Math.random() - .5) * env.shake, sy = env.reduce ? 0 : (Math.random() - .5) * env.shake;
    ctx.save(); ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    const R = view.R, lv = view.lv, hole = lv.hole || 0;

    // arena glow + floor
    ctx.save(); ctx.shadowColor = th.rim; ctx.shadowBlur = 50 * cam.z;
    // a glass platform: the space scenery shows faintly through the floor
    ctx.globalAlpha = lv.scene ? .72 : 1; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = th.floor[1]; ctx.fill(); ctx.restore();
    const fl = floorFor(lv);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
    ctx.globalAlpha = lv.scene ? .8 : 1; ctx.drawImage(fl.cv, -fl.S / 2, -fl.S / 2); ctx.globalAlpha = 1;
    // a band of light sweeping across the floor now and then
    const sweep = ((clock * 160) % (R * 6)) - R * 1.5;
    if (sweep < R * 1.5) {
      ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createLinearGradient(sweep - 140, sweep - 140, sweep + 140, sweep + 140);
      sg.addColorStop(0, hexA(th.rim, 0)); sg.addColorStop(.5, hexA(th.rim, .09)); sg.addColorStop(1, hexA(th.rim, 0));
      ctx.fillStyle = sg; ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // where the edge will be soon
    if (view.t != null && R > lv.rMin + 2) {
      const soon = lv.rMax - (lv.rMax - lv.rMin) * Math.min(1, (view.t + 8) / lv.time);
      ctx.setLineDash([10, 12]); ctx.strokeStyle = 'rgba(255,80,90,.45)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, soon, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    // rim
    ctx.save(); ctx.shadowColor = th.rim; ctx.shadowBlur = 24;
    ctx.strokeStyle = th.rim; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.setLineDash([30, 26]); ctx.lineDashOffset = -clock * 40; ctx.strokeStyle = th.rim2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    // sparks drifting up off the edge
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const spr = glowSprite(th.rim);
    for (let i = 0; i < 40; i++) {
      const a = i * TAU / 40 + Math.sin(i * 7.3) * .08, h = (clock * 38 + i * 37) % 80;
      ctx.globalAlpha = (1 - h / 80) * .8;
      const sz = 5 + (i % 3) * 2;
      ctx.drawImage(spr, Math.cos(a) * R - sz, Math.sin(a) * R - h - sz, sz * 2, sz * 2);
    }
    ctx.restore();
    // black hole
    if (hole) {
      const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, hole);
      hg.addColorStop(0, '#000000'); hg.addColorStop(.75, '#05030c'); hg.addColorStop(1, hexA(th.accent, .5));
      ellipse(ctx, 0, 0, hole, hole, 0, hg);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a0 = clock * (1.2 + i * .2) + i * 1.3, rr = hole * (.45 + i * .12);
        ctx.strokeStyle = hexA(i % 2 ? th.accent : th.rim, .5); ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 1.4); ctx.stroke();
      }
      ctx.restore();
      ctx.save(); ctx.shadowColor = th.accent; ctx.shadowBlur = 18; ctx.strokeStyle = th.accent; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, hole + 3, 0, TAU); ctx.stroke(); ctx.restore();
    }
    drawFloorFx(ctx, view, th, clock, R);
    // pellets
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of view.pellets) {
      const col = PELLET_COLORS[p.k], s = 5.5 + Math.sin(clock * 4 + p.x * .05) * 1;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 2.6);
      g.addColorStop(0, hexA(col, .5)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - s * 2.6, p.y - s * 2.6, s * 5.2, s * 5.2);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(.785 + clock * .8); ctx.fillStyle = col; ctx.fillRect(-s * .6, -s * .6, s * 1.2, s * 1.2); ctx.restore();
    }
    ctx.restore();
    // bumpers
    for (const b of view.bumpers) {
      const s = 1 + (b.pulse || 0) * .25;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(s, s);
      ellipse(ctx, 0, 0, b.r, b.r, 0, hexA(th.accent, .12 + (b.pulse || 0) * .25));
      ctx.shadowColor = th.accent; ctx.shadowBlur = 20;
      ctx.strokeStyle = th.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, b.r - 2, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, b.r * .55, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0; ellipse(ctx, 0, 0, b.r * .18, b.r * .18, 0, '#ffffff');
      ctx.restore();
    }
    for (const bl of lv.blockers || []) drawBlocker(ctx, Sim.blockerPose(bl, view.t || 0, R), bl, th, clock);
    for (const p of view.powerups || []) drawPowerup(ctx, p, clock);
    drawMeteors(ctx, view, clock);
    // blackout: the floor goes dark, only the orbs keep shining
    const ev = view.ev;
    if (ev && ev.k === 'blackout') {
      const a = .85 * Math.max(0, Math.min(1, ev.t / .6, (6 - ev.t) / .6));
      ctx.fillStyle = `rgba(0,0,4,${a})`; ctx.beginPath(); ctx.arc(0, 0, R + 40, 0, TAU); ctx.fill();
    }
    // trails
    const list = view.balls.slice().sort((a, b) => a.r - b.r);
    const seen = new Set();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of list) {
      seen.add(b.id);
      let tr = trails.get(b.id);
      if (!tr) { tr = []; trails.set(b.id, tr); }
      const last = tr[tr.length - 1];
      if (last && Math.hypot(last.x - b.x, last.y - b.y) > 200) tr.length = 0;
      tr.push({ x: b.x, y: b.y });
      if (tr.length > 9) tr.shift();
      const speed = Math.hypot(b.vx || 0, b.vy || 0);
      if (b.falling || speed < 90) continue;
      drawTrail(ctx, b, tr, Math.min(1, (speed - 90) / 380), clock);
    }
    ctx.restore();
    for (const id of trails.keys()) if (!seen.has(id)) trails.delete(id);
    // the Titan charging its slam: shows how far the shockwave reaches
    for (const b of list) {
      if (!b.slamT || b.falling) continue;
      const k = 1 - b.slamT / 1.1;
      ellipse(ctx, b.x, b.y, 260, 260, 0, `rgba(255,59,59,${.06 + k * .14})`);
      ctx.strokeStyle = `rgba(255,90,70,${.5 + .5 * Math.abs(Math.sin(clock * 16))})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(b.x, b.y, 260, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + (260 - b.r) * k, 0, TAU); ctx.stroke();
    }
    // orbs
    for (const b of list) {
      const s = b.falling ? Math.max(0, 1 - b.falling / .55) : 1;
      if (!b.falling) ellipse(ctx, b.x + 3, b.y + b.r * .78, b.r * .85, b.r * .3, 0, 'rgba(0,0,0,.4)');
      const blink = ((clock + b.id * 1.7) % 4.3) < .12;
      const sk = skinFor(b);
      if (b.dashT > 0 && !b.falling) {
        // afterimages while dashing
        const sp = Math.hypot(b.vx, b.vy) || 1;
        for (let i = 3; i >= 1; i--) drawBall(ctx, b.x - b.vx / sp * b.r * .8 * i, b.y - b.vy / sp * b.r * .8 * i, b.r * (1 - i * .06), sk, { face: b.face, expr: 'dash', t: clock, alpha: .32 - i * .08, glow: false, rim: false });
      }
      // one shell only, and only when the dash is charged
      drawBall(ctx, b.x, b.y, b.r * s, sk, { face: b.face, expr: exprOf(b, clock), blink, t: clock, alpha: b.falling ? .4 + s * .6 : 1, glow: false, rim: !b.falling && b.dashCd <= 0 && !b.pu });
      if (!b.falling && b.pu) drawPuAura(ctx, b, clock);
      if (!b.falling && view.freezeBy && view.freezeBy !== b.id) {
        ctx.save(); ctx.globalAlpha = .35; ellipse(ctx, b.x, b.y, b.r, b.r, 0, '#bfefff'); ctx.restore();
      }
    }
    // names + dash ring
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const b of list) {
      if (b.falling) continue;
      const fs = Math.max(13, Math.min(26, b.r * .5)) / Math.max(.7, cam.z);
      ctx.font = `600 ${fs}px "Chakra Petch", "Rajdhani", system-ui, sans-serif`;
      const sk = skinFor(b), ny = b.y - b.r - ((sk.crown || sk.boss) ? b.r * .45 : 0) - 12;
      ctx.lineWidth = fs * .3; ctx.strokeStyle = 'rgba(3,5,13,.85)'; ctx.strokeText(b.name, b.x, ny);
      ctx.fillStyle = b.me ? '#ffffff' : rimColor(sk, clock); ctx.fillText(b.name, b.x, ny);
      if (b.me) { ctx.fillStyle = '#ffcc3d'; ctx.beginPath(); ctx.moveTo(b.x - 7, ny - fs - 2); ctx.lineTo(b.x + 7, ny - fs - 2); ctx.lineTo(b.x, ny - fs + 7); ctx.closePath(); ctx.fill(); }
      const em = env.emotes && env.emotes.get(b.id);
      if (em && em.until > clock) drawEmote(ctx, b, em.k, cam.z);
    }
    // particles
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of env.parts) {
      const k = Math.max(0, p.life / p.max);
      ctx.globalAlpha = k;
      if (p.k === 'spark') {
        ctx.strokeStyle = p.c; ctx.lineWidth = p.s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .07, p.y - p.vy * .07); ctx.stroke();
        const g = p.s * 5; ctx.drawImage(glowSprite(p.c), p.x - g, p.y - g, g * 2, g * 2);
      }
      else if (p.k === 'glow') { const g = p.s * (1.3 - k * .3); ctx.drawImage(glowSprite(p.c), p.x - g, p.y - g, g * 2, g * 2); }
      else if (p.k === 'flash') { const g = p.s * (1.2 - k * .2); ctx.globalAlpha = k * k; ctx.drawImage(glowSprite(p.c), p.x - g, p.y - g, g * 2, g * 2); }
      else if (p.k === 'ring') { ctx.strokeStyle = p.c; ctx.lineWidth = 9 * k + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 - k * k) + 6, 0, TAU); ctx.stroke(); }
      else if (p.k === 'implode') { ctx.strokeStyle = p.c; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.s * k), 0, TAU); ctx.stroke(); }
      else if (p.k === 'beam') {
        const h = p.s * (1.4 - k * .4), wdt = 26 * k + 4;
        const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y - h);
        g.addColorStop(0, p.c); g.addColorStop(1, hexA(p.c, 0));
        ctx.fillStyle = g; ctx.fillRect(p.x - wdt / 2, p.y - h, wdt, h);
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(p.x - wdt / 6, p.y - h * .8, wdt / 3, h * .8);
      }
      else if (p.k === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.moveTo(p.s * 1.6, 0); ctx.lineTo(-p.s, p.s * .8); ctx.lineTo(-p.s * .6, -p.s); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      else if (p.k === 'conf') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.s, -p.s * .35, p.s * 2, p.s * .7); ctx.restore(); }
      else ellipse(ctx, p.x, p.y, p.s, p.s, 0, p.c);
    }
    ctx.restore();
    for (const t of env.texts) {
      const k = 1 - t.life / t.max;
      ctx.globalAlpha = Math.min(1, t.life * 3);
      const fs = t.size * (1 + Math.min(1, k * 6) * .3 - k * .2) / Math.max(.6, cam.z);
      ctx.font = `italic 700 ${fs}px "Chakra Petch", "Rajdhani", system-ui, sans-serif`;
      ctx.save(); ctx.lineWidth = fs * .12; ctx.strokeStyle = t.col; ctx.shadowColor = t.col; ctx.shadowBlur = 24;
      ctx.strokeText(t.txt, t.x, t.y - k * 40); ctx.fillStyle = '#ffffff'; ctx.fillText(t.txt, t.x, t.y - k * 40); ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // solar wind streaks (screen space)
    if (lv.wind) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA(th.rim, .45); ctx.lineWidth = 2; ctx.lineCap = 'round';
      const wa = view.windA;
      for (const w of env.windBits) { ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x - Math.cos(wa) * 34, w.y - Math.sin(wa) * 34); ctx.stroke(); }
      ctx.restore();
    }
    // gravity shift: arrows show which way everything is about to slide
    if (ev && ev.k === 'gravity') {
      const warn = ev.t < 1.5, a = ev.a, on = warn ? (Math.sin(clock * 18) > 0 ? .9 : .25) : .45;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(th.accent, on); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const M = Math.max(W, H), off = warn ? 0 : (clock * 220) % 140;
      for (let x = -M; x < M; x += 140) for (let y = -M * .6; y < M * .6; y += 170) {
        const xx = x + off + (Math.abs(y / 170) % 2) * 70;
        ctx.beginPath(); ctx.moveTo(xx - 14, y - 18); ctx.lineTo(xx + 6, y); ctx.lineTo(xx - 14, y + 18); ctx.stroke();
      }
      ctx.restore();
    }
    // full-screen flash on big hits
    if (env.flash && env.flash.a > .01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = env.flash.a;
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .7);
      g.addColorStop(0, hexA(env.flash.c, .35)); g.addColorStop(1, hexA(env.flash.c, .9));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }

  root.Art = { SKINS, BOSS, SEASON, THEMES, PELLET_COLORS, PU_COLORS, skinOf, skinFor, drawBall, drawPuIcon, render, happy, starPath };
})(this);
