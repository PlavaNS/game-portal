'use strict';
// ---------- Assets ----------
const IMG_NAMES = ['ball0', 'ball1', 'ball2', 'ball3', 'ball4', 'ball5', 'ball6', 'ball7', 'ball8', 'ball9',
  'fire', 'glow', 't_awesome', 't_goodjob', 't_nice', 't_cake', 'life', 'locked', 'locked_big',
  'ach_on', 'ach_off', 'unlocked'];
const img = {};
function loadImages() {
  return Promise.all(IMG_NAMES.map(n => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => { img[n] = i; res(); };
    i.onerror = () => rej(new Error('Missing asset ' + n));
    i.src = 'assets/' + n + '.png';
  })));
}

// ---------- Colour helpers ----------
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function rgba(h, a) { const [r, g2, b] = hexRgb(h); return `rgba(${r},${g2},${b},${a})`; }
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function shade(h, k) { return k > 0 ? mixHex(h, '#ffffff', k) : mixHex(h, '#000000', -k); }

// Soft radial glow sprite, cached per colour
const glowCache = new Map();
function glowSprite(color) {
  if (glowCache.has(color)) return glowCache.get(color);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgba(color, 0.9)); gr.addColorStop(0.35, rgba(color, 0.35)); gr.addColorStop(1, rgba(color, 0));
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  glowCache.set(color, c);
  return c;
}

// ---------- Canvas ----------
const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
let PX = 1;
function resize() {
  // Respect padding the host page may put on <html> (phone safe areas)
  const rs = getComputedStyle(document.documentElement);
  const vw = window.innerWidth - parseFloat(rs.paddingLeft) - parseFloat(rs.paddingRight);
  const vh = window.innerHeight - parseFloat(rs.paddingTop) - parseFloat(rs.paddingBottom);
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, vw / vh));
  let h = vh, w = vh * aspect;
  if (w > vw) { w = vw; h = vw / aspect; }
  VIEW_W = VIEW_H * aspect; HALF_W = VIEW_W / 2;
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
  stage.style.fontSize = (h / 100) + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  PX = canvas.height / VIEW_H;
}
window.addEventListener('resize', resize);

// ---------- Rendering ----------
function wx(x) { return (x + HALF_W) * PX; }
function wy(y, cam) { return (cam + VIEW_H / 2 - y) * PX; }

// Background particle field, generated once
const FIELD = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random(), layer: (Math.random() * 3) | 0, ph: Math.random() * 6 }));

function themeAtCamera(cam) {
  // Blend zone colours as the camera moves between zones (the menu cycles through them over time)
  const s = S.mode === 'menu' ? (S.time / 4.5) * SCREENS_PER_ZONE : Math.max(0, -cam / VIEW_H);
  const zf = s / SCREENS_PER_ZONE, zi = Math.floor(zf), t = Math.max(0, Math.min(1, (zf - zi - 0.85) / 0.15));
  const a = ZONES[zi % ZONES.length], b = ZONES[(zi + 1) % ZONES.length];
  if (t <= 0) return a;
  return { name: a.name, top: mixHex(a.top, b.top, t), bot: mixHex(a.bot, b.bot, t), accent: mixHex(a.accent, b.accent, t), glow: mixHex(a.glow, b.glow, t), fx: t < 0.5 ? a.fx : b.fx };
}

function drawBackground(cam, W, H, th) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, S.rage ? mixHex(th.top, '#8a1020', 0.45) : th.top);
  grad.addColorStop(1, S.rage ? mixHex(th.bot, '#3a0010', 0.45) : th.bot);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  // Big soft glows drifting with parallax
  const gl = glowSprite(th.glow);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const py = ((cam * 0.15 * PX + i * H * 0.45) % (H * 1.35) + H * 1.35) % (H * 1.35) - H * 0.2;
    const px = W * (0.2 + 0.6 * ((i * 0.37 + 0.1) % 1)) + Math.sin(S.time * 0.3 + i) * W * 0.08;
    const sz = W * (0.9 + i * 0.25);
    g.globalAlpha = 0.22;
    g.drawImage(gl, px - sz / 2, py - sz / 2, sz, sz);
  }
  g.globalAlpha = 1;

  // Particle field in three parallax layers
  for (const f of FIELD) {
    const par = [0.25, 0.45, 0.7][f.layer];
    let yy = (f.y * H + cam * par * PX * -1) % H; if (yy < 0) yy += H;
    yy = H - yy;
    let xx = f.x * W, size = (0.02 + f.s * 0.05) * PX * (f.layer + 1) * 0.6, alpha = 0.15 + f.layer * 0.1;
    switch (th.fx) {
      case 'stars': size *= 0.5; alpha = 0.4 + 0.5 * Math.abs(Math.sin(S.time * 2 + f.ph)); g.fillStyle = rgba('#ffffff', alpha); break;
      case 'bubbles': yy = (yy - S.time * 20 * (f.layer + 1) % H + H) % H; g.strokeStyle = rgba(th.accent, alpha); g.lineWidth = 0.015 * PX; break;
      case 'embers': yy = (yy - S.time * 35 * (f.layer + 1) % H + H) % H; xx += Math.sin(S.time + f.ph) * 6; g.fillStyle = rgba(th.accent, alpha + 0.2); size *= 0.6; break;
      case 'snow': yy = (yy + S.time * 25 * (f.layer + 1)) % H; xx += Math.sin(S.time * 0.8 + f.ph) * 10; g.fillStyle = rgba('#ffffff', alpha + 0.3); size *= 0.7; break;
      default: g.fillStyle = rgba(th.accent, alpha * 0.8); size *= 2.2;
    }
    g.beginPath(); g.arc(xx, yy, size, 0, 7);
    if (th.fx === 'bubbles') g.stroke(); else g.fill();
  }
  g.globalCompositeOperation = 'source-over';

  // Neon side walls
  for (const x of [0, W]) {
    g.fillStyle = rgba(th.accent, 0.14); g.fillRect(x - 0.12 * PX, 0, 0.24 * PX, H);
    g.fillStyle = rgba(th.accent, 0.6); g.fillRect(x - 0.025 * PX, 0, 0.05 * PX, H);
  }
}

