'use strict';
(() => {
// ================= constants (world units, y grows downward) =================
const GROUND = 540, WORLD_H = 600;
const R = 14, GRAV = 600, MAX_SPEED = 820;
const LINE_E = .9, LINE_MIN_BOUNCE = 400, LINE_LEN = 300, LINE_LEN_LONG = 480, MAX_LINES = 3, LINE_W = 8, LINE_FORWARD = 240;
const TERRAIN_E = .55;
const SLOWMO = .35, LAUNCH = { x: 300, y: -560 };
const RING_RY = 62, RING_RX = 24, RIM_R = 8, CEIL = -150;
const LIVES = 3, GIFT_COINS = 50, DAILY_GOAL = 8, DAILY_REWARD = 100, GOLDEN_EVERY = 5;
const POWERUPS = {
  magnet: { label: 'MAGNET', color: '#ff5f8a', dur: 8, glyph: 'U' },
  time:   { label: '+10 s',  color: '#3ee6ff', dur: 0, glyph: '+' },
  x2:     { label: 'X2',     color: '#ffd21f', dur: 10, glyph: '2' },
  long:   { label: 'LONG LINE', color: '#7dff5a', dur: 12, glyph: '—' },
  rocket: { label: 'ROCKET', color: '#ff8a1f', dur: 0, glyph: '^' },
};
const comboMult = c => c >= 10 ? 4 : c >= 6 ? 3 : c >= 3 ? 2 : 1;

const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const sfx = audio.sfx;
const cfg = window.BBA_CONFIG || {};

// ================= save data (per browser) =================
const today = () => new Date().toISOString().slice(0, 10);
const DEF = { coins: 0, best: 0, longest: 0, games: 0, portals: 0, stars: 0, perfects: 0, goldens: 0, powerups: 0, bestCombo: 0,
  ball: 'blue', line: 'neon', ownBalls: ['blue'], ownLines: ['neon'], sound: true, music: true, vibrate: true, gift: '', tut: false,
  missions: null, runs: [], playerName: '', pid: '', secret: '', daily: { date: '', best: 0, rewarded: false } };
let S;
try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem('bba_save') || '{}')); } catch (e) { S = Object.assign({}, DEF); }
function save() { try { localStorage.setItem('bba_save', JSON.stringify(S)); } catch (e) { /* storage blocked */ } }
audio.state.save = S;
function vibrate(ms) { if (S.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* not allowed in this frame */ } } }

// ================= skins =================
const BALLS = [
  { id: 'blue', name: 'Blue Bolt', price: 0, trail: '#7f8cff' },
  { id: 'basket', name: 'Hoopster', price: 150, trail: '#ff9a4a' },
  { id: 'tennis', name: 'Ace', price: 200, trail: '#e6ff5a' },
  { id: 'fire', name: 'Fireball', price: 350, trail: '#ff6a1f' },
  { id: 'ice', name: 'Frosty', price: 400, trail: '#9ff0ff' },
  { id: 'melon', name: 'Melon', price: 500, trail: '#ff5a7a' },
  { id: 'gold', name: 'Goldie', price: 750, trail: '#ffd21f' },
  { id: 'disco', name: 'Disco', price: 900, trail: '#ff7ad9' },
  { id: 'eye', name: 'Eyeball', price: 1200, trail: '#ffffff' },
];
const LINES = [
  { id: 'neon', name: 'Neon Purple', price: 0, c: '#d36bff' },
  { id: 'laser', name: 'Laser Cyan', price: 120, c: '#3ee6ff' },
  { id: 'lime', name: 'Lime Light', price: 200, c: '#7dff5a' },
  { id: 'flame', name: 'Flame', price: 300, c: '#ff6a2b' },
  { id: 'gold', name: 'Gold Rail', price: 450, c: '#ffd21f' },
  { id: 'rainbow', name: 'Rainbow', price: 800, c: 'rainbow' },
];
const lineColor = (id, t) => { const L = LINES.find(l => l.id === id) || LINES[0]; return L.c === 'rainbow' ? `hsl(${(t * 120) % 360},100%,65%)` : L.c; };
const PAL = { blue: ['#c9ceff', '#4f5bff', '#1c2280'], basket: ['#ffc28a', '#f26b1d', '#8a3208'], tennis: ['#f8ffb0', '#cde62a', '#6f800a'], fire: ['#fff6a8', '#ff8a1f', '#b81a0a'],
  ice: ['#ffffff', '#9fe9ff', '#2a86c0'], melon: ['#bfffa8', '#2fb84a', '#0e5a20'], gold: ['#fffad0', '#f7c531', '#94600a'], disco: ['#ffffff', '#c9c9e0', '#55557a'], eye: ['#ffffff', '#f4f1f8', '#b9b2cc'] };
