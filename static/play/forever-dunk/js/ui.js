'use strict';
// ---------- DOM ----------
const $ = id => document.getElementById(id);
const hud = $('hud'), hudScore = $('hudScore'), hudLives = $('hudLives'), rageBadge = $('rageBadge'), hint = $('hint');
const hudCombo = $('hudCombo'), hudPowers = $('hudPowers'), hudDaily = $('hudDaily'), streak = $('streak');
const menu = $('menu'), pauseEl = $('pause'), over = $('over'), contEl = $('cont');
const skinsEl = $('skins'), statsEl = $('stats'), settingsEl = $('settings'), missionsEl = $('missions'), dailyEl = $('dailyPanel');
const overScore = $('overScore'), overDist = $('overDist'), overZone = $('overZone'), overScoreRec = $('overScoreRec'), overDistRec = $('overDistRec'), unlockBox = $('unlockBox');
const bravo = $('bravo'), zoneBanner = $('zoneBanner'), toastEl = $('toast');

function fmtDist(m) { return save.feet ? Math.floor(m * 3.28084) + ' ft' : Math.floor(m) + ' m'; }

// ---------- HUD ----------
function renderLives() {
  hudLives.innerHTML = '';
  for (let i = 0; i < LIVES; i++) {
    const l = new Image(); l.src = img.life.src; l.alt = '';
    if (i >= S.lives) l.className = 'lost';
    hudLives.appendChild(l);
  }
}
function renderStreak() {
  streak.innerHTML = '';
  for (let i = 0; i < PERFECTS_FOR_RAGE; i++) {
    const d = document.createElement('i');
    if (S.rage || i < S.perfectRow) d.className = 'on';
    streak.appendChild(d);
  }
}
function renderCombo() {
  const m = comboMult(S.combo);
  hudCombo.classList.toggle('hidden', m < 2);
  hudCombo.textContent = 'COMBO ×' + m;
}
function renderPowers() {
  const chips = [];
  if (S.shield) chips.push(['shield', 'SHIELD']);
  if (S.power.long > 0) chips.push(['long', 'LONG ' + Math.ceil(S.power.long) + 's']);
  if (S.power.magnet > 0) chips.push(['magnet', 'MAGNET ' + Math.ceil(S.power.magnet) + 's']);
  hudPowers.innerHTML = chips.map(([k, t]) => `<span style="--pc:${POWERUPS[k].color}">${t}</span>`).join('');
}
function renderDaily() {
  hudDaily.classList.toggle('hidden', !S.daily);
  if (S.daily) hudDaily.innerHTML = `DAILY <b>${Math.min(S.baskets, DAILY_GOAL)}/${DAILY_GOAL}</b>`;
}
function updateHint() {
  const show = S.mode === 'play' && S.waitingRelease && S.balls.length > 0;
  hint.classList.toggle('hidden', !show);
  hint.innerHTML = S.tutorial ? 'DRAW A LINE<br><small>like the hand shows — the ball rolls along it</small>'
    : S.score === 0 && S.lives === LIVES && S.screen === 0 ? 'DRAW A LINE<br><small>guide the ball into the hoop</small>' : 'DRAW TO DROP';
}
const BRAVO_IMGS = ['t_awesome', 't_goodjob', 't_nice', 't_cake'];
function showBravo() {
  bravo.innerHTML = '';
  const i = new Image(); i.src = img[BRAVO_IMGS[(Math.random() * BRAVO_IMGS.length) | 0]].src;
  bravo.appendChild(i);
}
function showBanner(title, sub, color) {
  zoneBanner.innerHTML = `<small>${sub}</small>${title}`;
  zoneBanner.style.setProperty('--zc', color);
  zoneBanner.classList.remove('show'); void zoneBanner.offsetWidth; zoneBanner.classList.add('show');
}
function showZone(z) { const zone = ZONES[z % ZONES.length]; showBanner(zone.name, 'ZONE ' + (z + 1), zone.accent); sfx.zone(); }

