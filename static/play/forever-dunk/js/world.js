'use strict';
// ---------- State ----------
const S = {
  mode: 'menu', time: 0, slowT: 0,
  camY: 0, camFrom: 0, camTo: 0, camT: 1, shakeT: 0, shakeMag: SHAKE_MAG, flash: 0,
  screen: 0, balls: [], hoops: [], obstacles: [], orbs: [], strokes: [], particles: [], texts: [], rings: [],
  score: 0, lives: LIVES, distance: 0, startY: 0, baskets: 0,
  perfects: 0, perfectRow: 0, bestRow: 0, rage: false, rageTime: 0,
  combo: 0, coinsRun: 0, power: { long: 0, magnet: 0 }, shield: false,
  daily: false, dailyDate: '', tutorial: false,
  waitingRelease: true, respawnT: 0, overTimer: 0, zoneShown: 0,
  adActive: false, continued: false, sessionGames: 0, promo: false, rng: Math.random,
};
const pointers = new Map();
function screenCenter(n) { return -n * VIEW_H; }
// Level layout uses S.rng (seeded in the daily challenge); visual effects use frand
const rand = (a, b) => a + S.rng() * (b - a);
const chance = p => S.rng() < p;
const frand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
// In the daily challenge every screen is generated from the date, so everyone gets the same course
function withLevelRng(screen, fn) {
  if (!S.daily) return fn();
  const prev = S.rng;
  S.rng = mulberry32(hashStr(S.dailyDate + ':' + screen));
  try { return fn(); } finally { S.rng = prev; }
}
function lineLife() { return S.power.long > 0 ? LONG_LINE_LIFE : LINE_LIFE; }

function makeBall(x, y, screen) {
  return { x, y, vx: 0, vy: 0, r: BALL_R, angle: 0, spin: 0, squash: 0, trail: [],
    screen, belowTop: false, scoredScreen: -1, entered: false, prevLy: 99, touched: false, enter: 0, still: 0 };
}
const hoopFor = screen => S.hoops.find(h => h.screen === screen);

// ---------- Hoops ----------
function makeHoop(screen, avoidX, opts = {}) {
  const cy = screenCenter(screen);
  const boss = isBossScreen(screen);
  const golden = !opts.plain && !boss && screen >= UNLOCK.golden && chance(0.12);
  const k = opts.k || (screen < 2 ? 1.15 : golden ? 0.85 : 1);    // wider hoops for the first screens
  const limit = HALF_W - 1.05 * k;
  let x = 0;
  for (let i = 0; i < 40; i++) {
    x = rand(-limit, limit);
    if (avoidX === null || Math.abs(x - avoidX) >= 1.5) break;
  }
  if (opts.x !== undefined) x = opts.x;
  const y = opts.y !== undefined ? opts.y : cy + rand(-4.0, -2.7);
  let rot = 0;
  if (!opts.plain && screen >= UNLOCK.tilt && chance(boss ? 0.8 : Math.min(0.75, 0.25 + screen * 0.02))) {
    rot = (Math.PI / 180) * rand(6, 6 + Math.min(24, screen * 0.8)) * Math.sign(x || 1);
  }
  let amp = 0, speed = 0;
  if (!opts.plain && screen >= UNLOCK.moving && (boss || chance(Math.min(0.65, 0.2 + (screen - UNLOCK.moving) * 0.03)))) {
    amp = Math.min(1.4, 0.5 + screen * 0.02);
    if (amp > limit - Math.abs(x)) x = Math.sign(x || 1) * Math.max(0, limit - amp);
    speed = Math.min(2.2, 0.9 + screen * 0.03) * (golden ? 1.2 : 1);
  }
  const h = { screen, baseX: x, x, y, rot, amp, speed, phase: rand(0, 6.28), vx: 0, ax: 0, k, golden, boss,
    scored: false, glowT: 0, rimShake: 0 };
  h.net = buildNet(h);
  return h;
}
function updateHoopPose(h, t) {
  if (h.amp > 0) {
    const ph = h.phase + t * h.speed;
    h.x = h.baseX + Math.sin(ph) * h.amp;
    h.vx = Math.cos(ph) * h.amp * h.speed;
    h.ax = -Math.sin(ph) * h.amp * h.speed * h.speed;
  }
}
// Local hoop space is unscaled; h.k scales the whole hoop (rim, net, colliders, scoring)
function toLocal(h, x, y) {
  const dx = x - h.x, dy = y - h.y, c = Math.cos(-h.rot), s = Math.sin(-h.rot);
  return [(dx * c - dy * s) / h.k, (dx * s + dy * c) / h.k];
}
function toWorld(h, lx, ly) {
  const c = Math.cos(h.rot), s = Math.sin(h.rot);
  lx *= h.k; ly *= h.k;
  return [h.x + lx * c - ly * s, h.y + lx * s + ly * c];
}