function drawObstacle(o, cam, th) {
  const X = wx(o.x), Y = wy(o.y, cam);
  switch (o.type) {
    case 'bumper': {
      const r = o.r * PX * (1 + o.flash * 0.15);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 + o.flash * 0.5;
      g.drawImage(glowSprite(th.glow), X - r * 2.2, Y - r * 2.2, r * 4.4, r * 4.4);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const gr = g.createRadialGradient(X - r * 0.3, Y - r * 0.3, r * 0.1, X, Y, r);
      gr.addColorStop(0, shade(th.glow, 0.5)); gr.addColorStop(0.5, o.flash > 0.3 ? '#ffffff' : th.glow); gr.addColorStop(1, shade(th.glow, -0.45));
      g.fillStyle = gr; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 0.07 * PX; g.beginPath(); g.arc(X, Y, r * 0.96, 0, 7); g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.7); g.lineWidth = 0.035 * PX; g.beginPath(); g.arc(X, Y, r * 0.55, 0, 7); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X, Y, r * 0.2, 0, 7); g.fill();
      break;
    }
    case 'spinner': case 'cross': {
      g.lineCap = 'round';
      for (let k = 0; k < o.arms; k++) {
        const [ax, ay, bx, by] = armEnds(o, k);
        g.strokeStyle = rgba(th.accent, 0.3); g.lineWidth = 0.38 * PX;
        g.beginPath(); g.moveTo(wx(ax), wy(ay, cam)); g.lineTo(wx(bx), wy(by, cam)); g.stroke();
        const lg = g.createLinearGradient(wx(ax), wy(ay, cam), wx(bx), wy(by, cam));
        lg.addColorStop(0, th.accent); lg.addColorStop(0.5, '#ffffff'); lg.addColorStop(1, th.accent);
        g.strokeStyle = lg; g.lineWidth = 0.2 * PX;
        g.beginPath(); g.moveTo(wx(ax), wy(ay, cam)); g.lineTo(wx(bx), wy(by, cam)); g.stroke();
      }
      g.fillStyle = '#1b1b28'; g.beginPath(); g.arc(X, Y, 0.17 * PX, 0, 7); g.fill();
      g.strokeStyle = th.accent; g.lineWidth = 0.05 * PX; g.beginPath(); g.arc(X, Y, 0.17 * PX, 0, 7); g.stroke();
      break;
    }
    case 'slider': {
      const x0 = wx(o.x - o.w), w = o.w * 2 * PX, hh = 0.28 * PX;
      g.strokeStyle = rgba(th.accent, 0.25); g.lineWidth = 0.03 * PX; g.setLineDash([0.1 * PX, 0.1 * PX]);
      g.beginPath(); g.moveTo(wx(o.cx - o.amp - o.w), Y); g.lineTo(wx(o.cx + o.amp + o.w), Y); g.stroke(); g.setLineDash([]);
      const lg = g.createLinearGradient(0, Y - hh / 2, 0, Y + hh / 2);
      lg.addColorStop(0, shade(th.accent, 0.4)); lg.addColorStop(1, shade(th.accent, -0.35));
      g.fillStyle = lg; roundRect(x0, Y - hh / 2, w, hh, hh / 2); g.fill();
      g.fillStyle = rgba('#000000', 0.25);
      for (let i = 1; i < 6; i++) g.fillRect(x0 + w * i / 6 - 0.015 * PX, Y - hh * 0.3, 0.03 * PX, hh * 0.6);
      break;
    }
    case 'conveyor': {
      g.save(); g.translate(X, Y); g.rotate(-o.angle);
      const w = o.half * 2 * PX, hh = 0.26 * PX;
      g.fillStyle = '#23232f'; roundRect(-w / 2, -hh / 2, w, hh, hh / 2); g.fill();
      g.strokeStyle = shade(th.accent, -0.2); g.lineWidth = 0.035 * PX; roundRect(-w / 2, -hh / 2, w, hh, hh / 2); g.stroke();
      // Moving chevrons show the belt direction
      g.save(); roundRect(-w / 2, -hh / 2, w, hh, hh / 2); g.clip();
      const dir = Math.sign(o.speed), step = 0.32 * PX, off = ((S.time * Math.abs(o.speed) * 0.5 * PX) % step) * dir;
      g.strokeStyle = th.accent; g.lineWidth = 0.05 * PX; g.lineJoin = 'round';
      for (let x = -w / 2 - step; x < w / 2 + step; x += step) {
        const cx = x + off;
        g.beginPath(); g.moveTo(cx - dir * 0.06 * PX, -hh * 0.28); g.lineTo(cx + dir * 0.06 * PX, 0); g.lineTo(cx - dir * 0.06 * PX, hh * 0.28); g.stroke();
      }
      g.restore();
      for (const s of [-1, 1]) { g.fillStyle = '#9aa0b4'; g.beginPath(); g.arc(s * (w / 2 - hh / 2), 0, hh * 0.32, 0, 7); g.fill(); }
      g.restore();
      break;
    }
    case 'trampoline': {
      g.save(); g.translate(X, Y); g.rotate(-o.angle);
      const w = o.half * 2 * PX, sag = o.boing * 0.12 * PX;
      // legs
      g.strokeStyle = '#3a3a4c'; g.lineWidth = 0.07 * PX; g.lineCap = 'round';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * w * 0.42, 0); g.lineTo(s * w * 0.32, 0.32 * PX); g.stroke(); }
      // springs
      g.strokeStyle = '#c9ced8'; g.lineWidth = 0.025 * PX;
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * w / 8, 0.02 * PX); g.lineTo(i * w / 8 + 0.03 * PX, 0.1 * PX); g.stroke(); }
      // bouncy band
      g.strokeStyle = th.glow; g.lineWidth = 0.11 * PX;
      g.beginPath(); g.moveTo(-w / 2, 0); g.quadraticCurveTo(0, sag * 2, w / 2, 0); g.stroke();
      g.strokeStyle = shade(th.glow, 0.5); g.lineWidth = 0.035 * PX;
      g.beginPath(); g.moveTo(-w / 2, -0.03 * PX); g.quadraticCurveTo(0, sag * 2 - 0.03 * PX, w / 2, -0.03 * PX); g.stroke();
      for (const s of [-1, 1]) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(s * w / 2, 0, 0.07 * PX, 0, 7); g.fill(); }
      g.restore();
      break;
    }
    case 'wind': {
      const hh = o.h * PX, top = Y - hh / 2, dir = Math.sign(o.force);
      const lg = g.createLinearGradient(0, top, 0, top + hh);
      lg.addColorStop(0, rgba('#ffffff', 0)); lg.addColorStop(0.5, rgba('#ffffff', 0.08)); lg.addColorStop(1, rgba('#ffffff', 0));
      g.fillStyle = lg; g.fillRect(0, top, VIEW_W * PX, hh);
      g.strokeStyle = rgba('#ffffff', 0.45); g.lineWidth = 0.03 * PX; g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const yy = top + hh * (0.15 + 0.7 * ((i * 0.37) % 1));
        const len = (0.4 + (i % 3) * 0.25) * PX;
        let xx = ((S.time * 3.2 * (1 + (i % 3) * 0.3) + i * 0.71) % 1.3) * (VIEW_W + 1.5) * PX - 0.8 * PX;
        if (dir < 0) xx = VIEW_W * PX - xx;
        g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx - dir * len, yy); g.stroke();
      }
      g.fillStyle = rgba('#ffffff', 0.55); g.font = `${0.5 * PX}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(dir > 0 ? '»»' : '««', VIEW_W * PX / 2, Y);
      break;
    }
    case 'portal': {
      const col = o.hue ? '#3dc8ff' : '#ff9a3d', r = o.r * PX;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(glowSprite(col), X - r * 2.4, Y - r * 2.4, r * 4.8, r * 4.8);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#07061a'; g.beginPath(); g.ellipse(X, Y, r, r * 1.15, 0, 0, 7); g.fill();
      g.lineWidth = 0.05 * PX;
      for (let i = 0; i < 4; i++) {
        const a = (o.hueT || 0) * (o.hue ? -3 : 3) + i * Math.PI / 2;
        g.strokeStyle = rgba(col, 0.9 - i * 0.15);
        g.beginPath(); g.ellipse(X, Y, r * (0.95 - i * 0.18), r * 1.1 * (0.95 - i * 0.18), 0, a, a + 2.2); g.stroke();
      }
      g.strokeStyle = col; g.lineWidth = 0.08 * PX; g.beginPath(); g.ellipse(X, Y, r, r * 1.15, 0, 0, 7); g.stroke();
      break;
    }
    case 'pendulum': {
      const [bx, by] = pendulumBob(o);
      const BX = wx(bx), BY = wy(by, cam);
      g.strokeStyle = '#9aa0b4'; g.lineWidth = 0.05 * PX;
      g.beginPath(); g.moveTo(X, Y); g.lineTo(BX, BY); g.stroke();
      g.fillStyle = '#3a3a4c'; roundRect(X - 0.18 * PX, Y - 0.12 * PX, 0.36 * PX, 0.18 * PX, 0.05 * PX); g.fill();
      g.fillStyle = th.accent; g.beginPath(); g.arc(X, Y, 0.06 * PX, 0, 7); g.fill();
      const r = o.bob * PX;
      const rg = g.createRadialGradient(BX - r * 0.35, BY - r * 0.35, r * 0.1, BX, BY, r);
      rg.addColorStop(0, '#8a8fa3'); rg.addColorStop(1, '#1d1d28');
      g.fillStyle = rg; g.beginPath(); g.arc(BX, BY, r, 0, 7); g.fill();
      g.strokeStyle = th.accent; g.lineWidth = 0.04 * PX; g.beginPath(); g.arc(BX, BY, r * 0.98, 0, 7); g.stroke();
      break;
    }
    case 'blackhole': {
      const R = o.R * PX;
      const rg = g.createRadialGradient(X, Y, 0, X, Y, R);
      rg.addColorStop(0, 'rgba(0,0,0,0.95)'); rg.addColorStop(0.18, 'rgba(10,0,30,0.9)'); rg.addColorStop(0.45, rgba(th.glow, 0.25)); rg.addColorStop(1, rgba(th.glow, 0));
      g.fillStyle = rg; g.beginPath(); g.arc(X, Y, R, 0, 7); g.fill();
      g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const rr = R * (0.3 + i * 0.13), a = -o.spin * (2.5 - i * 0.35) + i * 1.3;
        g.strokeStyle = rgba(i % 2 ? th.accent : '#ffffff', 0.55 - i * 0.08); g.lineWidth = (0.05 - i * 0.006) * PX;
        g.beginPath(); g.ellipse(X, Y, rr, rr * 0.55, 0.4, a, a + 2.4); g.stroke();
      }
      g.fillStyle = '#000'; g.beginPath(); g.arc(X, Y, 0.18 * PX, 0, 7); g.fill();
      g.strokeStyle = rgba(th.accent, 0.8); g.lineWidth = 0.03 * PX; g.beginPath(); g.arc(X, Y, 0.19 * PX, 0, 7); g.stroke();
      break;
    }
    case 'gate': {
      const x0 = wx(o.x - o.half), x1 = wx(o.x + o.half);
      for (const px of [x0, x1]) {
        g.fillStyle = '#2a2a38'; roundRect(px - 0.08 * PX, Y - 0.22 * PX, 0.16 * PX, 0.44 * PX, 0.05 * PX); g.fill();
        g.fillStyle = o.on ? '#5cf2ff' : o.warn ? '#ffd166' : '#40405a'; g.beginPath(); g.arc(px, Y - 0.1 * PX, 0.04 * PX, 0, 7); g.fill();
      }
      if (o.on) {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = rgba('#5cf2ff', 0.3); g.lineWidth = 0.24 * PX;
        g.beginPath(); g.moveTo(x0, Y); g.lineTo(x1, Y); g.stroke();
        g.strokeStyle = '#d8fbff'; g.lineWidth = 0.035 * PX; g.beginPath();
        const n = 10;
        for (let i = 0; i <= n; i++) g.lineTo(x0 + (x1 - x0) * i / n, Y + (i % n ? (Math.random() - 0.5) * 0.12 * PX : 0));
        g.stroke();
        g.globalCompositeOperation = 'source-over';
      } else if (o.warn && Math.floor(S.time * 14) % 2) {
        g.strokeStyle = rgba('#5cf2ff', 0.5); g.lineWidth = 0.02 * PX; g.setLineDash([0.08 * PX, 0.08 * PX]);
        g.beginPath(); g.moveTo(x0, Y); g.lineTo(x1, Y); g.stroke(); g.setLineDash([]);
      }
      break;
    }
    case 'cloud': {
      const w = o.w * PX, h = o.h * PX;
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + o.t * 0.4;
        const cx = X + Math.cos(a) * w * 0.55, cy = Y + Math.sin(a * 1.3) * h * 0.45, rr = (0.45 + (i % 3) * 0.12) * PX;
        g.fillStyle = rgba('#cbb8ff', 0.16); g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill();
      }
      g.fillStyle = rgba('#e8deff', 0.18); g.beginPath(); g.ellipse(X, Y, w * 0.95, h * 0.95, 0, 0, 7); g.fill();
      g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = 0.025 * PX; g.setLineDash([0.08 * PX, 0.08 * PX]);
      g.beginPath(); g.ellipse(X, Y, w, h, 0, 0, 7); g.stroke(); g.setLineDash([]);
      // "no drawing" mark
      g.save(); g.translate(X, Y); g.strokeStyle = rgba('#ffffff', 0.8); g.lineWidth = 0.045 * PX; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-0.16 * PX, 0.12 * PX); g.lineTo(0.12 * PX, -0.16 * PX); g.stroke();
      g.beginPath(); g.arc(0, 0, 0.24 * PX, 0, 7); g.moveTo(-0.17 * PX, -0.17 * PX); g.lineTo(0.17 * PX, 0.17 * PX); g.stroke();
      g.restore();
      break;
    }
    case 'drone': {
      g.save(); g.translate(X, Y);
      g.fillStyle = rgba('#ffffff', 0.25);
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.32 * PX, -0.26 * PX, (0.2 + Math.abs(Math.sin(S.time * 40)) * 0.05) * PX, 0.04 * PX, 0, 0, 7); g.fill(); }
      g.strokeStyle = '#2a2a3a'; g.lineWidth = 0.05 * PX;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.15 * PX, -0.08 * PX); g.lineTo(s * 0.32 * PX, -0.24 * PX); g.stroke(); }
      const lg = g.createLinearGradient(0, -0.25 * PX, 0, 0.25 * PX);
      lg.addColorStop(0, '#4b4f66'); lg.addColorStop(1, '#16161f');
      g.fillStyle = lg; g.beginPath(); g.ellipse(0, 0, 0.32 * PX, 0.22 * PX, 0, 0, 7); g.fill();
      g.strokeStyle = th.accent; g.lineWidth = 0.03 * PX; g.beginPath(); g.ellipse(0, 0.02 * PX, 0.32 * PX, 0.22 * PX, 0, 0.2, Math.PI - 0.2); g.stroke();
      const ex = Math.cos(o.aim) * 0.1 * PX, ey = -Math.sin(o.aim) * 0.07 * PX;
      const charge = o.timer < 0.5 ? 1 - o.timer / 0.5 : 0;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(glowSprite('#ff2244'), ex - (0.3 + charge * 0.3) * PX, ey - (0.3 + charge * 0.3) * PX, (0.6 + charge * 0.6) * PX, (0.6 + charge * 0.6) * PX);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#ff3355'; g.beginPath(); g.arc(ex, ey, 0.085 * PX, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex - 0.025 * PX, ey - 0.025 * PX, 0.025 * PX, 0, 7); g.fill();
      g.restore();
      break;
    }
    case 'powerup': drawPowerupBadge(o.kind, X, Y, 1 + Math.sin(o.t * 5) * 0.08, o.t); break;
    case 'star': {
      const s = 1 + Math.sin(o.t * 4) * 0.08, r = 0.26 * PX * s;
      g.globalCompositeOperation = 'lighter'; g.drawImage(glowSprite('#ffd21f'), X - r * 2, Y - r * 2, r * 4, r * 4); g.globalCompositeOperation = 'source-over';
      g.save(); g.translate(X, Y); g.rotate(Math.sin(o.t * 2) * 0.25);
      g.fillStyle = '#ffd21f'; g.strokeStyle = '#fff6c2'; g.lineWidth = 0.035 * PX; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
      g.restore();
      break;
    }
    case 'heart': {
      const s = 1 + Math.sin(o.t * 6) * 0.1, r = 0.24 * PX * s;
      g.globalCompositeOperation = 'lighter'; g.drawImage(glowSprite('#ff5f8a'), X - r * 2.2, Y - r * 2.2, r * 4.4, r * 4.4); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#ff3d6e';
      g.beginPath(); g.moveTo(X, Y + r * 0.9);
      g.bezierCurveTo(X - r * 1.4, Y - r * 0.1, X - r * 0.6, Y - r * 1.1, X, Y - r * 0.35);
      g.bezierCurveTo(X + r * 0.6, Y - r * 1.1, X + r * 1.4, Y - r * 0.1, X, Y + r * 0.9); g.fill();
      break;
    }
  }
}
function roundRect(x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Shows where the ball starts and where it will fall: a light beam from the top edge,
// a dotted drop line and bouncing arrows under the ball.
function drawDropIndicator(ball, X, Y, th, alpha, beamOn) {
  const r = ball.r * PX;
  g.save(); g.globalAlpha = alpha;
  if (beamOn) {
  const beam = g.createLinearGradient(0, 0, 0, Y + r);
  beam.addColorStop(0, rgba('#ffffff', 0.32)); beam.addColorStop(1, rgba(th.accent, 0.05));
  g.fillStyle = beam;
  g.beginPath(); g.moveTo(X - r * 0.5, 0); g.lineTo(X + r * 0.5, 0); g.lineTo(X + r * 1.5, Y + r); g.lineTo(X - r * 1.5, Y + r); g.closePath(); g.fill();
  }
  const pulse = 1 + Math.sin(S.time * 6) * 0.1;
  g.strokeStyle = rgba('#ffffff', 0.85); g.lineWidth = 0.05 * PX;
  g.beginPath(); g.arc(X, Y, r * 1.35 * pulse, 0, 7); g.stroke();
  // dotted drop line, dots flowing downward
  const step = 0.32 * PX, off = (S.time * 1.4 * PX) % step, len = 4.2 * PX;
  for (let d = r * 1.6 + off; d < len; d += step) {
    g.fillStyle = rgba('#ffffff', 0.55 * (1 - d / len));
    g.beginPath(); g.arc(X, Y + d, 0.045 * PX, 0, 7); g.fill();
  }
  // three chevrons lighting up in sequence
  g.lineWidth = 0.07 * PX; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const a = 0.25 + 0.75 * Math.max(0, Math.sin(S.time * 5 - i * 0.9));
    const cy = Y + r * 1.9 + i * 0.26 * PX + Math.sin(S.time * 5) * 0.04 * PX;
    g.strokeStyle = rgba(th.accent, a);
    g.beginPath(); g.moveTo(X - 0.17 * PX, cy); g.lineTo(X, cy + 0.13 * PX); g.lineTo(X + 0.17 * PX, cy); g.stroke();
  }
  g.restore();
}
// ---------- Drawn lines (with line skins) ----------
function lineGlow(th) {
  const skin = LINE_SKINS[save.lineSkin];
  if (skin.mode === 'zone') return S.rage ? '#ff7a00' : th.accent;
  return skin.glow;
}
function drawStrokes(cam, th) {
  const skin = LINE_SKINS[save.lineSkin], life = lineLife(), glow = lineGlow(th);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const bucketPath = (pts, bucket) => {
    g.beginPath(); let started = false;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a.dead || b.dead) { started = false; continue; }
      const bk = Math.min(3, Math.floor((S.time - b.t) / life * 4));
      if (bk !== bucket) { started = false; continue; }
      if (!started) { g.moveTo(wx(a.x), wy(a.y, cam)); started = true; }
      g.lineTo(wx(b.x), wy(b.y, cam));
    }
  };
  for (const st of S.strokes) {
    const pts = st.pts;
    // Soft glow, grouped by age so the line fades out from its tail
    for (let bucket = 0; bucket < 4; bucket++) {
      const fade = 1 - bucket * 0.22;
      bucketPath(pts, bucket);
      g.strokeStyle = rgba(glow, (skin.mode === 'rainbow' ? 0.18 : 0.28) * fade); g.lineWidth = 0.34 * PX * fade; g.stroke();
    }
    if (skin.mode === 'rainbow' || skin.mode === 'candy') {
      // Opaque per-segment colours (no visible overlap dots)
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (a.dead || b.dead) continue;
        const fade = 1 - Math.min(1, (S.time - b.t) / life) * 0.45;
        g.strokeStyle = skin.mode === 'rainbow' ? `hsl(${(i * 14 + S.time * 160) % 360},95%,65%)` : (Math.floor(i / 2) % 2 ? skin.glow : skin.core);
        g.lineWidth = 0.13 * PX * fade;
        g.beginPath(); g.moveTo(wx(a.x), wy(a.y, cam)); g.lineTo(wx(b.x), wy(b.y, cam)); g.stroke();
      }
    } else {
      for (let bucket = 0; bucket < 4; bucket++) {
        const fade = 1 - bucket * 0.22;
        bucketPath(pts, bucket);
        g.strokeStyle = skin.mode === 'zone' ? mixHex('#ffffff', glow, bucket * 0.25) : mixHex(skin.core, skin.glow, bucket * 0.2);
        g.lineWidth = 0.13 * PX * (0.7 + 0.3 * fade); g.stroke();
      }
    }
  }
  for (const st of S.strokes) if (st.pts.length === 1 && !st.pts[0].dead) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(wx(st.pts[0].x), wy(st.pts[0].y, cam), 0.08 * PX, 0, 7); g.fill();
  }
}

// ---------- Hoops (normal, golden, boss; scaled by h.k) ----------
function hoopColors(h) {
  if (h.golden) return { rim: '#ffd21f', net: '#fff2b8', glow: '#ffd21f' };
  const skin = BASKET_SKINS[save.basketSkin];
  return { rim: skin.rim, net: skin.net, glow: h.boss ? '#ff3d6e' : zoneOf(h.screen).accent };
}
function drawHoopBack(h, cam) {
  const c = hoopColors(h);
  g.save(); g.translate(wx(h.x), wy(h.y, cam)); g.rotate(-h.rot); g.scale(h.k, h.k);
  const pulse = 0.65 + 0.35 * Math.sin(S.time * 3);
  const gs = (2.6 + h.glowT * 1.5 + (h.golden || h.boss ? 0.8 : 0)) * PX;
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = (h.scored ? 0.25 : 0.45 * pulse) + h.glowT * 0.5 + (h.golden ? 0.2 : 0);
  g.drawImage(glowSprite(c.glow), -gs / 2, -gs / 2 - 0.2 * PX, gs, gs);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const jig = Math.sin(S.time * 60) * h.rimShake * 0.02 * PX;
  g.strokeStyle = shade(c.rim, -0.35); g.lineWidth = 0.1 * PX;
  g.beginPath(); g.ellipse(0, jig, RIM_X * PX, RIM_RY * PX, 0, Math.PI, Math.PI * 2); g.stroke();
  g.restore();
}
function drawHoopFront(h, cam) {
  const c = hoopColors(h);
  const { pts, links } = h.net;
  g.strokeStyle = c.net; g.lineWidth = 0.045 * PX * h.k; g.lineCap = 'round';
  g.beginPath();
  for (const [a, b] of links) { g.moveTo(wx(pts[a].x), wy(pts[a].y, cam)); g.lineTo(wx(pts[b].x), wy(pts[b].y, cam)); }
  g.stroke();
  g.save(); g.translate(wx(h.x), wy(h.y, cam)); g.rotate(-h.rot); g.scale(h.k, h.k);
  const jig = Math.sin(S.time * 60) * h.rimShake * 0.02 * PX;
  g.strokeStyle = c.rim; g.lineWidth = 0.13 * PX;
  g.beginPath(); g.ellipse(0, jig, RIM_X * PX, RIM_RY * PX, 0, 0, Math.PI); g.stroke();
  g.strokeStyle = shade(c.rim, 0.45); g.lineWidth = 0.035 * PX;
  g.beginPath(); g.ellipse(0, jig - 0.025 * PX, RIM_X * PX, RIM_RY * PX, 0, 0.35, Math.PI - 0.9); g.stroke();
  g.fillStyle = shade(c.rim, -0.2);
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * RIM_X * PX, jig, 0.075 * PX, 0, 7); g.fill(); }
  g.restore();
  // Labels above special hoops
  if ((h.golden || h.boss) && !h.scored) {
    const X = wx(h.x), Y = wy(h.y + 0.75 * h.k, cam) + Math.sin(S.time * 4) * 0.05 * PX;
    g.font = `${0.36 * PX}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 0.1 * PX; g.strokeStyle = 'rgba(0,0,0,.45)';
    const label = h.boss ? 'BOSS' : `×${GOLDEN_POINTS}`;
    g.strokeText(label, X, Y); g.fillStyle = h.boss ? '#ff6b8f' : '#ffd21f'; g.fillText(label, X, Y);
  }
}