const toastQueue = [];
let toastBusy = false;
function toast(html) { toastQueue.push(html); if (!toastBusy) nextToast(); }
function nextToast() {
  const html = toastQueue.shift();
  if (!html) { toastBusy = false; return; }
  toastBusy = true;
  toastEl.innerHTML = html;
  toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
  setTimeout(nextToast, 2300);
}
function onMissionComplete(text, reward) {
  sfx.mission(); vibrate(30);
  toast(`<small>MISSION COMPLETE</small>${text}<b><i class="coin"></i>+${reward}</b>`);
  refreshCoins();
}

// ---------- Modes ----------
function setMode(m) {
  S.mode = m;
  menu.classList.toggle('hidden', m !== 'menu');
  hud.classList.toggle('hidden', m === 'menu');
  pauseEl.classList.toggle('hidden', m !== 'paused');
  over.classList.toggle('hidden', m !== 'over');
  contEl.classList.toggle('hidden', m !== 'cont');
  if (m === 'play') {
    hudScore.textContent = S.score; renderLives(); renderStreak(); renderCombo(); renderPowers(); renderDaily();
    rageBadge.classList.toggle('hidden', !S.rage);
    Platform.gameplayStart();
  } else Platform.gameplayStop();
  if (m === 'paused') renderMissionList($('pauseMissions'), true);
  if (m === 'menu') { refreshMenu(); menuScene(); Platform.showBanner('adMenu', 320, 50); } else Platform.hideBanner('adMenu');
  if (m === 'over') Platform.showBanner('adOver', 300, 250); else Platform.hideBanner('adOver');
  updateHint();
}

function newGame(daily) {
  Object.assign(S, {
    time: 0, slowT: 0, screen: 0, camY: 0, camTo: 0, camT: 1, shakeT: 0, flash: 0,
    balls: [], obstacles: [], orbs: [], strokes: [], particles: [], texts: [], rings: [],
    score: 0, lives: LIVES, distance: 0, baskets: 0, perfects: 0, perfectRow: 0, bestRow: 0, rage: false, rageTime: 0,
    combo: 0, coinsRun: 0, power: { long: 0, magnet: 0 }, shield: false,
    daily: !!daily, dailyDate: today(), tutorial: !save.tutorialDone && !daily, rng: Math.random,
    respawnT: 0, overTimer: 0, zoneShown: 0, continued: false,
  });
  pointers.clear();
  resetRunMissions();
  missionEvent('games', 1);
  S.hoops = [withLevelRng(0, () => makeHoop(0, null))];
  spawnBall();
  S.startY = S.balls[0].y;
}
function startPlay(daily) { newGame(daily); setMode('play'); }
// New runs after the first one may start with an interstitial (natural break)
function playWithBreak(daily) {
  if (S.sessionGames === 0) { startPlay(daily); return; }
  Platform.interstitial().then(() => startPlay(daily));
}

// Continue offer: 5-second countdown; a rewarded ad gives one life back (once per run)
let contTimer = null;
function openContinue() {
  setMode('cont');
  let left = 5;
  const arc = $('contArc'), num = $('contNum');
  num.textContent = left; arc.style.transition = 'none'; arc.style.strokeDashoffset = '0';
  void arc.getBoundingClientRect();
  arc.style.transition = 'stroke-dashoffset 5s linear'; arc.style.strokeDashoffset = '276.5';
  clearInterval(contTimer);
  contTimer = setInterval(() => {
    left--; num.textContent = Math.max(0, left);
    if (left <= 0) { clearInterval(contTimer); finishGame(); }
  }, 1000);
}
function offerContinueOrFinish() {
  if (S.continued) { finishGame(); return; }
  Platform.prepareRewarded().then(ok => { if (ok) openContinue(); else finishGame(); });
}
function acceptContinue() {
  clearInterval(contTimer);
  Platform.rewarded().then(ok => {
    if (!ok) { finishGame(); return; }
    S.continued = true; S.lives = 1;
    setMode('play'); spawnBall();
  });
}