// Visual net: knots on a springy grid pinned to the rim, pushed around by the balls
function buildNet(h) {
  const pts = [], links = [];
  for (let r = 0; r < NET_ROWS; r++) {
    const k = r / (NET_ROWS - 1);
    const hw = RIM_X + (NET_BOTTOM_HW - RIM_X) * k;
    for (let c = 0; c < NET_COLS; c++) {
      const lx = -hw + (2 * hw) * c / (NET_COLS - 1), ly = -NET_DEPTH * k;
      const [x, y] = toWorld(h, lx, ly);
      pts.push({ x, y, lx, ly, pin: r === 0, ox: 0, oy: 0, vx: 0, vy: 0 });
    }
  }
  const id = (r, c) => r * NET_COLS + c;
  for (let r = 0; r < NET_ROWS - 1; r++) {
    for (let c = 0; c < NET_COLS; c++) {
      if (c + 1 < NET_COLS) links.push([id(r, c), id(r + 1, c + 1)]);
      if (c - 1 >= 0) links.push([id(r, c), id(r + 1, c - 1)]);
      if (c === 0 || c === NET_COLS - 1) links.push([id(r, c), id(r + 1, c)]);
    }
  }
  return { pts, links };
}
function updateNet(h, dt) {
  for (const p of h.net.pts) {
    const [rx, ry] = toWorld(h, p.lx, p.ly);
    if (p.pin) { p.x = rx; p.y = ry; continue; }
    const depth = -p.ly / NET_DEPTH;
    p.vx += (-90 * p.ox - 9 * p.vx) * dt - h.ax * depth * 0.6 * dt;
    p.vy += (-90 * p.oy - 9 * p.vy) * dt;
    p.ox += p.vx * dt; p.oy += p.vy * dt;
    p.x = rx + p.ox; p.y = ry + p.oy;
    for (const ball of S.balls) {
      const dx = p.x - ball.x, dy = p.y - ball.y, d = Math.hypot(dx, dy), R = ball.r * 0.95;
      if (d < R && d > 1e-6) {
        const nx = ball.x + dx / d * R, ny = ball.y + dy / d * R;
        p.vx += (nx - p.x) / dt * 0.3; p.vy += (ny - p.y) / dt * 0.3;
        p.ox += nx - p.x; p.oy += ny - p.y; p.x = nx; p.y = ny;
      }
    }
  }
}

// ---------- Obstacles & pickups ----------
// Nothing here can destroy the ball: every obstacle only deflects, pushes or redirects it.
function placeOk(o, hoop, cy) {
  const top = cy + VIEW_H / 2;
  if (o.y > top - 1.6) return false;                                     // keep the spawn area clear
  if (o.y < hoop.y + 0.9) return false;                                  // nothing at or below the rim
  const ext = o.ext || 0.5;
  const hoopReach = (hoop.amp || 0) + 1.15 * hoop.k + ext;
  if (Math.abs(o.x - hoop.baseX) < hoopReach && o.y < hoop.y + 3.2) return false; // keep the shot open
  for (const p of S.obstacles) if (p.screen === o.screen && Math.hypot(p.x - o.x, p.y - o.y) < (p.ext || 0.5) + ext + 0.45) return false;
  return true;
}
function makeObstacle(type, screen, hoop, extra) {
  const cy = screenCenter(screen);
  const y = rand(cy - 1.8, cy + 3.0);
  const lim = HALF_W - 0.5;
  const towardHoop = x => Math.sign(hoop.baseX - x) || 1;
  switch (type) {
    case 'bumper': { const r = rand(0.32, 0.45); return { type, screen, x: rand(-lim + r, lim - r), y, r, ext: r, flash: 0 }; }
    case 'spinner': case 'cross': {
      const len = type === 'cross' ? rand(0.7, 0.85) : rand(0.75, 1.0);
      return { type, screen, x: rand(-lim + len, lim - len), y, len, ext: len, angle: rand(0, 3), omega: rand(1.4, 2.4) * (chance(0.5) ? 1 : -1), arms: type === 'cross' ? 2 : 1 };
    }
    case 'slider': { const w = rand(0.55, 0.75), amp = rand(0.6, 1.2); return { type, screen, cx: rand(-lim + w + amp, lim - w - amp), x: 0, y, w, amp, ext: w + amp, speed: rand(1.0, 1.8), phase: rand(0, 6), vx: 0 }; }
    case 'wind': { const dir = hoop.baseX > 0 ? 1 : -1; return { type, screen, x: 0, y: rand(cy - 0.6, cy + 1.6), h: 1.5, force: dir * rand(5, 8), ext: 0.2, wide: true }; }
    case 'drone': { const side = chance(0.5) ? -1 : 1; return { type, screen, side, x: side * (HALF_W - 0.55), y: rand(cy + 0.2, cy + 2.6), ext: 0.5, timer: 1.6, interval: Math.max(1.5, 2.8 - screen * 0.03), aim: 0, bob: rand(0, 6), recoil: 0 }; }
    case 'trampoline': { const x = rand(-lim + 0.6, lim - 0.6); return { type, screen, x, y, half: 0.55, ext: 0.6, angle: towardHoop(x) * rand(0.15, 0.5), boing: 0 }; }
    case 'conveyor': { const x = rand(-lim + 0.8, lim - 0.8); return { type, screen, x, y, half: rand(0.7, 0.9), ext: 0.9, angle: rand(-0.18, 0.18), speed: towardHoop(x) * rand(2.5, 3.5) * (chance(0.25) ? -1 : 1) }; }
    case 'portal': return { type, screen, x: rand(-lim, lim), y: rand(cy + 0.8, cy + 3.0), r: 0.36, ext: 0.45, hue: 0, cooldown: 0, hueT: 0 };
    case 'pendulum': { const len = rand(1.1, 1.4); return { type, screen, x: rand(-lim + 0.5, lim - 0.5), y: rand(cy + 1.2, cy + 3.2), len, bob: 0.3, ext: 1.1, amp: rand(0.7, 1.05), speed: rand(1.6, 2.2), phase: rand(0, 6), angle: 0, omega: 0 }; }
    case 'blackhole': return { type, screen, x: rand(-lim + 0.4, lim - 0.4), y, R: 1.5, ext: 1.1, spin: 0 };
    case 'gate': { const half = rand(0.6, 0.8); return { type, screen, x: rand(-lim + half, lim - half), y, half, ext: half + 0.1, cycle: rand(0, 2.8), on: true }; }
    case 'cloud': return { type, screen, x: rand(-lim + 0.9, lim - 0.9), y, w: 1.0, h: 0.65, ext: 1.0, t: 0 };
    case 'star': return { type, screen, x: rand(-lim, lim), y, ext: 0.3, pickup: true, t: rand(0, 6) };
    case 'heart': return { type, screen, x: rand(-lim, lim), y, ext: 0.3, pickup: true, t: rand(0, 6) };
    case 'powerup': return { type, screen, kind: extra, x: rand(-lim, lim), y, ext: 0.35, pickup: true, t: rand(0, 6) };
  }
  throw new Error('Unknown obstacle ' + type);
}
function populateScreen(screen, hoop) {
  if (screen < 1) return;
  const boss = isBossScreen(screen);
  const types = OBSTACLE_TYPES.filter(t => screen >= UNLOCK[t]);
  const fresh = types.find(t => UNLOCK[t] === screen);    // a newly unlocked type always shows up
  let count = boss ? 3 + (screen > 30 ? 1 : 0)
    : screen < UNLOCK.bumper ? 0 : screen < 10 ? (chance(0.7) ? 1 : 0) : screen < 22 ? 1 + (chance(0.4) ? 1 : 0) : 1 + (chance(0.7) ? 1 : 0) + (screen > 34 && chance(0.3) ? 1 : 0);
  const wanted = [];
  if (fresh) { wanted.push(fresh); count = Math.max(count, 1); }
  let guard = 0;
  while (wanted.length < count && types.length && guard++ < 50) {
    const weights = types.map(t => 1 + Math.max(0, 6 - (screen - UNLOCK[t]) / 3));
    let r = S.rng() * weights.reduce((a, b) => a + b, 0), pick = types[0];
    for (let i = 0; i < types.length; i++) { r -= weights[i]; if (r <= 0) { pick = types[i]; break; } }
    if ((pick === 'wind' || pick === 'portal') && wanted.includes(pick)) continue;
    wanted.push(pick);
  }
  const cy = screenCenter(screen);
  const tryPlace = (type, extra) => {
    for (let i = 0; i < 40; i++) {
      const o = makeObstacle(type, screen, hoop, extra);
      if (o.wide) {
        if (o.y > cy + VIEW_H / 2 - 1.6 || o.y < hoop.y + 1.3) continue;
        if (S.obstacles.some(p => p.screen === screen && Math.abs(p.y - o.y) < 1.0)) continue;
        S.obstacles.push(o); return o;
      }
      if (o.cx !== undefined) o.x = o.cx;
      if (placeOk(o, hoop, cy)) { S.obstacles.push(o); return o; }
    }
    return null;
  };
  for (const t of wanted) {
    const o = tryPlace(t);
    if (o && t === 'portal') {
      const exit = tryPlace('portal');
      if (exit) { o.link = exit; exit.link = o; exit.hue = 1; }
      else S.obstacles.splice(S.obstacles.indexOf(o), 1);
    }
  }
  if (screen >= UNLOCK.star && chance(0.45)) tryPlace('star');
  if (screen >= UNLOCK.heart && S.lives < LIVES && chance(0.09)) tryPlace('heart');
  if (screen >= UNLOCK.powerup && chance(boss ? 0.6 : 0.24)) {
    const kinds = ['long', 'magnet'];
    if (!S.shield) kinds.push('shield');
    tryPlace('powerup', kinds[Math.floor(S.rng() * kinds.length)]);
  }
}