// ---------- Power-up badge (also used for pickups in the world) ----------
function drawPowerupBadge(kind, X, Y, scale, t) {
  const def = POWERUPS[kind], r = 0.3 * PX * scale;
  g.globalCompositeOperation = 'lighter'; g.drawImage(glowSprite(def.color), X - r * 2.4, Y - r * 2.4, r * 4.8, r * 4.8); g.globalCompositeOperation = 'source-over';
  const gr = g.createRadialGradient(X - r * 0.3, Y - r * 0.3, r * 0.1, X, Y, r);
  gr.addColorStop(0, shade(def.color, 0.5)); gr.addColorStop(1, shade(def.color, -0.35));
  g.fillStyle = gr; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 0.04 * PX; g.beginPath(); g.arc(X, Y, r, 0, 7); g.stroke();
  g.save(); g.translate(X, Y); g.rotate(Math.sin(t * 2) * 0.15);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'long') {
    g.lineWidth = r * 0.2; g.beginPath(); g.moveTo(-r * 0.55, r * 0.25);
    g.bezierCurveTo(-r * 0.2, -r * 0.5, r * 0.2, r * 0.5, r * 0.55, -r * 0.25); g.stroke();
  } else if (kind === 'magnet') {
    g.lineWidth = r * 0.26; g.beginPath(); g.arc(0, -r * 0.05, r * 0.38, Math.PI, 0, true); g.stroke();
    g.fillStyle = '#ff3355'; g.fillRect(-r * 0.51, -r * 0.05, r * 0.26, r * 0.3); g.fillRect(r * 0.25, -r * 0.05, r * 0.26, r * 0.3);
  } else if (kind === 'shield') {
    g.beginPath(); g.moveTo(0, -r * 0.55); g.lineTo(r * 0.45, -r * 0.35); g.lineTo(r * 0.38, r * 0.15);
    g.quadraticCurveTo(r * 0.2, r * 0.45, 0, r * 0.58); g.quadraticCurveTo(-r * 0.2, r * 0.45, -r * 0.38, r * 0.15);
    g.lineTo(-r * 0.45, -r * 0.35); g.closePath(); g.fill();
  }
  g.restore();
}