function finishGame() {
  clearInterval(contTimer);
  S.sessionGames++;
  const before = kind => SKIN_SETS[kind].map((_, i) => isUnlocked(kind, i));
  const prev = { ball: before('ball'), basket: before('basket') };
  const scoreRec = S.score > save.best.score, distRec = S.distance > save.best.distance;
  save.best.score = Math.max(save.best.score, S.score);
  save.best.distance = Math.max(save.best.distance, S.distance);
  save.best.perfects = Math.max(save.best.perfects, S.perfects);
  save.best.inRow = Math.max(save.best.inRow, S.bestRow);
  save.total.distance += S.distance;
  save.total.points += S.score;
  save.total.games += 1;
  save.total.perfects += S.perfects;
  save.total.rageSeconds += Math.round(S.rageTime);
  if (!save.days.includes(today())) save.days.push(today());
  save.coins += S.coinsRun;
  let dailyEarned = false;
  if (S.daily) {
    if (save.daily.date !== S.dailyDate) save.daily = { date: S.dailyDate, best: 0, rewarded: false };
    save.daily.best = Math.max(save.daily.best, S.score);
    if (!save.daily.rewarded && S.baskets >= DAILY_GOAL) { save.daily.rewarded = true; save.coins += DAILY_REWARD; dailyEarned = true; }
  }
  writeSave();

  $('overTitle').textContent = S.daily ? 'DAILY RESULT' : 'GAME OVER';
  overScore.textContent = S.score;
  overDist.textContent = fmtDist(S.distance);
  overZone.textContent = S.daily
    ? `${Math.min(S.baskets, DAILY_GOAL)} / ${DAILY_GOAL} baskets` + (dailyEarned ? ` · +${DAILY_REWARD} coins!` : save.daily.rewarded ? ' · reward collected' : '')
    : 'Reached ' + zoneOf(S.screen).name;
  overScoreRec.classList.toggle('hidden', !scoreRec || S.score === 0);
  overDistRec.classList.toggle('hidden', !distRec || S.distance === 0);
  $('overCoins').textContent = '+' + S.coinsRun;
  const dbl = $('btnDouble');
  dbl.classList.add('hidden');
  if (S.coinsRun > 0) Platform.prepareRewarded().then(ok => { if (ok && S.mode === 'over') dbl.classList.remove('hidden'); });

  const newOnes = [];
  for (const kind of ['ball', 'basket']) SKIN_SETS[kind].forEach((_, i) => { if (!prev[kind][i] && isUnlocked(kind, i)) newOnes.push([kind, i]); });
  unlockBox.innerHTML = '';
  if (newOnes.length) {
    const imgs = document.createElement('div'); imgs.className = 'imgs';
    newOnes.forEach(([k, i]) => imgs.appendChild(skinIcon(k, i)));
    const txt = document.createElement('div'); txt.className = 'txt';
    const u = new Image(); u.src = img.unlocked.src; txt.appendChild(u);
    const sp = document.createElement('span'); sp.textContent = 'New skin' + (newOnes.length > 1 ? 's' : '') + ' — equip in the SHOP';
    txt.appendChild(sp);
    unlockBox.append(imgs, txt);
    unlockBox.classList.remove('hidden');
    setTimeout(sfx.unlocked, 350);
  } else unlockBox.classList.add('hidden');
  setMode('over');
}
function doubleCoins() {
  const btn = $('btnDouble');
  btn.classList.add('hidden');
  Platform.rewarded().then(ok => {
    if (!ok) return;
    save.coins += S.coinsRun; writeSave();
    S.coinsRun *= 2;
    $('overCoins').textContent = '+' + S.coinsRun;
    sfx.coin(); toast(`<small>REWARD</small>Coins doubled<b><i class="coin"></i>+${S.coinsRun / 2}</b>`);
  });
}
// Coins earned in a run are kept even when the player quits to the menu
function quitToMenu() {
  if (S.coinsRun > 0) { save.coins += S.coinsRun; S.coinsRun = 0; writeSave(); }
  setMode('menu');
}

