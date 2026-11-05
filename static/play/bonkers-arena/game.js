// Bonkers Arena — client: menus, levels, online play, daily quests, leaderboard.
(function () {
  const TAU = Math.PI * 2;
  const $ = id => document.getElementById(id);
  const A = window.Audio2, P = window.Platform, D = window.Daily;
  const { SKINS, SEASON, skinOf, skinFor, drawBall, PELLET_COLORS, PU_COLORS } = window.Art;

  // ---------- save (stored through the portal SDK) ----------
  const save = { uid: '', name: '', coins: 0, skin: 0, owned: [0, 1, 2, 3], stars: {}, sfx: true, music: true, daily: null, streak: null };
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
  function floatText(x, y, txt, col, size) { texts.push({ x, y, txt, col, size, life: 1.1, max: 1.1 }); }

  function fx(x, y, kind, c, s, life) { parts.push({ x, y, vx: 0, vy: 0, life, max: life, c, s, k: kind, rot: 0 }); }

  // knock-out explosion in the style of the winner's skin
  const KO_STYLE = { fire: ['#ff6a2a', '#ffcc3d', '#ffffff'], zap: ['#ffffff', '#46e6ff', '#ff4fd8'], rainbow: ['#ff4fd8', '#ffcc3d', '#7dff9b', '#46e6ff', '#b77dff'], aurora: ['#3dffb8', '#b77dff', '#ffffff'], stars: ['#ffffff', '#c9c2ff'], gold: ['#ffe680', '#ffffff'], ice: ['#d8f6ff', '#ffffff'], smoke: ['#dfe6ff', '#8a93b8'] };
  function koBurst(x, y, killer, victim) {
    const s = skinFor(killer), cols = KO_STYLE[s.trail] || [s.c, '#ffffff'];
    fx(x, y, 'flash', cols[0], 170, .45);
    fx(x, y, 'beam', cols[0], 320, .9);
    fx(x, y, 'ring', cols[0], 230, .6);
    fx(x, y, 'ring', '#ffffff', 140, .4);
    burst(x, y, 46, cols, 700, 3.5, .9, 'spark');
    burst(x, y, 16, [skinFor(victim).c, '#ffffff'], 520, 7, 1, 'shard');
    if (s.trail === 'rainbow' || s.trail === 'gold') burst(x, y, 30, cols, 500, 6, 1.4, 'conf');
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

  function colorOf(view, id) { const b = view.balls.find(x => x.id === id); return b ? skinFor(b).c : '#ffffff'; }

  function handleEvents(view, events, meId) {
    for (const ev of events) {
      if (ev.e === 'bonk') {
        const p = ev.pow, ca = colorOf(view, ev.a), cb = colorOf(view, ev.b);
        fx(ev.x, ev.y, 'flash', '#ffffff', 40 + p * 110, .25 + p * .15);
        fx(ev.x, ev.y, 'ring', p > .6 ? '#ffcc3d' : '#ffffff', 50 + p * 160, .35 + p * .2);
        burst(ev.x, ev.y, 10 + (p * 30 | 0), ['#ffffff', ca, cb, '#ffcc3d'], 380 + p * 420, 2.5 + p * 1.5, .4 + p * .25, 'spark');
        if (p > .4) burst(ev.x, ev.y, 4 + (p * 10 | 0), [ca, cb], 300 + p * 300, 4 + p * 4, .7, 'shard');
        const mine = ev.a === meId || ev.b === meId;
        if (mine || near(ev.x, ev.y)) A.play('bonk', mine ? p : p * .4);
        if (mine) {
          shake = Math.max(shake, 5 + p * 16);
          if (p > .6) { hitstop = Math.max(hitstop, .07); screenFlash('#ffcc3d', .18 + p * .12); }
        }
      } else if (ev.e === 'eat') {
        fx(ev.x, ev.y, 'glow', PELLET_COLORS[ev.k], 22, .3);
        burst(ev.x, ev.y, 4, PELLET_COLORS[ev.k], 160, 1.8, .3, 'spark');
        if (ev.id === meId) { A.play('eat', ev.k); quest('eat', 1); }
      } else if (ev.e === 'dash') {
        const c = colorOf(view, ev.id);
        fx(ev.x, ev.y, 'ring', c, 70, .35); fx(ev.x, ev.y, 'glow', c, 50, .3);
        if (ev.id === meId) { A.play('dash'); quest('dash', 1); shake = Math.max(shake, 4); }
      } else if (ev.e === 'bump' || ev.e === 'block') {
        fx(ev.x, ev.y, 'flash', '#ff4fd8', 60, .25);
        burst(ev.x, ev.y, 12, ['#ff4fd8', '#ffffff', '#46e6ff'], 420, 2.5, .35, 'spark');
        if (near(ev.x, ev.y)) A.play('bump');
      } else if (ev.e === 'pu') {
        const c = PU_COLORS[ev.type];
        fx(ev.x, ev.y, 'beam', c, 220, .7); fx(ev.x, ev.y, 'ring', c, 120, .5); fx(ev.x, ev.y, 'flash', c, 90, .35);
        burst(ev.x, ev.y, 26, [c, '#ffffff'], 420, 3, .6, 'spark');
        if (ev.id === meId) { A.play('coin'); floatText(ev.x, ev.y - 24, PU_NAME[ev.type] + '!', PU_COLORS[ev.type], 28); quest('pu', 1); }
      } else if (ev.e === 'out') {
        const victim = nameOf(view, ev.id), by = ev.by ? nameOf(view, ev.by) : null;
        feed(by ? `${by} bonked ${victim} into the void!` : `${victim} fell into the void!`);
        if (ev.by) {
          Art.happy(ev.by, clock);
          const v = view.balls.find(x => x.id === ev.id), k = view.balls.find(x => x.id === ev.by);
          if (v && k) { koBurst(v.x, v.y, k, v); if (near(v.x, v.y)) shake = Math.max(shake, 8); }
        }
        if (ev.by === meId) {
          const b = view.balls.find(x => x.id === meId), v = view.balls.find(x => x.id === ev.id);
          if (v) floatText(v.x, v.y - v.r - 10, 'KO!', '#ff4fd8', 54);
          if (b) floatText(b.x, b.y - b.r - 30, '+5', '#ffcc3d', 28);
          screenFlash(colorOf(view, meId), .3); shake = Math.max(shake, 18);
          A.play('coin'); quest('bonk', 1);
        }
      } else if (ev.e === 'splash') {
        const col = colorOf(view, ev.id);
        fx(ev.x, ev.y, 'implode', col, ev.r * 4, .6);
        fx(ev.x, ev.y, 'flash', col, ev.r * 3.5, .5);
        burst(ev.x, ev.y, 30, [col, '#ffffff'], 460, 3, .8, 'spark');
        if (ev.id === meId || near(ev.x, ev.y)) A.play('splash');
        if (ev.id === meId) { shake = Math.max(shake, 16); screenFlash('#ff4d6a', .35); }
      }
    }
  }

  function feed(msg) {
    const f = $('feed'), s = document.createElement('span');
    s.textContent = msg; f.appendChild(s);
    setTimeout(() => s.remove(), 3500);
    while (f.children.length > 4) f.firstChild.remove();
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
    const lv = Object.assign({}, Sim.LEVELS[1], { bots: 7, time: 9999 });
    const w = Sim.createWorld(lv); Sim.fillBots(w, 8);
    demo = { w };
  }

  function viewOf(w, meId) {
    for (const b of w.balls) b.me = b.id === meId;
    return { lv: w.lv, R: w.R, t: w.t, balls: w.balls.filter(b => b.alive), pellets: w.pellets, bumpers: w.bumpers, powerups: w.powerups, freezeBy: w.freezeT > 0 ? w.freezeBy : 0, windA: w.windA };
  }

  function showScreen(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }
  function hideScreens() { for (const s of document.querySelectorAll('.screen')) s.hidden = true; }

  function startLevel(n) {
    A.init(); A.startMusic();
    const lv = Sim.LEVELS[n - 1];
    const w = Sim.createWorld(lv);
    const me = Sim.setupLevel(w, playerName(), save.skin, myColor());
    L = { n, lv, w, me, cd: 3.6, shown: false, lastBeep: 4 };
    mode = 'level'; paused = false; slowUntil = 0;
    parts.length = 0; texts.length = 0; $('feed').innerHTML = '';
    cam.x = me.x; cam.y = me.y;
    hideScreens(); $('hud').hidden = false;
    $('windPill').hidden = !lv.wind;
    P.levelStarted(n);
  }

  function updateLevel(dt) {
    const w = L.w;
    if (L.cd > 0) {
      L.cd -= dt;
      const sec = Math.ceil(L.cd - .6);
      if (sec !== L.lastBeep) { L.lastBeep = sec; A.play('beep', sec <= 0); }
      $('centerMsg').innerHTML = sec > 0 ? `${sec}<small>Level ${L.n} · ${esc(L.lv.name)}</small>` : 'GO!';
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
    if (!L.shown && (L.me.place || ended)) {
      L.shown = true;
      const won = L.me.place === 1;
      const sess = L; setTimeout(() => levelResult(sess, won), won ? 2200 : 1400);
      if (won) {
        slowUntil = clock + 1.6;
        burst(L.me.x, L.me.y, 70, ['#46e6ff', '#ff4fd8', '#ffcc3d', '#7dff9b'], 460, 6, 1.8, 'conf');
        A.play('win'); quest('win', 1);
      } else A.play('lose');
    }
  }

  let lastReward = 0, resultAction = null;
  function showResult(o) {
    $('resTitle').textContent = o.title; $('resTitle').classList.toggle('win', o.win);
    $('resStars').hidden = o.stars == null;
    if (o.stars != null) $('resStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < o.stars ? 'on' : ''}" style="animation-delay:${i * .15}s">★</span>`).join('');
    $('resPlace').textContent = '#' + o.place; $('resBonks').textContent = o.bonks; $('resCoins').textContent = '+' + o.coins;
    $('resNote').textContent = o.note;
    lastReward = o.coins;
    $('resDouble').hidden = !P.rewardedSupported || o.coins <= 0;
    $('resMain').hidden = !o.main; if (o.main) $('resMain').textContent = o.main;
    $('resRetry').hidden = !o.retry; if (o.retry) $('resRetry').textContent = o.retry;
    resultAction = o.actions;
    showScreen('result');
    P.breakAd();
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
    $('resCoins').textContent = '+' + lastReward * 2; $('resDouble').hidden = true;
    A.play('coin'); toast(`+${lastReward} bonus coins!`);
  };

  function levelResult(sess, won) {
    if (mode !== 'level' || L !== sess) return;
    if (paused || hostPaused) { setTimeout(() => levelResult(sess, won), 300); return; }
    const me = L.me, stars = Sim.starsFor(L.lv, me);
    const prev = save.stars[L.n] || 0;
    const coins = me.bonks * 5 + (won ? 25 : me.place <= 3 ? 10 : 2) + Math.max(0, stars - prev) * 10;
    save.coins += coins; save.stars[L.n] = Math.max(prev, stars); store(); refreshCoins();
    P.levelEnded(L.n, won);
    const need = Math.max(2, Math.round(L.lv.bots / 2));
    const next = Sim.LEVELS.find(l => l.id === L.n + 1 && !l.season);
    showResult({
      title: won ? 'You won!' : me.place <= 3 ? `${ordinal(me.place)} place!` : 'Knocked out!', win: won,
      stars, place: me.place, bonks: me.bonks, coins,
      note: won ? (stars < 3 ? `Win with ${need} bonks for 3 stars.` : 'Perfect! All 3 stars.') : 'Be the last orb on the platform to win the level.',
      main: won && next ? 'Next level' : null, retry: won ? 'Play again' : 'Try again',
      actions: { main: () => startLevel(L.n + 1), retry: () => startLevel(L.n), home: goHome },
    });
  }

  function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }

  function goHome() {
    if (N) { N.leaving = true; N.ws.close(); N = null; }
    mode = 'menu'; paused = false; L = null; slowUntil = 0;
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
  $('restartBtn').onclick = () => { A.play('click'); startLevel(L.n); };
  $('quitBtn').onclick = () => { A.play('click'); goHome(); };

  // ---------- online ----------
  const SERVER = window.BONK_SERVER || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  const API = SERVER.replace(/^ws/, 'http').replace(/\/ws$/, '');
  const INTERP = 110;
  const onlineAvailable = () => !window.BONK_OFFLINE && P.canReachServer;

  function myColor() { const s = skinOf(save.skin); return s.holo ? '#ffffff' : s.c; }

  function startOnline() {
    A.init(); A.startMusic();
    let ws;
    try { ws = new WebSocket(SERVER); } catch (e) { toast('Could not reach the game server.'); return; }
    N = { ws, id: 0, names: {}, lv: Sim.ONLINE, bumpers: [], snaps: [], ph: 'wait', cd: 0, lastSend: 0, inRound: false, resultShown: false, leaving: false, lastBeep: 99 };
    mode = 'online'; paused = false;
    parts.length = 0; texts.length = 0; $('feed').innerHTML = '';
    hideScreens(); $('hud').hidden = false; $('windPill').hidden = true;
    $('centerMsg').innerHTML = '<small>Connecting…</small>';
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: playerName(), skin: save.skin, uid: save.uid, color: myColor() }));
    ws.onmessage = m => onNet(JSON.parse(m.data));
    ws.onclose = () => { if (N && !N.leaving) { toast('Lost connection to the game server.'); goHome(); } };
    ws.onerror = () => { /* onclose follows */ };
  }

  function onNet(msg) {
    if (!N) return;
    if (msg.t === 'welcome') N.id = msg.id;
    else if (msg.t === 'roster') { N.names = {}; for (const [id, name, skin, , col] of msg.list) N.names[id] = { name, skin, col }; }
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
      const p = prev[r[0]] || r, nm = N.names[r[0]] || { name: '???', skin: 0, col: -1 };
      return {
        id: r[0], name: nm.name, skin: nm.skin, col: nm.col, x: p[1] + (r[1] - p[1]) * k, y: p[2] + (r[2] - p[2]) * k,
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
      if (sec !== N.lastBeep && sec <= 3) { N.lastBeep = sec; A.play('beep', sec <= 0); }
      cm.innerHTML = sec > 3 ? `<small>Next round in ${sec}…</small>` : `${Math.max(1, sec)}<small>Online Arena</small>`;
    } else if (N.ph === 'play') {
      if (!N.inRound) cm.innerHTML = '<small>Watching… you play in the next round</small>';
      else if (N.lastBeep === 1) { A.play('beep', true); N.lastBeep = 0; N.goUntil = now + 700; cm.textContent = 'GO!'; }
      else if (now > (N.goUntil || 0)) cm.textContent = '';
    } else cm.textContent = '';
  }

  function onlineResult(res) {
    const mine = res.find(r => r[0] === N.id);
    if (!mine) return;
    const [, place, bonks] = mine;
    const coins = bonks * 5 + (place === 1 ? 25 : place <= 3 ? 10 : 2);
    save.coins += coins; refreshCoins();
    quest('online', 1);
    if (place === 1) { quest('win', 1); A.play('win'); } else A.play('lose');
    store();
    showResult({
      title: place === 1 ? 'Champion!' : `${ordinal(place)} place!`, win: place === 1,
      stars: null, place, bonks, coins, note: 'The next round starts in a few seconds.',
      main: 'Keep playing', retry: null,
      actions: { main: hideScreens, retry: hideScreens, home: goHome },
    });
  }

  // ---------- HUD ----------
  let hudT = 0;
  function updateHud(view, timeLeft) {
    const standing = view.balls.filter(b => !b.falling);
    $('time').textContent = Math.floor(timeLeft / 60) + ':' + String(Math.floor(timeLeft % 60)).padStart(2, '0');
    $('alive').textContent = standing.length;
    const sorted = standing.slice().sort((a, b) => b.r - a.r);
    let top = sorted.slice(0, 5);
    const me = sorted.find(b => b.me);
    if (me && !top.includes(me)) top = top.slice(0, 4).concat(me);
    $('board').innerHTML = top.map(b => `<div class="${b.me ? 'me' : ''}"><span class="row-name">${sorted.indexOf(b) + 1}. ${esc(b.name)}</span><span>${Math.round(b.r)}</span></div>`).join('');
    const mb = view.balls.find(b => b.me);
    $('dash').style.setProperty('--p', mb ? (100 * (1 - mb.dashCd / Sim.DASH_CD)) + '%' : '0%');
    if (view.lv.wind) $('windArrow').style.transform = `rotate(${view.windA}rad)`;
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
    if (mode === 'menu') {
      A.setIntensity(false);
      Sim.step(demo.w, dt, {}); demo.w.events.length = 0;
      if (demo.w.over || demo.w.balls.filter(b => b.alive).length < 3) newDemo();
      view = viewOf(demo.w, -1);
    } else if (mode === 'level') {
      if (!paused && !hostPaused) updateLevel(dt);
      view = viewOf(L.w, L.me.id);
      if (L.me.alive) follow = L.me;
      else follow = view.balls.slice().sort((a, b) => b.r - a.r)[0] || null;
      if (now - hudT > 120) { updateHud(view, Math.max(0, L.lv.time - L.w.t)); hudT = now; }
    } else {
      view = netView();
      updateOnline(view);
      follow = view.balls.find(b => b.me) || view.balls.slice().sort((a, b) => b.r - a.r)[0] || null;
      if (now - hudT > 120) { updateHud(view, Math.max(0, N.lv.time - (view.T || 0))); hudT = now; }
    }
    // camera (zooms in during the slow-motion finish)
    let tz, tx = 0, ty = 0;
    if (follow) { tz = Math.min(W, H) / (420 + follow.r * 6); tx = follow.x; ty = follow.y; }
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
    if (mode === 'menu' && !$('home').hidden) heroBall();
    Art.render(ctx, view, { W, H, DPR, cam, clock, shake, reduce: reduceMotion, parts, texts, windBits, dashCd: Sim.DASH_CD, flash: reduceMotion ? null : flash });
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
  $('diceBtn').onclick = () => { A.init(); A.play('click'); const r = randomName(); $('nameInput').value = r; save.name = r; store(); };

  // ---------- menus ----------
  function refreshCoins() { for (const el of document.querySelectorAll('.coinCount')) el.textContent = save.coins; }
  function refreshBadge() { const n = D.pending(save); $('dailyBadge').hidden = !n; $('dailyBadge').textContent = n; }

  const seasonEnds = new Date(SEASON.ends).getTime();
  const seasonOn = () => Date.now() < seasonEnds;
  const seasonDays = () => Math.max(0, Math.ceil((seasonEnds - Date.now()) / 864e5));

  function heroBall() {
    const c = $('heroBall').getContext('2d');
    c.clearRect(0, 0, 320, 260);
    const face = Math.sin(clock * .7) * 1.2 + Math.sin(clock * 1.9) * .3;
    const blink = (clock % 3.7) < .12, bob = Math.sin(clock * 2.2) * 6;
    // floor glow under the orb
    const s = skinOf(save.skin), g = c.createRadialGradient(160, 228, 0, 160, 228, 110);
    g.addColorStop(0, s.holo ? 'rgba(255,255,255,.35)' : s.c + '66'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 150, 320, 110);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(160, 226, 62 - bob, 12, 0, 0, Math.PI * 2); c.fill();
    drawBall(c, 160, 132 + bob, 72, s, { face, expr: (clock % 9) > 8.2 ? 'happy' : 'n', blink, t: clock });
  }

  function renderHome() {
    if (D.refresh(save, onlineAvailable())) store();
    $('nameInput').value = save.name;
    $('onlineBtn').hidden = !onlineAvailable();
    $('topBtn').hidden = !onlineAvailable();
    document.querySelector('.home-dock').dataset.count = onlineAvailable() ? 3 : 2;
    $('levelsBtn').querySelector('.pb-sub').textContent = `${Sim.LEVELS.filter(l => !l.season || seasonOn()).length} levels · solo`;
    $('seasonChip').hidden = !seasonOn();
    $('seasonChip').textContent = `${SEASON.name} · ${seasonDays()} days left`;
    $('heroSkin').textContent = skinOf(save.skin).n;
    refreshCoins(); refreshBadge(); heroBall(); syncToggles();
  }

  function levelOpen(lv) {
    if (lv.season) return seasonOn() && (save.stars[3] || 0) > 0;
    return lv.id === 1 || (save.stars[lv.id - 1] || 0) > 0;
  }

  function renderLevels() {
    const grid = $('levelGrid'); grid.innerHTML = '';
    let total = 0, max = 0;
    for (const lv of Sim.LEVELS) {
      const st = save.stars[lv.id] || 0;
      if (lv.season && !seasonOn()) continue;
      total += st; max += 3;
      const open = levelOpen(lv);
      const b = lv.season ? $('seasonLevel') : document.createElement('button');
      b.className = (lv.season ? 'season-level' : 'lvl') + ` t-${lv.theme}${open ? '' : ' locked'}`;
      if (!lv.season) b.id = 'lvl-' + lv.id;
      const starsHtml = `<span class="st">${[0, 1, 2].map(i => `<span class="${i < st ? 'on' : ''}">★</span>`).join('')}</span>`;
      b.innerHTML = lv.season
        ? `<span class="sl-tag">Season level</span><b>${esc(lv.name)}</b><small>${open ? 'Black hole, bumpers and wind together' : 'Win level 3 to open it'}</small>${starsHtml}`
        : `<b>${lv.id}</b><small>${esc(lv.name)}</small>${starsHtml}`;
      b.setAttribute('aria-label', `Level ${lv.name}${open ? '' : ', locked'}`);
      b.onclick = () => { A.play('click'); if (!open) { toast(lv.season ? 'Win level 3 to open the season level.' : 'Win the level before to open this one.'); return; } startLevel(lv.id); };
      if (!lv.season) grid.appendChild(b);
    }
    $('seasonLevel').hidden = !seasonOn();
    $('starsTotal').textContent = `★ ${total}/${max}`;
  }

  function skinButton(s, i) {
    const owned = save.owned.includes(i);
    const b = document.createElement('button');
    b.className = 'skin' + (save.skin === i ? ' on' : '') + (owned ? '' : ' locked') + (!owned && save.coins < s.price ? ' poor' : '');
    b.id = 'skin-' + i;
    const cv2 = document.createElement('canvas'); cv2.width = 144; cv2.height = 144;
    drawBall(cv2.getContext('2d'), 72, 78, 44, s, { face: .35, expr: 'n', t: 0 });
    b.appendChild(cv2);
    const nm = document.createElement('span'); nm.textContent = s.n; b.appendChild(nm);
    if (s.trail && s.trail !== 'glow') { const tr = document.createElement('span'); tr.className = 'trail-tag'; tr.textContent = s.trail + ' trail'; b.appendChild(tr); }
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

  function renderShop() {
    const grid = $('skinGrid'), sg = $('seasonGrid'); grid.innerHTML = ''; sg.innerHTML = '';
    SKINS.forEach((s, i) => {
      if (s.season) { if (seasonOn() || save.owned.includes(i)) sg.appendChild(skinButton(s, i)); }
      else grid.appendChild(skinButton(s, i));
    });
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

  let topData = null, topTab = 'day';
  function renderTop() {
    $('tabDay').classList.toggle('on', topTab === 'day'); $('tabDay').setAttribute('aria-selected', topTab === 'day');
    $('tabWeek').classList.toggle('on', topTab === 'week'); $('tabWeek').setAttribute('aria-selected', topTab === 'week');
    const list = $('topList');
    if (!topData) { list.innerHTML = '<li class="empty">Loading…</li>'; return; }
    const rows = topData[topTab];
    list.innerHTML = rows.length
      ? rows.map(([name, pts], i) => `<li class="${name === save.name ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="nm">${esc(name)}</span><b>${pts}</b></li>`).join('')
      : '<li class="empty">No one has scored yet. Play an online round and take first place!</li>';
  }
  async function openTop() {
    topData = null; renderTop(); showScreen('top');
    try {
      const r = await fetch(API + '/api/top');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      topData = await r.json();
    } catch (e) {
      console.error('Leaderboard failed:', e);
      $('topList').innerHTML = '<li class="empty">Could not load the leaderboard right now.</li>'; return;
    }
    renderTop();
  }
  $('tabDay').onclick = () => { topTab = 'day'; renderTop(); };
  $('tabWeek').onclick = () => { topTab = 'week'; renderTop(); };

  function syncToggles() {
    for (const id of ['sfxBtn', 'sfxBtn2']) $(id).setAttribute('aria-pressed', save.sfx);
    for (const id of ['musicBtn', 'musicBtn2']) $(id).setAttribute('aria-pressed', save.music);
    A.setSfx(save.sfx); A.setMusic(save.music);
  }
  for (const id of ['sfxBtn', 'sfxBtn2']) $(id).onclick = () => { A.init(); save.sfx = !save.sfx; store(); syncToggles(); A.play('click'); };
  for (const id of ['musicBtn', 'musicBtn2']) $(id).onclick = () => { A.init(); A.startMusic(); save.music = !save.music; store(); syncToggles(); };

  $('levelsBtn').onclick = () => { A.init(); A.startMusic(); A.play('click'); playerName(); renderLevels(); showScreen('levels'); };
  $('onlineBtn').onclick = () => { A.init(); A.play('click'); playerName(); startOnline(); };
  $('shopBtn').onclick = $('heroBtn').onclick = () => { A.init(); A.startMusic(); A.play('click'); renderShop(); showScreen('shop'); };
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
    requestAnimationFrame(t => { frame(t); P.gameReady(); });
  }
  boot().catch(e => {
    console.error('Game failed to start:', e);
    document.body.insertAdjacentHTML('beforeend', '<div class="toast">The game could not start. Please reload the page.</div>');
  });
})();