// ---------- Physics helpers ----------
function collidePoint(ball, px, py, th, e, mu, svx, svy) {
  let dx = ball.x - px, dy = ball.y - py;
  const R = ball.r + th, d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return 0;
  let d = Math.sqrt(d2);
  if (d < 1e-6) { dx = 0; dy = 1; d = 1; }
  const nx = dx / d, ny = dy / d;
  ball.x = px + nx * R; ball.y = py + ny * R;
  const rvx = ball.vx - svx, rvy = ball.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0.001;
  const tx = -ny, ty = nx;
  const vt = rvx * tx + rvy * ty;
  const ee = -vn < 0.6 ? 0 : e; // no micro-bounces, so the ball rolls along lines
  const vnAfter = -vn * ee;
  const loss = Math.min(Math.abs(vt), mu * (-vn) * 0.35);
  const vtAfter = vt - Math.sign(vt) * loss;
  ball.vx = svx + nx * vnAfter + tx * vtAfter;
  ball.vy = svy + ny * vnAfter + ty * vtAfter;
  ball.spin = -vtAfter / ball.r;
  if (-vn > 2) ball.squash = Math.min(0.22, -vn * 0.025);
  return -vn;
}
function closestOnSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay, l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [ax + abx * t, ay + aby * t];
}
function collideSegment(ball, ax, ay, bx, by, th, e, mu, svx = 0, svy = 0) {
  const [cx, cy] = closestOnSeg(ball.x, ball.y, ax, ay, bx, by);
  return collidePoint(ball, cx, cy, th, e, mu, svx, svy);
}
function segDist(px, py, ax, ay, bx, by) {
  const [cx, cy] = closestOnSeg(px, py, ax, ay, bx, by);
  return Math.hypot(cx - px, cy - py);
}
function forEachLineSeg(fn) {
  for (const st of S.strokes) {
    const pts = st.pts;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i - 1].dead || pts[i].dead) continue;
      if (fn(pts[i - 1], pts[i], st, i) === false) return;
    }
  }
}
function armEnds(o, k) {
  const a = o.angle + k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
  return [o.x - c * o.len, o.y - s * o.len, o.x + c * o.len, o.y + s * o.len];
}
function padEnds(o) {
  const c = Math.cos(o.angle), s = Math.sin(o.angle);
  return [o.x - c * o.half, o.y - s * o.half, o.x + c * o.half, o.y + s * o.half];
}
function pendulumBob(o) { return [o.x + Math.sin(o.angle) * o.len, o.y - Math.cos(o.angle) * o.len]; }