// ---------- Menu ----------
function refreshCoins() {
  const c = save.coins.toLocaleString('en-US');
  $('menuCoins').textContent = c; $('shopCoins').textContent = c;
}
function refreshMenu() {
  refreshCoins();
  $('dockBall').src = img[BALL_SKINS[save.ballSkin].img].src;
  $('menuBest').textContent = save.best.score;
  $('menuDist').textContent = fmtDist(save.best.distance);
  $('btnGift').classList.toggle('hidden', save.giftDate === today());
  const d = save.daily.date === today() ? save.daily : { best: 0, rewarded: false };
  $('dailyInfo').textContent = d.rewarded ? `Done today · best ${d.best}` : `Score ${DAILY_GOAL} baskets · +${DAILY_REWARD} coins`;
}
function menuScene() {
  Object.assign(S, { screen: 0, camY: 0, camT: 1, obstacles: [], orbs: [], strokes: [], texts: [], particles: [], rings: [], rage: false, balls: [], shield: false, power: { long: 0, magnet: 0 }, rng: Math.random });
  rageBadge.classList.add('hidden');
  S.hoops = [makeHoop(0, null, { x: 0, y: MENU_HOOP_Y, k: 1, plain: true })];
  Object.assign(S.hoops[0], { amp: 0.7, speed: 0.9, baseX: 0 });
}
function claimGift() {
  const grant = n => {
    save.giftDate = today(); save.coins += n; writeSave();
    sfx.coin(); toast(`<small>DAILY GIFT</small>Come back tomorrow for more<b><i class="coin"></i>+${n}</b>`);
    refreshMenu();
  };
  Platform.prepareRewarded().then(ok => {
    if (!ok) { grant(Math.round(GIFT_COINS / 3)); return; }
    Platform.rewarded().then(done => { if (done) grant(GIFT_COINS); });
  });
}
function openDaily() {
  const d = save.daily.date === today() ? save.daily : { best: 0, rewarded: false };
  $('dailyGoal').textContent = DAILY_GOAL;
  $('dailyReward').textContent = DAILY_REWARD;
  $('dailyBest').textContent = d.best;
  $('dailyState').textContent = d.rewarded ? 'Collected' : 'Not yet';
  dailyEl.classList.remove('hidden');
}

// ---------- Missions ----------
function renderMissionList(el, compact) {
  el.innerHTML = save.missions.map(m => {
    const def = missionDef(m), pct = Math.min(100, m.progress / m.target * 100);
    const prog = !def.perRun || S.mode === 'paused' ? `<small>${Math.min(m.progress, m.target)} / ${m.target}</small>` : '';
    return `<div class="mission"><div class="m-text">${def.text(m.target)}${prog}<div class="bar"><div style="width:${pct}%"></div></div></div>` +
      (compact ? '' : `<div class="m-reward"><i class="coin"></i>${def.reward(m.target)}</div>`) + '</div>';
  }).join('');
}