function drawBall(c, x, y, r, rot, id, vx = 1, vy = 0) {
  const pal = PAL[id] || PAL.blue;
  const g = c.createRadialGradient(x - r * .4, y - r * .45, r * .1, x, y, r * 1.05);
  g.addColorStop(0, pal[0]); g.addColorStop(.5, pal[1]); g.addColorStop(1, pal[2]);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip(); c.translate(x, y); c.rotate(rot);
  c.lineWidth = r * .11; c.lineCap = 'round';
  if (id === 'blue') { c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(0, 0, r * .62, -.6, .9); c.stroke(); }
  if (id === 'basket') { c.strokeStyle = '#3a1606'; c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.moveTo(0, -r); c.lineTo(0, r); c.stroke();
    c.beginPath(); c.arc(-r * 1.15, 0, r * .85, -1.1, 1.1); c.stroke(); c.beginPath(); c.arc(r * 1.15, 0, r * .85, Math.PI - 1.1, Math.PI + 1.1); c.stroke(); }
  if (id === 'tennis') { c.strokeStyle = '#fff'; c.lineWidth = r * .14; c.beginPath(); c.arc(-r * 1.05, 0, r * .8, -1.2, 1.2); c.stroke(); c.beginPath(); c.arc(r * 1.05, 0, r * .8, Math.PI - 1.2, Math.PI + 1.2); c.stroke(); }
  if (id === 'fire') { c.fillStyle = 'rgba(255,240,150,.55)'; for (let i = 0; i < 5; i++) { c.rotate(1.256); c.beginPath(); c.ellipse(r * .45, 0, r * .28, r * .12, 0, 0, 7); c.fill(); } }
  if (id === 'ice') { c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = r * .07; for (let i = 0; i < 6; i++) { c.rotate(1.047); c.beginPath(); c.moveTo(0, 0); c.lineTo(r * .8, 0); c.moveTo(r * .45, 0); c.lineTo(r * .6, r * .15); c.moveTo(r * .45, 0); c.lineTo(r * .6, -r * .15); c.stroke(); } }
  if (id === 'melon') { c.strokeStyle = '#0b4718'; c.lineWidth = r * .16; for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(0, 0, Math.abs(i) * r * .38 + r * .08, r * 1.1, 0, 0, 7); c.stroke(); } }
  if (id === 'gold') { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = r * .08; c.beginPath(); c.arc(0, 0, r * .7, 0, 7); c.stroke(); c.fillStyle = '#a8700b'; c.font = `${r * 1.1}px "Lilita One", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, r * .05); }
  if (id === 'disco') { const s = r * .38; for (let gx = -r; gx < r; gx += s) for (let gy = -r; gy < r; gy += s) { const h = ((gx * 7 + gy * 13) | 0) % 360; c.fillStyle = `hsla(${h},90%,${60 + ((gx + gy) | 0) % 25}%,.55)`; c.fillRect(gx + 1, gy + 1, s - 2, s - 2); } }
  c.restore();
  if (id === 'eye') { const a = Math.atan2(vy, vx), ix = x + Math.cos(a) * r * .35, iy = y + Math.sin(a) * r * .35;
    c.strokeStyle = 'rgba(220,40,60,.45)'; c.lineWidth = r * .05; for (let i = 0; i < 5; i++) { const b = i * 1.25 + .4; c.beginPath(); c.moveTo(x + Math.cos(b) * r * .95, y + Math.sin(b) * r * .95); c.lineTo(x + Math.cos(b + .2) * r * .6, y + Math.sin(b + .2) * r * .6); c.stroke(); }
    c.fillStyle = '#2f8cff'; c.beginPath(); c.arc(ix, iy, r * .45, 0, 7); c.fill(); c.fillStyle = '#0b0b18'; c.beginPath(); c.arc(ix, iy, r * .22, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x - r * .38, y - r * .42, r * .28, r * .16, -.6, 0, 7); c.fill();
}

// ================= themes =================
const THEMES = [
  { name: 'NEON NIGHT', top: '#2b1060', bot: '#0e0a26', glow: '#e04bff', hillL: '#7a45ff', hillR: '#3b1a9e', hillD: '#1c0b55', rim: '#c9a6ff', far: ['#3a1c84', '#25125e'], bokeh: '#b98cff', portal: ['#ff6ad5', '#3ee6ff'], fx: 'bokeh', grid: '#b36bff' },
  { name: 'SUNSET BAY', top: '#ff7a59', bot: '#4a1661', glow: '#ffb35a', hillL: '#ff5f8a', hillR: '#a12a6c', hillD: '#4a1046', rim: '#ffd3a8', far: ['#c4466e', '#82295f'], bokeh: '#ffd08a', portal: ['#ffe14a', '#ff4fa0'], fx: 'embers', grid: '#ff8a7a' },
  { name: 'DEEP SPACE', top: '#0c1a52', bot: '#03040f', glow: '#3ee6ff', hillL: '#2f6bff', hillR: '#14308f', hillD: '#081446', rim: '#8fe3ff', far: ['#14286e', '#0b1a4a'], bokeh: '#6fb7ff', portal: ['#3ee6ff', '#a96bff'], fx: 'stars', grid: '#4f8cff' },
  { name: 'AURORA', top: '#06474a', bot: '#0a0f2e', glow: '#3df5a7', hillL: '#1fd18e', hillR: '#0b7a6a', hillD: '#06334a', rim: '#b2ffe0', far: ['#0b5d5c', '#073c4a'], bokeh: '#7dffd0', portal: ['#3df5a7', '#3ee6ff'], fx: 'aurora', grid: '#3df5a7' },
  { name: 'LAVA CORE', top: '#4a0a08', bot: '#140308', glow: '#ff6a1f', hillL: '#ff5a2b', hillR: '#8a1d0e', hillD: '#3a0a06', rim: '#ffb347', far: ['#6b1a0e', '#40100a'], bokeh: '#ff9a4a', portal: ['#ffd21f', '#ff3d00'], fx: 'embers', grid: '#ff7a3a' },
  { name: 'ICE PEAK', top: '#9fd8ff', bot: '#24508f', glow: '#ffffff', hillL: '#dff6ff', hillR: '#7fb8e8', hillD: '#3d6fb0', rim: '#ffffff', far: ['#6ea6d8', '#4f84bd'], bokeh: '#ffffff', portal: ['#ffffff', '#7fe7ff'], fx: 'snow', grid: '#ffffff' },
  { name: 'CANDY LAND', top: '#ff9ad5', bot: '#5a1e6e', glow: '#ff5fb4', hillL: '#ff7ac8', hillR: '#c23d9a', hillD: '#6a1d63', rim: '#fff0fa', far: ['#d65ab0', '#9a3a8a'], bokeh: '#ffd1ec', portal: ['#ffe14a', '#ff5fb4'], fx: 'bokeh', grid: '#ff8ad0' },
  { name: 'TOXIC LAB', top: '#0b3b2a', bot: '#040d16', glow: '#7dff5a', hillL: '#2fd36a', hillR: '#0f7a3e', hillD: '#063a22', rim: '#c8ffb0', far: ['#0d5a3a', '#083d2c'], bokeh: '#7dff5a', portal: ['#7dff5a', '#3ee6ff'], fx: 'bubbles', grid: '#7dff5a' },
  { name: 'CYBER CITY', top: '#120a3a', bot: '#05030f', glow: '#ff2bd6', hillL: '#3b2aa8', hillR: '#1d1466', hillD: '#0c0836', rim: '#ff2bd6', far: ['#2a1a7a', '#1a1050'], bokeh: '#3ee6ff', portal: ['#ff2bd6', '#3ee6ff'], fx: 'rain', grid: '#ff2bd6' },
  { name: 'DESERT DUSK', top: '#ffb16b', bot: '#5a2140', glow: '#ffd27a', hillL: '#ff8a5a', hillR: '#b8503a', hillD: '#5c2630', rim: '#ffe3b0', far: ['#c86a4a', '#8a4040'], bokeh: '#ffd9a0', portal: ['#ffd27a', '#ff7a4a'], fx: 'sand', grid: '#ffb070' },
  { name: 'OCEAN DEEP', top: '#0a4f7a', bot: '#021124', glow: '#3ee6ff', hillL: '#1f8fc9', hillR: '#0f5a8a', hillD: '#072e4c', rim: '#aef0ff', far: ['#0e5f8e', '#0a4468'], bokeh: '#9fe9ff', portal: ['#3ee6ff', '#3df5a7'], fx: 'bubbles', grid: '#3ee6ff' },
  { name: 'SAKURA', top: '#ffd6e8', bot: '#4a1f5e', glow: '#ff7ab8', hillL: '#f08ac0', hillR: '#a95494', hillD: '#5c2a66', rim: '#ffffff', far: ['#c87aa8', '#8d4f84'], bokeh: '#ffb3d6', portal: ['#ff7ab8', '#ffffff'], fx: 'petals', grid: '#ff9ad0' },
];

// ================= world state =================
let W = 0, H = 0, dpr = 1, scale = 1, viewW = 0, viewH = 0, camX = 0, camY = 0, shake = 0, time = 0, flash = 0;
let mode = 'menu', paused = false;
let stages = [], cur = 0, ball = null, lines = [], drag = null, particles = [], floaters = [], trail = [], fx = [];
let lives = LIVES, portals = 0, starsRun = 0, coinsRun = 0, perfectsRun = 0, maxX = 0, score = 0, timeLeft = 0, deadT = 0, themeIdx = 0, tickT = 0;
let adActive = false, combo = 0, bestComboRun = 0, power = { magnet: 0, x2: 0, long: 0 }, continued = false, daily = false, runDaily = 0;
let rng = Math.random;
const rand = (a, b) => a + (b - a) * rng();
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ================= stages =================
function genStage(k, start, wall) {
  const L = 1000 + Math.min(k, 10) * 100;
  const ringX = start + L, ringY = rand(105, 205);
  const hMax = Math.min(300, 150 + Math.min(k, 10) * 15);
  const mountains = []; let x = start + 230;
  while (x < ringX - 170) {
    const w = rand(170, 300), h = rand(80, hMax), x1 = Math.min(x + w, ringX - 60);
    mountains.push({ x0: x, px: x + (x1 - x) * rand(.38, .62), x1, py: GROUND - h });
    x += w * rand(.6, .95);
  }
  const st = { k, start, wall, ringX, ringY, mountains, bumpers: [], bars: [], stars: [], pickups: [], crystals: [], ceilBars: [], passed: false,
    golden: k > 0 && (k + 1) % GOLDEN_EVERY === 0, time: Math.max(24, 36 - Math.min(k, 12)) };
  for (let i = 0; i < Math.min(k, 3); i++) {
    const bx = rand(start + 320, ringX - 200);
    st.bumpers.push({ x: bx, y: Math.min(rand(250, 390), surfaceY(st, bx) - 70), r: 22, hit: 0 });
  }
  for (let i = 0; i < Math.min(Math.max(0, k - 2), 2); i++) {
    st.bars.push({ x: rand(start + 380, ringX - 220), y: rand(170, 300), len: 120, a: rand(-.5, .5), spin: rng() < .5 ? rand(.5, 1.1) * (rng() < .5 ? -1 : 1) : 0 });
  }
  if (k >= 2) for (let i = 0; i < Math.min(1 + Math.floor(k / 4), 3); i++) {
    const cx = rand(start + 300, ringX - 260), w = rand(50, 90), h = rand(90, 170);
    st.crystals.push({ x: cx, w, y0: -10, y1: -10 + h });
  }
  if (k >= 5 && rng() < .6) st.ceilBars.push({ x: rand(start + 420, ringX - 320), y: rand(50, 120), len: 150, amp: rand(80, 160), spd: rand(.5, 1), ph: rand(0, 6.28) });
  for (let i = 0; i < 6; i++) {
    const sx = start + 200 + (L - 320) * (i + rng() * .6) / 6;
    st.stars.push({ x: sx, y: Math.min(rand(120, 330), surfaceY(st, sx) - 60), got: false });
  }
  if (k >= 1 && rng() < .75) {
    const keys = Object.keys(POWERUPS), px = rand(start + 300, ringX - 250);
    st.pickups.push({ kind: keys[(rng() * keys.length) | 0], x: px, y: Math.min(rand(140, 320), surfaceY(st, px) - 70), got: false });
  }
  if (k >= 4 && rng() < .3) { const hx = rand(start + 300, ringX - 250); st.pickups.push({ kind: 'heart', x: hx, y: Math.min(rand(140, 320), surfaceY(st, hx) - 70), got: false }); }
  return st;
}
const nextStage = p => genStage(p.k + 1, p.ringX + 90, p.ringX - R - 8);
function surfaceY(st, x) {
  let y = GROUND;
  for (const m of st.mountains) {
    if (x < m.x0 || x > m.x1) continue;
    const t = x < m.px ? (x - m.x0) / (m.px - m.x0) : (m.x1 - x) / (m.x1 - m.px);
    y = Math.min(y, GROUND - (GROUND - m.py) * t);
  }
  return y;
}
function ceilSeg(b) { const x = b.x + Math.sin(time * b.spd + b.ph) * b.amp; return [x - b.len / 2, b.y, x + b.len / 2, b.y]; }
function barSeg(b) { const a = b.a + time * b.spin, dx = Math.cos(a) * b.len / 2, dy = Math.sin(a) * b.len / 2; return [b.x - dx, b.y - dy, b.x + dx, b.y + dy]; }

// ================= flow =================
function startGame(isDaily) {
  daily = !!isDaily;
  rng = daily ? mulberry(+today().replace(/-/g, '')) : mulberry((Math.random() * 1e9) | 0);
  stages = [genStage(0, 0, 0)]; stages.push(nextStage(stages[0])); cur = 0;
  themeIdx = 0; audio.music.track(0); lives = LIVES; portals = 0; starsRun = 0; coinsRun = 0; perfectsRun = 0; maxX = 0; score = 0; combo = 0; bestComboRun = 0; continued = false;
  power = { magnet: 0, x2: 0, long: 0 };
  particles = []; floaters = []; fx = []; fxInit();
  S.games++; mission('games', 1); save();
  spawn(); camX = ball.x - viewW * .25;
  setMode('ready');
  banner(daily ? 'DAILY CHALLENGE' : THEMES[0].name, daily ? `PASS ${DAILY_GOAL} PORTALS` : 'WORLD 1', THEMES[0].glow);
  hud(); hudPowers();
}
function setMode(m) {
  mode = m;
  show('menu', m === 'menu'); show('over', m === 'over'); show('hud', m === 'ready' || m === 'play' || m === 'dead');
  if (m === 'play' || m === 'ready') Platform.gameplayStart(); else Platform.gameplayStop();
  if (m === 'menu') Platform.showBanner('adMenu', 320, 50); else Platform.hideBanner('adMenu');
  if (m === 'over') Platform.showBanner('adOver', 300, 250); else Platform.hideBanner('adOver');
}
function spawn() {
  const st = stages[cur];
  ball = { x: st.start + 80, y: 400, vx: 0, vy: 0, rot: 0 };
  trail = []; lines = []; drag = null; timeLeft = st.time; mode = 'ready';
  setHint(S.tut ? '' : 'TAP TO LAUNCH');
}
function launch() {
  ball.vx = LAUNCH.x; ball.vy = LAUNCH.y; mode = 'play'; sfx.launch();
  burst(ball.x, ball.y, '#ffffff', 14, 220);
  setHint(S.tut ? '' : 'DRAG TO DRAW A RAMP<small>Draw a straight line under the ball — it bounces off it</small>');
}
function loseLife(reason) {
  if (mode !== 'play') return;
  mode = 'dead'; deadT = 1.2; shake = 10; sfx.fail(); vibrate(80);
  lives--; combo = 0; hud(); banner(reason, '', THEMES[themeIdx].glow);
  burst(ball.x, ball.y, '#ffffff', 30, 300);
}
function afterLife() {
  if (lives > 0) { spawn(); return; }
  if (!continued && Platform.hasRewarded) { Platform.prepareRewarded().then(ok => { if (ok) openContinue(); else gameOver(); }); }
  else gameOver();
}
// ---- continue (rewarded ad) ----
let contTimer = null;
function openContinue() {
  show('continue', true); mode = 'continue';
  let left = 5; $('contBar').style.width = '100%';
  contTimer = setInterval(() => { left--; $('contBar').style.width = (left / 5 * 100) + '%'; if (left <= 0) { closeContinue(); gameOver(); } }, 1000);
}
function closeContinue() { clearInterval(contTimer); show('continue', false); }
$('btnContinue').onclick = () => {
  closeContinue();
  Platform.rewarded().then(ok => {
    if (ok) { continued = true; lives = 1; hud(); spawn(); setMode('ready'); banner('BACK IN!', '+1 LIFE', '#3df5a7'); sfx.heart(); }
    else gameOver();
  });
};
$('btnNoThanks').onclick = () => { closeContinue(); gameOver(); };

function gameOver() {
  setMode('over');
  const isBest = !daily && score > S.best; if (isBest) S.best = score;
  if (!daily) S.longest = Math.max(S.longest, Math.floor(maxX / 10));
  S.bestCombo = Math.max(S.bestCombo, bestComboRun);
  if (daily) { const d = S.daily.date === today() ? S.daily : { date: today(), best: 0, rewarded: false }; d.best = Math.max(d.best, runDaily); if (d.best >= DAILY_GOAL && !d.rewarded) { d.rewarded = true; S.coins += DAILY_REWARD; toast(`<small>DAILY CHALLENGE DONE</small>Come back tomorrow for a new one<b><i class="coin"></i>+${DAILY_REWARD}</b>`); sfx.mission(); } S.daily = d; }
  addRun(score); save();
  $('oTitle').textContent = isBest ? 'AMAZING!' : daily ? 'CHALLENGE OVER' : "TIME'S UP!";
  $('oNew').hidden = !isBest; $('oScore').textContent = score;
  $('oPortals').textContent = portals; $('oDist').textContent = Math.floor(maxX / 10) + ' m'; $('oCoins').textContent = '+' + coinsRun;
  const dbl = $('btnDouble'); dbl.hidden = true;
  if (coinsRun > 0) Platform.prepareRewarded().then(ok => { if (ok && mode === 'over') dbl.hidden = false; });
  showOverRank(); refreshMenu();
}
$('btnDouble').onclick = () => {
  $('btnDouble').hidden = true;
  Platform.rewarded().then(ok => { if (ok) { S.coins += coinsRun; coinsRun *= 2; $('oCoins').textContent = '+' + coinsRun; save(); refreshMenu(); sfx.buy(); toast(`<small>DOUBLED</small><b><i class="coin"></i>+${coinsRun}</b>`); } });
};
function passPortal(st) {
  st.passed = true; portals++; S.portals++; combo++; bestComboRun = Math.max(bestComboRun, combo);
  if (daily) runDaily = portals;
  const perfect = Math.abs(ball.y - st.ringY) < 16, mult = comboMult(combo), x2 = power.x2 > 0 ? 2 : 1;
  const coinsGain = (st.golden ? 20 : perfect ? 10 : 5) * x2;
  const pts = (st.golden ? 300 : 100) * mult * x2 + (perfect ? 50 * x2 : 0);
  addCoins(coinsGain); score += pts;
  if (perfect) { perfectsRun++; S.perfects++; mission('perfects', 1); }
  if (st.golden) { S.goldens++; mission('golden', 1); }
  mission('portals', portals, true); mission('combo', combo, true);
  if (st.golden) sfx.golden(); else sfx.portal(perfect);
  if (combo === 3 || combo === 6 || combo === 10) { sfx.combo(3); banner('COMBO x' + mult, 'KEEP IT UP', '#ffd21f'); }
  vibrate(perfect ? [30, 40, 30] : 30);
  const th = THEMES[themeIdx];
  burst(st.ringX, st.ringY, st.golden ? '#ffd21f' : th.portal[0], 40, 360); burst(st.ringX, st.ringY, th.portal[1], 30, 260); burst(st.ringX, st.ringY, '#ffffff', 16, 180);
  floater(st.ringX, st.ringY - 90, (perfect ? 'PERFECT! ' : '') + '+' + pts, perfect || st.golden ? '#ffd21f' : '#ffffff');
  shake = 6; flash = st.golden ? .8 : .45; bumpScore();
  cur++;
  if (!stages[cur + 1]) stages.push(nextStage(stages[cur]));
  stages = stages.filter((s, i) => i >= cur - 1);
  cur = stages.findIndex(s => !s.passed);
  lines = []; timeLeft = stages[cur].time;
  const k = stages[cur].k;
  if (k % 3 === 0) { themeIdx = Math.floor(k / 3) % THEMES.length; fxInit(); audio.music.track(themeIdx % audio.music.tracks); banner(THEMES[themeIdx].name, 'WORLD ' + (Math.floor(k / 3) + 1), THEMES[themeIdx].glow); sfx.zone(); }
  else if (combo !== 3 && combo !== 6 && combo !== 10) banner(st.golden ? 'GOLDEN!' : perfect ? 'PERFECT!' : ['NICE!', 'SWISH!', 'BALL AWAY!', 'GREAT!', 'SMOOTH!'][portals % 5], '', THEMES[themeIdx].glow);
  if (stages[cur].golden) toast('<small>NEXT UP</small>A golden portal — 3× points, +20 coins');
  save();
}
function addCoins(n) { coinsRun += n; S.coins += n; hud(); }
function pickup(p) {
  p.got = true; S.powerups++; mission('powerups', 1);
  if (p.kind === 'heart') { if (lives < LIVES) lives++; sfx.heart(); floater(p.x, p.y - 30, '+1 LIFE', '#ff6ad5'); burst(p.x, p.y, '#ff6ad5', 16, 200); hud(); return; }
  const pw = POWERUPS[p.kind]; sfx.powerup(); burst(p.x, p.y, pw.color, 18, 220); floater(p.x, p.y - 30, pw.label, pw.color);
  if (p.kind === 'time') timeLeft += 10;
  else if (p.kind === 'rocket') { ball.vx = Math.max(ball.vx, 650); ball.vy = Math.min(ball.vy, -420); sfx.rocket(); shake = 5; }
  else power[p.kind] = pw.dur;
  hudPowers();
}

// ================= missions =================
const MTPL = [
  { t: 'portals', run: true, txt: n => `Pass ${n} portals in one run`, steps: [3, 5, 8, 12, 16, 20] },
  { t: 'stars', txt: n => `Collect ${n} stars`, steps: [15, 40, 80, 150, 250] },
  { t: 'dist', run: true, txt: n => `Fly ${n} m in one run`, steps: [150, 300, 500, 800, 1200] },
  { t: 'perfects', txt: n => `Hit ${n} perfect portals`, steps: [2, 5, 10, 20, 35] },
  { t: 'lines', txt: n => `Draw ${n} lines`, steps: [25, 60, 120, 250] },
  { t: 'games', txt: n => `Play ${n} games`, steps: [3, 8, 15, 30] },
  { t: 'combo', run: true, txt: n => `Reach a ${n} portal combo`, steps: [3, 6, 10] },
  { t: 'powerups', txt: n => `Pick up ${n} power-ups`, steps: [3, 8, 15, 30] },
  { t: 'golden', txt: n => `Pass ${n} golden portals`, steps: [1, 3, 6] },
];
function makeMission(tpl, lvl) { const n = tpl.steps[Math.min(lvl, tpl.steps.length - 1)]; return { t: tpl.t, n, p: 0, lvl, reward: 40 + lvl * 30 + (tpl.run ? 20 : 0) }; }
if (!S.missions) { S.missions = [makeMission(MTPL[0], 0), makeMission(MTPL[1], 0), makeMission(MTPL[2], 0)]; save(); }
function mission(t, v, isRun) {
  for (const m of S.missions) { if (m.t !== t || m.p >= m.n) continue; m.p = isRun ? Math.max(m.p, v) : m.p + v; if (m.p >= m.n) { m.p = m.n; banner('MISSION DONE!', 'CLAIM IN MENU', '#ffd21f'); sfx.mission(); } }
}
function claim(i) {
  const m = S.missions[i]; if (m.p < m.n) return;
  S.coins += m.reward; sfx.buy();
  const used = S.missions.map(x => x.t);
  const free = MTPL.filter(x => !used.includes(x.t) || x.t === m.t);
  const tpl = free[(Math.random() * free.length) | 0];
  S.missions[i] = makeMission(tpl, m.t === tpl.t ? m.lvl + 1 : Math.max(0, m.lvl));
  save(); refreshMenu(); openMissions();
}

// ================= physics =================
function closest(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return [ax + dx * t, ay + dy * t]; }
function bounce(qx, qy, rad, e, minB, fr = 1) {
  let nx = ball.x - qx, ny = ball.y - qy, d = Math.hypot(nx, ny); if (d < 1e-6) { nx = 0; ny = -1; d = 1; } nx /= d; ny /= d;
  ball.x = qx + nx * rad; ball.y = qy + ny * rad;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) { const tx = ball.vx - vn * nx, ty = ball.vy - vn * ny; ball.vx = tx * fr - vn * e * nx; ball.vy = ty * fr - vn * e * ny; }
  const vn2 = ball.vx * nx + ball.vy * ny;
  if (minB && vn2 < minB) { ball.vx += (minB - vn2) * nx; ball.vy += (minB - vn2) * ny; }
  return -vn;
}
function step(dt) {
  const st = stages[cur];
  ball.vy += GRAV * dt;
  if (power.magnet > 0) { const dx = st.ringX - ball.x, dy = st.ringY - ball.y, d = Math.hypot(dx, dy) || 1; ball.vx += dx / d * 520 * dt; ball.vy += dy / d * 520 * dt; }
  const sp = Math.hypot(ball.vx, ball.vy); if (sp > MAX_SPEED) { ball.vx *= MAX_SPEED / sp; ball.vy *= MAX_SPEED / sp; }
  const px = ball.x;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.rot += ball.vx * dt / R;

  // player lines (nearest only, so a joint never double-bounces)
  let hit = null, hd = R + LINE_W / 2;
  for (const l of lines) {
    const [qx, qy] = closest(ball.x, ball.y, l.ax, l.ay, l.bx, l.by), d = Math.hypot(ball.x - qx, ball.y - qy);
    if (d < hd) { hd = d; hit = [qx, qy, l]; }
  }
  if (hit) { const v = bounce(hit[0], hit[1], R + LINE_W / 2, LINE_E, LINE_MIN_BOUNCE); if (ball.vx < LINE_FORWARD) ball.vx = LINE_FORWARD; // lines always carry the ball onward
    if (v > 40) { sfx.bounce(v); hit[2].pulse = 1; sparks(hit[0], hit[1], lineColor(S.line, time), 8); vibrate(10); } }

  // terrain: soft, nothing here hurts the ball
  if (ball.y + R > GROUND) { const v = bounce(ball.x, GROUND, R, TERRAIN_E, 0, .985); if (v > 90) sfx.thud(v); }
  for (const m of st.mountains.concat(stages[cur - 1] ? stages[cur - 1].mountains : [])) {
    if (ball.x + R < m.x0 || ball.x - R > m.x1) continue;
    const sy = surfaceY({ mountains: [m] }, ball.x);
    if (ball.y > sy && ball.y < GROUND) { // tunnelled inside: lift onto the surface
      const sides = [[m.x0, GROUND, m.px, m.py], [m.px, m.py, m.x1, GROUND]];
      let best = null, bd = 1e9; for (const [ax, ay, bx, by] of sides) { const q = closest(ball.x, ball.y, ax, ay, bx, by), d = Math.hypot(ball.x - q[0], ball.y - q[1]); if (d < bd) { bd = d; best = q; } }
      const nx = ball.x < m.px ? -(m.py - GROUND) : (m.py - GROUND), ny = ball.x < m.px ? -(m.px - m.x0) : -(m.x1 - m.px), nl = Math.hypot(nx, ny);
      ball.x = best[0] + nx / nl * (R + 1); ball.y = best[1] + ny / nl * (R + 1);
      const vn = ball.vx * nx / nl + ball.vy * ny / nl; if (vn < 0) { ball.vx -= (1 + TERRAIN_E) * vn * nx / nl; ball.vy -= (1 + TERRAIN_E) * vn * ny / nl; }
      continue;
    }
    for (const [ax, ay, bx, by] of [[m.x0, GROUND, m.px, m.py], [m.px, m.py, m.x1, GROUND]]) {
      const [qx, qy] = closest(ball.x, ball.y, ax, ay, bx, by);
      if (Math.hypot(ball.x - qx, ball.y - qy) < R) { const v = bounce(qx, qy, R, TERRAIN_E, 0, .985); if (v > 90) sfx.thud(v); }
    }
  }
  for (const b of st.bumpers) {
    if (Math.hypot(ball.x - b.x, ball.y - b.y) < R + b.r) { bounce(b.x, b.y, R + b.r, .9, 560); b.hit = 1; sfx.bumper(); burst(b.x, b.y, '#ff6ad5', 12, 200); vibrate(15); }
  }
  for (const b of st.bars) {
    const [ax, ay, bx, by] = barSeg(b), [qx, qy] = closest(ball.x, ball.y, ax, ay, bx, by);
    if (Math.hypot(ball.x - qx, ball.y - qy) < R + 6) { const v = bounce(qx, qy, R + 6, .85, 220); if (v > 40) sfx.rim(); }
  }
  for (const s of st.stars) {
    if (!s.got && Math.hypot(ball.x - s.x, ball.y - s.y) < R + 18) {
      s.got = true; starsRun++; S.stars++; mission('stars', 1); const g = power.x2 > 0 ? 2 : 1; addCoins(g); score += 10 * g; sfx.coin();
      burst(s.x, s.y, '#ffd21f', 14, 180); floater(s.x, s.y - 26, '+' + g, '#ffd21f');
    }
  }
  for (const p of st.pickups) { if (!p.got && Math.hypot(ball.x - p.x, ball.y - p.y) < R + 22) pickup(p); }
  // portal rims
  for (const ry of [st.ringY - RING_RY, st.ringY + RING_RY]) {
    if (Math.hypot(ball.x - st.ringX, ball.y - ry) < R + RIM_R) { const v = bounce(st.ringX, ry, R + RIM_R, .75, 0); if (v > 50) sfx.rim(); }
  }
  // portal pass, otherwise the energy gate sends the ball back
  if (px < st.ringX && ball.x >= st.ringX) {
    if (ball.y > st.ringY - RING_RY + RIM_R && ball.y < st.ringY + RING_RY - RIM_R) { passPortal(st); return; }
  }
  if (ball.x + R > st.ringX && px + R <= st.ringX + 1 && !(ball.y > st.ringY - RING_RY && ball.y < st.ringY + RING_RY)) {
    ball.x = st.ringX - R; ball.vx = -Math.abs(ball.vx) * .6; st.gateHit = 1; sfx.gate();
  }
  if (ball.x < st.wall + R) { ball.x = st.wall + R; ball.vx = Math.abs(ball.vx) * .7; }
  if (ball.y < CEIL + R) { ball.y = CEIL + R; ball.vy = Math.abs(ball.vy) * .5; }
  for (const c of st.crystals) {
    if (ball.x + R < c.x - c.w / 2 || ball.x - R > c.x + c.w / 2) continue;
    for (const [ax, ay, bx, by] of [[c.x - c.w / 2, c.y0, c.x, c.y1], [c.x, c.y1, c.x + c.w / 2, c.y0]]) {
      const [qx, qy] = closest(ball.x, ball.y, ax, ay, bx, by);
      if (Math.hypot(ball.x - qx, ball.y - qy) < R) { const v = bounce(qx, qy, R, .7, 0); if (v > 60) { sfx.rim(); sparks(qx, qy, '#ffffff', 5); } }
    }
  }
  for (const b of st.ceilBars) {
    const [ax, ay, bx, by] = ceilSeg(b), [qx, qy] = closest(ball.x, ball.y, ax, ay, bx, by);
    if (Math.hypot(ball.x - qx, ball.y - qy) < R + 7) { const v = bounce(qx, qy, R + 7, .8, 160); if (v > 40) sfx.rim(); }
  }
}

// ================= effects =================
function burst(x, y, col, n, spd) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = spd * (.3 + Math.random() * .7); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .7 + Math.random() * .5, col, r: 2 + Math.random() * 3.5, g: 380 }); } }
function sparks(x, y, col, n) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, v = 120 + Math.random() * 180; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .45 + Math.random() * .3, col, r: 1.5 + Math.random() * 2, g: 500 }); } }
function floater(x, y, txt, col) { floaters.push({ x, y, txt, col, life: 1.1 }); }
function banner(big, small, col) { const b = $('banner'); b.innerHTML = (small ? `<small>${small}</small>` : '') + big; b.style.setProperty('--bc', col); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
let toastT = null;
function toast(html) { const el = $('toast'); el.innerHTML = html; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }
function setHint(h) { const el = $('hint'); el.innerHTML = h; el.hidden = !h; }
function bumpScore() { const el = $('hScore'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
// theme ambient particles (screen space)
function fxInit() {
  const th = THEMES[themeIdx], n = Math.round(24 + W * H / 45000); fx = [];
  for (let i = 0; i < n; i++) fx.push({ x: Math.random() * W, y: Math.random() * H, r: th.fx === 'bokeh' ? 4 + Math.random() * 26 : th.fx === 'stars' ? .6 + Math.random() * 1.6 : th.fx === 'petals' ? 3 + Math.random() * 3 : 1.5 + Math.random() * 3, a: .05 + Math.random() * .16, p: .1 + Math.random() * .5, v: 4 + Math.random() * 12, ph: Math.random() * 6.3 });
}

// ================= HUD & screens =================
function show(id, on) { $(id).hidden = !on; }
function hud() {
  $('hScore').textContent = score; $('hCoins').textContent = S.coins; $('hPortal').textContent = portals + 1; $('hDist').textContent = Math.floor(maxX / 10);
  [...$('hLives').children].forEach((el, i) => el.classList.toggle('lost', i >= lives));
  const m = comboMult(combo); $('combo').hidden = m < 2; $('combo').textContent = 'x' + m;
  audio.state.intensity = m >= 3 ? 2 : m >= 2 ? 1 : 0;
}
function hudTime() { const st = stages[cur], p = Math.max(0, timeLeft / st.time); const el = $('hTime'); el.style.width = (p * 100) + '%'; el.classList.toggle('low', timeLeft < 6); }
function hudPowers() {
  $('powers').innerHTML = Object.keys(power).filter(k => power[k] > 0).map(k => { const pw = POWERUPS[k]; return `<div class="pw" style="--pc:${pw.color}" data-k="${k}">${pw.label}<i style="width:${power[k] / pw.dur * 100}%"></i></div>`; }).join('');
}
function refreshMenu() {
  $('mCoins').textContent = S.coins; $('mBest').textContent = S.best; $('mDist').textContent = S.longest + ' m';
  $('btnGift').hidden = S.gift === today();
  $('mBadge').hidden = !S.missions.some(m => m.p >= m.n);
  const d = S.daily.date === today() ? S.daily : { best: 0, rewarded: false };
  $('dailyInfo').textContent = d.rewarded ? `Done today · best ${d.best} portals` : `Pass ${DAILY_GOAL} portals · +${DAILY_REWARD} coins`;
  $('btnDaily').classList.toggle('done', d.rewarded);
  const dc = $('dockBall').getContext('2d'); dc.clearRect(0, 0, 96, 96); drawBall(dc, 48, 48, 40, 0, S.ball);
}
function openDialog(title, html) { $('dTitle').textContent = title; $('dBody').innerHTML = html; show('dialog', true); }
$('dClose').onclick = () => { show('dialog', false); refreshMenu(); };

let shopTab = 'balls';
function openShop() {
  const list = shopTab === 'balls' ? BALLS : LINES, own = shopTab === 'balls' ? S.ownBalls : S.ownLines, sel = shopTab === 'balls' ? S.ball : S.line;
  let h = `<div class="tabs"><button class="tab ${shopTab === 'balls' ? 'on' : ''}" data-tab="balls">BALLS</button><button class="tab ${shopTab === 'lines' ? 'on' : ''}" data-tab="lines">LINES</button></div><div class="grid">`;
  for (const it of list) {
    const has = own.includes(it.id), on = sel === it.id;
    const btn = on ? '<span class="pr on">EQUIPPED</span>' : has ? '<span class="pr use">USE</span>' : `<span class="pr ${S.coins < it.price ? 'no' : ''}"><i class="coin"></i>${it.price}</span>`;
    h += `<button class="item ${on ? 'sel' : ''}" data-id="${it.id}"><canvas width="128" height="128" data-prev="${it.id}"></canvas><span class="nm">${it.name}</span>${btn}</button>`;
  }
  openDialog('SHOP  ·  ' + S.coins + ' coins', h + '</div>');
  $('dBody').querySelectorAll('canvas[data-prev]').forEach(c => { const x = c.getContext('2d'), id = c.dataset.prev; if (shopTab === 'balls') drawBall(x, 64, 64, 46, .3, id); else drawNeonLine(x, [[18, 96], [110, 40]], id, 10, 0); });
  $('dBody').querySelectorAll('.tab').forEach(b => b.onclick = () => { shopTab = b.dataset.tab; openShop(); });
  $('dBody').querySelectorAll('.item').forEach(b => b.onclick = () => {
    const id = b.dataset.id, it = list.find(i => i.id === id);
    if (own.includes(id)) { if (shopTab === 'balls') S.ball = id; else S.line = id; sfx.click(); }
    else if (S.coins >= it.price) { S.coins -= it.price; own.push(id); if (shopTab === 'balls') S.ball = id; else S.line = id; sfx.buy(); }
    else { sfx.no(); toast(`<small>NOT ENOUGH COINS</small>Collect stars and pass portals to earn more`); return; }
    save(); refreshMenu(); openShop();
  });
}
function openMissions() {
  let h = '';
  S.missions.forEach((m, i) => {
    const tpl = MTPL.find(t => t.t === m.t), done = m.p >= m.n;
    h += `<div class="mission"><div class="mt"><b>${tpl.txt(m.n)}</b><small>${Math.floor(m.p)} / ${m.n}</small><div class="bar"><i style="width:${Math.min(100, m.p / m.n * 100)}%"></i></div></div>
      <button class="claim" data-i="${i}" ${done ? '' : 'disabled'}><i class="coin"></i>${m.reward}</button></div>`;
  });
  openDialog('MISSIONS', h);
  $('dBody').querySelectorAll('.claim').forEach(b => b.onclick = () => claim(+b.dataset.i));
}
function openStats() {
  const rows = [['BEST SCORE', S.best], ['LONGEST FLIGHT', S.longest + ' m'], ['GAMES PLAYED', S.games], ['PORTALS', S.portals], ['PERFECT PORTALS', S.perfects], ['GOLDEN PORTALS', S.goldens], ['BEST COMBO', S.bestCombo], ['STARS', S.stars]];
  openDialog('STATS', '<div class="statgrid">' + rows.map(r => `<div class="stat"><small>${r[0]}</small><b>${r[1]}</b></div>`).join('') + '</div>');
}
function openSettings() {
  openDialog('SETTINGS', `<button class="toggle-row" id="tSound">Sound effects<span class="switch ${S.sound ? 'on' : ''}"></span></button>
    <button class="toggle-row" id="tMusic">Music<span class="switch ${S.music ? 'on' : ''}"></span></button>
    <button class="toggle-row" id="tVib">Vibration<span class="switch ${S.vibrate ? 'on' : ''}"></span></button>
    <div class="about">Ball Ball Away by Door 404 · Draw straight lines, bounce the ball through the portals.</div>`);
  $('tSound').onclick = () => { S.sound = !S.sound; save(); audio.apply(); sfx.click(); openSettings(); };
  $('tMusic').onclick = () => { S.music = !S.music; save(); audio.unlock(); audio.apply(); openSettings(); };
  $('tVib').onclick = () => { S.vibrate = !S.vibrate; save(); vibrate(30); openSettings(); };
}

// ================= leaderboard =================
const LB = (() => {
  const url = cfg.lbUrl, key = cfg.lbKey, enabled = !!(url && key);
  async function rpc(fn, body) {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${fn} failed: ${r.status} ${await r.text()}`);
    return r.json();
  }
  function randomId() { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); }
  function ensureIds() { if (!S.pid) { S.pid = randomId(); S.secret = randomId(); save(); } }
  function country() { const region = (navigator.language || '').split('-')[1]; return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : null; }
  return {
    enabled,
    submit(sc) { ensureIds(); return rpc('bba_submit', { p_pid: S.pid, p_secret: S.secret, p_name: S.playerName, p_cc: country(), p_score: sc }); },
    top(period) { ensureIds(); return rpc('bba_top', { p_period: period, p_limit: 50, p_pid: S.pid }); },
  };
})();
const cleanName = raw => (raw || '').replace(/[^A-Za-z0-9 _.\-ÀÁÂÃÄÅÆÇČĆĐŠŽàáâãäåæçčćđšžèéêëìíîïñòóôõöùúûüýÿ]/g, '').trim().slice(0, 16);
const escHtml = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function addRun(sc) { if (sc <= 0) return; S.runs.push({ score: sc, date: today(), world: themeIdx, daily }); S.runs.sort((a, b) => b.score - a.score); S.runs = S.runs.slice(0, 10); }
function showOverRank() {
  const rank = $('overRank'), entry = $('nameEntry'); rank.hidden = true; entry.hidden = true;
  if (!LB.enabled || score <= 0 || daily) return;
  if (!S.playerName) { $('nameInput').value = ''; entry.hidden = false; return; }
  rank.textContent = 'Sending your score…'; rank.hidden = false;
  LB.submit(score).then(r => { rank.innerHTML = `Today <b>#${r.day_rank}</b> · All time <b>#${r.rank}</b> <small>of ${r.players} players</small>`; })
    .catch(e => { console.warn(e); rank.textContent = 'Leaderboard is offline right now — your score is saved on this device.'; });
}
function saveName(inputId) {
  const name = cleanName($(inputId).value);
  if (name.length < 2) { toast('<small>NAME</small>Use 2 to 16 letters or numbers'); return false; }
  S.playerName = name; save(); return true;
}
$('btnName').onclick = () => { if (saveName('nameInput')) showOverRank(); };
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnName').click(); });
let lbPeriod = 'day';
function openRanks() {
  lbPeriod = LB.enabled ? 'day' : 'mine';
  const tabs = LB.enabled ? `<button class="tab" data-p="day">TODAY</button><button class="tab" data-p="all">ALL TIME</button>` : '';
  openDialog('RANKS', `${LB.enabled ? `<div class="name-row"><input id="lbNameInput" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Your name" value="${escHtml(S.playerName)}"><button id="btnLbName" class="small-btn">SAVE</button></div>` : ''}
    <div class="tabs" id="lbTabs">${tabs}<button class="tab" data-p="mine">MY RUNS</button></div><div id="lbList"></div><div id="lbNote" class="lb-note"></div>`);
  $('dBody').querySelectorAll('.tab').forEach(t => t.onclick = () => { lbPeriod = t.dataset.p; sfx.click(); renderRanks(); });
  if (LB.enabled) $('btnLbName').onclick = () => { if (saveName('lbNameInput')) { toast('<small>SAVED</small>Your name goes on the board after your next run'); } };
  renderRanks();
}
function renderRanks() {
  $('dBody').querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.p === lbPeriod));
  const list = $('lbList'), note = $('lbNote');
  const row = (pos, name, cc, sc, me, extra = '') => `<div class="lb-row${me ? ' me' : ''}"><span class="pos">${pos}</span><span class="nm">${name}${cc ? ` <i class="cc">${cc}</i>` : ''}${extra}</span><b>${sc}</b></div>`;
  if (lbPeriod === 'mine') {
    list.innerHTML = S.runs.length ? S.runs.map((r, i) => row(i + 1, r.date, null, r.score, false, `<small>${THEMES[r.world || 0].name}${r.daily ? ' · DAILY' : ''}</small>`)).join('') : '<div class="lb-empty">Play a game to see your best runs here.</div>';
    note.textContent = Platform.name === 'crazygames' ? 'The weekly world leaderboard is on the CrazyGames game page.' : 'Your 10 best runs on this device.';
    return;
  }
  list.innerHTML = '<div class="lb-empty">Loading…</div>';
  note.textContent = lbPeriod === 'day' ? 'Resets every day at midnight UTC.' : 'Best score of every player.';
  const period = lbPeriod;
  LB.top(period).then(rows => {
    if (lbPeriod !== period) return;
    list.innerHTML = rows.length ? rows.map(r => row(r.pos, escHtml(r.name), r.cc, r.score, r.me)).join('') : '<div class="lb-empty">No scores yet — be the first!</div>';
  }).catch(e => { console.warn(e); list.innerHTML = '<div class="lb-empty">Leaderboard is offline right now.</div>'; });
}

// ================= buttons =================
$('btnShop').onclick = () => { audio.unlock(); sfx.click(); openShop(); };
$('btnMissions').onclick = () => { audio.unlock(); sfx.click(); openMissions(); };
$('btnRanks').onclick = () => { audio.unlock(); sfx.click(); openRanks(); };
$('btnStats').onclick = () => { audio.unlock(); sfx.click(); openStats(); };
$('btnSettings').onclick = () => { audio.unlock(); sfx.click(); openSettings(); };
$('btnGift').onclick = () => {
  audio.unlock();
  const grant = n => { S.gift = today(); S.coins += n; save(); sfx.buy(); banner('+' + n + ' COINS', 'DAILY GIFT', '#ffd21f'); refreshMenu(); };
  Platform.prepareRewarded().then(ok => { if (!ok) { grant(GIFT_COINS); return; } Platform.rewarded().then(done => { if (done) grant(GIFT_COINS * 3); else grant(GIFT_COINS); }); });
};
$('btnPlay').onclick = () => { audio.unlock(); audio.apply(); sfx.click(); startGame(false); };
$('btnDaily').onclick = () => { audio.unlock(); audio.apply(); sfx.click(); startGame(true); };
$('btnAgain').onclick = () => { sfx.click(); Platform.interstitial().then(() => startGame(daily)); };
$('btnHome').onclick = goHome; $('btnQuit').onclick = () => { show('pause', false); paused = false; gameOver(); };
function goHome() { sfx.click(); audio.music.track(0); setMode('menu'); setupAttract(); refreshMenu(); }
function togglePause() { if (mode !== 'play' && mode !== 'ready') return; paused = !paused; show('pause', paused); drag = null; }
$('btnPause').onclick = togglePause; $('btnResume').onclick = togglePause;
document.addEventListener('visibilitychange', () => { if (document.hidden && !paused && (mode === 'play' || mode === 'ready')) togglePause(); });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' && mode === 'ready' && !paused) { audio.unlock(); launch(); e.preventDefault(); }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});

// ================= input: straight lines, any angle =================
function toWorld(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale + camX, y: (e.clientY - r.top) / scale + camY }; }
cv.addEventListener('pointerdown', e => {
  audio.unlock();
  if (paused || e.button > 0) return;
  if (mode === 'ready') { launch(); return; }
  if (mode !== 'play') return;
  cv.setPointerCapture(e.pointerId);
  const p = toWorld(e); drag = { ax: p.x, ay: p.y, bx: p.x, by: p.y, id: e.pointerId };
  sfx.pen();
});
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const max = power.long > 0 ? LINE_LEN_LONG : LINE_LEN;
  const p = toWorld(e); let dx = p.x - drag.ax, dy = p.y - drag.ay; const l = Math.hypot(dx, dy);
  if (l > max) { dx *= max / l; dy *= max / l; }
  drag.bx = drag.ax + dx; drag.by = drag.ay + dy;
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  if (Math.hypot(drag.bx - drag.ax, drag.by - drag.ay) >= 22) {
    if (lines.length >= MAX_LINES) lines.shift();
    lines.push({ ax: drag.ax, ay: drag.ay, bx: drag.bx, by: drag.by, pulse: 1 });
    mission('lines', 1); sfx.place();
    if (!S.tut) { S.tut = true; save(); setHint(''); }
  }
  drag = null;
}
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

// ================= render =================
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = r.width || innerWidth; H = r.height || innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  scale = Math.min(W / (W > H ? 760 : 400), H / WORLD_H);
  viewW = W / scale; viewH = H / scale; camY = WORLD_H - viewH;
  fxInit();
}
addEventListener('resize', resize);
const glowCache = {};
function glow(col) {
  if (glowCache[col]) return glowCache[col];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(.35, col + '88'); g.addColorStop(1, col + '00');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return glowCache[col] = c;
}
function drawGlow(x, y, r, col, a = 1) { ctx.globalAlpha = a; ctx.drawImage(glow(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
const hex = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#ffffff';

function render() {
  const th = THEMES[themeIdx];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.top); g.addColorStop(1, th.bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawFx(th);
  const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake;
  farRange(.25, th.far[0], 170, .004, sx, sy);
  farRange(.5, th.far[1], 110, .007, sx, sy);

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (sx - camX * scale), dpr * (sy - camY * scale));
  // ground band with a receding neon grid
  const gg = ctx.createLinearGradient(0, GROUND, 0, GROUND + 80); gg.addColorStop(0, th.hillR); gg.addColorStop(1, th.bot);
  ctx.fillStyle = gg; ctx.fillRect(camX - 40, GROUND, viewW + 80, viewH);
  ctx.strokeStyle = th.grid; ctx.lineWidth = 1.5; ctx.globalAlpha = .18;
  for (let x = Math.floor((camX - 40) / 60) * 60; x < camX + viewW + 60; x += 60) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + (x - camX - viewW / 2) * .5, GROUND + 120); ctx.stroke(); }
  for (let i = 0; i < 5; i++) { const y = GROUND + 6 + i * i * 6; ctx.beginPath(); ctx.moveTo(camX - 40, y); ctx.lineTo(camX + viewW + 40, y); ctx.stroke(); }
  ctx.globalAlpha = .6; ctx.strokeStyle = th.rim; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(camX - 40, GROUND); ctx.lineTo(camX + viewW + 40, GROUND); ctx.stroke(); ctx.globalAlpha = 1;
  if (camY < CEIL + 10) { const cg = ctx.createLinearGradient(0, CEIL - 200, 0, CEIL); cg.addColorStop(0, th.bot); cg.addColorStop(1, th.hillD); ctx.fillStyle = cg; ctx.fillRect(camX - 40, CEIL - 400, viewW + 80, 400 - 20);
    ctx.strokeStyle = th.rim; ctx.globalAlpha = .5; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(camX - 40, CEIL - 20); ctx.lineTo(camX + viewW + 40, CEIL - 20); ctx.stroke(); ctx.globalAlpha = 1; }
  for (const s of stages) drawGate(s, th);
  for (const s of stages) drawMountains(s, th);
  for (const s of stages) drawProps(s, th);
  for (const s of stages) drawPortal(s, th, 'back');
  drawLines();
  drawTrail();
  if (ball && mode !== 'dead' && mode !== 'over' && mode !== 'continue') drawPlayer();
  if (mode === 'ready' && ball) drawArrow(th);
  for (const s of stages) drawPortal(s, th, 'front');
  drawParticles();
  if (ball && ball.y < camY + 8 && mode === 'play') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ball.x, camY + 10); ctx.lineTo(ball.x - 11, camY + 30); ctx.lineTo(ball.x + 11, camY + 30); ctx.fill(); }
  if (flash > 0) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = flash * .5; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
function drawFx(th) {
  for (const b of fx) {
    let x, y;
    if (th.fx === 'petals') { x = ((b.x + Math.sin(time * 1.5 + b.ph) * 40 - camX * scale * b.p * .3) % (W + 60) + W + 60) % (W + 60) - 30; y = (b.y + time * b.v * 2.5) % (H + 20) - 10; }
    else if (th.fx === 'bubbles') { x = ((b.x + Math.sin(time * 2 + b.ph) * 10 - camX * scale * b.p * .3) % (W + 60) + W + 60) % (W + 60) - 30; y = (b.y - time * b.v * 3 + H * 10) % (H + 20) - 10; }
    else if (th.fx === 'rain') { x = ((b.x - time * b.v * 1.5 - camX * scale * b.p * .3) % (W + 60) + W + 60) % (W + 60) - 30; y = (b.y + time * b.v * 12) % (H + 40) - 20; }
    else if (th.fx === 'sand') { x = ((b.x + time * b.v * 6 - camX * scale * b.p * .3) % (W + 60) + W + 60) % (W + 60) - 30; y = b.y + Math.sin(time * 3 + b.ph) * 6; }
    else if (th.fx === 'snow') { x = ((b.x + Math.sin(time + b.ph) * 20 - camX * scale * b.p * .3) % (W + 60) + W + 60) % (W + 60) - 30; y = (b.y + time * b.v * 3) % (H + 20) - 10; }
    else if (th.fx === 'embers') { x = ((b.x + Math.sin(time * 2 + b.ph) * 12 - camX * scale * b.p * .3) % (W + 60) + W + 60) % (W + 60) - 30; y = (b.y - time * b.v * 2 + H * 10) % (H + 20) - 10; }
    else { x = ((b.x - camX * scale * b.p * .3) % (W + 60) + W + 60) % (W + 60) - 30; y = (b.y - time * b.v + H * 10) % (H + 60) - 30; }
    ctx.globalAlpha = th.fx === 'stars' ? .3 + .4 * Math.abs(Math.sin(time * 2 + b.ph)) : th.fx === 'rain' ? b.a * 1.6 : b.a;
    ctx.fillStyle = th.fx === 'embers' ? (b.ph < 3 ? '#ffb347' : '#ff5a2b') : th.bokeh;
    if (th.fx === 'petals') { ctx.beginPath(); ctx.ellipse(x, y, b.r * 2.2, b.r * 1.2, b.ph + time, 0, 7); ctx.fill(); }
    else if (th.fx === 'rain') { ctx.fillRect(x, y, 1.5, 14); }
    else if (th.fx === 'bubbles') { ctx.strokeStyle = th.bokeh; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, b.r * 1.5, 0, 7); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  if (th.fx === 'aurora') {
    for (let i = 0; i < 3; i++) {
      const gr = ctx.createLinearGradient(0, 0, 0, H * .5); gr.addColorStop(0, i ? 'rgba(61,245,167,0)' : 'rgba(62,230,255,0)'); gr.addColorStop(.5, i === 1 ? 'rgba(170,120,255,.14)' : 'rgba(61,245,167,.14)'); gr.addColorStop(1, 'rgba(61,245,167,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * .12 + i * 40 + Math.sin(x * .004 + time * .6 + i) * 50 + Math.sin(x * .011 - time * .3) * 25);
      ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
    }
  }
}
function farRange(p, col, h, f, sx, sy) {
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (sx - camX * p * scale), dpr * (sy - camY * scale));
  const x0 = camX * p - 60, x1 = camX * p + viewW + 60;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, GROUND + 2);
  for (let x = Math.floor(x0 / 30) * 30; x <= x1 + 30; x += 30) { const y = GROUND - h * .55 - Math.sin(x * f) * h * .35 - Math.sin(x * f * 2.7 + 1) * h * .15 - Math.abs(Math.sin(x * f * 6.1)) * h * .12; ctx.lineTo(x, y); }
  ctx.lineTo(x1 + 30, GROUND + 2); ctx.fill();
}
function drawMountains(s, th) {
  for (const m of s.mountains) {
    if (m.x1 < camX - 20 || m.x0 > camX + viewW + 20) continue;
    let gl = ctx.createLinearGradient(0, m.py, 0, GROUND); gl.addColorStop(0, th.hillL); gl.addColorStop(1, th.hillD);
    ctx.fillStyle = gl; ctx.beginPath(); ctx.moveTo(m.x0, GROUND); ctx.lineTo(m.px, m.py); ctx.lineTo(m.px + (m.x1 - m.px) * .12, GROUND); ctx.closePath(); ctx.fill();
    let gr = ctx.createLinearGradient(0, m.py, 0, GROUND); gr.addColorStop(0, th.hillR); gr.addColorStop(1, th.hillD);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(m.px, m.py); ctx.lineTo(m.x1, GROUND); ctx.lineTo(m.px + (m.x1 - m.px) * .12, GROUND); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(m.px, m.py); ctx.lineTo(m.x0 + (m.px - m.x0) * .55, GROUND); ctx.lineTo(m.x0 + (m.px - m.x0) * .3, GROUND); ctx.closePath(); ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = th.rim; ctx.globalAlpha = .25; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(m.x0, GROUND); ctx.lineTo(m.px, m.py); ctx.lineTo(m.x1, GROUND); ctx.stroke();
    ctx.globalAlpha = .9; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalAlpha = 1;
    if (GROUND - m.py > 200) { ctx.fillStyle = 'rgba(255,255,255,.85)'; const t = .14, hh = GROUND - m.py;
      ctx.beginPath(); ctx.moveTo(m.px, m.py); ctx.lineTo(m.px - (m.px - m.x0) * t, m.py + hh * t); ctx.lineTo(m.px - (m.px - m.x0) * t * .4, m.py + hh * t * .7); ctx.lineTo(m.px + (m.x1 - m.px) * t * .2, m.py + hh * t * .9); ctx.lineTo(m.px + (m.x1 - m.px) * t, m.py + hh * t); ctx.closePath(); ctx.fill(); }
  }
}
function drawProps(s, th) {
  for (const b of s.bumpers) {
    b.hit = Math.max(0, b.hit - .05); const r = b.r * (1 + b.hit * .25);
    drawGlow(b.x, b.y, r * 2.6, '#ff6ad5', .5 + b.hit * .5);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#e0379d'; ctx.beginPath(); ctx.arc(b.x, b.y, r * .78, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, r * .42, 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, r * .16, 0, 7); ctx.fill();
  }
  for (const b of s.bars) {
    const [ax, ay, bx, by] = barSeg(b);
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(62,230,255,.25)'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = '#3ee6ff'; ctx.lineWidth = 11; ctx.stroke();
    ctx.fillStyle = '#0b0b24'; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#3ee6ff'; ctx.lineWidth = 3; ctx.stroke();
  }
  for (const c of s.crystals) {
    const g = ctx.createLinearGradient(0, c.y0, 0, c.y1); g.addColorStop(0, th.hillL); g.addColorStop(1, th.rim);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c.x - c.w / 2, CEIL - 20); ctx.lineTo(c.x + c.w / 2, CEIL - 20); ctx.lineTo(c.x + c.w / 2, c.y0); ctx.lineTo(c.x, c.y1); ctx.lineTo(c.x - c.w / 2, c.y0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(c.x - c.w / 2, c.y0); ctx.lineTo(c.x - c.w * .1, c.y0); ctx.lineTo(c.x, c.y1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = th.rim; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.globalAlpha = .9; ctx.beginPath(); ctx.moveTo(c.x - c.w / 2, c.y0); ctx.lineTo(c.x, c.y1); ctx.lineTo(c.x + c.w / 2, c.y0); ctx.stroke(); ctx.globalAlpha = 1;
    drawGlow(c.x, c.y1, 26, hex(th.rim), .35);
  }
  for (const b of s.ceilBars) {
    const [ax, ay, bx, by] = ceilSeg(b), mx = (ax + bx) / 2;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(mx, CEIL - 20); ctx.lineTo(mx, ay); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineCap = 'round'; ctx.strokeStyle = th.portal[0] + '44'; ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = th.portal[0]; ctx.lineWidth = 12; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax + 8, ay - 3); ctx.lineTo(bx - 8, by - 3); ctx.stroke();
  }
  for (const t of s.stars) { if (!t.got) drawStar(t.x, t.y + Math.sin(time * 3 + t.x) * 4, 14); }
  for (const p of s.pickups) { if (!p.got) drawPickup(p); }
}
function drawPickup(p) {
  const y = p.y + Math.sin(time * 2.5 + p.x) * 5, col = p.kind === 'heart' ? '#ff6ad5' : POWERUPS[p.kind].color;
  drawGlow(p.x, y, 50, col, .6 + .2 * Math.sin(time * 4));
  if (p.kind === 'heart') {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(p.x, y + 14); ctx.bezierCurveTo(p.x - 22, y - 4, p.x - 10, y - 18, p.x, y - 8); ctx.bezierCurveTo(p.x + 10, y - 18, p.x + 22, y - 4, p.x, y + 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(p.x - 7, y - 7, 4, 2.5, -.6, 0, 7); ctx.fill(); return;
  }
  ctx.fillStyle = 'rgba(10,6,30,.85)'; ctx.beginPath(); ctx.arc(p.x, y, 18, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(p.x, y, 18, 0, 7); ctx.stroke();
  ctx.fillStyle = col; ctx.font = '22px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const gl = POWERUPS[p.kind].glyph;
  if (p.kind === 'magnet') { ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, y - 2, 8, Math.PI, 0); ctx.moveTo(p.x - 8, y - 2); ctx.lineTo(p.x - 8, y + 7); ctx.moveTo(p.x + 8, y - 2); ctx.lineTo(p.x + 8, y + 7); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 10.5, y + 4, 5, 4); ctx.fillRect(p.x + 5.5, y + 4, 5, 4); }
  else if (p.kind === 'long') { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x - 11, y + 5); ctx.lineTo(p.x + 11, y - 5); ctx.stroke(); }
  else if (p.kind === 'rocket') { ctx.beginPath(); ctx.moveTo(p.x, y - 12); ctx.lineTo(p.x + 9, y + 8); ctx.lineTo(p.x, y + 3); ctx.lineTo(p.x - 9, y + 8); ctx.closePath(); ctx.fill(); }
  else ctx.fillText(gl, p.x, y + 1);
  ctx.textBaseline = 'alphabetic';
}
function drawStar(x, y, r) {
  drawGlow(x, y, r * 3, '#ffd21f', .55);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 2 + x) * .25);
  ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#ff9a1f'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * .48 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-r * .2, -r * .3, r * .22, r * .12, -.5, 0, 7); ctx.fill();
  ctx.restore();
}
function drawGate(s, th) {
  if (s.passed) return;
  const x = s.ringX; s.gateHit = Math.max(0, (s.gateHit || 0) - .03);
  const a = .18 + s.gateHit * .6, col = s.golden ? '#ffd21f' : th.portal[1];
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (const [y0, y1] of [[-200, s.ringY - RING_RY], [s.ringY + RING_RY, GROUND]]) {
    ctx.globalAlpha = a * .5; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.globalAlpha = a + .15; ctx.lineWidth = 3; ctx.setLineDash([10, 14]); ctx.lineDashOffset = -time * 40; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}
function drawPortal(s, th, half) {
  const x = s.ringX, y = s.ringY, c0 = s.golden ? '#ffe14a' : th.portal[0], c1 = s.golden ? '#ff9a1f' : th.portal[1];
  if (half === 'back') {
    if (!s.passed) drawGlow(x, y, RING_RY * (s.golden ? 2.8 : 2.2), hex(c0), .55 + .15 * Math.sin(time * 3));
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, RING_RX, RING_RY, 0, 0, 7); ctx.clip();
    const ig = ctx.createRadialGradient(x, y, 2, x, y, RING_RY); ig.addColorStop(0, 'rgba(255,255,255,.85)'); ig.addColorStop(.35, c1 + 'aa'); ig.addColorStop(1, c0 + '44');
    ctx.fillStyle = ig; ctx.fillRect(x - RING_RX, y - RING_RY, RING_RX * 2, RING_RY * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); const ph = time * 3 + i * 1.57; ctx.ellipse(x, y, RING_RX * .6, RING_RY * .75, 0, ph, ph + 1.6); ctx.stroke(); }
    ctx.restore();
    ctx.lineWidth = 12; ctx.strokeStyle = c1; ctx.beginPath(); ctx.ellipse(x, y, RING_RX, RING_RY, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
  } else {
    const gr = ctx.createLinearGradient(x, y - RING_RY, x, y + RING_RY); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    ctx.lineWidth = 14; ctx.strokeStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, RING_RX, RING_RY, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x + 2, y, RING_RX, RING_RY, 0, -Math.PI / 2.6, Math.PI / 6); ctx.stroke();
    for (const ry of [y - RING_RY, y + RING_RY]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, ry, RIM_R, 0, 7); ctx.fill(); ctx.fillStyle = c0; ctx.beginPath(); ctx.arc(x, ry, RIM_R * .55, 0, 7); ctx.fill(); }
    if (!s.passed) { for (let i = 0; i < 6; i++) { const a = time * 2 + i * 1.047; drawGlow(x + Math.cos(a) * (RING_RX + 14), y + Math.sin(a) * (RING_RY + 14), 7, '#ffffff', .9); } }
    if (s.golden && !s.passed) { ctx.fillStyle = '#ffe14a'; ctx.font = '18px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('3×', x, y - RING_RY - 18); }
  }
}
function drawNeonLine(c, pts, id, w, pulse) {
  const col = lineColor(id, time);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const path = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); };
  c.globalAlpha = .22; c.strokeStyle = col; c.lineWidth = w * 3.2 + pulse * 10; path(); c.stroke();
  c.globalAlpha = .5; c.lineWidth = w * 1.9; path(); c.stroke();
  c.globalAlpha = 1; c.lineWidth = w; path(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = w * .38; path(); c.stroke();
  for (const p of pts) { c.fillStyle = '#fff'; c.beginPath(); c.arc(p[0], p[1], w * .75, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(p[0], p[1], w * .4, 0, 7); c.fill(); }
}
function drawLines() {
  for (const l of lines) { l.pulse = Math.max(0, l.pulse - .04); drawNeonLine(ctx, [[l.ax, l.ay], [l.bx, l.by]], S.line, LINE_W, l.pulse); }
  if (drag) {
    const max = power.long > 0 ? LINE_LEN_LONG : LINE_LEN, len = Math.hypot(drag.bx - drag.ax, drag.by - drag.ay);
    ctx.globalAlpha = .8; ctx.setLineDash([12, 10]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(drag.ax, drag.ay); ctx.lineTo(drag.bx, drag.by); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    drawNeonLine(ctx, [[drag.ax, drag.ay], [drag.bx, drag.by]], S.line, LINE_W * .6, 0);
    const left = 1 - len / max;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(drag.bx, drag.by, 20, 0, 7); ctx.stroke();
    ctx.strokeStyle = lineColor(S.line, time); ctx.beginPath(); ctx.arc(drag.bx, drag.by, 20, -Math.PI / 2, -Math.PI / 2 + left * 6.283); ctx.stroke();
  }
}
function drawTrail() {
  const sk = BALLS.find(b => b.id === S.ball) || BALLS[0];
  for (let i = 0; i < trail.length; i++) { const t = trail[i], k = i / trail.length; ctx.globalAlpha = k * .5; ctx.fillStyle = sk.trail; ctx.beginPath(); ctx.arc(t.x, t.y, R * k * .9, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawPlayer() {
  const sk = BALLS.find(b => b.id === S.ball) || BALLS[0];
  drawGlow(ball.x, ball.y, R * 3.4, sk.trail, .55);
  if (power.magnet > 0) { ctx.strokeStyle = POWERUPS.magnet.color; ctx.lineWidth = 2; ctx.globalAlpha = .5 + .3 * Math.sin(time * 8); ctx.beginPath(); ctx.arc(ball.x, ball.y, R + 7, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  if (power.x2 > 0) drawGlow(ball.x, ball.y, R * 4.5, '#ffd21f', .35);
  drawBall(ctx, ball.x, ball.y, R, ball.rot, S.ball, ball.vx, ball.vy);
  if (mode === 'play' && Math.random() < .6) particles.push({ x: ball.x + (Math.random() - .5) * R, y: ball.y + (Math.random() - .5) * R, vx: -ball.vx * .1, vy: -ball.vy * .1 - 20, life: .5, col: sk.trail, r: 1.5 + Math.random() * 2.5, g: 0 });
}
function drawArrow(th) {
  const pulse = Math.sin(time * 6) * 6, ang = Math.atan2(LAUNCH.y, LAUNCH.x);
  ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ang); ctx.translate(34 + pulse, 0);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [w, col, a] of [[16, th.glow, .3], [7, '#ffffff', 1]]) { ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(62, 0); ctx.moveTo(44, -18); ctx.lineTo(66, 0); ctx.lineTo(44, 18); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  for (let i = 1; i < 14; i++) { const t = i * .07, x = ball.x + LAUNCH.x * t, y = ball.y + LAUNCH.y * t + GRAV * t * t / 2; ctx.globalAlpha = .6 * (1 - i / 14); ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawParticles() {
  for (const p of particles) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4)); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = '30px "Lilita One", sans-serif'; ctx.lineJoin = 'round';
  for (const f of floaters) { ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5)); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,8,50,.7)'; ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y); }
  ctx.globalAlpha = 1;
}

// ================= menu attract mode =================
function setupAttract() {
  rng = mulberry(11); themeIdx = 0; fxInit();
  stages = [genStage(0, 0, 0)]; stages.push(nextStage(stages[0])); cur = 0;
  stages[0].bumpers = []; stages[0].crystals = []; stages[1].crystals = []; lines = []; particles = []; floaters = [];
  ball = { x: 120, y: 330, vx: 150, vy: -300, rot: 0 }; trail = []; camX = -60;
}
function updateAttract(dt) {
  const st = stages[cur];
  ball.vy += GRAV * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.rot += ball.vx * dt / R;
  const floor = Math.min(surfaceY(st, ball.x), surfaceY(stages[1], ball.x)) - 60;
  if (ball.y > floor && ball.vy > 0) { ball.vy = -420 - Math.random() * 120; sparks(ball.x, ball.y + R, lineColor(S.line, time), 6); lines = [{ ax: ball.x - 50, ay: ball.y + R + 4, bx: ball.x + 50, by: ball.y + R - 12, pulse: 1 }]; }
  trail.push({ x: ball.x, y: ball.y }); if (trail.length > 22) trail.shift();
  camX += ((ball.x - viewW * .4) - camX) * Math.min(1, dt * 2);
  if (ball.x > stages[1].ringX - 200) setupAttract();
}

// ================= loop =================
let lastT = performance.now();
function frame(t) {
  const rdt = Math.min(.05, (t - lastT) / 1000); lastT = t;
  if (!paused && !adActive) update(rdt);
  render();
  requestAnimationFrame(frame);
}
function update(rdt) {
  time += rdt; flash = Math.max(0, flash - rdt * 2);
  if (mode === 'menu') updateAttract(rdt);
  const dt = (drag && mode === 'play') ? rdt * SLOWMO : rdt;
  if (mode === 'play') {
    const n = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 4));
    for (let i = 0; i < n && mode === 'play'; i++) { const c = cur; step(dt / n); if (c !== cur) break; }
    trail.push({ x: ball.x, y: ball.y }); if (trail.length > 18) trail.shift();
    if (ball.x > maxX) { maxX = ball.x; mission('dist', Math.floor(maxX / 10), true); }
    timeLeft -= rdt;
    let pwChanged = false;
    for (const k in power) { if (power[k] > 0) { power[k] -= rdt; pwChanged = true; } }
    if (pwChanged) hudPowers();
    if (timeLeft < 5 && Math.floor(timeLeft) !== tickT && timeLeft > 0) { tickT = Math.floor(timeLeft); sfx.tick(); }
    if (timeLeft <= 0) loseLife("TIME'S UP!");
    hud(); hudTime();
  }
  if (mode === 'dead') { deadT -= rdt; if (deadT <= 0) afterLife(); }
  for (const p of particles) { p.x += p.vx * rdt; p.y += p.vy * rdt; p.vy += p.g * rdt; p.life -= rdt * 1.3; }
  particles = particles.filter(p => p.life > 0); if (particles.length > 500) particles.splice(0, particles.length - 500);
  for (const f of floaters) { f.y -= 50 * rdt; f.life -= rdt; } floaters = floaters.filter(f => f.life > 0);
  shake = Math.max(0, shake - rdt * 30);
  if (ball && (mode === 'play' || mode === 'ready')) { const st = stages[cur]; const target = Math.max(ball.x - viewW * .33, st.wall - 40); camX += (target - camX) * Math.min(1, rdt * 3.5); }
}

// ================= boot =================
let platformMuted = false;
const applyAudio = () => { audio.state.blocked = adActive || platformMuted; audio.apply(); };
Platform.hooks.adStart = () => { adActive = true; drag = null; applyAudio(); };
Platform.hooks.adEnd = () => { adActive = false; lastT = performance.now(); applyAudio(); };
Platform.hooks.audio = v => { platformMuted = !v; applyAudio(); };
if (cfg.debug) window.__setTheme = i => { themeIdx = i; fxInit(); };
if (cfg.debug) window.__g = () => ({ ball, st: stages[cur], portals, mode, camX, camY, scale, lives, timeLeft, score, combo, power, themeIdx, coins: S.coins });
resize(); setupAttract(); refreshMenu();
requestAnimationFrame(frame);
Platform.init().then(() => {
  setMode('menu');
  if (!S.playerName) Platform.userName().then(n => { if (n && !S.playerName) { S.playerName = cleanName(n); save(); } });
  Platform.loadingDone();
});
})();