function nearestBall(x, y) {
  let best = null, bd = Infinity;
  for (const b of S.balls) { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
  return best;
}

function obstacleFrame(o, dt) {
  switch (o.type) {
    case 'spinner': case 'cross': o.angle += o.omega * dt; break;
    case 'slider': { const ph = o.phase + S.time * o.speed; o.x = o.cx + Math.sin(ph) * o.amp; o.vx = Math.cos(ph) * o.amp * o.speed; break; }
    case 'bumper': o.flash = Math.max(0, o.flash - dt * 4); break;
    case 'trampoline': o.boing = Math.max(0, o.boing - dt * 3); break;
    case 'portal': o.hueT += dt; o.cooldown = Math.max(0, o.cooldown - dt); break;
    case 'blackhole': o.spin += dt; break;
    case 'cloud': o.t += dt; break;
    case 'pendulum': { const ph = o.phase + S.time * o.speed; o.angle = Math.sin(ph) * o.amp; o.omega = Math.cos(ph) * o.amp * o.speed; break; }
    case 'gate': o.cycle = (o.cycle + dt) % 2.8; o.on = o.cycle < 1.6; o.warn = o.cycle > 2.4; break;
    case 'drone': {
      o.bob += dt; o.y = (o.baseY || (o.baseY = o.y)) + Math.sin(o.bob * 2) * 0.12;
      o.recoil = Math.max(0, o.recoil - dt * 4);
      const ball = nearestBall(o.x, o.y);
      if (ball && o.screen === S.screen) {
        const want = Math.atan2(ball.y - o.y, ball.x - o.x);
        let diff = want - o.aim; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
        o.aim += diff * Math.min(1, dt * 5);
        if (!S.waitingRelease && S.mode === 'play') {
          o.timer -= dt;
          if (o.timer <= 0) {
            o.timer = o.interval;
            const sp = 4.2 + Math.min(2, S.screen * 0.03);
            const mx = o.x + Math.cos(o.aim) * 0.45, my = o.y + Math.sin(o.aim) * 0.45;
            S.orbs.push({ x: mx, y: my, vx: Math.cos(o.aim) * sp, vy: Math.sin(o.aim) * sp, r: 0.17, life: 5 });
            o.recoil = 1; sfx.shoot();
          }
        }
      }
      break;
    }
    case 'star': case 'heart': case 'powerup': o.t += dt; break;
  }
  // The fog cloud erases any line drawn through it
  if (o.type === 'cloud') {
    for (const st of S.strokes) for (const p of st.pts) {
      if (!p.dead && Math.abs(p.x - o.x) < o.w && Math.abs(p.y - o.y) < o.h) { p.dead = true; if (Math.random() < 0.3) sparks(p.x, p.y, '#d9c8ff', 1); }
    }
  }
}

function obstacleCollide(o, ball, dt) {
  switch (o.type) {
    case 'bumper': {
      const dx = ball.x - o.x, dy = ball.y - o.y, d = Math.hypot(dx, dy), R = ball.r + o.r;
      if (d < R) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        ball.x = o.x + nx * R; ball.y = o.y + ny * R;
        const vn = ball.vx * nx + ball.vy * ny;
        const out = Math.max(6.5, Math.abs(vn) * 1.1);
        ball.vx += nx * (out - vn); ball.vy += ny * (out - vn);
        ball.squash = 0.22;
        if (o.flash < 0.5) { sfx.boing(); sparks(o.x + nx * o.r, o.y + ny * o.r, zoneOf(o.screen).accent, 8); missionEvent('bumper', 1); }
        o.flash = 1;
      }
      break;
    }
    case 'spinner': case 'cross':
      for (let k = 0; k < o.arms; k++) {
        const [ax, ay, bx, by] = armEnds(o, k);
        const [cx, cy] = closestOnSeg(ball.x, ball.y, ax, ay, bx, by);
        const rx = cx - o.x, ry = cy - o.y;
        if (collidePoint(ball, cx, cy, 0.1, 0.6, 0.5, -o.omega * ry, o.omega * rx) > 1.5) sfx.bounce(2);
      }
      break;
    case 'slider':
      collideSegment(ball, o.x - o.w, o.y, o.x + o.w, o.y, 0.14, 0.5, 0.6, o.vx, 0);
      break;
    case 'conveyor': {
      const [ax, ay, bx, by] = padEnds(o);
      collideSegment(ball, ax, ay, bx, by, 0.13, 0.3, 0.9, Math.cos(o.angle) * o.speed, Math.sin(o.angle) * o.speed);
      break;
    }
    case 'trampoline': {
      const [ax, ay, bx, by] = padEnds(o);
      const [cx, cy] = closestOnSeg(ball.x, ball.y, ax, ay, bx, by);
      const dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy), R = ball.r + 0.08;
      if (d < R) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        ball.x = cx + nx * R; ball.y = cy + ny * R;
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
          const out = Math.max(8.5, -vn * 1.15);
          ball.vx += nx * (out - vn); ball.vy += ny * (out - vn);
          ball.squash = 0.25; o.boing = 1; sfx.boing(); missionEvent('trampoline', 1);
        }
      }
      break;
    }
    case 'wind':
      if (Math.abs(ball.y - o.y) < o.h / 2) ball.vx += o.force * dt;
      break;
    case 'portal': {
      if (!o.link || o.cooldown > 0) break;
      if (Math.hypot(ball.x - o.x, ball.y - o.y) < o.r * 0.8) {
        const to = o.link;
        sparks(o.x, o.y, '#ff9a3d', 14);
        ball.x = to.x; ball.y = to.y; ball.trail.length = 0;
        o.cooldown = to.cooldown = 0.7;
        sparks(to.x, to.y, '#3dc8ff', 14); sfx.portal(); missionEvent('portal', 1);
      }
      break;
    }
    case 'pendulum': {
      const [bx, by] = pendulumBob(o);
      collideSegment(ball, o.x, o.y, bx, by, 0.04, 0.5, 0.3);
      const rx = bx - o.x, ry = by - o.y;
      if (collidePoint(ball, bx, by, o.bob, 0.8, 0.2, -o.omega * ry, o.omega * rx) > 1.5) sfx.clunk();
      break;
    }
    case 'blackhole': {
      const dx = o.x - ball.x, dy = o.y - ball.y, d = Math.hypot(dx, dy);
      if (d < o.R && d > 0.05) { const pull = 11 * (1 - d / o.R); ball.vx += dx / d * pull * dt; ball.vy += dy / d * pull * dt; }
      break;
    }
    case 'gate':
      if (o.on) collideSegment(ball, o.x - o.half, o.y, o.x + o.half, o.y, 0.07, 0.65, 0.3);
      break;
    case 'drone':
      collidePoint(ball, o.x, o.y, 0.3, 0.6, 0.3, 0, 0);
      break;
    case 'star': case 'heart': case 'powerup':
      if (!o.taken && Math.hypot(ball.x - o.x, ball.y - o.y) < ball.r + 0.32) { o.taken = true; collectPickup(o, ball); }
      break;
  }
}

