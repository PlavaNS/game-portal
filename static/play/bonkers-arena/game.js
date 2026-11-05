// Bonkers Arena — client: menus, levels, online play, daily quests, leaderboard.
(function () {
  const TAU = Math.PI * 2;
  const $ = id => document.getElementById(id);
  const A = window.Audio2, P = window.Platform, D = window.Daily;
  const { TIERS, SKINS, SEASON, skinOf, skinFor, drawBall, PELLET_COLORS, PU_COLORS } = window.Art;

  // ---------- save (stored through the portal SDK) ----------
  const save = { uid: '', name: '', coins: 0, skin: 0, color: -1, owned: [0], best: null, v: 2, sfx: true, music: true, voice: true, daily: null, streak: null };
  function store() { P.save(save); }

  // ---------- canvas ----------
  const cv = $('c'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR | 0; cv.height = H * DPR | 0; }
  addEventListener('resize', resize); resize();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cam = { x: 0, y: 0, z: .8 };
  let shake = 0, clock = 0, hitstop = 0;
  const flash = { a: 0, c: '#ffffff' };
  function screenFlash(c, a) { if (a > flash.a) { flash.a = a; flash.c = c; } }
  const parts = [], texts = [], windBits = [];

  function toScreen(x, y) { return [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2]; }

  // ---------- particles ----------
  function burst(x, y, n, col, speed, size, life, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (.4 + Math.random() * .8);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, c: Array.isArray(col) ? col[i % col.length] : col, s: size * (.6 + Math.random() * .7), k: kind || 'dot', rot: Math.random() * TAU });
    }
  }
  // screen-wide confetti that flutters down, and fireworks around a spot in the arena
  const rain = [], CONF = ['#46e6ff', '#ff4fd8', '#ffcc3d', '#7dff9b', '#ffffff', '#b77dff', '#ff8a1f'];
  function confettiRain(n) {
    if (reduceMotion) n = n / 4 | 0;
    for (let i = 0; i < n; i++) rain.push({ x: Math.random() * W, y: -20 - Math.random() * H * .7, vx: (Math.random() - .5) * 70, vy: 110 + Math.random() * 150, rot: Math.random() * TAU, vr: (Math.random() - .5) * 9, s: 4 + Math.random() * 5, c: CONF[i % CONF.length], wob: Math.random() * TAU, round: Math.random() < .3 });
  }
  function fireworks(x, y, n) {
    for (let k = 0; k < n; k++) setTimeout(() => {
      const a = Math.random() * TAU, d = 90 + Math.random() * 170, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d - 60, col = CONF[(Math.random() * 6) | 0];
      fx(px, py, 'flash', col, 70, .35); fx(px, py, 'ring', col, 90, .5);
      burst(px, py, 34, [col, '#ffffff'], 380, 2.6, 1, 'spark');
      burst(px, py, 10, [col, CONF[(Math.random() * 7) | 0]], 260, 4, 1.3, 'conf');
      A.play('firework');
    }, 200 + k * 280);
  }
  function celebrate(x, y, n) { confettiRain(n); fireworks(x, y, 5); }
  function drawRain(dt) {
    if (!rain.length) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (let i = rain.length - 1; i >= 0; i--) {
      const p = rain[i];
      p.wob += dt * 6; p.rot += p.vr * dt; p.x += (p.vx + Math.sin(p.wob) * 40) * dt; p.y += p.vy * dt;
      if (p.y > H + 30) { rain.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(Math.cos(p.wob), 1); ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s * .6, 0, TAU); ctx.fill(); } else ctx.fillRect(-p.s, -p.s * .4, p.s * 2, p.s * .8);
      ctx.restore();
    }
  }
  function floatText(x, y, txt, col, size) { texts.push({ x, y, txt, col, size, life: 1.1, max: 1.1 }); }

  function fx(x, y, kind, c, s, life) { parts.push({ x, y, vx: 0, vy: 0, life, max: life, c, s, k: kind, rot: 0 }); }

  // knock-out explosion in the style of the winner's skin
  const KO_STYLE = { fire: ['#ff6a2a', '#ffcc3d', '#ffffff'], zap: ['#ffffff', '#46e6ff', '#ff4fd8'], rainbow: ['#ff4fd8', '#ffcc3d', '#7dff9b', '#46e6ff', '#b77dff'], aurora: ['#3dffb8', '#b77dff', '#ffffff'], stars: ['#ffffff', '#c9c2ff'], gold: ['#ffe680', '#ffffff'], ice: ['#d8f6ff', '#ffffff'], smoke: ['#dfe6ff', '#8a93b8'] };
  function koBurst(x, y, killer, victim) {
    const s = skinFor(killer), cols = KO_STYLE[s.trail] || [s.c, '#ffffff'];
    fx(x, y, 'flash', cols[0], 80, .35);
    fx(x, y, 'beam', cols[0], 160, .7);
    fx(x, y, 'ring', cols[0], 110, .5);
    burst(x, y, 24, cols, 380, 2.5, .6, 'spark');
    burst(x, y, 8, [skinFor(victim).c, '#ffffff'], 300, 4.5, .7, 'shard');
    if (s.trail === 'rainbow' || s.trail === 'gold') burst(x, y, 16, cols, 300, 4, 1, 'conf');
  }

  // ---------- input ----------
  // mouse steers toward the cursor; on touch screens a joystick bottom-left steers
  const input = { x: W / 2, y: H / 2, active: false, keys: {}, dash: false, joy: { on: false, a: 0, p: 0, id: null } };
  let touchMode = matchMedia('(pointer: coarse)').matches;
  function setTouchMode(on) { touchMode = on; document.body.classList.toggle('touch', on); }
  setTouchMode(touchMode);
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { input.x = e.clientX; input.y = e.clientY; input.active = true; } });
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') { setTouchMode(true); return; }
    input.x = e.clientX; input.y = e.clientY; input.active = true;
    if (mode !== 'menu') input.dash = true;
  });

  const joy = $('joy'), knob = $('joyKnob'), JOY_R = 52;
  function joyMove(e) {
    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.joy.a = Math.atan2(dy, dx); input.joy.p = Math.min(1, d / JOY_R);
  }
  joy.addEventListener('pointerdown', e => {
    e.preventDefault(); setTouchMode(true);
    joy.setPointerCapture(e.pointerId); input.joy.on = true; input.joy.id = e.pointerId; joy.classList.add('held'); joyMove(e);
  });
  joy.addEventListener('pointermove', e => { if (input.joy.on && e.pointerId === input.joy.id) joyMove(e); });
  const joyEnd = e => {
    if (e.pointerId !== input.joy.id) return;
    input.joy.on = false; input.joy.p = 0; input.joy.id = null; joy.classList.remove('held'); knob.style.transform = '';
  };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
  addEventListener('keydown', e => {
    if (mode === 'menu') return;
    if (e.code === 'Space') { e.preventDefault(); input.dash = true; return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
    input.keys[e.code] = true;
  });
  addEventListener('keyup', e => { input.keys[e.code] = false; });
  $('dash').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); input.dash = true; });

  function readInput(me) {
    const k = input.keys;
    const kx = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0);
    const ky = (k.ArrowDown || k.KeyS ? 1 : 0) - (k.ArrowUp || k.KeyW ? 1 : 0);
    const d = input.dash; input.dash = false;
    if (kx || ky) return { a: Math.atan2(ky, kx), p: 1, d };
    if (input.joy.on) return { a: input.joy.a, p: input.joy.p, d };
    if (!me || !input.active || touchMode) return { a: me ? me.face : 0, p: 0, d };
    const [sx, sy] = toScreen(me.x, me.y);
    const dx = input.x - sx, dy = input.y - sy, dist = Math.hypot(dx, dy);
    return { a: Math.atan2(dy, dx), p: Math.min(1, Math.max(0, (dist - 10) / 110)), d };
  }

  // ---------- quests ----------
  function quest(id, amount) {
    const done = D.progress(save, id, amount);
    if (done) { toast(`Quest complete: ${D.label(done)}! Claim it in Daily.`); A.play('coin'); refreshBadge(); }
  }

  // ---------- events → sound and effects ----------
  function nameOf(view, id) { const b = view.balls.find(x => x.id === id) || (view.names && view.names[id]); return b ? b.name : '???'; }
  function near(x, y) { const [sx, sy] = toScreen(x, y); return sx > -80 && sx < W + 80 && sy > -80 && sy < H + 80; }
  const PU_NAME = { shield: 'SHIELD', magnet: 'MAGNET', mega: 'MEGA HIT', boost: 'BOOST', freeze: 'FREEZE' };

  // each orb has its own voice: small orbs squeak, big ones and the Titan grumble
  function pitchOf(b) { return (b.skin === 99 ? 190 : 470 + ((b.id * 137) % 330)) * Math.pow(Sim.START_R / b.r, .35); }
  function say(view, id, kind, meId, chance) {
    if (chance != null && Math.random() > chance) return;
    const b = view.balls.find(x => x.id === id);
    if (!b) return;
    const mine = id === meId;
    if (!mine && !near(b.x, b.y)) return;
    A.voice(kind, pitchOf(b), mine ? 1 : .5);
  }
  let chatterAt = 3;
  function idleChatter(view) {
    if (clock < chatterAt) return;
    chatterAt = clock + 2.5 + Math.random() * 3;
    const list = view.balls.filter(b => !b.falling && near(b.x, b.y));
    if (list.length) { const b = list[(Math.random() * list.length) | 0]; A.voice('chatter', pitchOf(b), .35); }
  }

  function colorOf(view, id) { const b = view.balls.find(x => x.id === id); return b ? skinFor(b).c : '#ffffff'; }

  function handleEvents(view, events, meId) {
    for (const ev of events) {
      if (ev.e === 'bonk') {
        const p = ev.pow, ca = colorOf(view, ev.a), cb = colorOf(view, ev.b);
        fx(ev.x, ev.y, 'flash', '#ffffff', 22 + p * 50, .2 + p * .1);
        fx(ev.x, ev.y, 'ring', p > .6 ? '#ffcc3d' : '#ffffff', 28 + p * 70, .3 + p * .15);
        burst(ev.x, ev.y, 6 + (p * 14 | 0), ['#ffffff', ca, cb, '#ffcc3d'], 220 + p * 220, 2 + p, .3 + p * .15, 'spark');
        if (p > .5) burst(ev.x, ev.y, 2 + (p * 5 | 0), [ca, cb], 200 + p * 150, 3 + p * 2, .5, 'shard');
        const mine = ev.a === meId || ev.b === meId;
        if (mine || near(ev.x, ev.y)) A.play('bonk', mine ? p : p * .4);
        if (p > .35) {
          const ba = view.balls.find(x => x.id === ev.a), bb = view.balls.find(x => x.id === ev.b);
          if (ba && bb) { const loser = ba.r < bb.r ? ba : bb; say(view, loser.id, p > .7 ? 'dizzy' : (Math.random() < .5 ? 'oof' : 'eep'), meId); }
        }
        if (mine) {
          shake = Math.max(shake, 3 + p * 8);
          if (p > .7) { hitstop = Math.max(hitstop, .05); screenFlash('#ffcc3d', .08 + p * .06); }
        }
      } else if (ev.e === 'eat') {
        fx(ev.x, ev.y, 'glow', PELLET_COLORS[ev.k], 22, .3);
        burst(ev.x, ev.y, 4, PELLET_COLORS[ev.k], 160, 1.8, .3, 'spark');
        if (ev.id === meId) { A.play('eat', ev.k); quest('eat', 1); say(view, meId, 'nom', meId, .2); }
      } else if (ev.e === 'dash') {
        const c = colorOf(view, ev.id);
        fx(ev.x, ev.y, 'ring', c, 40, .3); fx(ev.x, ev.y, 'glow', c, 28, .25);
        say(view, ev.id, 'hup', meId, ev.id === meId ? 1 : .5);
        if (ev.id === meId) { A.play('dash'); quest('dash', 1); shake = Math.max(shake, 4); }
      } else if (ev.e === 'bump' || ev.e === 'block') {
        fx(ev.x, ev.y, 'flash', '#ff4fd8', 30, .2);
        burst(ev.x, ev.y, 6, ['#ff4fd8', '#ffffff', '#46e6ff'], 260, 2, .3, 'spark');
        if (near(ev.x, ev.y)) A.play('bump');
      } else if (ev.e === 'pu') {
        const c = PU_COLORS[ev.type];
        fx(ev.x, ev.y, 'beam', c, 120, .5); fx(ev.x, ev.y, 'ring', c, 60, .4); fx(ev.x, ev.y, 'flash', c, 45, .3);
        burst(ev.x, ev.y, 12, [c, '#ffffff'], 260, 2.2, .45, 'spark');
        if (ev.id === meId) { A.play('coin'); floatText(ev.x, ev.y - 24, PU_NAME[ev.type] + '!', PU_COLORS[ev.type], 28); quest('pu', 1); A.announce(ev.type, 1); }
        say(view, ev.id, 'ooh', meId);
      } else if (ev.e === 'out') {
        const victim = nameOf(view, ev.id), by = ev.by ? nameOf(view, ev.by) : null;
        feed(by ? `${by} bonked ${victim} into the void!` : `${victim} fell into the void!`);
        say(view, ev.id, 'scream', meId);
        if (ev.by === meId) { const b = view.balls.find(x => x.id === meId); if (b) setTimeout(() => A.voice('laugh', pitchOf(b), 1, true), 300); }
        else if (ev.by) { const v = view; setTimeout(() => say(v, ev.by, 'giggle', meId), 350); }
        if (ev.by) {
          Art.happy(ev.by, clock, ev.by === meId ? 1.6 : .9);
          const v = view.balls.find(x => x.id === ev.id), k = view.balls.find(x => x.id === ev.by);
          if (v && k) { koBurst(v.x, v.y, k, v); if (near(v.x, v.y)) shake = Math.max(shake, 5); }
        }
        if (ev.by === meId) {
          const b = view.balls.find(x => x.id === meId), v = view.balls.find(x => x.id === ev.id);
          if (v) floatText(v.x, v.y - v.r - 10, 'KO!', '#ff4fd8', 34);
          if (b) floatText(b.x, b.y - b.r - 30, '+5', '#ffcc3d', 22);
          screenFlash(colorOf(view, meId), .12); shake = Math.max(shake, 9);
          A.play('coin'); A.play('ko'); quest('bonk', 1);
          koStreak++; A.announce(koStreak === 3 ? 'fire' : ['ko', 'ko2', 'ko3'][(Math.random() * 3) | 0], koStreak === 3 ? 2 : 1);
          if (run && mode === 'level') { run.kos++; run.score += 25; }
        }
      } else if (ev.e === 'crumble') {
        fx(ev.x, ev.y, 'flash', '#ff8a3b', 50, .3);
        burst(ev.x, ev.y, 10, ['#ff8a3b', '#ffcc3d', '#5a2a1a'], 200, 5, .6, 'shard');
        if (near(ev.x, ev.y)) A.play('splash');
      } else if (ev.e === 'slamwarn') {
        say(view, ev.id, 'dizzy', meId);
      } else if (ev.e === 'slam') {
        fx(ev.x, ev.y, 'ring', '#ff3b3b', ev.r, .55); fx(ev.x, ev.y, 'ring', '#ffcc3d', ev.r * .7, .45); fx(ev.x, ev.y, 'flash', '#ff6a2a', 120, .35);
        burst(ev.x, ev.y, 26, ['#ff3b3b', '#ffcc3d', '#ffffff'], 520, 3, .6, 'spark');
        if (near(ev.x, ev.y)) { A.play('bonk', 1); A.play('ko'); shake = Math.max(shake, 14); screenFlash('#ff3b3b', .12); }
      } else if (ev.e === 'meteor') {
        fx(ev.x, ev.y, 'flash', '#ffb347', 110, .35); fx(ev.x, ev.y, 'ring', '#ff6a2a', 105, .45);
        burst(ev.x, ev.y, 14, ['#ff6a2a', '#ffcc3d', '#ffffff'], 380, 3, .5, 'spark'); burst(ev.x, ev.y, 6, ['#6b4a3a', '#ff8a3b'], 260, 5, .7, 'shard');
        if (near(ev.x, ev.y)) { A.play('bonk', .8); shake = Math.max(shake, 8); }
      } else if (ev.e === 'arena') {
        arenaBanner(ARENA_EV[ev.k]); A.play('wave'); A.announce(ev.k, 2);
      } else if (ev.e === 'splash') {
        const col = colorOf(view, ev.id);
        fx(ev.x, ev.y, 'implode', col, ev.r * 2.5, .5);
        fx(ev.x, ev.y, 'flash', col, ev.r * 1.8, .4);
        burst(ev.x, ev.y, 16, [col, '#ffffff'], 280, 2.2, .6, 'spark');
        if (ev.id === meId || near(ev.x, ev.y)) A.play('splash');
        if (ev.id === meId) { shake = Math.max(shake, 10); screenFlash('#ff4d6a', .15); }
      }
    }
  }

  function feed(msg) {
    const f = $('feed'), s = document.createElement('span');
    s.textContent = msg; f.appendChild(s);
    setTimeout(() => s.remove(), 3500);
    while (f.children.length > 4) f.firstChild.remove();
  }
  // big banner when an arena event starts
  const ARENA_EV = { meteors: 'METEOR SHOWER', gravity: 'GRAVITY SHIFT', blackout: 'BLACKOUT' };
  let bannerTimer = 0;
  function arenaBanner(txt) {
    const cm = $('centerMsg'); cm.innerHTML = `${txt}<small>watch out!</small>`;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { if (cm.textContent.startsWith(txt)) cm.textContent = ''; }, 1800);
  }

  let toastTimer = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200); }

  // ---------- modes ----------
  let mode = 'menu';           // 'menu' | 'level' | 'online'
  let paused = false;          // player opened the pause menu
  let hostPaused = false;      // the portal asked the game to pause (ad, hidden tab)
  let L = null;                // level session
  let demo = null;             // menu background world
  let N = null;                // online session
  let slowUntil = 0;           // slow motion after a winning knock-out



  function newDemo() {
    const lv = Object.assign({}, Sim.LEVELS.find(l => l.name === 'Grid Rush'), { bots: 7, time: 9999 });
    const w = Sim.createWorld(lv); Sim.fillBots(w, 8);
    demo = { w };
  }
  function viewOf(w, meId) {
    for (const b of w.balls) b.me = b.id === meId;
    return { lv: w.lv, R: w.R, t: w.t, balls: w.balls.filter(b => b.alive), pellets: w.pellets, bumpers: w.bumpers, powerups: w.powerups, freezeBy: w.freezeT > 0 ? w.freezeBy : 0, windA: w.windA, tiles: w.tiles, sinks: Sim.sinks(w), meteors: w.meteors, ev: w.ev };
  }

  function showScreen(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }
  function hideScreens() { for (const s of document.querySelectorAll('.screen')) s.hidden = true; }

  // ---------- endless run: waves until you fall ----------
  let run = null, koStreak = 0;
  const PRAISE = ['great', 'awesome', 'amazing', 'perfect', 'wow', 'champ', 'super'];

  // A run is saved at the start of every wave, so you can carry on from that wave later or after falling.
  function startRun(fresh) {
    if (!fresh && save.run) { run = Object.assign({ wave: 1, score: 0, kos: 0, coins: 0, mods: {}, continued: false }, save.run); run.wave--; }
    else run = { wave: 0, score: 0, kos: 0, coins: 0, mods: {}, continued: false };
    nextWave();
  }
  function retryWave() { startRun(false); }

  // battle song for each arena look (indexes into the battle playlist)
  const TRACK_OF = { light: [1, 4], mint: [4, 1], lilac: [1, 2], sunrise: [4, 2], dusk: [3, 5], cyber: [0, 3], frost: [4, 1], synth: [2, 0], inferno: [5, 3], aurora: [1, 4] };
  function nextWave() {
    A.init(); A.startMusic();
    run.wave++;
    save.run = { wave: run.wave, score: run.score, kos: run.kos, coins: run.coins, mods: run.mods, continued: run.continued }; store();
    const lv = Sim.makeWave(run.wave);
    const w = Sim.createWorld(lv);
    const me = Sim.setupLevel(w, playerName(), save.skin, myColor(), run.mods);
    me.col = save.color;
    L = { n: run.wave, lv, w, me, cd: 3.4, shown: false, lastBeep: 4 };
    mode = 'level'; paused = false; slowUntil = 0;
    parts.length = 0; texts.length = 0; $('feed').innerHTML = '';
    cam.x = me.x; cam.y = me.y;
    hideScreens(); $('hud').hidden = false;
    $('windPill').hidden = !lv.wind;
    // every orb beams down onto the platform
    for (const b of w.balls) { const c = skinFor(b).c; fx(b.x, b.y, 'beam', c, 220, .9); fx(b.x, b.y, 'ring', c, 60, .6); }
    A.play('wave'); koStreak = 0;
    A.playTrack('battle', (TRACK_OF[lv.theme] || [0])[run.wave % 2]);
    A.ambient(Art.THEMES[lv.theme] && Art.THEMES[lv.theme].sky ? 'wind' : 'space');
    P.levelStarted(run.wave);
  }

  function updateLevel(dt) {
    const w = L.w;
    if (L.cd > 0) {
      L.cd -= dt;
      const sec = Math.ceil(L.cd - .6);
      if (sec !== L.lastBeep) { L.lastBeep = sec; A.play('beep', sec <= 0); A.announce(sec > 0 ? ['', 'one', 'two', 'three'][sec] : L.lv.boss ? 'boss' : 'go', 3); }
      // the goal, said plainly: stay on until the clock runs out, or be the last ball standing
      const goal = `Survive ${Math.round(L.lv.time)}s or bonk them all off`;
      const msg = sec > 0 ? `WAVE ${run.wave}<small>${esc(L.lv.name)}${L.lv.boss ? ' · TITAN IS HERE' : ''}</small><small class="goal">${goal}</small>` : 'GO!';
      if (msg !== L.msg) { L.msg = msg; $('centerMsg').innerHTML = msg; }
      if (L.cd <= 0) $('centerMsg').textContent = '';
      return;
    }
    if (hitstop > 0) { hitstop -= dt; return; }
    const inp = readInput(L.me.alive && !L.me.falling ? L.me : null);
    let t = clock < slowUntil ? dt * .25 : dt;
    while (t > 0) { const s = Math.min(t, 1 / 60); Sim.step(w, s, { [L.me.id]: inp }); inp.d = false; t -= s; }
    handleEvents(viewOf(w, L.me.id), w.events, L.me.id);
    const ended = w.events.some(e => e.e === 'end');
    w.events.length = 0;
    if (L.shown) return;
    const out = L.me.falling || !L.me.alive;
    if (out) {
      L.shown = true;
      const sess = L; setTimeout(() => gameOver(sess), 1400);
      A.play('over'); A.announce('over', 3);
    } else if (ended) {
      L.shown = true;
      slowUntil = clock + 1.6;
      celebrate(L.me.x, L.me.y, 140);
      A.play('clear'); quest('win', 1); A.voice('yay', pitchOf(L.me), 1); A.announce(PRAISE[(Math.random() * PRAISE.length) | 0], 3);
      const bonus = 100 + run.wave * 20;
      run.score += bonus; floatText(L.me.x, L.me.y - L.me.r - 30, `+${bonus}`, '#7dff9b', 30);
      const coins = 10 + run.wave * 2; run.coins += coins; save.coins += coins; store(); refreshCoins();
      P.levelEnded(run.wave, true);
      const sess = L; setTimeout(() => showPerks(sess), 2200);
    }
  }

  const PERK_ICON = {
    heavy: '<circle cx="12" cy="13" r="7"/><path d="M9 6h6"/>',
    dash: '<path d="M4 12h9M7 7h8M7 17h8M15 7l5 5-5 5"/>',
    power: '<path d="M13 3 6 14h5l-1 7 7-11h-5z"/>',
    speed: '<path d="M5 18 12 6l7 12"/><path d="M8 18h8"/>',
    magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4M6 8h4M14 8h4"/>',
    shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/>',
    grow: '<circle cx="9" cy="14" r="4"/><circle cx="16" cy="9" r="5"/>',
    steady: '<path d="M4 20h16M7 20V10l5-5 5 5v10"/>',
  };
  function showPerks(sess) {
    if (mode !== 'level' || L !== sess) return;
    if (paused || hostPaused) { setTimeout(() => showPerks(sess), 300); return; }
    const keys = Object.keys(Sim.PERKS).filter(k => (run.mods[k] || 0) < 3).sort(() => Math.random() - .5).slice(0, 3);
    $('perkTitle').textContent = `Wave ${run.wave} cleared!`;
    $('perkNote').textContent = `Score ${run.score} · pick a boost for wave ${run.wave + 1}`;
    const grid = $('perkGrid'); grid.innerHTML = '';
    keys.forEach((k, i) => {
      const p = Sim.PERKS[k], lvl = run.mods[k] || 0;
      const b = document.createElement('button'); b.className = 'perk'; b.id = 'perk-' + i;
      b.innerHTML = `<svg viewBox="0 0 24 24">${PERK_ICON[k]}</svg><b>${esc(p.name)}</b><span>${esc(p.text)}</span><small>${'●'.repeat(lvl + 1)}${'○'.repeat(2 - lvl)}</small>`;
      b.onclick = () => { run.mods[k] = lvl + 1; A.play('perk'); P.breakAd(); nextWave(); };
      grid.appendChild(b);
    });
    showScreen('perks');
  }

  function gameOver(sess) {
    if (mode !== 'level' || L !== sess) return;
    if (paused || hostPaused) { setTimeout(() => gameOver(sess), 300); return; }
    P.levelEnded(run.wave, false);
    const best = save.best || { score: 0, wave: 0 };
    const record = run.score > best.score;
    if (record) save.best = { score: run.score, wave: run.wave };
    store();
    if (record && run.score > 0) { confettiRain(180); A.play('clear'); A.announce('record', 3); }
    submitRun(run.score, run.wave).then(r => { if (r && L === sess && !$('result').hidden) $('resNote').textContent += ` · World rank #${r.rank} of ${r.players}`; });
    const canContinue = !run.continued && P.rewardedSupported;
    showResult({
      title: record && run.score > 0 ? 'New record!' : run.wave >= 10 ? 'What a run!' : run.wave >= 5 ? 'So close!' : 'Game over', win: record && run.score > 0,
      wave: run.wave,
      stats: [['KOs', run.kos], ['Score', run.score], ['Coins', '+' + run.coins]], coins: run.coins,
      best: record ? { text: 'New personal best!', now: 1, of: 1 } : best.score <= 0 ? null : { text: `${Math.max(0, best.score - run.score)} points to your best (${best.score}, wave ${best.wave})`, now: run.score, of: best.score },
      note: record ? 'Your best run so far.' : '',
      main: canContinue ? 'Continue · watch ad' : null, retry: run.wave > 1 ? `Retry wave ${run.wave}` : 'Play again',
      actions: {
        main: async () => {
          $('resMain').disabled = true;
          const earned = await P.rewardedAd('continue');
          $('resMain').disabled = false;
          if (!earned) return;
          run.continued = true; run.wave--; nextWave();
        },
        retry: retryWave, home: goHome,
      },
    });
  }

  let lastReward = 0, resultAction = null;
  function showResult(o) {
    $('resTitle').textContent = o.title; $('resTitle').classList.toggle('win', o.win);
    $('resStats').innerHTML = o.stats.map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join('');
    // the player's own ball on the result card, with how far they got
    const rc = $('resBall').getContext('2d'); rc.clearRect(0, 0, 220, 150);
    const sk = mySkin(), g = rc.createRadialGradient(110, 128, 0, 110, 128, 90); g.addColorStop(0, sk.c + '55'); g.addColorStop(1, 'rgba(0,0,0,0)');
    rc.fillStyle = g; rc.fillRect(0, 60, 220, 90);
    rc.fillStyle = 'rgba(0,0,0,.45)'; rc.beginPath(); rc.ellipse(110, 126, 46, 9, 0, 0, Math.PI * 2); rc.fill();
    drawBall(rc, 110, 78, 50, sk, { front: true, t: clock, expr: o.win ? 'n' : 'fall' });
    $('resWave').textContent = o.wave ? `Wave ${o.wave}` : (o.place ? `Team #${o.place}` : '');
    $('resWave').hidden = !$('resWave').textContent;
    const rb = $('resBest'); rb.hidden = !o.best;
    if (o.best) { const pct = Math.min(100, Math.round(o.best.now / Math.max(1, o.best.of) * 100)); $('resBestText').textContent = o.best.text; $('resBestBar').style.width = pct + '%'; $('resBestBar').style.background = pct >= 100 ? 'var(--amber)' : 'var(--cyan)'; }
    resultStars(o.win);
    $('resNote').textContent = o.note;
    lastReward = o.coins;
    $('resDouble').hidden = !P.rewardedSupported || o.coins <= 0;
    $('resMain').hidden = !o.main; if (o.main) $('resMain').textContent = o.main;
    $('resRetry').hidden = !o.retry; if (o.retry) $('resRetry').textContent = o.retry;
    resultAction = o.actions;
    showScreen('result');
    P.breakAd();
  }
  // little stars drift up behind the ball while the result is shown
  let starTimer = 0;
  function resultStars(win) {
    clearInterval(starTimer);
    const card = $('result').querySelector('.card');
    for (const s of card.querySelectorAll('.res-star')) s.remove();
    if (reduceMotion) return;
    starTimer = setInterval(() => {
      if ($('result').hidden) { clearInterval(starTimer); return; }
      const s = document.createElement('i'); s.className = 'res-star';
      s.style.left = (8 + Math.random() * 84) + '%'; s.style.animationDuration = (2.5 + Math.random() * 2) + 's';
      s.style.background = win ? ['#ffcc3d', '#fff', '#46e6ff'][Math.random() * 3 | 0] : ['#46e6ff', '#b77dff'][Math.random() * 2 | 0];
      card.appendChild(s); setTimeout(() => s.remove(), 4600);
    }, win ? 180 : 420);
  }
  $('resMain').onclick = () => { A.play('click'); resultAction.main(); };
  $('resRetry').onclick = () => { A.play('click'); resultAction.retry(); };
  $('resHome').onclick = () => { A.play('click'); resultAction.home(); };
  $('resDouble').onclick = async () => {
    A.play('click'); $('resDouble').disabled = true;
    const earned = await P.rewardedAd('double_coins');
    $('resDouble').disabled = false;
    if (!earned) return;
    save.coins += lastReward; store(); refreshCoins();
    $('resDouble').hidden = true;
    A.play('coin'); toast(`+${lastReward} bonus coins!`);
  };

  function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }

  function goHome() {
    A.ambient('');
    if (N) { N.leaving = true; N.ws.close(); N = null; }
    mode = 'menu'; paused = false; L = null; run = null; slowUntil = 0;
    $('hud').hidden = true; $('centerMsg').textContent = '';
    renderHome(); showScreen('home');
  }

  function togglePause() {
    if (mode === 'menu' || !$('result').hidden) return;
    paused = !paused;
    $('restartBtn').hidden = mode !== 'level';
    $('resumeBtn').textContent = mode === 'online' ? 'Back to game' : 'Resume';
    if (paused) showScreen('pause'); else hideScreens();
  }
  $('pauseBtn').onclick = () => { A.play('click'); togglePause(); };
  $('resumeBtn').onclick = () => { A.play('click'); togglePause(); };
  // 'Start over' in the pause menu restarts the current wave (online: reconnects)
  $('restartBtn').onclick = () => { A.play('click'); paused = false; retryWave(); };
  $('quitBtn').onclick = () => { A.play('click'); goHome(); };

  // ---------- online ----------
  const SERVER = window.BONK_SERVER || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  const API = SERVER.replace(/^ws/, 'http').replace(/\/ws$/, '');
  const INTERP = 110;
  const onlineAvailable = () => !window.BONK_OFFLINE && P.canReachServer;

  // the player's look: chosen skin, optionally in a chosen colour (save.color = index in Sim.COLORS, -1 = the skin's own)
  function mySkin() { return skinFor({ skin: save.skin, col: save.color }); }
  function myColor() { return mySkin().c; }

  // Free hosting puts the server to sleep when nobody plays; the first player wakes it up (about a minute).
  async function wakeServer() {
    const t0 = Date.now();
    for (let i = 0; ; i++) {
      try { const r = await fetch(API + '/health', { signal: AbortSignal.timeout(8000), cache: 'no-store' }); if (r.ok) return true; } catch (e) {}
      if (mode !== 'online' || Date.now() - t0 > 90000) return false;
      $('centerMsg').innerHTML = `<small>Waking up the server… ${Math.round((Date.now() - t0) / 1000)}s</small><small class="goal">The first player of the day waits about a minute</small>`;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  async function startOnline(party) {
    A.init(); A.startMusic();
    mode = 'online'; paused = false; N = null;
    hideScreens(); $('hud').hidden = false; $('windPill').hidden = true;
    $('centerMsg').innerHTML = '<small>Connecting…</small>';
    if (!(await wakeServer())) { if (mode === 'online') { toast('The game server is not answering. Try again in a minute.'); goHome(); } return; }
    if (mode !== 'online') return;
    let ws;
    try { ws = new WebSocket(SERVER); } catch (e) { toast('Could not reach the game server.'); goHome(); return; }
    N = { ws, id: 0, names: {}, lv: Sim.ONLINE, bumpers: [], snaps: [], ph: 'wait', cd: 0, lastSend: 0, inRound: false, resultShown: false, leaving: false, lastBeep: 99 };
    parts.length = 0; texts.length = 0; $('feed').innerHTML = '';
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: playerName(), skin: save.skin, col: save.color, uid: save.uid, color: myColor(), party: party || null }));
    ws.onmessage = m => onNet(JSON.parse(m.data));
    ws.onclose = () => { if (N && !N.leaving) { toast('Lost connection to the game server.'); goHome(); } };
    ws.onerror = () => { /* onclose follows */ };
  }

  function onNet(msg) {
    if (!N) return;
    if (msg.t === 'welcome') N.id = msg.id;
    else if (msg.t === 'roster') { N.names = {}; for (const [id, name, skin, , col, team] of msg.list) N.names[id] = { name, skin, col, team }; }
    else if (msg.t === 'round') {
      N.lv = msg.lv; N.bumpers = msg.lv.bumpers.map(([x, y, r]) => ({ x, y, r, pulse: 0 }));
      N.resultShown = false; N.snaps.length = 0;
      $('windPill').hidden = !msg.lv.wind;
      if (!$('result').hidden) hideScreens();
    } else if (msg.t === 's') {
      msg.at = performance.now();
      N.snaps.push(msg); if (N.snaps.length > 6) N.snaps.shift();
      N.ph = msg.ph; N.cd = msg.cd;
      if (msg.e && msg.e.length) N.pending = (N.pending || []).concat(msg.e);
      if (msg.res && !N.resultShown) { N.resultShown = true; onlineResult(msg.res); }
    }
  }

  function netView() {
    const s = N.snaps;
    const empty = { lv: N.lv, R: N.lv.rMax, balls: [], pellets: [], bumpers: N.bumpers, powerups: [], windA: 0, names: N.names };
    if (!s.length) return empty;
    const rt = performance.now() - INTERP;
    let a = s[0], b = s[0];
    for (let i = 0; i < s.length - 1; i++) if (s[i].at <= rt && s[i + 1].at >= rt) { a = s[i]; b = s[i + 1]; break; }
    if (rt > s[s.length - 1].at) { a = b = s[s.length - 1]; }
    const k = a === b ? 1 : (rt - a.at) / (b.at - a.at);
    const prev = {}; for (const r of a.b) prev[r[0]] = r;
    const balls = b.b.map(r => {
      const p = prev[r[0]] || r, nm = N.names[r[0]] || { name: '???', skin: 0, col: -1, team: -1 };
      return {
        id: r[0], name: nm.name, skin: nm.skin, col: nm.col, team: nm.team == null ? -1 : nm.team, x: p[1] + (r[1] - p[1]) * k, y: p[2] + (r[2] - p[2]) * k,
        vx: (r[1] - p[1]) * 20, vy: (r[2] - p[2]) * 20, r: p[3] + (r[3] - p[3]) * k, face: r[4] / 100,
        dashT: r[5] ? .2 : 0, dashCd: r[6] / 10, falling: r[7] / 100, dizzy: r[8] ? .3 : 0, bonks: r[9],
        pu: Sim.PU_TYPES[r[10]] || '', puT: r[11] / 10, me: r[0] === N.id,
      };
    });
    const pellets = []; for (let i = 0; i < b.p.length; i += 3) pellets.push({ x: b.p[i], y: b.p[i + 1], k: b.p[i + 2] });
    const powerups = []; for (let i = 0; i < b.pu.length; i += 3) powerups.push({ x: b.pu[i], y: b.pu[i + 1], type: Sim.PU_TYPES[b.pu[i + 2]] });
    N.bumpers.forEach((bu, i) => { bu.pulse = b.bu[i] / 10; });
    return { lv: N.lv, R: a.R + (b.R - a.R) * k, t: b.T, balls, pellets, bumpers: N.bumpers, powerups, freezeBy: b.fz, windA: 0, names: N.names, T: b.T };
  }

  function updateOnline(view) {
    const me = view.balls.find(x => x.id === N.id);
    N.inRound = !!me;
    if (N.pending) { handleEvents(view, N.pending, N.id); N.pending = null; }
    const now = performance.now();
    if (me && N.ph === 'play' && now - N.lastSend > 50) {
      const inp = readInput(me.falling ? null : me);
      if (N.ws.readyState === 1) N.ws.send(JSON.stringify({ t: 'in', a: +inp.a.toFixed(3), p: +inp.p.toFixed(2), d: inp.d ? 1 : 0 }));
      N.lastSend = now;
    }
    const cm = $('centerMsg');
    if (N.ph === 'wait') {
      const sec = Math.ceil(N.cd);
      if (sec !== N.lastBeep && sec <= 3) { N.lastBeep = sec; A.play('beep', sec <= 0); if (sec > 0) A.announce(['', 'one', 'two', 'three'][sec], 3); }
      const myTeam = N.names[N.id] && Art.TEAMS[N.names[N.id].team];
      const teamTag = myTeam ? `<small class="goal" style="color:${myTeam.c}">You are team ${myTeam.n}</small>` : '';
      cm.innerHTML = sec > 3 ? `<small>Next round in ${sec}…</small>${teamTag}` : `${Math.max(1, sec)}<small>Last team standing wins</small>${teamTag}`;
    } else if (N.ph === 'play') {
      if (!N.inRound) cm.innerHTML = '<small>Watching… you play in the next round</small>';
      else if (N.lastBeep === 1) { A.play('beep', true); A.announce('go', 3); N.lastBeep = 0; N.goUntil = now + 700; cm.textContent = 'GO!'; }
      else if (now > (N.goUntil || 0)) cm.textContent = '';
    } else cm.textContent = '';
  }

  function onlineResult(res) {
    const mine = res.find(r => r[0] === N.id);
    if (!mine) return;
    const [, place, bonks, team, winTeam] = mine;
    const coins = bonks * 5 + (place === 1 ? 25 : place === 2 ? 10 : 2);
    const won = team === winTeam, winner = Art.TEAMS[winTeam];
    save.coins += coins; refreshCoins();
    quest('online', 1);
    if (place === 1) { quest('win', 1); A.play('win'); A.voice('yay', 600, 1); } else A.play('lose');
    store();
    showResult({
      title: won ? 'Your team won!' : winner ? `Team ${winner.n} won` : 'Round over', win: won, place,
      stats: [['Bonks', bonks], ['Coins', '+' + coins]], coins, note: 'The next round starts in a few seconds.',
      main: 'Keep playing', retry: null,
      actions: { main: hideScreens, retry: hideScreens, home: goHome },
    });
  }

  // ---------- HUD ----------
  let hudT = 0;
  function updateHud(view, timeLeft, total) {
    const standing = view.balls.filter(b => !b.falling);
    $('time').textContent = Math.floor(timeLeft / 60) + ':' + String(Math.floor(timeLeft % 60)).padStart(2, '0');
    $('alive').textContent = `${standing.length}/${total}`;
    const sorted = standing.slice().sort((a, b) => b.r - a.r);
    let top = sorted.slice(0, 5);
    const me = sorted.find(b => b.me);
    if (me && !top.includes(me)) top = top.slice(0, 4).concat(me);
    $('board').innerHTML = top.map(b => `<div class="${b.me ? 'me' : ''}"><span class="row-name">${sorted.indexOf(b) + 1}. ${esc(b.name)}</span><span>${Math.round(b.r)}</span></div>`).join('');
    const mb = view.balls.find(b => b.me);
    const charge = mb ? Sim.dashCharge(mb) : 0;
    $('dash').style.setProperty('--p', (100 * charge) + '%'); $('dash').classList.toggle('full', charge >= 1);
    if (view.lv.wind) $('windArrow').style.transform = `rotate(${view.windA}rad)`;
    $('wavePill').hidden = $('scorePill').hidden = mode !== 'level';
    if (run) { $('waveNum').textContent = run.wave; $('scoreNum').textContent = run.score; }
    const pill = $('puPill');
    if (mb && mb.pu) { pill.hidden = false; pill.style.setProperty('--pc', PU_COLORS[mb.pu]); pill.innerHTML = `<i>${PU_NAME[mb.pu]}</i>${Math.ceil(mb.puT)}s`; }
    else pill.hidden = true;
    A.setIntensity(standing.length <= 3 || timeLeft < 20);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    clock += dt;
    let view, follow = null;
    A.setSong(mode === 'menu' ? 'menu' : 'battle');
    if (mode === 'menu' || (mode === 'online' && !N)) {
      // menu, or online while the server is still waking up: the demo arena plays in the background
      A.setIntensity(false);
      Sim.step(demo.w, dt, {}); demo.w.events.length = 0;
      if (demo.w.over || demo.w.balls.filter(b => b.alive).length < 3) newDemo();
      view = viewOf(demo.w, -1);
    } else if (mode === 'level') {
      if (!paused && !hostPaused) updateLevel(dt);
      view = viewOf(L.w, L.me.id);
      if (L.me.alive) follow = L.me;
      else follow = view.balls.slice().sort((a, b) => b.r - a.r)[0] || null;
      if (now - hudT > 120) { updateHud(view, Math.max(0, L.lv.time - L.w.t), L.w.balls.length); hudT = now; }
    } else {
      view = netView();
      updateOnline(view);
      follow = view.balls.find(b => b.me) || view.balls.slice().sort((a, b) => b.r - a.r)[0] || null;
      if (now - hudT > 120) { updateHud(view, Math.max(0, N.lv.time - (view.T || 0)), Object.keys(N.names).length); hudT = now; }
    }
    // camera (zooms in during the slow-motion finish)
    let tz, tx = 0, ty = 0;
    if (follow) { tz = Math.min(W, H) / (420 + follow.r * 6); tx = follow.x + (follow.vx || 0) * .1; ty = follow.y + (follow.vy || 0) * .1; }
    else tz = Math.min(W, H) / (view.R * 2.3);
    tz = Math.min(1.1, tz);
    if (clock < slowUntil) tz *= 1.45;
    cam.z += (tz - cam.z) * Math.min(1, dt * 3);
    cam.x += (tx - cam.x) * Math.min(1, dt * 5); cam.y += (ty - cam.y) * Math.min(1, dt * 5);
    // effects (slowed down with the game during slow motion)
    const edt = clock < slowUntil ? dt * .35 : dt;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= edt; p.x += p.vx * edt; p.y += p.vy * edt; p.vx *= .93; p.vy *= .93; if (p.k === 'conf') p.vy += 160 * edt; p.rot += edt * (p.k === 'shard' ? 12 : 6); if (p.life <= 0) parts.splice(i, 1); }
    if (parts.length > 900) parts.splice(0, parts.length - 900);
    for (let i = texts.length - 1; i >= 0; i--) { texts[i].life -= edt; if (texts[i].life <= 0) texts.splice(i, 1); }
    if (view.lv.wind) {
      while (windBits.length < 40) windBits.push({ x: Math.random() * W, y: Math.random() * H });
      const vx = Math.cos(view.windA) * 260, vy = Math.sin(view.windA) * 260;
      for (const w of windBits) { w.x += vx * dt; w.y += vy * dt; if (w.x < -40 || w.x > W + 40 || w.y < -40 || w.y > H + 40) { w.x = Math.random() * W; w.y = Math.random() * H; if (Math.random() < .5) w.x = vx > 0 ? -30 : W + 30; else w.y = vy > 0 ? -30 : H + 30; } }
    } else windBits.length = 0;
    shake *= Math.exp(-8 * dt);
    flash.a *= Math.exp(-7 * dt);
    if (mode !== 'menu' && !paused) idleChatter(view);
    Art.render(ctx, view, { W, H, DPR, cam, clock, shake, reduce: reduceMotion, parts, texts, windBits, dashCd: Sim.DASH_CD, flash: reduceMotion ? null : flash });
    drawRain(dt);
    requestAnimationFrame(frame);
  }

  // ---------- names ----------
  const ADJ = ['Happy', 'Bouncy', 'Sunny', 'Neon', 'Zippy', 'Jolly', 'Mighty', 'Tiny', 'Cosmic', 'Brave', 'Speedy', 'Sparkly'];
  const ANIMAL = ['Panda', 'Bunny', 'Kitty', 'Puppy', 'Duckling', 'Otter', 'Koala', 'Penguin', 'Fox', 'Frog', 'Hamster', 'Llama'];
  const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'puss', 'nigg', 'fag', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'porn', 'sex', 'anal', 'kurac', 'kurc', 'picka', 'pička', 'jebem', 'jebi', 'jeb', 'govno', 'kurva', 'peder', 'sranje', 'pizda', 'drolja', 'retard'];
  function randomName() { return ADJ[Math.random() * ADJ.length | 0] + ANIMAL[Math.random() * ANIMAL.length | 0]; }
  function cleanName(s) {
    s = String(s || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14);
    const flat = s.toLowerCase().replace(/[^a-zčćšđž]/g, '');
    if (!s || BLOCK.some(w => flat.includes(w))) return '';
    return s;
  }
  function playerName() {
    const typed = $('nameInput').value.trim(), n = cleanName(typed);
    if (n) { if (n !== save.name) { save.name = n; store(); } return n; }
    const r = randomName();
    if (typed) toast('Let’s pick a friendlier name!');
    $('nameInput').value = r; save.name = r; store();
    return r;
  }
  $('nameInput').addEventListener('change', () => playerName());

  // ---------- menus ----------
  function refreshCoins() { for (const el of document.querySelectorAll('.coinCount')) el.textContent = save.coins; }
  function refreshBadge() { const n = D.pending(save); $('dailyBadge').hidden = !n; $('dailyBadge').textContent = n; }

  const seasonEnds = new Date(SEASON.ends).getTime();
  const seasonOn = () => Date.now() < seasonEnds;
  const seasonDays = () => Math.max(0, Math.ceil((seasonEnds - Date.now()) / 864e5));

  function renderHome() {
    if (D.refresh(save, onlineAvailable())) store();
    $('nameInput').value = save.name;
    $('onlineBtn').hidden = $('friendsBtn').hidden = !onlineAvailable();
    const best = save.best;
    const sub = $('playBtn').querySelector('.pb-sub'), saved = save.run && save.run.wave > 1 ? save.run : null;
    $('playBtn').querySelector('.pb-main').textContent = saved ? 'CONTINUE' : 'PLAY';
    sub.hidden = !saved && !(best && best.score);
    sub.textContent = saved ? `Wave ${saved.wave} · score ${saved.score}` : sub.hidden ? '' : `Best ${best.score} · wave ${best.wave}`;
    $('newGameBtn').hidden = !saved;
    refreshCoins(); refreshBadge(); syncToggles();
  }

  function skinButton(s, i) {
    const owned = save.owned.includes(i);
    const b = document.createElement('button');
    b.className = 'skin tier-' + s.tier + (save.skin === i ? ' on' : '') + (owned ? '' : ' locked') + (!owned && save.coins < s.price ? ' poor' : '');
    b.id = 'skin-' + i;
    const cv2 = document.createElement('canvas'); cv2.width = 144; cv2.height = 144;
    drawBall(cv2.getContext('2d'), 72, 76, 44, save.skin === i ? mySkin() : s, { front: true, t: 0 });
    b.appendChild(cv2);
    const nm = document.createElement('span'); nm.textContent = s.n; b.appendChild(nm);
    if (s.tier !== 'free') { const tg = document.createElement('span'); tg.className = 'tier-tag'; tg.textContent = s.season ? 'Season' : TIERS[s.tier].n; b.appendChild(tg); }
    const pr = document.createElement('span'); pr.className = 'price' + (owned ? ' owned' : '');
    pr.innerHTML = owned ? (save.skin === i ? 'Selected' : 'Owned') : `<span class="coin"></span>${s.price}`;
    b.appendChild(pr);
    b.onclick = () => {
      if (owned) { save.skin = i; store(); A.play('click'); renderShop(); return; }
      if (save.coins < s.price) { A.play('click'); toast(`You need ${s.price - save.coins} more coins.`); return; }
      save.coins -= s.price; save.owned.push(i); save.skin = i; store(); A.play('coin'); refreshCoins(); renderShop();
      toast(`${s.n} unlocked!`);
    };
    return b;
  }

  function renderColors() {
    const row = $('colorRow'); row.innerHTML = '';
    [-1].concat(Sim.COLORS.map((_, i) => i)).forEach(i => {
      // colours are for the Classic ball; picking one switches to Classic
      const b = document.createElement('button');
      b.className = 'swatch' + (save.skin === 0 && save.color === i ? ' on' : '');
      b.id = 'color-' + (i < 0 ? 'orig' : i);
      b.setAttribute('aria-label', i < 0 ? 'Skin colour' : 'Colour ' + (i + 1));
      if (i >= 0) b.style.setProperty('--sw', Sim.COLORS[i]);
      else b.style.setProperty('--sw', SKINS[0].c);
      b.onclick = () => { save.color = i; save.skin = 0; store(); A.play('click'); renderShop(); };
      row.appendChild(b);
    });
  }

  function renderShop() {
    renderColors();
    const list = $('typeList'), sg = $('seasonGrid'); list.innerHTML = ''; sg.innerHTML = '';
    for (const tier of ['rare', 'epic', 'legend']) {
      const head = document.createElement('div'); head.className = 'section-label tier-label';
      head.innerHTML = `<b>${TIERS[tier].n}</b><span class="coin"></span>${TIERS[tier].price}`;
      const grid = document.createElement('div'); grid.className = 'skin-grid';
      SKINS.forEach((s, i) => { if (s.tier === tier && !s.season) grid.appendChild(skinButton(s, i)); });
      list.append(head, grid);
    }
    SKINS.forEach((s, i) => { if (s.season && (seasonOn() || save.owned.includes(i))) sg.appendChild(skinButton(s, i)); });
    $('seasonHead').hidden = !seasonOn();
    $('seasonHead').innerHTML = `<b>${esc(SEASON.name)}</b><span>Only until the season ends · ${seasonDays()} days left</span>`;
    sg.hidden = !sg.children.length;
  }

  function renderDaily() {
    D.refresh(save, onlineAvailable());
    const row = $('streakRow'); row.innerHTML = '';
    const claimedToday = save.daily.streakClaimed, count = save.streak.count;
    const todayIdx = claimedToday ? (count - 1) % 7 : count % 7;
    D.STREAK.forEach((r, i) => {
      const d = document.createElement('div');
      const done = claimedToday ? i <= todayIdx : i < todayIdx;
      d.className = 'day' + (done ? ' done' : '') + (i === todayIdx ? ' today' : '');
      d.innerHTML = `<small>Day ${i + 1}</small><b>${r}</b>`;
      row.appendChild(d);
    });
    $('streakClaim').disabled = claimedToday;
    $('streakClaim').textContent = claimedToday ? 'Come back tomorrow' : `Claim ${D.streakReward(save)}`;
    $('streakDouble').hidden = claimedToday || !P.rewardedSupported;
    const ql = $('questList'); ql.innerHTML = '';
    save.daily.quests.forEach((q, i) => {
      const el = document.createElement('div'); el.className = 'quest' + (q.claimed ? ' claimed' : '');
      const pct = Math.round(q.p / q.n * 100);
      el.innerHTML = `<div class="q-text">${esc(D.label(q))}<div class="bar"><span style="width:${pct}%"></span></div><small>${q.p}/${q.n}</small></div>`;
      const btn = document.createElement('button'); btn.className = 'btn amber small';
      btn.id = 'quest-' + i;
      btn.disabled = q.claimed || q.p < q.n;
      btn.innerHTML = q.claimed ? 'Done' : `<span class="coin"></span>${q.reward}`;
      btn.onclick = () => { const r = D.claimQuest(save, i); if (r) { A.play('coin'); store(); refreshCoins(); refreshBadge(); renderDaily(); toast(`+${r} coins!`); } };
      el.appendChild(btn); ql.appendChild(el);
    });
  }
  function claimStreak(mult) {
    const r = D.claimStreak(save, mult);
    if (!r) return;
    A.play('coin'); store(); refreshCoins(); refreshBadge(); renderDaily(); toast(`+${r} coins!`);
  }
  $('streakClaim').onclick = () => claimStreak(1);
  $('streakDouble').onclick = async () => {
    A.play('click'); $('streakDouble').disabled = true;
    const earned = await P.rewardedAd('daily_bonus');
    $('streakDouble').disabled = false;
    if (earned) claimStreak(2);
  };

  // ---------- world leaderboard: best endless runs from every player (database shared with our other games) ----------
  const LB_URL = 'https://pxjlcbjwdalctlyeljql.supabase.co', LB_KEY = 'sb_publishable_bl8XkH55cD8R7M0cdpe6Xw_5osxFI1k';
  async function lbCall(fn, body) {
    const r = await fetch(`${LB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: LB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${fn} failed: ${r.status} ${await r.text()}`);
    return r.json();
  }
  function hexId() { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); }
  function lbIds() { if (!save.lbPid) { save.lbPid = hexId(); save.lbSecret = hexId(); store(); } }
  function country() { const r = (navigator.language || '').split('-')[1]; return r && /^[A-Za-z]{2}$/.test(r) ? r.toUpperCase() : null; }
  async function submitRun(score, wave) {
    if (score <= 0) return null;
    lbIds();
    const name = (save.name || 'Player').slice(0, 16).padEnd(2, '_');
    try { return await lbCall('ba_submit', { p_pid: save.lbPid, p_secret: save.lbSecret, p_name: name, p_cc: country(), p_score: score, p_wave: wave }); }
    catch (e) { console.error('World leaderboard submit failed:', e); return null; }
  }

  let topData = null, topTab = 'day', topErr = false;
  function renderTop() {
    $('tabDay').classList.toggle('on', topTab === 'day'); $('tabDay').setAttribute('aria-selected', topTab === 'day');
    $('tabWeek').classList.toggle('on', topTab === 'all'); $('tabWeek').setAttribute('aria-selected', topTab === 'all');
    const list = $('topList');
    if (topErr) { list.innerHTML = '<li class="empty">The world leaderboard is not reachable right now.</li>'; return; }
    if (!topData || !topData[topTab]) { list.innerHTML = '<li class="empty">Loading…</li>'; return; }
    const rows = topData[topTab];
    list.innerHTML = rows.length
      ? rows.map(r => `<li class="${r.me ? 'me' : ''}"><span class="rank">${r.pos}</span><span class="nm">${esc(r.name)}${r.cc ? ` <small>${esc(r.cc)}</small>` : ''}</span><span class="wv">W${r.wave}</span><b>${r.score}</b></li>`).join('')
      : '<li class="empty">No scores yet today. Play and take first place!</li>';
  }
  async function loadTop(period) {
    lbIds();
    try { topData[period] = await lbCall('ba_top', { p_period: period, p_limit: 50, p_pid: save.lbPid }); topErr = false; }
    catch (e) { console.error('World leaderboard failed:', e); topErr = true; }
    renderTop();
  }
  function openTop() { topData = {}; topErr = false; renderTop(); showScreen('top'); loadTop(topTab); }
  $('tabDay').onclick = () => { topTab = 'day'; renderTop(); if (!topData[topTab]) loadTop(topTab); };
  $('tabWeek').onclick = () => { topTab = 'all'; renderTop(); if (!topData[topTab]) loadTop(topTab); };

  function syncToggles() {
    for (const id of ['sfxBtn', 'sfxBtn2']) $(id).setAttribute('aria-pressed', save.sfx);
    for (const id of ['musicBtn', 'musicBtn2']) $(id).setAttribute('aria-pressed', save.music);
    for (const id of ['voiceBtn', 'voiceBtn2']) $(id).setAttribute('aria-pressed', save.voice);
    A.setSfx(save.sfx); A.setMusic(save.music); A.setVoice(save.voice);
  }
  for (const id of ['sfxBtn', 'sfxBtn2']) $(id).onclick = () => { A.init(); save.sfx = !save.sfx; store(); syncToggles(); A.play('click'); };
  for (const id of ['musicBtn', 'musicBtn2']) $(id).onclick = () => { A.init(); A.startMusic(); save.music = !save.music; store(); syncToggles(); };
  for (const id of ['voiceBtn', 'voiceBtn2']) $(id).onclick = () => { A.init(); save.voice = !save.voice; store(); syncToggles(); A.play('click'); };

  $('playBtn').onclick = () => { A.init(); A.startMusic(); A.play('click'); playerName(); startRun(false); };
  $('newGameBtn').onclick = () => { A.init(); A.startMusic(); A.play('click'); playerName(); save.run = null; store(); startRun(true); };
  $('onlineBtn').onclick = () => { A.init(); A.play('click'); playerName(); startOnline(null); };

  // ---------- play with friends: an invite code puts everyone who uses it in one team ----------
  let partyCode = '';
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), v => CODE_CHARS[v % CODE_CHARS.length]).join('');
  const inviteUrl = code => location.href.split(/[?#]/)[0] + '?team=' + code;
  function openParty(code, invited) {
    partyCode = code;
    $('partyCode').textContent = code;
    $('partyTitle').textContent = invited ? "You're invited!" : 'Play with friends';
    $('partyNote').textContent = invited ? 'A friend invited you to their team. Tap Play together to join them.' : 'Send the invite to your friends. Everyone who opens it plays in your team, against the other teams.';
    $('partyInput').value = '';
    showScreen('party');
  }
  $('friendsBtn').onclick = () => { A.init(); A.play('click'); openParty(partyCode || newCode(), false); };
  $('partyInvite').onclick = async () => {
    A.play('click');
    const url = inviteUrl(partyCode), text = `Join my team in Bonkers Arena! Code ${partyCode}`;
    if (navigator.share) { try { await navigator.share({ title: 'Bonkers Arena', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); toast('Invite link copied. Send it to your friends!'); }
    catch (e) { toast(`Your team code: ${partyCode}`); }
  };
  $('partyPlay').onclick = () => { A.init(); A.play('click'); playerName(); startOnline(partyCode); };
  $('partyJoin').onclick = () => {
    const code = $('partyInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { toast('A team code has 5 letters and numbers.'); return; }
    A.init(); A.play('click'); partyCode = code; playerName(); startOnline(code);
  };
  $('shopBtn').onclick = () => { A.init(); A.startMusic(); A.play('click'); renderShop(); showScreen('shop'); };
  $('dailyBtn').onclick = () => { A.init(); A.startMusic(); A.play('click'); renderDaily(); showScreen('daily'); };
  $('topBtn').onclick = () => { A.init(); A.startMusic(); A.play('click'); openTop(); };
  for (const b of document.querySelectorAll('[data-go="home"]')) b.onclick = () => { A.play('click'); renderHome(); showScreen('home'); };

  // first gesture anywhere starts audio (browsers require it)
  addEventListener('pointerdown', () => { A.init(); A.startMusic(); }, { once: true });

  // ---------- start ----------
  async function boot() {
    await P.init();
    const saved = await P.load();
    if (saved) Object.assign(save, saved);
    // old saves had skins; they became ball types, so coins spent on old skins come back
    if (!saved || saved.v !== 2) {
      const OLD = [0, 0, 0, 0, 60, 80, 100, 120, 150, 180, 220, 260, 300, 400, 500, 700, 300, 350, 450];
      const back = (save.owned || []).reduce((s, i) => s + (OLD[i] || 0), 0);
      save.coins += back; save.owned = [0]; save.skin = 0; save.v = 2;
      if (back) setTimeout(() => toast(`Skins are now ball types. ${back} coins refunded!`), 1500);
      store();
    }
    if (!save.uid) save.uid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    if (!save.name) save.name = randomName();
    // portal pause and sound requests (ads, hidden tab)
    A.setHostMute(!P.audioAllowed);
    P.onAudio(on => A.setHostMute(!on));
    P.onPause(p => { hostPaused = p; A.setHostMute(p || !P.audioAllowed); });
    store();
    newDemo();
    renderHome();
    showScreen('home');
    // opened from a friend's invite link
    const invite = (new URLSearchParams(location.search).get('team') || '').toUpperCase();
    if (/^[A-Z0-9]{5}$/.test(invite) && onlineAvailable()) openParty(invite, true);
    requestAnimationFrame(t => { frame(t); P.gameReady(); });
  }
  boot().catch(e => {
    console.error('Game failed to start:', e);
    document.body.insertAdjacentHTML('beforeend', '<div class="toast">The game could not start. Please reload the page.</div>');
  });
})();