// ---------- Shop ----------
let shopTab = 'ball', shopView = 0;
const equippedOf = kind => kind === 'ball' ? save.ballSkin : kind === 'basket' ? save.basketSkin : save.lineSkin;
function setEquipped(kind, i) {
  if (kind === 'ball') save.ballSkin = i; else if (kind === 'basket') save.basketSkin = i; else save.lineSkin = i;
  writeSave();
}
function skinIcon(kind, i) {
  if (kind === 'ball') { const im = new Image(); im.src = img[BALL_SKINS[i].img].src; return im; }
  const c = document.createElement('canvas'); c.width = 160; c.height = 160; c.className = 'basket-icon';
  if (kind === 'basket') drawBasketPreview(c.getContext('2d'), i, 160);
  else drawLinePreview(c.getContext('2d'), i, 160);
  return c;
}
function drawBasketPreview(x, i, size) {
  const s = BASKET_SKINS[i];
  x.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size * 0.34, rx = size * 0.38, ry = rx * RIM_RY / RIM_X;
  x.lineCap = 'round';
  x.strokeStyle = shade(s.rim, -0.35); x.lineWidth = size * 0.045;
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2); x.stroke();
  x.strokeStyle = s.net; x.lineWidth = size * 0.02;
  const rows = 5, cols = 7, depth = size * 0.4, bh = rx * NET_BOTTOM_HW / RIM_X;
  const P2 = (r, c) => { const k = r / (rows - 1), hw = rx + (bh - rx) * k; return [cx - hw + 2 * hw * c / (cols - 1), cy + depth * k + Math.sin(c / (cols - 1) * Math.PI) * ry * (1 - k)]; };
  x.beginPath();
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
    const [ax, ay] = P2(r, c);
    for (const dc of [-1, 1]) { if (c + dc < 0 || c + dc >= cols) continue; const [bx, by] = P2(r + 1, c + dc); x.moveTo(ax, ay); x.lineTo(bx, by); }
    if (c === 0 || c === cols - 1) { const [bx, by] = P2(r + 1, c); x.moveTo(ax, ay); x.lineTo(bx, by); }
  }
  x.stroke();
  x.strokeStyle = s.rim; x.lineWidth = size * 0.058;
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); x.stroke();
  x.strokeStyle = shade(s.rim, 0.45); x.lineWidth = size * 0.016;
  x.beginPath(); x.ellipse(cx, cy - size * 0.01, rx, ry, 0, 0.35, Math.PI - 0.9); x.stroke();
}
function drawLinePreview(x, i, size) {
  const s = LINE_SKINS[i];
  x.clearRect(0, 0, size, size);
  const glow = s.mode === 'zone' ? '#22e6ff' : s.glow;
  const pts = [];
  for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push([size * (0.12 + t * 0.76), size * (0.62 - Math.sin(t * Math.PI * 1.6) * 0.22 - t * 0.1)]); }
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.strokeStyle = rgba(glow, 0.3); x.lineWidth = size * 0.12;
  x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke();
  for (let k = 1; k < pts.length; k++) {
    x.strokeStyle = s.mode === 'rainbow' ? `hsl(${k * 15},95%,65%)` : s.mode === 'candy' ? (Math.floor(k / 2) % 2 ? s.glow : s.core) : s.mode === 'zone' ? '#e9fdff' : s.core;
    x.lineWidth = size * 0.05;
    x.beginPath(); x.moveTo(...pts[k - 1]); x.lineTo(...pts[k]); x.stroke();
  }
  if (s.sparkle) { x.fillStyle = s.sparkle; for (let k = 0; k < 7; k++) { const [a, b] = pts[(k * 3 + 1) % pts.length]; x.beginPath(); x.arc(a + (k % 3 - 1) * size * 0.05, b - size * 0.06, size * 0.018, 0, 7); x.fill(); } }
}
function openShop() { shopTab = 'ball'; shopView = save.ballSkin; renderShop(); skinsEl.classList.remove('hidden'); }
function renderShop() {
  refreshCoins();
  const list = SKIN_SETS[shopTab], eq = equippedOf(shopTab);
  document.querySelectorAll('#skins .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === shopTab));
  const skin = list[shopView], unlocked = isUnlocked(shopTab, shopView);
  const pc = $('skinPreview'), px = pc.getContext('2d');
  px.clearRect(0, 0, pc.width, pc.height);
  if (shopTab === 'ball') { if (unlocked) px.drawImage(img[skin.img], 22, 22, 256, 256); else { px.globalAlpha = 0.35; px.drawImage(img[skin.img], 22, 22, 256, 256); px.globalAlpha = 1; } }
  else if (shopTab === 'basket') drawBasketPreview(px, shopView, 300);
  else drawLinePreview(px, shopView, 300);
  $('skinName').textContent = skin.name;
  const ach = document.querySelector('#skins .ach');
  if (skin.ach) {
    ach.classList.remove('hidden');
    const v = Math.min(statValue(skin.ach[1]), skin.ach[2]);
    $('achText').textContent = skin.ach[0];
    $('achFill').style.width = (v / skin.ach[2] * 100) + '%';
    $('achStatus').textContent = unlocked ? 'Unlocked' : `${Math.floor(v)} / ${skin.ach[2]} — or buy it with coins`;
    $('achIcon').src = img[unlocked ? 'ach_on' : 'ach_off'].src;
  } else ach.classList.add('hidden');
  const buy = $('btnBuy');
  buy.classList.remove('hidden', 'disabled', 'equipped');
  if (!unlocked) {
    buy.innerHTML = `BUY <i class="coin"></i>${skin.price}`;
    if (save.coins < skin.price) buy.classList.add('disabled');
  } else if (shopView !== eq) buy.innerHTML = 'EQUIP';
  else { buy.innerHTML = 'EQUIPPED'; buy.classList.add('equipped'); }

  const grid = $('skinGrid'); grid.innerHTML = '';
  list.forEach((s, i) => {
    const b = document.createElement('button');
    const u = isUnlocked(shopTab, i);
    b.className = 'skin-cell' + (i === eq ? ' sel' : '') + (i === shopView ? ' view' : '') + (u ? '' : ' locked');
    b.appendChild(skinIcon(shopTab, i));
    if (!u) { const p = document.createElement('span'); p.className = 'price'; p.innerHTML = `<i class="coin"></i>${s.price}`; b.appendChild(p); }
    if (i === eq) { const t = document.createElement('span'); t.className = 'tick'; t.textContent = '✓'; b.appendChild(t); }
    b.addEventListener('click', () => { sfx.unlock(); sfx.click(); shopView = i; renderShop(); });
    grid.appendChild(b);
  });
}
function shopAction() {
  const unlocked = isUnlocked(shopTab, shopView);
  if (!unlocked) {
    if (!buySkin(shopTab, shopView)) { sfx.fail(); return; }
    sfx.unlocked(); setEquipped(shopTab, shopView);
  } else setEquipped(shopTab, shopView);
  sfx.click(); renderShop(); refreshMenu();
}

// ---------- Stats & settings ----------
function openStats() {
  const rows = [
    ['Best score', save.best.score], ['Longest distance', fmtDist(save.best.distance)], ['Games played', save.total.games],
    ['Days played', save.days.length], ['Total points', save.total.points], ['Total distance', fmtDist(save.total.distance)],
    ['Perfect dunks', save.total.perfects], ['Most perfects in a game', save.best.perfects], ['Best perfect streak', save.best.inRow],
    ['Stars collected', save.total.stars], ['Seconds in rage mode', save.total.rageSeconds],
  ];
  $('statsList').innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
  statsEl.classList.remove('hidden');
}
const onOff = v => `<b class="${v ? '' : 'off'}">${v ? 'ON' : 'OFF'}</b>`;
function renderSettings() {
  $('optSound').innerHTML = `<span>Sound</span>${onOff(save.sound)}`;
  $('optMusic').innerHTML = `<span>Music</span>${onOff(save.music)}`;
  $('optVibrate').innerHTML = `<span>Vibration</span>${onOff(save.vibrate)}`;
  $('optUnits').innerHTML = `<span>Distance in</span><b>${save.feet ? 'FEET' : 'METERS'}</b>`;
}
function toggleSetting(key) {
  save[key] = !save[key]; writeSave(); renderSettings();
  sfx.unlock(); sfx.click();
  if (key === 'sound' || key === 'music') { if (save.sound && save.music) music.start(); else music.stop(); }
  if (key === 'vibrate') vibrate(40);
}

// ---------- Wiring ----------
function click(fn) { return () => { sfx.unlock(); music.start(); sfx.click(); fn(); }; }
const on = (id, fn) => $(id).addEventListener('click', click(fn));
on('btnPlay', () => playWithBreak(false));
on('btnAgain', () => playWithBreak(S.daily));
on('btnDaily', openDaily);
on('btnDailyGo', () => { dailyEl.classList.add('hidden'); playWithBreak(true); });
on('btnDailyBack', () => dailyEl.classList.add('hidden'));
on('btnGift', claimGift);
on('btnContinue', acceptContinue);
on('btnNoThanks', () => { clearInterval(contTimer); finishGame(); });
on('btnDouble', doubleCoins);
on('btnOverHome', () => setMode('menu'));
on('btnPause', () => { if (S.mode === 'play') setMode('paused'); });
on('btnResume', () => setMode('play'));
on('btnPauseHome', quitToMenu);
on('btnSkins', openShop);
on('btnSkinsBack', () => { skinsEl.classList.add('hidden'); refreshMenu(); });
on('btnBuy', shopAction);
document.querySelectorAll('#skins .tab').forEach(t => t.addEventListener('click', click(() => { shopTab = t.dataset.tab; shopView = equippedOf(shopTab); renderShop(); })));
on('btnMissions', () => { renderMissionList($('missionList'), false); missionsEl.classList.remove('hidden'); });
on('btnMissionsBack', () => missionsEl.classList.add('hidden'));
on('btnStats', openStats);
on('btnStatsBack', () => statsEl.classList.add('hidden'));
on('btnSettings', () => { renderSettings(); settingsEl.classList.remove('hidden'); });
on('btnSettingsBack', () => settingsEl.classList.add('hidden'));
['optSound', 'optMusic', 'optVibrate'].forEach(id => $(id).addEventListener('click', () => toggleSetting(id.slice(3).toLowerCase())));
$('optUnits').addEventListener('click', click(() => { save.feet = !save.feet; writeSave(); renderSettings(); refreshMenu(); }));
document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') setMode('paused'); });
// Portals require that keys used by the page never scroll the parent page, and no context menu
window.addEventListener('keydown', e => {
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  if (e.key === 'Escape' || e.key === 'p') { if (S.mode === 'play') setMode('paused'); else if (S.mode === 'paused') setMode('play'); }
});
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Drawing input ----------
function eventToWorld(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * VIEW_W - HALF_W, y: S.camY + VIEW_H / 2 - (e.clientY - r.top) / r.height * VIEW_H };
}
canvas.addEventListener('pointerdown', e => {
  if (S.mode !== 'play' || !S.balls.length) return;
  e.preventDefault();
  sfx.unlock(); music.start();
  canvas.setPointerCapture(e.pointerId);
  const p = eventToWorld(e);
  const st = { pts: [{ x: p.x, y: p.y, t: S.time }], active: true };
  S.strokes.push(st);
  pointers.set(e.pointerId, st);
  if (S.waitingRelease) { S.waitingRelease = false; updateHint(); }
});
canvas.addEventListener('pointermove', e => {
  const st = pointers.get(e.pointerId);
  if (!st || S.mode !== 'play') return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events) {
    const p = eventToWorld(ev);
    const last = st.pts[st.pts.length - 1];
    if (!last) { st.pts.push({ x: p.x, y: p.y, t: S.time }); continue; }
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < LINE_MIN_STEP) continue;
    const n = Math.ceil(d / 0.3);
    for (let i = 1; i <= n; i++) st.pts.push({ x: last.x + (p.x - last.x) * i / n, y: last.y + (p.y - last.y) * i / n, t: S.time });
  }
});
function endStroke(e) { const st = pointers.get(e.pointerId); if (st) { st.active = false; pointers.delete(e.pointerId); } }
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);