// ---------- Balls ----------
function drawBall(ball, cam, th) {
  const X = wx(ball.x), Y = wy(ball.y, cam);
  if (!S.waitingRelease) {
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i], a = i / ball.trail.length;
      g.fillStyle = S.rage ? `rgba(255,140,40,${a * 0.25})` : rgba(th.accent, a * 0.16);
      g.beginPath(); g.arc(wx(t.x), wy(t.y, cam), ball.r * PX * (0.3 + a * 0.6), 0, 7); g.fill();
    }
  }
  g.globalCompositeOperation = 'lighter';
  const gs = (S.rage ? 2.6 : 1.6) * PX;
  g.globalAlpha = S.rage ? 0.6 : 0.25;
  g.drawImage(S.rage ? img.glow : glowSprite(th.accent), X - gs / 2, Y - gs / 2, gs, gs);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (S.mode === 'play') {
    if (S.waitingRelease) drawDropIndicator(ball, X, Y, th, 1, true);
    else if (ball.enter > 0) drawDropIndicator(ball, X, Y, th, Math.min(1, ball.enter / 0.4), false);
  }
  const sp = Math.hypot(ball.vx, ball.vy);
  const stretch = Math.min(0.12, sp * 0.01) - ball.squash;
  const dir = Math.atan2(-ball.vy, ball.vx);
  const bi = img[BALL_SKINS[save.ballSkin].img], bs = ball.r * 2.12 * PX;
  g.save(); g.translate(X, Y); g.rotate(dir); g.scale(1 + stretch, 1 - stretch * 0.8); g.rotate(-dir - ball.angle);
  g.drawImage(bi, -bs / 2, -bs / 2, bs, bs);
  g.restore();
  if (S.shield && S.mode === 'play') {
    const r = ball.r * PX * (1.45 + Math.sin(S.time * 5) * 0.05);
    g.strokeStyle = rgba(POWERUPS.shield.color, 0.8); g.lineWidth = 0.05 * PX;
    g.fillStyle = rgba(POWERUPS.shield.color, 0.12);
    g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill(); g.stroke();
  }
}
// Arrow at the top edge for a ball that is above the visible area (extra balls still in the previous screen)
function drawOffscreenMarkers(cam) {
  const topY = cam + VIEW_H / 2;
  for (const b of S.balls) {
    if (b.y - b.r < topY) continue;
    const X = wx(b.x), bob = Math.sin(S.time * 8) * 0.05 * PX, Y = 0.22 * PX + bob;
    g.fillStyle = rgba('#ffffff', 0.9);
    g.beginPath(); g.moveTo(X - 0.2 * PX, Y); g.lineTo(X + 0.2 * PX, Y); g.lineTo(X, Y + 0.22 * PX); g.closePath(); g.fill();
    g.drawImage(img[BALL_SKINS[save.ballSkin].img], X - 0.13 * PX, Y - 0.2 * PX, 0.26 * PX, 0.26 * PX);
  }
}
// Magnet power-up: pulsing rings rising from the target hoop
function drawMagnet(cam) {
  if (S.power.magnet <= 0 || S.mode !== 'play') return;
  const h = hoopFor(S.screen);
  if (!h) return;
  for (let i = 0; i < 3; i++) {
    const k = ((S.time * 0.9 + i / 3) % 1);
    g.strokeStyle = rgba(POWERUPS.magnet.color, 0.5 * (1 - k)); g.lineWidth = 0.04 * PX;
    g.beginPath(); g.ellipse(wx(h.x), wy(h.y + 0.3 + k * 2.2, cam), (0.5 + k * 0.9) * PX, (0.12 + k * 0.2) * PX, 0, 0, 7); g.stroke();
  }
}
// First game: a ghost hand shows how to draw a ramp into the hoop
function drawTutorial(cam) {
  if (!S.tutorial || !S.waitingRelease || S.mode !== 'play') return;
  const b = S.balls[0], h = hoopFor(S.screen);
  if (!b || !h) return;
  const dir = Math.sign(h.x - b.x) || 1;
  const ax = b.x - dir * 0.2, ay = b.y - 1.1, bx = h.x - dir * 0.75 * h.k, by = h.y + 0.85;
  const cyc = (S.time % 2.4) / 1.7, p = clamp(cyc, 0, 1);
  const cx = ax + (bx - ax) * p, cy = ay + (by - ay) * p;
  g.save();
  g.globalAlpha = cyc > 1.25 ? 0 : 0.85;
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.1 * PX; g.lineCap = 'round'; g.setLineDash([0.15 * PX, 0.15 * PX]);
  g.beginPath(); g.moveTo(wx(ax), wy(ay, cam)); g.lineTo(wx(cx), wy(cy, cam)); g.stroke(); g.setLineDash([]);
  // Hand: fingertip on the line, finger and palm below-right
  const X = wx(cx), Y = wy(cy, cam), u = PX;
  g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.03 * u;
  g.beginPath(); roundRectPath(X - 0.08 * u, Y - 0.04 * u, 0.16 * u, 0.42 * u, 0.08 * u); g.fill(); g.stroke();
  g.beginPath(); roundRectPath(X - 0.1 * u, Y + 0.24 * u, 0.42 * u, 0.36 * u, 0.13 * u); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(X, Y, (0.14 + Math.sin(S.time * 10) * 0.03) * u, 0, 7); g.fill();
  g.restore();
}
function roundRectPath(x, y, w, h, r) {
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

let lastPageBg = '';
function render() {
  const W = canvas.width, H = canvas.height;
  let cam = S.camY, shakeX = 0;
  if (S.shakeT > 0) {
    const damper = S.shakeT / SHAKE_DUR;
    shakeX = (Math.random() * 2 - 1) * S.shakeMag * damper * PX;
    cam += (Math.random() * 2 - 1) * S.shakeMag * damper;
  }
  const th = themeAtCamera(cam);
  const pageBg = `linear-gradient(180deg, ${shade(th.top, -0.55)}, ${shade(th.bot, -0.6)})`;
  if (pageBg !== lastPageBg) { document.body.style.background = pageBg; lastPageBg = pageBg; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(cam, W, H, th);
  g.setTransform(1, 0, 0, 1, shakeX, 0);

  const BEHIND = { wind: 1, blackhole: 1 };
  for (const o of S.obstacles) if (BEHIND[o.type]) drawObstacle(o, cam, th);
  drawMagnet(cam);
  for (const h of S.hoops) drawHoopBack(h, cam);
  drawStrokes(cam, th);
  for (const o of S.obstacles) if (!BEHIND[o.type]) drawObstacle(o, cam, th);
  for (const p of S.orbs) {
    const X = wx(p.x), Y = wy(p.y, cam);
    g.globalCompositeOperation = 'lighter'; g.drawImage(glowSprite('#ff2244'), X - p.r * 3 * PX, Y - p.r * 3 * PX, p.r * 6 * PX, p.r * 6 * PX); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#ffd0d8'; g.beginPath(); g.arc(X, Y, p.r * 0.7 * PX, 0, 7); g.fill();
  }
  for (const b of S.balls) drawBall(b, cam, th);
  for (const h of S.hoops) drawHoopFront(h, cam);
  drawTutorial(cam);

  for (const r of S.rings) {
    const k = r.t / 0.6;
    g.strokeStyle = rgba(r.color, 1 - k); g.lineWidth = 0.08 * PX * (1 - k);
    g.beginPath(); g.ellipse(wx(r.x), wy(r.y, cam), (0.9 + k * 1.8) * PX, (0.25 + k * 0.6) * PX, 0, 0, 7); g.stroke();
  }
  for (const p of S.particles) {
    const k = p.t / p.life, X = wx(p.x), Y = wy(p.y, cam);
    if (p.kind === 'fire') {
      g.globalAlpha = 1 - k; g.globalCompositeOperation = 'lighter';
      const fw = img.fire.width / 2, fx = (p.frame % 2) * fw, fy = ((p.frame / 2) | 0) * fw, s = p.size * (1 - k * 0.5) * PX;
      g.save(); g.translate(X, Y); g.rotate(p.rot); g.drawImage(img.fire, fx, fy, fw, fw, -s / 2, -s / 2, s, s); g.restore();
      g.globalCompositeOperation = 'source-over';
    } else if (p.kind === 'confetti') {
      g.globalAlpha = 1 - k; g.fillStyle = p.color;
      g.save(); g.translate(X, Y); g.rotate(p.rot + p.vr * p.t); g.fillRect(-p.size * PX, -p.size * 0.5 * PX, p.size * 2 * PX, p.size * PX); g.restore();
    } else if (p.kind === 'spark') {
      g.globalAlpha = 1 - k; g.globalCompositeOperation = 'lighter'; g.fillStyle = p.color;
      g.beginPath(); g.arc(X, Y, p.size * PX * (1 - k * 0.5), 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
    } else {
      g.globalAlpha = 1 - k; g.fillStyle = p.color;
      g.beginPath(); g.arc(X, Y, p.size * PX, 0, 7); g.fill();
    }
  }
  g.globalAlpha = 1;

  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (const t of S.texts) {
    const k = t.t;
    const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.5 : 1.1 - Math.min(0.1, (k - 0.12));
    g.globalAlpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
    g.font = `${(t.big ? 0.62 : 0.5) * pop * PX}px "Lilita One", sans-serif`;
    const x = Math.min(W - 1.7 * PX, Math.max(1.7 * PX, wx(t.x))), y = wy(t.y + k * 1.1, cam);
    g.lineWidth = 0.14 * PX; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(t.text, x, y);
    g.fillStyle = t.color; g.fillText(t.text, x, y);
  }
  g.globalAlpha = 1;
  drawOffscreenMarkers(cam);

  g.setTransform(1, 0, 0, 1, 0, 0);
  if (S.flash > 0) { g.fillStyle = rgba('#ffffff', S.flash * 0.35); g.fillRect(0, 0, W, H); }
  if (S.rage) {
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(255,60,0,0)'); vg.addColorStop(1, `rgba(255,60,0,${0.35 + Math.sin(S.time * 8) * 0.08})`);
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
}