function collectPickup(o, ball) {
  if (o.type === 'star') {
    addScore(1); addCoins(3); save.total.stars++; missionEvent('stars', 1);
    sfx.star(); popText(o.x, o.y, '+1', '#ffe066'); sparks(o.x, o.y, '#ffe066', 14);
  } else if (o.type === 'heart') {
    S.lives = Math.min(LIVES, S.lives + 1); renderLives(); sfx.heart();
    popText(o.x, o.y, '+1 LIFE', '#ff5f8a'); sparks(o.x, o.y, '#ff5f8a', 14);
  } else applyPowerup(o.kind, ball, o.x, o.y);
}
function applyPowerup(kind, ball, x, y) {
  const def = POWERUPS[kind];
  sfx.powerup(); vibrate(30);
  popText(x, y, def.label, def.color, true); sparks(x, y, def.color, 18);
  missionEvent('powerups', 1);
  if (kind === 'shield') S.shield = true;
  else S.power[kind] = def.dur;
  renderPowers();
}

// ---------- Physics step ----------
function physicsStep(dt) {
  for (const h of S.hoops) updateHoopPose(h, S.time);
  for (const p of S.orbs) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    forEachLineSeg((a, b) => {
      if (segDist(p.x, p.y, a.x, a.y, b.x, b.y) < p.r + LINE_TH) { p.life = 0; sparks(p.x, p.y, '#ff4d6d', 8); sfx.zap(); return false; }
    });
    if (Math.abs(p.x) > HALF_W + 1) p.life = 0;
  }
  if (S.waitingRelease) return;
  for (const ball of S.balls) stepBall(ball, dt);
}

