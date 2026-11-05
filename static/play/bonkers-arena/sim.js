// Bonkers Arena — shared simulation. Runs in the browser (levels) and on the server (online).
(function (root) {
  const TAU = Math.PI * 2;

  // Arena features: friction (ice), bumpers, hole (water in the middle), wind, boss.
  const LEVELS = [
    { id: 1, scene: 'galaxy', name: 'Neon Ring', theme: 'cyber', bots: 3, skill: 0.25, time: 90, rMax: 380, rMin: 150 },
    { id: 2, scene: 'comets', name: 'Grid Rush', theme: 'cyber', bots: 5, skill: 0.35, time: 90, rMax: 440, rMin: 150, blockers: [{ k: 'pillar', x: 0, y: -190, w: 30 }, { k: 'pillar', x: 165, y: 95, w: 30 }, { k: 'pillar', x: -165, y: 95, w: 30 }] },
    { id: 3, scene: 'moon', name: 'Frost Byte', theme: 'frost', bots: 5, skill: 0.4, time: 90, rMax: 440, rMin: 150, friction: 0.45 },
    { id: 4, scene: 'planet', name: 'Pinball Core', theme: 'synth', bots: 6, skill: 0.45, time: 100, rMax: 480, rMin: 160, bumpers: 4 },
    { id: 5, scene: 'blackhole', name: 'Black Hole', theme: 'inferno', bots: 6, skill: 0.5, time: 100, rMax: 500, rMin: 220, hole: 90, blockers: [{ k: 'slide', x: 0, y: -280, len: 70, w: 13, ang: 0, amp: 120, speed: 1.1 }, { k: 'slide', x: 0, y: 280, len: 70, w: 13, ang: 0, amp: 120, speed: -1.1 }] },
    { id: 6, scene: 'sun', name: 'Solar Wind', theme: 'cyber', bots: 7, skill: 0.55, time: 100, rMax: 500, rMin: 160, wind: 110, blockers: [{ k: 'wall', x: -230, y: -80, x2: -150, y2: -200, w: 12 }, { k: 'wall', x: 230, y: 80, x2: 150, y2: 200, w: 12 }] },
    { id: 7, scene: 'moon', name: 'Cryo Bumpers', theme: 'frost', bots: 7, skill: 0.6, time: 110, rMax: 520, rMin: 170, friction: 0.5, bumpers: 5, blockers: [{ k: 'sweep', x: 0, y: 0, len: 110, w: 14, speed: 0.9 }] },
    { id: 8, scene: 'planet', name: 'Titan', theme: 'synth', bots: 5, skill: 0.6, time: 110, rMax: 520, rMin: 170, boss: true, blockers: [{ k: 'sweep', x: 0, y: 0, len: 150, w: 15, speed: 0.7 }] },
    { id: 9, scene: 'comets', name: 'Overload', theme: 'synth', bots: 8, skill: 0.7, time: 110, rMax: 560, rMin: 230, bumpers: 4, hole: 90, wind: 80, blockers: [{ k: 'pillar', x: 0, y: -330, w: 28 }, { k: 'pillar', x: 0, y: 330, w: 28 }] },
    { id: 10, scene: 'blackhole', name: 'Final Circuit', theme: 'inferno', bots: 11, skill: 0.8, time: 120, rMax: 620, rMin: 180, bumpers: 3, wind: 60, blockers: [{ k: 'sweep', x: 0, y: 0, len: 140, w: 15, speed: 1.0 }, { k: 'slide', x: -380, y: 0, len: 60, w: 12, ang: Math.PI / 2, amp: 140, speed: 1.3 }, { k: 'slide', x: 380, y: 0, len: 60, w: 12, ang: Math.PI / 2, amp: 140, speed: -1.3 }] },
    { id: 11, scene: 'galaxy', name: 'Aurora Rift', theme: 'aurora', bots: 9, skill: 0.75, time: 110, rMax: 580, rMin: 210, bumpers: 2, hole: 70, wind: 50, season: 1, blockers: [{ k: 'slide', x: -300, y: 0, len: 60, w: 12, ang: Math.PI / 2, amp: 120, speed: 1 }, { k: 'slide', x: 300, y: 0, len: 60, w: 12, ang: Math.PI / 2, amp: 120, speed: -1 }] },
    { id: 12, scene: 'planet', name: 'Cargo Belts', theme: 'synth', bots: 6, skill: 0.5, time: 100, rMax: 500, rMin: 200, belts: [{ x: 0, y: -120, ang: 0, len: 300, w: 46, speed: 520 }, { x: 0, y: 120, ang: Math.PI, len: 300, w: 46, speed: 520 }] },
    { id: 13, scene: 'moon', name: 'Sinkhole Moon', theme: 'frost', bots: 6, skill: 0.55, time: 100, rMax: 520, rMin: 200, friction: 0.7, sinks: 3 },
    { id: 14, scene: 'sun', name: 'Crumble Core', theme: 'inferno', bots: 7, skill: 0.6, time: 100, rMax: 540, rMin: 200, crumble: true },
  ];
  const ONLINE = { id: 0, name: 'Online Arena', theme: 'cyber', bots: 0, skill: 0.55, time: 120, rMax: 620, rMin: 160, bumpers: 3 };

  const BOT_NAMES = ['Volt', 'Nova', 'Rift', 'Pulse', 'Echo', 'Flux', 'Blitz', 'Zap', 'Orbit', 'Glitch', 'Spark', 'Neon', 'Comet', 'Laser', 'Byte'];
  const START_R = 22, DASH_CD = 2.2, PELLET_GAIN = 36;
  // Bots get their own neon colour, all different from each other and from the players' skins.
  const COLORS = ['#ff3b3b', '#ff8a1f', '#ffd400', '#a8ff3d', '#2bff88', '#00f0d0', '#2bb8ff', '#4d6bff', '#9b5cff', '#e040ff', '#ff4fa8', '#f2f2ff'];
  // Power-ups: shield = heavy and steady, magnet = pulls cubes, mega = hits much harder,
  // boost = faster with quicker dash, freeze = slows everyone else.
  const PU_TYPES = ['shield', 'magnet', 'mega', 'boost', 'freeze'];
  const PU_TIME = { shield: 5, magnet: 6, mega: 6, boost: 5, freeze: 4 };

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function createWorld(level) {
    const w = { lv: level, t: 0, R: level.rMax, balls: [], pellets: [], bumpers: [], events: [], nextId: 1, over: false, alive: 0, windA: rnd(0, TAU), powerups: [], puTimer: 6, freezeBy: 0, freezeT: 0,
      tiles: level.crumble ? new Map() : null, meteors: [], ev: null, evT: rnd(8, 12), lastEv: '' };
    const n = level.bumpers || 0;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + 0.4, d = level.rMax * 0.42;
      w.bumpers.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 34, pulse: 0 });
    }
    for (let i = 0; i < 60; i++) spawnPellet(w);
    return w;
  }

  function spawnPellet(w) {
    const hole = w.lv.hole || 0;
    for (let k = 0; k < 10; k++) {
      const a = rnd(0, TAU), d = hole + 20 + Math.sqrt(Math.random()) * (w.R * 0.9 - hole - 20);
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      if (w.bumpers.some(b => Math.hypot(b.x - x, b.y - y) < b.r + 14)) continue;
      w.pellets.push({ x, y, k: (Math.random() * 4) | 0 });
      return;
    }
  }

  function addBall(w, o) {
    const hole = w.lv.hole || 0;
    let x = 0, y = 0;
    for (let k = 0; k < 30; k++) {
      const a = rnd(0, TAU), d = rnd(hole + 60, w.R * 0.75);
      x = Math.cos(a) * d; y = Math.sin(a) * d;
      if (!w.balls.some(b => Math.hypot(b.x - x, b.y - y) < 90) && !w.bumpers.some(b => Math.hypot(b.x - x, b.y - y) < 80)) break;
    }
    const mods = Object.assign({ heavy: 0, dash: 0, power: 0, speed: 0, magnet: 0, shield: 0, grow: 0, steady: 0 }, o.mods);
    const r = o.r || START_R + mods.heavy * 4;
    const b = {
      id: w.nextId++, name: o.name, skin: o.skin | 0, human: !!o.human, col: o.col == null ? -1 : o.col,
      x, y, vx: 0, vy: 0, r, tr: r, face: Math.atan2(-y, -x),
      alive: true, falling: 0, dashCd: 0, dashT: 0, dizzy: 0,
      hitBy: 0, hitAt: -9, bonks: 0, place: 0,
      skill: o.skill == null ? w.lv.skill : o.skill, boss: !!o.boss, slamCd: 5, slamT: 0,
      pu: '', puT: 0, mods,
      ai: { t: 0, a: 0, p: 0, prey: 0, rescue: false },
    };
    w.balls.push(b);
    w.alive++;
    return b;
  }

  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  // hue in degrees, or -1 for white/grey colours
  function hueOf(hex) {
    const [r, g, b] = hexRgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < .2) return -1;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }
  // every palette colour that could be mistaken for this one
  function similarColors(hex) {
    const h = hueOf(hex);
    return COLORS.map((c, i) => [i, hueOf(c)]).filter(([, h2]) => (h < 0 || h2 < 0) ? h === h2 : Math.min(Math.abs(h - h2), 360 - Math.abs(h - h2)) < 32).map(([i]) => i);
  }

  // humanColors: the rim colours of the players' skins, so no bot looks like a player
  function fillBots(w, total, humanColors) {
    let i = 0;
    const used = new Set(w.balls.map(b => b.name));
    const players = new Set();
    for (const h of humanColors || []) for (const k of similarColors(h)) players.add(k);
    const allowed = COLORS.map((_, k) => k).filter(k => !players.has(k)).sort(() => Math.random() - .5);
    const inUse = new Set(w.balls.filter(b => b.col >= 0).map(b => b.col));
    // unused colours first; when there are more bots than colours, repeat but never a player's colour
    const order = allowed.filter(k => !inUse.has(k)).concat(allowed.filter(k => inUse.has(k)));
    let n = 0;
    while (w.balls.length < total) {
      const name = BOT_NAMES.find(nm => !used.has(nm)) || ('Bot ' + (++i));
      used.add(name);
      const col = order[n++ % order.length];
      addBall(w, { name, skin: 0, col });
    }
  }

  function setupLevel(w, playerName, playerSkin, playerColor, mods) {
    const me = addBall(w, { name: playerName, skin: playerSkin, human: true, mods });
    if (me.mods.shield) { me.pu = 'shield'; me.puT = 2 + me.mods.shield * 2; }
    me.x = 0; me.y = -(w.lv.hole ? w.lv.hole + 90 : (w.lv.blockers && w.lv.blockers.some(b => b.k === 'sweep') ? 220 : 0));
    if (w.lv.boss) addBall(w, { name: 'Titan', skin: 99, r: 62, boss: true, skill: 0.7 });
    fillBots(w, 1 + w.lv.bots + (w.lv.boss ? 1 : 0), [playerColor]);
    return me;
  }

  // ---------- blockers: solid neon bars that never kill, they only get in the way ----------
  // Every blocker is a capsule (segment a-b with radius w); its pose depends only on time,
  // so the server and the players' screens compute the same position.
  function blockerPose(bl, t, R) {
    let ax, ay, bx, by, vx = 0, vy = 0, spin = 0, cx = bl.x, cy = bl.y;
    if (bl.k === 'pillar') { ax = bx = bl.x; ay = by = bl.y; }
    else if (bl.k === 'wall') { ax = bl.x; ay = bl.y; bx = bl.x2; by = bl.y2; }
    else if (bl.k === 'sweep') {
      const a = bl.speed * t, len = Math.min(bl.len, R * 0.72);
      ax = bl.x - Math.cos(a) * len; ay = bl.y - Math.sin(a) * len; bx = bl.x + Math.cos(a) * len; by = bl.y + Math.sin(a) * len;
      spin = bl.speed;
    } else {
      const off = bl.amp * Math.sin(t * bl.speed), dx = Math.cos(bl.ang), dy = Math.sin(bl.ang);
      cx = bl.x + dx * off; cy = bl.y + dy * off;
      const v = bl.amp * bl.speed * Math.cos(t * bl.speed); vx = dx * v; vy = dy * v;
      ax = cx - dy * bl.len; ay = cy + dx * bl.len; bx = cx + dy * bl.len; by = cy - dx * bl.len;
    }
    const reach = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by)) + bl.w;
    return { ax, ay, bx, by, w: bl.w, vx, vy, spin, cx, cy, active: reach < R - 8 };
  }

  function collideBlockers(w) {
    for (const bl of w.lv.blockers || []) {
      const p = blockerPose(bl, w.t, w.R);
      if (!p.active) continue;
      for (const b of w.balls) {
        if (!b.alive || b.falling) continue;
        const ex = p.bx - p.ax, ey = p.by - p.ay, l2 = ex * ex + ey * ey;
        const u = l2 ? Math.max(0, Math.min(1, ((b.x - p.ax) * ex + (b.y - p.ay) * ey) / l2)) : 0;
        const qx = p.ax + ex * u, qy = p.ay + ey * u;
        const dx = b.x - qx, dy = b.y - qy, d = Math.hypot(dx, dy), m = b.r + p.w;
        if (d >= m || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        b.x = qx + nx * m; b.y = qy + ny * m;
        // speed of the blocker where it touches the orb
        const svx = p.vx - p.spin * (qy - p.cy), svy = p.vy + p.spin * (qx - p.cx);
        const vn = (b.vx - svx) * nx + (b.vy - svy) * ny;
        if (vn < 0) {
          b.vx -= 1.4 * vn * nx; b.vy -= 1.4 * vn * ny;
          if (-vn > 140) w.events.push({ e: 'block', x: qx + nx * p.w, y: qy + ny * p.w, pow: Math.min(1, -vn / 600) });
        }
      }
    }
  }

  // ---------- floors: belts, sinkholes, crumbling tiles ----------
  function hash(a, b) { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); }
  function rAt(lv, t) { return lv.rMax - (lv.rMax - lv.rMin) * Math.min(1, t / lv.time); }
  // Sinkholes open one after another; where and when depends only on time, so every screen agrees.
  const SINK = { cycle: 7, warn: 1.6, open: 3.2, r: 60 };
  function sinkState(w, k) {
    const lv = w.lv, off = k * SINK.cycle / lv.sinks, tt = w.t + off, c = Math.floor(tt / SINK.cycle), ph = tt - c * SINK.cycle;
    if (w.t < 3 || ph >= SINK.warn + SINK.open) return null;
    const hole = lv.hole || 0, R0 = rAt(lv, c * SINK.cycle - off), a = hash(k + 1, c) * TAU, d = hole + 90 + hash(k + 7, c) * Math.max(0, R0 * 0.8 - hole - 90);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: SINK.r, open: ph >= SINK.warn, k: ph < SINK.warn ? ph / SINK.warn : 1 };
  }
  function sinks(w) { const out = []; for (let k = 0; k < (w.lv.sinks || 0); k++) { const s = sinkState(w, k); if (s) out.push(s); } return out; }
  const TILE = 84;
  function tileKey(x, y) { return Math.floor(x / TILE) + ',' + Math.floor(y / TILE); }
  // true where the floor is gone; with warn, also where it is about to go (bots stay away)
  function voidAt(w, x, y, warn) {
    for (const s of sinks(w)) if ((s.open || warn) && Math.hypot(x - s.x, y - s.y) < s.r) return true;
    if (w.tiles) { const tl = w.tiles.get(tileKey(x, y)); if (tl && (tl.gone || (warn && tl.dmg > 1))) return true; }
    return false;
  }
  function stepFloors(w, dt) {
    for (const bt of w.lv.belts || []) {
      const dx = Math.cos(bt.ang), dy = Math.sin(bt.ang);
      for (const b of w.balls) {
        if (!b.alive || b.falling) continue;
        const rx = b.x - bt.x, ry = b.y - bt.y, along = rx * dx + ry * dy, side = -rx * dy + ry * dx;
        if (Math.abs(along) < bt.len && Math.abs(side) < bt.w) { b.vx += dx * bt.speed * dt * 1.6; b.vy += dy * bt.speed * dt * 1.6; }
      }
    }
    if (!w.tiles) return;
    // tiles crack under orbs that stand still and fall away, then grow back
    const hit = new Set();
    if (w.t > 3) for (const b of w.balls) {
      if (!b.alive || b.falling) continue;
      const key = tileKey(b.x, b.y);
      if (hit.has(key)) continue; hit.add(key);
      let tl = w.tiles.get(key);
      if (!tl) { const [i, j] = key.split(',').map(Number); tl = { i, j, dmg: 0, gone: false, back: 0 }; w.tiles.set(key, tl); }
      if (tl.gone) continue;
      tl.dmg += dt;
      if (tl.dmg >= 1.6) { tl.gone = true; tl.back = w.t + 7; w.events.push({ e: 'crumble', x: (tl.i + .5) * TILE, y: (tl.j + .5) * TILE }); }
    }
    for (const [key, tl] of w.tiles) {
      if (tl.gone) { if (w.t > tl.back) w.tiles.delete(key); }
      else if (!hit.has(key)) { tl.dmg -= dt * 0.4; if (tl.dmg <= 0) w.tiles.delete(key); }
    }
  }

  // ---------- the Titan slams the floor: a shockwave that throws everyone near it ----------
  function push(w, src, x, y, reach, power) {
    for (const o of w.balls) {
      if (o === src || !o.alive || o.falling) continue;
      const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy);
      if (d > reach || d === 0) continue;
      const f = power * (1 - d / reach) + power * 0.25, m = Math.pow(START_R / o.r, 0.3) * (o.pu === 'shield' ? 0.4 : 1);
      o.vx += dx / d * f * m; o.vy += dy / d * f * m;
      if (o.pu !== 'shield') o.dizzy = 0.6;
      if (src) { o.hitBy = src.id; o.hitAt = w.t; }
    }
  }
  function stepBoss(w, b, dt) {
    if (b.slamT > 0) {
      b.slamT -= dt; b.vx *= 0.9; b.vy *= 0.9;
      if (b.slamT <= 0) { push(w, b, b.x, b.y, 260, 520); b.slamCd = rnd(5, 7); w.events.push({ e: 'slam', id: b.id, x: b.x, y: b.y, r: 260 }); }
      return;
    }
    b.slamCd -= dt;
    if (b.slamCd <= 0 && w.balls.some(o => o !== b && o.alive && !o.falling && Math.hypot(o.x - b.x, o.y - b.y) < 220)) {
      b.slamT = 1.1; w.events.push({ e: 'slamwarn', id: b.id });
    }
  }

  // ---------- arena events: meteor shower, gravity shift, blackout ----------
  const EV_TIME = { meteors: 5.5, gravity: 6.5, blackout: 6 };
  function stepEvents(w, dt) {
    for (let i = w.meteors.length - 1; i >= 0; i--) {
      const m = w.meteors[i]; m.t += dt;
      if (m.t >= 1.3) { push(w, null, m.x, m.y, 105, 560); w.events.push({ e: 'meteor', x: m.x, y: m.y }); w.meteors.splice(i, 1); }
    }
    if (!w.lv.events) return;
    if (!w.ev) {
      w.evT -= dt;
      if (w.evT > 0) return;
      const kinds = ['meteors', 'gravity', 'blackout'].filter(k => k !== w.lastEv);
      const k = kinds[(Math.random() * kinds.length) | 0];
      w.ev = { k, t: 0, a: rnd(0, TAU), next: 0 }; w.lastEv = k;
      w.events.push({ e: 'arena', k });
      return;
    }
    const ev = w.ev; ev.t += dt;
    if (ev.k === 'meteors' && ev.t < 4.2) {
      ev.next -= dt;
      if (ev.next <= 0) {
        ev.next = 0.4;
        const st = w.balls.filter(b => b.alive && !b.falling), tg = st[(Math.random() * st.length) | 0];
        let x, y;
        if (tg && Math.random() < 0.6) { const a = rnd(0, TAU), d = rnd(0, 110); x = tg.x + Math.cos(a) * d; y = tg.y + Math.sin(a) * d; }
        else { const a = rnd(0, TAU), d = Math.sqrt(Math.random()) * w.R * 0.85; x = Math.cos(a) * d; y = Math.sin(a) * d; }
        w.meteors.push({ x, y, t: 0 });
      }
    }
    if (ev.k === 'gravity' && ev.t > 1.5) {
      const g = 230;
      for (const b of w.balls) if (b.alive && !b.falling) { b.vx += Math.cos(ev.a) * g * dt; b.vy += Math.sin(ev.a) * g * dt; }
    }
    if (ev.t >= EV_TIME[ev.k]) { w.ev = null; w.evT = rnd(11, 16); }
  }

  function byId(w, id) { for (const b of w.balls) if (b.id === id) return b; return null; }

  function dash(w, b) {
    if (b.dashCd > 0 || !b.alive || b.falling) return;
    const sp = 520 * Math.pow(START_R / b.r, 0.25);
    b.vx += Math.cos(b.face) * sp; b.vy += Math.sin(b.face) * sp;
    b.dashCd = (b.pu === 'boost' ? DASH_CD * 0.45 : DASH_CD) * Math.pow(0.8, b.mods.dash); b.dashT = 0.35;
    w.events.push({ e: 'dash', id: b.id, x: b.x, y: b.y });
  }

  function accelOf(w, b) {
    let a = 950 / (1 + (b.r - START_R) / 45);
    if (b.pu === 'boost') a *= 1.6;
    a *= 1 + 0.15 * b.mods.speed;
    if (w.freezeT > 0 && w.freezeBy !== b.id) a *= 0.45;
    return a;
  }

  function spawnPowerup(w) {
    const hole = w.lv.hole || 0;
    for (let k = 0; k < 20; k++) {
      const a = rnd(0, TAU), d = rnd(hole + 50, w.R * 0.7);
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      if (w.bumpers.some(b => Math.hypot(b.x - x, b.y - y) < b.r + 30)) continue;
      w.powerups.push({ x, y, type: PU_TYPES[(Math.random() * PU_TYPES.length) | 0] });
      return;
    }
  }

  function botThink(w, b) {
    const ai = b.ai, s = b.skill;
    ai.prey = 0;
    const look = 0.25 + s * 0.35;
    const fx = b.x + b.vx * look, fy = b.y + b.vy * look;
    const dc = Math.hypot(fx, fy), hole = w.lv.hole || 0;
    const margin = 50 + s * 70;
    // stay on the platform
    const danger = dc > w.R - b.r - margin, inHole = hole && dc < hole + b.r + margin * 0.6;
    if (danger || inHole) {
      ai.a = danger ? Math.atan2(-fy, -fx) : Math.atan2(fy, fx);
      ai.a += rnd(-0.3, 0.3) * (1 - s); ai.p = 1; ai.t = Math.min(ai.t, 0.1);
      // a skilled bot dashes back to safety when it is about to fall
      const edgeNow = danger ? w.R - Math.hypot(b.x, b.y) - b.r : Math.hypot(b.x, b.y) - hole - b.r;
      if (edgeNow < 25 && b.dashCd === 0 && Math.random() < s) ai.rescue = true;
      return;
    }
    // keep off holes in the floor, cracked tiles and spots where a meteor is about to land
    if (w.lv.sinks || w.tiles || w.meteors.length) {
      const bad = (x, y) => voidAt(w, x, y, true) || w.meteors.some(m => Math.hypot(m.x - x, m.y - y) < 115);
      if (bad(fx, fy) || bad(b.x, b.y)) {
        let bestA = ai.a, bestD = -1;
        for (let i = 0; i < 12; i++) {
          const a = i * TAU / 12, x = b.x + Math.cos(a) * 110, y = b.y + Math.sin(a) * 110;
          if (bad(x, y) || Math.hypot(x, y) > w.R - b.r - 40) continue;
          const d = Math.min(...w.meteors.map(m => Math.hypot(m.x - x, m.y - y)), 999) + Math.random() * 30 * (1 - s);
          if (d > bestD) { bestD = d; bestA = a; }
        }
        ai.a = bestA; ai.p = 1; ai.t = Math.min(ai.t, 0.15);
        return;
      }
    }
    // grab a nearby power-up
    let pbest = null, pd = 200 + s * 120;
    for (const p of w.powerups) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < pd) { pd = d; pbest = p; } }
    if (pbest && Math.random() < 0.4 + s * 0.5) { ai.a = Math.atan2(pbest.y - b.y, pbest.x - b.x); ai.p = 1; return; }
    // hunt a smaller ball
    let best = null, bd = 1e9;
    for (const o of w.balls) {
      if (o === b || !o.alive || o.falling) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (o.r < b.r * (1.02 + s * 0.15) && d < 220 + s * 200 && d < bd) { bd = d; best = o; }
    }
    if (best && Math.random() < 0.35 + s * 0.6) {
      ai.prey = best.id;
      // aim so the push sends the prey toward the edge
      const ox = best.x, oy = best.y, od = Math.hypot(ox, oy) || 1;
      const tx = ox - (ox / od) * best.r * s, ty = oy - (oy / od) * best.r * s;
      ai.a = Math.atan2(ty - b.y, tx - b.x) + rnd(-0.5, 0.5) * (1 - s); ai.p = 1; return;
    }
    bd = 1e9; best = null;
    for (const p of w.pellets) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; best = p; } }
    if (best) { ai.a = Math.atan2(best.y - b.y, best.x - b.x); ai.p = 0.8; }
  }

  function knockOut(w, b) {
    b.falling = 0.0001;
    b.place = w.alive;
    w.alive--;
    const k = (w.t - b.hitAt < 4) ? byId(w, b.hitBy) : null;
    if (k && k.alive && !k.falling) {
      k.tr = Math.sqrt(k.tr * k.tr + b.r * b.r * 0.55);
      k.bonks++;
      w.events.push({ e: 'out', id: b.id, by: k.id });
    } else w.events.push({ e: 'out', id: b.id, by: 0 });
  }

  // inputs: { [id]: { a: angle, p: 0..1, d: true when dash pressed } }
  // After the round ends, balls already falling still finish their fall.
  function stepFalling(w, dt) {
    for (const b of w.balls) {
      if (!b.alive || !b.falling) continue;
      b.vx *= 0.97; b.vy *= 0.97; b.x += b.vx * dt; b.y += b.vy * dt;
      b.falling += dt;
      if (b.falling > 0.55) { b.alive = false; w.events.push({ e: 'splash', x: b.x, y: b.y, r: b.r, id: b.id }); }
    }
  }

  function step(w, dt, inputs) {
    if (w.over) { stepFalling(w, dt); return; }
    const lv = w.lv;
    w.t += dt;
    w.R = lv.rMax - (lv.rMax - lv.rMin) * Math.min(1, w.t / lv.time);
    const fr = Math.exp(-(lv.friction ? 1.6 * lv.friction : 1.6) * dt);
    if (lv.wind) w.windA += dt * 0.12;
    const wx = lv.wind ? Math.cos(w.windA) * lv.wind : 0, wy = lv.wind ? Math.sin(w.windA) * lv.wind : 0;
    const hole = lv.hole || 0;
    w.freezeT = Math.max(0, w.freezeT - dt);
    w.puTimer -= dt;
    if (w.puTimer <= 0) { w.puTimer = rnd(6, 10); if (w.powerups.length < 3) spawnPowerup(w); }
    for (let i = w.powerups.length - 1; i >= 0; i--) {
      const p = w.powerups[i];
      if (Math.hypot(p.x, p.y) > w.R - 25) { w.powerups.splice(i, 1); continue; }
      for (const b of w.balls) {
        if (!b.alive || b.falling || Math.hypot(p.x - b.x, p.y - b.y) > b.r + 16) continue;
        w.powerups.splice(i, 1);
        if (p.type === 'freeze') { w.freezeBy = b.id; w.freezeT = PU_TIME.freeze; }
        b.pu = p.type; b.puT = PU_TIME[p.type];
        w.events.push({ e: 'pu', id: b.id, type: p.type, x: p.x, y: p.y });
        break;
      }
    }

    for (const b of w.balls) {
      if (!b.alive) continue;
      b.dashCd = Math.max(0, b.dashCd - dt); b.dashT = Math.max(0, b.dashT - dt); b.dizzy = Math.max(0, b.dizzy - dt);
      if (b.puT > 0) { b.puT -= dt; if (b.puT <= 0) { b.pu = ''; b.puT = 0; } }
      if (!b.falling) {
        let a, p, d = false;
        if (b.human) { const i = inputs && inputs[b.id]; a = i ? i.a : b.face; p = i ? i.p : 0; d = i && i.d; }
        else {
          b.ai.t -= dt;
          if (b.ai.t <= 0) { b.ai.t = 0.45 - b.skill * 0.25 + Math.random() * 0.2; botThink(w, b); }
          a = b.ai.a; p = b.ai.p;
          const pr = b.ai.prey && byId(w, b.ai.prey);
          if (pr && pr.alive && Math.hypot(pr.x - b.x, pr.y - b.y) < b.r + pr.r + 100 && Math.random() < dt * (0.4 + b.skill * 1.6)) d = true;
          if (b.ai.rescue) { b.face = a; d = true; b.ai.rescue = false; }
        }
        if (b.dizzy > 0) p *= 0.3;
        if (b.slamT > 0) p = 0;
        const acc = accelOf(w, b) * p;
        b.vx += Math.cos(a) * acc * dt; b.vy += Math.sin(a) * acc * dt;
        if (p > 0.05) b.face = a;
        if (d) dash(w, b);
        b.vx += wx * dt; b.vy += wy * dt;
      }
      b.vx *= fr; b.vy *= fr;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.r += (b.tr - b.r) * Math.min(1, dt * 6);
      if (b.falling) {
        b.falling += dt;
        if (b.falling > 0.55) { b.alive = false; w.events.push({ e: 'splash', x: b.x, y: b.y, r: b.r, id: b.id }); }
      } else {
        const dc = Math.hypot(b.x, b.y);
        if (dc > w.R + b.r * 0.15 || (hole && dc < hole - b.r * 0.15) || voidAt(w, b.x, b.y)) knockOut(w, b);
        else if (b.boss) stepBoss(w, b, dt);
      }
    }

    // bumpers
    for (const bu of w.bumpers) {
      bu.pulse = Math.max(0, bu.pulse - dt * 4);
      for (const b of w.balls) {
        if (!b.alive || b.falling) continue;
        const dx = b.x - bu.x, dy = b.y - bu.y, d = Math.hypot(dx, dy), m = b.r + bu.r;
        if (d >= m || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        b.x = bu.x + nx * m; b.y = bu.y + ny * m;
        const vn = b.vx * nx + b.vy * ny;
        const kick = 280 * Math.pow(START_R / b.r, 0.3);
        b.vx += nx * (Math.max(0, -vn) * 1.3 + kick); b.vy += ny * (Math.max(0, -vn) * 1.3 + kick);
        bu.pulse = 1;
        w.events.push({ e: 'bump', x: bu.x + nx * bu.r, y: bu.y + ny * bu.r });
      }
    }

    collideBlockers(w);
    stepFloors(w, dt);
    stepEvents(w, dt);

    // ball vs ball
    const bs = w.balls;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (!a.alive || a.falling) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j]; if (!b.alive || b.falling) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
        if (d >= m || d === 0) continue;
        const nx = dx / d, ny = dy / d, ov = m - d;
        const ma = a.r * a.r * (a.pu === 'shield' ? 4 : 1) * (1 + 0.3 * a.mods.steady), mb = b.r * b.r * (b.pu === 'shield' ? 4 : 1) * (1 + 0.3 * b.mods.steady);
        a.x -= nx * ov * mb / (ma + mb); a.y -= ny * ov * mb / (ma + mb);
        b.x += nx * ov * ma / (ma + mb); b.y += ny * ov * ma / (ma + mb);
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel >= 0) continue;
        const J = -1.3 * rel / (1 / ma + 1 / mb);
        const pa = (a.dashT > 0 ? 1.5 : 1) * (a.pu === 'mega' ? 1.8 : 1) * (1 + 0.2 * a.mods.power), pb = (b.dashT > 0 ? 1.5 : 1) * (b.pu === 'mega' ? 1.8 : 1) * (1 + 0.2 * b.mods.power);
        a.vx -= J / ma * nx * pb; a.vy -= J / ma * ny * pb;
        b.vx += J / mb * nx * pa; b.vy += J / mb * ny * pa;
        const ka = 35 * pb * Math.min(2, b.r / a.r), kb = 35 * pa * Math.min(2, a.r / b.r);
        b.vx += nx * kb; b.vy += ny * kb; a.vx -= nx * ka; a.vy -= ny * ka;
        a.hitBy = b.id; a.hitAt = w.t; b.hitBy = a.id; b.hitAt = w.t;
        const pow = Math.min(1, -rel / 500 * Math.max(pa, pb));
        if (pow > 0.35) { if (a.dashT <= 0 && a.pu !== 'shield') a.dizzy = 0.5; if (b.dashT <= 0 && b.pu !== 'shield') b.dizzy = 0.5; }
        w.events.push({ e: 'bonk', x: a.x + nx * a.r, y: a.y + ny * a.r, pow, a: a.id, b: b.id });
      }
    }

    // pellets (magnets pull them in)
    for (const b of bs) {
      if ((b.pu !== 'magnet' && !b.mods.magnet) || !b.alive || b.falling) continue;
      const reach = b.pu === 'magnet' ? 220 : 80 + 40 * b.mods.magnet, pull = b.pu === 'magnet' ? 300 : 180;
      for (const p of w.pellets) {
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
        if (d < reach && d > 1) { p.x += dx / d * pull * dt; p.y += dy / d * pull * dt; }
      }
    }
    for (let i = w.pellets.length - 1; i >= 0; i--) {
      const p = w.pellets[i], dc = Math.hypot(p.x, p.y);
      if (dc > w.R - 10 || (hole && dc < hole + 10) || voidAt(w, p.x, p.y)) { w.pellets.splice(i, 1); continue; }
      for (const b of bs) {
        if (!b.alive || b.falling) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 4) {
          b.tr = Math.sqrt(b.tr * b.tr + PELLET_GAIN * (1 + 0.5 * b.mods.grow));
          w.pellets.splice(i, 1);
          w.events.push({ e: 'eat', id: b.id, x: p.x, y: p.y, k: p.k });
          break;
        }
      }
    }
    const want = Math.max(14, 60 * Math.pow(w.R / lv.rMax, 2));
    while (w.pellets.length < want) spawnPellet(w);

    // end of round
    const standing = bs.filter(b => b.alive && !b.falling);
    if (standing.length <= 1 || w.t >= lv.time) {
      standing.sort((x, y) => y.r - x.r).forEach((b, i) => { b.place = i + 1; });
      w.over = true;
      w.events.push({ e: 'end', winner: standing[0] ? standing[0].id : 0 });
    }
  }

  // ---------- endless mode ----------
  // Wave n uses an arena from LEVELS (first in a fixed order, later at random); every 5th wave brings the Titan.
  const WAVE_ORDER = [0, 1, 2, 11, 3, 12, 4, 7, 13, 5, 6, 8, 9, 10];
  function makeWave(n) {
    const tpl = n <= WAVE_ORDER.length ? LEVELS[WAVE_ORDER[n - 1]] : LEVELS[(Math.random() * LEVELS.length) | 0];
    const boss = n % 5 === 0;
    const bots = Math.min(2 + n, 14) - (boss ? 1 : 0);
    const rMax = Math.round(Math.max(tpl.rMax, 300 + bots * 26) * 1.18);
    return Object.assign({}, tpl, { id: n, wave: n, bots, boss, skill: Math.min(0.05 + 0.06 * n, 0.9), time: 40 + Math.min(n * 3, 35), events: n >= 3, rMax, rMin: Math.max(tpl.rMin, rMax * (n < 4 ? 0.6 : 0.45)) });
  }

  // Perks picked between waves; each can be taken up to 3 times.
  const PERKS = {
    heavy: { name: 'Heavy Core', text: 'Start every wave bigger and heavier.' },
    dash: { name: 'Quick Dash', text: 'Dash recharges 20% faster.' },
    power: { name: 'Power Hit', text: 'Your hits push 20% harder.' },
    speed: { name: 'Turbo', text: 'Roll 15% faster.' },
    magnet: { name: 'Cube Magnet', text: 'Energy cubes fly to you.' },
    shield: { name: 'Spawn Shield', text: 'Start every wave with a shield.' },
    grow: { name: 'Big Appetite', text: 'Cubes make you grow 50% more.' },
    steady: { name: 'Steady', text: 'Hits push you 30% less.' },
  };

  // Stars for a finished level: win = 1, plus bonks.
  function starsFor(lv, me) {
    if (me.place !== 1) return 0;
    const need = Math.max(2, Math.round(lv.bots / 2));
    return me.bonks >= need ? 3 : me.bonks >= Math.ceil(need / 2) ? 2 : 1;
  }

  const api = { sinks, TILE, LEVELS, ONLINE, makeWave, PERKS, BOT_NAMES, COLORS, START_R, DASH_CD, PU_TYPES, PU_TIME, blockerPose, createWorld, addBall, fillBots, setupLevel, step, byId, starsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sim = api;
})(this);
