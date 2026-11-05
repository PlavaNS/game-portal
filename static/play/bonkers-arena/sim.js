// Bonkers Arena — shared simulation. Runs in the browser (levels) and on the server (online).
(function (root) {
  const TAU = Math.PI * 2;

  // Arena features: friction (ice), bumpers, hole (water in the middle), wind, boss.
  const LEVELS = [
    { id: 1, name: 'Neon Ring', theme: 'cyber', bots: 3, skill: 0.25, time: 90, rMax: 380, rMin: 150 },
    { id: 2, name: 'Grid Rush', theme: 'cyber', bots: 5, skill: 0.35, time: 90, rMax: 440, rMin: 150, blockers: [{ k: 'pillar', x: 0, y: -190, w: 30 }, { k: 'pillar', x: 165, y: 95, w: 30 }, { k: 'pillar', x: -165, y: 95, w: 30 }] },
    { id: 3, name: 'Frost Byte', theme: 'frost', bots: 5, skill: 0.4, time: 90, rMax: 440, rMin: 150, friction: 0.45 },
    { id: 4, name: 'Pinball Core', theme: 'synth', bots: 6, skill: 0.45, time: 100, rMax: 480, rMin: 160, bumpers: 4 },
    { id: 5, name: 'Black Hole', theme: 'inferno', bots: 6, skill: 0.5, time: 100, rMax: 500, rMin: 220, hole: 90, blockers: [{ k: 'slide', x: 0, y: -280, len: 70, w: 13, ang: 0, amp: 120, speed: 1.1 }, { k: 'slide', x: 0, y: 280, len: 70, w: 13, ang: 0, amp: 120, speed: -1.1 }] },
    { id: 6, name: 'Solar Wind', theme: 'cyber', bots: 7, skill: 0.55, time: 100, rMax: 500, rMin: 160, wind: 110, blockers: [{ k: 'wall', x: -230, y: -80, x2: -150, y2: -200, w: 12 }, { k: 'wall', x: 230, y: 80, x2: 150, y2: 200, w: 12 }] },
    { id: 7, name: 'Cryo Bumpers', theme: 'frost', bots: 7, skill: 0.6, time: 110, rMax: 520, rMin: 170, friction: 0.5, bumpers: 5, blockers: [{ k: 'sweep', x: 0, y: 0, len: 110, w: 14, speed: 0.9 }] },
    { id: 8, name: 'Titan', theme: 'synth', bots: 5, skill: 0.6, time: 110, rMax: 520, rMin: 170, boss: true, blockers: [{ k: 'sweep', x: 0, y: 0, len: 150, w: 15, speed: 0.7 }] },
    { id: 9, name: 'Overload', theme: 'synth', bots: 8, skill: 0.7, time: 110, rMax: 560, rMin: 230, bumpers: 4, hole: 90, wind: 80, blockers: [{ k: 'pillar', x: 0, y: -330, w: 28 }, { k: 'pillar', x: 0, y: 330, w: 28 }] },
    { id: 10, name: 'Final Circuit', theme: 'inferno', bots: 11, skill: 0.8, time: 120, rMax: 620, rMin: 180, bumpers: 3, wind: 60, blockers: [{ k: 'sweep', x: 0, y: 0, len: 140, w: 15, speed: 1.0 }, { k: 'slide', x: -380, y: 0, len: 60, w: 12, ang: Math.PI / 2, amp: 140, speed: 1.3 }, { k: 'slide', x: 380, y: 0, len: 60, w: 12, ang: Math.PI / 2, amp: 140, speed: -1.3 }] },
    { id: 11, name: 'Aurora Rift', theme: 'aurora', bots: 9, skill: 0.75, time: 110, rMax: 580, rMin: 210, bumpers: 2, hole: 70, wind: 50, season: 1, blockers: [{ k: 'slide', x: -300, y: 0, len: 60, w: 12, ang: Math.PI / 2, amp: 120, speed: 1 }, { k: 'slide', x: 300, y: 0, len: 60, w: 12, ang: Math.PI / 2, amp: 120, speed: -1 }] },
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
    const w = { lv: level, t: 0, R: level.rMax, balls: [], pellets: [], bumpers: [], events: [], nextId: 1, over: false, alive: 0, windA: rnd(0, TAU), powerups: [], puTimer: 6, freezeBy: 0, freezeT: 0 };
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
    const r = o.r || START_R;
    const b = {
      id: w.nextId++, name: o.name, skin: o.skin | 0, human: !!o.human, col: o.col == null ? -1 : o.col,
      x, y, vx: 0, vy: 0, r, tr: r, face: Math.atan2(-y, -x),
      alive: true, falling: 0, dashCd: 0, dashT: 0, dizzy: 0,
      hitBy: 0, hitAt: -9, bonks: 0, place: 0,
      skill: o.skill == null ? w.lv.skill : o.skill, boss: !!o.boss,
      pu: '', puT: 0,
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
      addBall(w, { name, skin: (Math.random() * 16) | 0, col });
    }
  }

  function setupLevel(w, playerName, playerSkin, playerColor) {
    const me = addBall(w, { name: playerName, skin: playerSkin, human: true });
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
          b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny;
          if (-vn > 140) w.events.push({ e: 'block', x: qx + nx * p.w, y: qy + ny * p.w, pow: Math.min(1, -vn / 600) });
        }
      }
    }
  }

  function byId(w, id) { for (const b of w.balls) if (b.id === id) return b; return null; }

  function dash(w, b) {
    if (b.dashCd > 0 || !b.alive || b.falling) return;
    const sp = 520 * Math.pow(START_R / b.r, 0.25);
    b.vx += Math.cos(b.face) * sp; b.vy += Math.sin(b.face) * sp;
    b.dashCd = b.pu === 'boost' ? DASH_CD * 0.45 : DASH_CD; b.dashT = 0.35;
    w.events.push({ e: 'dash', id: b.id, x: b.x, y: b.y });
  }

  function accelOf(w, b) {
    let a = 950 / (1 + (b.r - START_R) / 45);
    if (b.pu === 'boost') a *= 1.6;
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
        if (dc > w.R + b.r * 0.15 || (hole && dc < hole - b.r * 0.15)) knockOut(w, b);
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
        const kick = 380 * Math.pow(START_R / b.r, 0.3);
        b.vx += nx * (Math.max(0, -vn) * 1.6 + kick); b.vy += ny * (Math.max(0, -vn) * 1.6 + kick);
        bu.pulse = 1;
        w.events.push({ e: 'bump', x: bu.x + nx * bu.r, y: bu.y + ny * bu.r });
      }
    }

    collideBlockers(w);

    // ball vs ball
    const bs = w.balls;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (!a.alive || a.falling) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j]; if (!b.alive || b.falling) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
        if (d >= m || d === 0) continue;
        const nx = dx / d, ny = dy / d, ov = m - d;
        const ma = a.r * a.r * (a.pu === 'shield' ? 4 : 1), mb = b.r * b.r * (b.pu === 'shield' ? 4 : 1);
        a.x -= nx * ov * mb / (ma + mb); a.y -= ny * ov * mb / (ma + mb);
        b.x += nx * ov * ma / (ma + mb); b.y += ny * ov * ma / (ma + mb);
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel >= 0) continue;
        const J = -1.6 * rel / (1 / ma + 1 / mb);
        const pa = (a.dashT > 0 ? 1.8 : 1) * (a.pu === 'mega' ? 2.2 : 1), pb = (b.dashT > 0 ? 1.8 : 1) * (b.pu === 'mega' ? 2.2 : 1);
        a.vx -= J / ma * nx * pb; a.vy -= J / ma * ny * pb;
        b.vx += J / mb * nx * pa; b.vy += J / mb * ny * pa;
        const ka = 60 * pb * Math.min(2, b.r / a.r), kb = 60 * pa * Math.min(2, a.r / b.r);
        b.vx += nx * kb; b.vy += ny * kb; a.vx -= nx * ka; a.vy -= ny * ka;
        a.hitBy = b.id; a.hitAt = w.t; b.hitBy = a.id; b.hitAt = w.t;
        const pow = Math.min(1, -rel / 500 * Math.max(pa, pb));
        if (pow > 0.35) { if (a.dashT <= 0 && a.pu !== 'shield') a.dizzy = 0.5; if (b.dashT <= 0 && b.pu !== 'shield') b.dizzy = 0.5; }
        w.events.push({ e: 'bonk', x: a.x + nx * a.r, y: a.y + ny * a.r, pow, a: a.id, b: b.id });
      }
    }

    // pellets (magnets pull them in)
    for (const b of bs) {
      if (b.pu !== 'magnet' || !b.alive || b.falling) continue;
      for (const p of w.pellets) {
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
        if (d < 220 && d > 1) { p.x += dx / d * 300 * dt; p.y += dy / d * 300 * dt; }
      }
    }
    for (let i = w.pellets.length - 1; i >= 0; i--) {
      const p = w.pellets[i], dc = Math.hypot(p.x, p.y);
      if (dc > w.R - 10 || (hole && dc < hole + 10)) { w.pellets.splice(i, 1); continue; }
      for (const b of bs) {
        if (!b.alive || b.falling) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 4) {
          b.tr = Math.sqrt(b.tr * b.tr + PELLET_GAIN);
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

  // Stars for a finished level: win = 1, plus bonks.
  function starsFor(lv, me) {
    if (me.place !== 1) return 0;
    const need = Math.max(2, Math.round(lv.bots / 2));
    return me.bonks >= need ? 3 : me.bonks >= Math.ceil(need / 2) ? 2 : 1;
  }

  const api = { LEVELS, ONLINE, BOT_NAMES, COLORS, START_R, DASH_CD, PU_TYPES, PU_TIME, blockerPose, createWorld, addBall, fillBots, setupLevel, step, byId, starsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sim = api;
})(this);