function stepBall(ball, dt) {
  ball.vy -= GRAVITY * dt;
  const damp = 1 / (1 + DRAG * dt);
  ball.vx *= damp; ball.vy *= damp;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  ball.angle += ball.spin * dt;

  let impact = 0;
  if (ball.x < -HALF_W + ball.r) { ball.x = -HALF_W + ball.r; if (ball.vx < 0) { impact = Math.max(impact, -ball.vx); ball.vx *= -0.7; } }
  if (ball.x > HALF_W - ball.r) { ball.x = HALF_W - ball.r; if (ball.vx > 0) { impact = Math.max(impact, ball.vx); ball.vx *= -0.7; } }
  // Ceiling of the ball's own screen, once it is inside it
  const top = screenCenter(ball.screen) + VIEW_H / 2;
  if (ball.belowTop || ball.y < top - ball.r * 2.2) {
    ball.belowTop = true;
    if (ball.y > top - ball.r) { ball.y = top - ball.r; if (ball.vy > 0) ball.vy *= -0.5; }
  }

  forEachLineSeg((a, b) => { impact = Math.max(impact, collideSegment(ball, a.x, a.y, b.x, b.y, LINE_TH, 0.55, 0.8)); });
  for (const st of S.strokes) if (st.pts.length === 1 && !st.pts[0].dead) impact = Math.max(impact, collidePoint(ball, st.pts[0].x, st.pts[0].y, LINE_TH, 0.55, 0.8, 0, 0));

  for (const o of S.obstacles) { if (Math.abs(o.y - ball.y) <= 2.5) obstacleCollide(o, ball, dt); }

  // Balls bump into each other
  for (const other of S.balls) {
    if (other === ball) continue;
    const dx = ball.x - other.x, dy = ball.y - other.y, d = Math.hypot(dx, dy), R = ball.r + other.r;
    if (d < R && d > 1e-6) {
      const nx = dx / d, ny = dy / d, push = (R - d) / 2;
      ball.x += nx * push; ball.y += ny * push; other.x -= nx * push; other.y -= ny * push;
      const rel = (ball.vx - other.vx) * nx + (ball.vy - other.vy) * ny;
      if (rel < 0) { ball.vx -= rel * nx * 0.9; ball.vy -= rel * ny * 0.9; other.vx += rel * nx * 0.9; other.vy += rel * ny * 0.9; }
    }
  }

  for (const h of S.hoops) {
    if (Math.abs(h.y - ball.y) > 3) continue;
    for (const sgn of [-1, 1]) {
      const [rx, ry] = toWorld(h, sgn * RIM_X, 0);
      const hit = collidePoint(ball, rx, ry, RIM_R * h.k, 0.6, 0.4, h.vx, 0);
      if (hit > 0) {
        if (h.screen === ball.screen && ball.scoredScreen !== ball.screen) ball.touched = true;
        if (hit > 0.8) { sfx.rim(hit); h.rimShake = 1; }
      }
      for (let i = 1; i < NET_COLLIDE.length; i++) {
        const [ax, ay] = toWorld(h, sgn * NET_COLLIDE[i - 1][0], NET_COLLIDE[i - 1][1]);
        const [bx, by] = toWorld(h, sgn * NET_COLLIDE[i][0], NET_COLLIDE[i][1]);
        collideSegment(ball, ax, ay, bx, by, 0.02, 0.15, 0.3, h.vx, 0);
      }
    }
  }

  // Scoring through the hoop of the ball's own screen (Unity: PointScorer + FalsePointPreventer)
  const h = hoopFor(ball.screen);
  if (h && ball.scoredScreen !== ball.screen && S.mode === 'play') {
    // Magnet power-up: gently steer balls above the hoop toward it
    if (S.power.magnet > 0 && ball.y > h.y + 0.2) ball.vx += clamp((h.x - ball.x) * 7 - ball.vx * 1.5, -12, 12) * dt;
    const [lx, ly] = toLocal(h, ball.x, ball.y);
    if (ball.prevLy > 0 && ly <= 0 && Math.abs(lx) < RIM_X - 0.05) ball.entered = true;
    if (ball.entered && ly > 0.25) ball.entered = false;
    if (ball.entered && ly < -0.45) ballScored(ball, h);
    ball.prevLy = ly;
  }

  for (const p of S.orbs) {
    if (p.life <= 0) continue;
    if (Math.hypot(ball.x - p.x, ball.y - p.y) < ball.r + p.r) {
      collidePoint(ball, p.x, p.y, p.r, 0.9, 0, p.vx * 0.8, p.vy * 0.8);
      p.life = 0; sparks(p.x, p.y, '#ff4d6d', 10); sfx.zap(); shake(0.12);
    }
  }
  if (impact > 1.2) sfx.bounce(impact);
}

// ---------- Scoring ----------
function ballScored(ball, h) {
  ball.scoredScreen = ball.screen; ball.entered = false;
  const perfect = !ball.touched;
  if (!h.scored) { h.scored = true; hoopCleared(h, perfect); return; }
  // Extra balls through the same hoop: a small bonus, and they carry on to the next screen
  const pts = comboMult(S.combo) * (S.rage ? 2 : 1);
  addScore(pts); addCoins(1);
  popText(h.x, h.y + 0.6, '+' + pts, '#ffffff'); sfx.swish(); h.glowT = 1;
  burst(h.x, h.y - 0.3, 10, ['#ffffff', zoneOf(h.screen).accent]);
}
function hoopCleared(h, perfect) {
  h.glowT = 1;
  const z = zoneOf(h.screen);
  const prevMult = comboMult(S.combo);
  S.combo++; S.baskets++;
  const mult = comboMult(S.combo);
  let base = h.golden ? GOLDEN_POINTS : perfect ? PERFECT_POINT : POINT;
  if (perfect) {
    S.perfects++; S.perfectRow++; S.bestRow = Math.max(S.bestRow, S.perfectRow);
    if (!S.rage && S.perfectRow >= PERFECTS_FOR_RAGE) startRage();
    S.slowT = 0.22;
  } else {
    S.perfectRow = 0;
    if (S.rage) stopRage();
  }
  const pts = base * mult * (S.rage ? 2 : 1);
  addScore(pts);
  addCoins(1 + (perfect ? 1 : 0) + (h.golden ? 5 : 0));
  renderStreak(); renderCombo();
  const label = '+' + pts + (h.golden ? ' GOLDEN!' : perfect ? ' PERFECT!' : '');
  const [tx, ty] = toWorld(h, 0, 0.7);
  popText(tx, ty, label, h.golden ? '#ffd21f' : perfect ? z.accent : '#ffffff', perfect || h.golden);
  S.rings.push({ x: h.x, y: h.y, t: 0, color: h.golden ? '#ffd21f' : perfect ? z.accent : '#ffffff' });
  burst(h.x, h.y - 0.3, perfect ? 30 : 14, h.golden ? ['#ffd21f', '#fff2b8', '#ffffff'] : perfect ? [z.accent, z.glow, '#ffffff'] : ['#ffffff', z.accent]);
  if (perfect) { sfx.perfect(); S.flash = 0.35; shake(0.18); vibrate(40); if (Math.random() < BRAVO_CHANCE) showBravo(); }
  else { sfx.swish(); vibrate(15); }
  if (mult > prevMult) popText(h.x, h.y + 1.4, 'COMBO x' + mult, '#ff9f1c', true);
  if (h.boss) {
    addScore(BOSS_POINTS); addCoins(BOSS_COINS);
    showBanner('BOSS CLEARED', `+${BOSS_POINTS} points · +${BOSS_COINS} coins`, '#ffd21f');
    burst(h.x, h.y, 40, ['#ffd21f', '#ff5a1f', '#ffffff', z.accent]);
  }
  if (S.tutorial) { S.tutorial = false; save.tutorialDone = true; writeSave(); }
  missionEvent('baskets', S.baskets, 'max');
  missionEvent('perfects', S.perfects, 'max');
  missionEvent('streak', S.perfectRow, 'max');
  missionEvent('combo', mult, 'max');
  if (h.golden) missionEvent('golden', 1);
  if (h.screen === S.screen) advanceScreen(h);
  renderDaily();
}
function advanceScreen(h) {
  S.screen++;
  const next = withLevelRng(S.screen, () => { const nh = makeHoop(S.screen, h.x); S.hoops.push(nh); populateScreen(S.screen, nh); return nh; });
  S.camFrom = S.camY; S.camTo = screenCenter(S.screen); S.camT = 0;
  const z = zoneIndex(S.screen);
  if (isBossScreen(S.screen)) { showBanner('BOSS ROUND', 'Clear it for a big bonus', '#ff3d6e'); sfx.boss(); }
  else if (z !== S.zoneShown) { S.zoneShown = z; showZone(z); }
  missionEvent('screen', S.screen, 'max');
  void next;
}