// ---------- Main loop ----------
let last = performance.now(), powerTick = 0;
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  if (!S.adActive && (S.mode === 'play' || S.mode === 'menu')) update(dt);
  if (S.mode === 'play' && (powerTick += dt) > 0.25) { powerTick = 0; renderPowers(); }
  render();
  requestAnimationFrame(frame);
}
let platformAudio = true;
function applyAudio() { audioBlocked = S.adActive || !platformAudio || document.hidden; sfx.suspend(audioBlocked); }
document.addEventListener('visibilitychange', applyAudio);
Platform.hooks.adStart = () => { S.adActive = true; applyAudio(); };
Platform.hooks.adEnd = () => { S.adActive = false; applyAudio(); };
Platform.hooks.audio = v => { platformAudio = v; applyAudio(); };

async function boot() {
  resize();
  await Promise.all([loadImages(), Platform.init()]);
  await Promise.all([document.fonts.load('40px "Lilita One"'), document.fonts.load('40px "Mitr"')]);
  ensureMissions();
  setMode('menu');
  Platform.loadingDone();
  requestAnimationFrame(frame);
}
boot().catch(err => {
  console.error(err);
  document.body.innerHTML = '<p style="color:#fff;font-family:sans-serif;padding:24px">The game could not load. Please refresh the page.</p>';
});
// Test hook (used by automated checks)
window.__fd = { S, save, startPlay, makeHoop, makeObstacle, populateScreen, spawnBall, startRage, applyPowerup, showZone, openShop, missionEvent };