// ---------- Balls coming and going ----------
function spawnBall() {
  const cy = screenCenter(S.screen);
  const h = hoopFor(S.screen);
  const x = withLevelRng(S.screen * 31 + 7, () => {
    let v = 0;
    for (let i = 0; i < 40; i++) { v = rand(-(HALF_W - 1.6), HALF_W - 1.6); if (!h || Math.abs(v - h.baseX) > 1.4) break; }
    return v;
  });
  const b = makeBall(x, cy + VIEW_H / 2 - BALL_R - 0.12, S.screen);
  if (h && h.scored) b.scoredScreen = -1;
  S.balls = [b];
  S.waitingRelease = true;
  updateHint();
}
function loseBall(b) {
  S.balls.splice(S.balls.indexOf(b), 1);
  if (S.balls.length) {
    sfx.lost(); sparks(b.x, Math.max(b.y, screenCenter(S.screen) - VIEW_H / 2 + 0.3), '#ffffff', 10);
    popText(b.x, screenCenter(S.screen) - VIEW_H / 2 + 0.8, 'BALL LOST', '#c9c2e8');
    return;
  }
  onFail();
}
function onFail() {
  pointers.clear();
  if (S.shield) {
    S.shield = false; renderPowers();
    sfx.powerup(); popText(0, screenCenter(S.screen), 'SHIELD SAVED YOU', POWERUPS.shield.color, true);
    S.respawnT = 0.35; return;
  }
  sfx.fail(); shake(SHAKE_MAG); vibrate(90);
  S.lives--;
  S.perfectRow = 0; S.combo = 0; renderStreak(); renderCombo();
  if (S.rage) stopRage();
  renderLives();
  if (S.lives <= 0) { S.overTimer = 0.9; return; }
  S.respawnT = 0.35;
}

function addScore(pts) {
  S.score += pts;
  hudScore.textContent = S.score;
  hudScore.classList.remove('bump'); void hudScore.offsetWidth; hudScore.classList.add('bump');
}
function addCoins(n) { S.coinsRun += n; }
function shake(m) { S.shakeT = SHAKE_DUR; S.shakeMag = m; }
function startRage() { S.rage = true; sfx.rage(); shake(0.25); rageBadge.classList.remove('hidden'); Platform.happy(); }
function stopRage() { S.rage = false; rageBadge.classList.add('hidden'); }

// ---------- Update ----------
function update(realDt) {
  if (S.slowT > 0) S.slowT -= realDt;
  const dt = S.slowT > 0 ? realDt * 0.35 : realDt;
  S.time += dt;

  if (S.camT < 1) {
    S.camT = Math.min(1, S.camT + realDt / SCREEN_ANIM);
    const k = S.camT, e = k * k * (3 - 2 * k);
    S.camY = S.camFrom + (S.camTo - S.camFrom) * e;
  }
  if (S.shakeT > 0) S.shakeT -= realDt;
  S.flash = Math.max(0, S.flash - realDt * 2);

  const life = lineLife();
  for (const st of S.strokes) while (st.pts.length && S.time - st.pts[0].t > life) st.pts.shift();
  S.strokes = S.strokes.filter(st => st.pts.length > 0 || st.active);
  lineSparkles();

  for (const o of S.obstacles) if (o.screen >= S.screen - 1) obstacleFrame(o, dt);

  if (S.mode === 'play') {
    const before = { long: S.power.long > 0, magnet: S.power.magnet > 0 };
    if (!S.waitingRelease) { S.power.long = Math.max(0, S.power.long - dt); S.power.magnet = Math.max(0, S.power.magnet - dt); }
    if (before.long !== (S.power.long > 0) || before.magnet !== (S.power.magnet > 0)) renderPowers();

    const steps = Math.max(1, Math.ceil(dt / 0.002));
    const hdt = dt / steps;
    for (let i = 0; i < steps && S.balls.length; i++) {
      physicsStep(hdt);
      for (const b of [...S.balls]) {
        if (b.y < screenCenter(b.screen) - VIEW_H / 2 - b.r - 0.2) {
          if (b.scoredScreen === b.screen) {
            // Went through its hoop: carries on into the next screen
            Object.assign(b, { screen: b.screen + 1, belowTop: false, touched: false, entered: false, prevLy: 99, enter: ENTER_HINT });
          } else loseBall(b);
        } else if (b.screen < S.screen - 1) loseBall(b);
      }
    }
    S.orbs = S.orbs.filter(p => p.life > 0);

    for (const b of S.balls) {
      if (!S.waitingRelease) {
        const m = Math.max(0, (S.startY - b.y) / VIEW_H * METERS_PER_SCREEN);
        if (m > S.distance) S.distance = m;
        b.still = Math.hypot(b.vx, b.vy) < 0.15 ? b.still + dt : 0;
        if (b.still > 1.2) { b.vx += (Math.random() < 0.5 ? -1 : 1) * 1.2; b.vy += 1.5; b.still = 0; }
        if (S.rage) fireParticles(b);
      }
      b.enter = Math.max(0, b.enter - realDt);
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 12) b.trail.shift();
      b.squash = Math.max(0, b.squash - dt * 2.5);
    }
    if (S.rage && !S.waitingRelease) S.rageTime += dt;
    if (!S.balls.length && S.respawnT > 0) { S.respawnT -= realDt; if (S.respawnT <= 0) spawnBall(); }
    S.hoops = S.hoops.filter(k => k.screen >= S.screen - 1);
    S.obstacles = S.obstacles.filter(o => o.screen >= S.screen - 1 && !(o.pickup && o.taken));
    if (S.overTimer > 0) { S.overTimer -= realDt; if (S.overTimer <= 0) offerContinueOrFinish(); }
  } else if (S.mode === 'menu') {
    menuDemo(dt);
  }

  for (const h of S.hoops) { updateNet(h, dt); h.glowT = Math.max(0, h.glowT - dt * 1.5); h.rimShake = Math.max(0, h.rimShake - dt * 5); }
  for (const p of S.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= (p.g || 0) * dt; }
  S.particles = S.particles.filter(p => p.t < p.life);
  for (const t of S.texts) t.t += dt;
  S.texts = S.texts.filter(t => t.t < 1);
  for (const r of S.rings) r.t += dt;
  S.rings = S.rings.filter(r => r.t < 0.6);
}

// Menu: balls keep dunking through a swaying hoop, with a celebration on every swish
const MENU_HOOP_Y = 0.15;
function menuDemo(dt) {
  const h = S.hoops[0];
  if (!h) return;
  updateHoopPose(h, S.time);
  let b = S.balls[0];
  if (!b || b.y < -VIEW_H / 2 - 1) {
    b = makeBall(h.x + h.vx * 0.55 + frand(-0.08, 0.08), VIEW_H / 2 + 0.8, 0);
    b.spin = frand(-3, 3); b.belowTop = true;
    S.balls = [b]; S.waitingRelease = false; S.menuScored = false;
  }
  const steps = Math.ceil(dt / 0.003), hdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    b.vy -= GRAVITY * hdt; b.vy *= 1 / (1 + DRAG * hdt); b.vx *= 1 / (1 + DRAG * hdt);
    b.x += b.vx * hdt; b.y += b.vy * hdt; b.angle += b.spin * hdt;
    for (const sgn of [-1, 1]) { const [rx, ry] = toWorld(h, sgn * RIM_X, 0); collidePoint(b, rx, ry, RIM_R, 0.5, 0.4, h.vx, 0); }
  }
  if (!S.menuScored && b.y < h.y - 0.45 && Math.abs(b.x - h.x) < RIM_X) {
    S.menuScored = true; h.glowT = 1;
    const th = themeAtCamera(0);
    burst(h.x, h.y - 0.2, 22, [th.accent, th.glow, '#ffffff']);
    S.rings.push({ x: h.x, y: h.y, t: 0, color: th.accent });
  }
  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > 12) b.trail.shift();
}

// ---------- Effects ----------
function popText(x, y, text, color, big) { S.texts.push({ x, y, t: 0, text, color, big: !!big }); }
function burst(x, y, n, colors) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = frand(1.5, 5);
    S.particles.push({ kind: Math.random() < 0.5 ? 'confetti' : 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 2.5, g: 9, t: 0, life: frand(0.6, 1.1),
      size: frand(0.05, 0.11), color: colors[i % colors.length], rot: frand(0, 6), vr: frand(-12, 12) });
  }
}
function sparks(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = frand(1, 4);
    S.particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 3, t: 0, life: frand(0.2, 0.45), size: frand(0.03, 0.06), color });
  }
}
function fireParticles(ball) {
  for (let i = 0; i < 2; i++) {
    S.particles.push({ kind: 'fire', x: ball.x + frand(-0.2, 0.2), y: ball.y + frand(-0.2, 0.2),
      vx: frand(-0.3, 0.3) - ball.vx * 0.15, vy: 1.2 + Math.random() - ball.vy * 0.15, t: 0, life: frand(0.35, 0.6),
      size: frand(0.25, 0.45), frame: (Math.random() * 4) | 0, rot: frand(0, 6) });
  }
}
// Line skins with sparkle (Fire, Ice, Gold, Galaxy) shed little particles
function lineSparkles() {
  const skin = LINE_SKINS[save.lineSkin];
  if (!skin.sparkle || !S.strokes.length || Math.random() > 0.35) return;
  const st = S.strokes[(Math.random() * S.strokes.length) | 0];
  const live = st.pts.filter(p => !p.dead);
  if (!live.length) return;
  const p = live[(Math.random() * live.length) | 0];
  S.particles.push({ kind: 'spark', x: p.x, y: p.y, vx: frand(-0.4, 0.4), vy: frand(0.2, 1), g: 0, t: 0, life: frand(0.3, 0.6), size: frand(0.02, 0.05), color: skin.sparkle });
}
