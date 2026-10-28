'use strict';
// ---------- Persistence (browser storage; the game works without it) ----------
const SAVE_KEY = 'foreverDunk.v1';
function defaultSave() {
  return {
    best: { score: 0, distance: 0, perfects: 0, inRow: 0 },
    total: { distance: 0, points: 0, games: 0, perfects: 0, rageSeconds: 0, stars: 0 },
    days: [], ballSkin: 0, basketSkin: 0, lineSkin: 0,
    owned: { ball: [0], basket: [0], line: [0] },
    coins: 0, missions: [], tutorialDone: false,
    daily: { date: '', best: 0, rewarded: false }, giftDate: '',
    sound: true, music: true, vibrate: true, feet: false,
  };
}
function loadSave() {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return base;
    const s = JSON.parse(raw);
    return {
      ...base, ...s,
      best: { ...base.best, ...s.best }, total: { ...base.total, ...s.total },
      owned: { ...base.owned, ...s.owned }, daily: { ...base.daily, ...s.daily },
    };
  } catch (e) { console.warn('Save unavailable', e); return base; }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { console.warn('Save failed', e); } }
const save = loadSave();
const today = () => new Date().toISOString().slice(0, 10);

function statValue(type) {
  switch (type) {
    case P.DistancePerGame: return save.best.distance;
    case P.TotalDistance: return save.total.distance;
    case P.PointsPerGame: return save.best.score;
    case P.TotalPoints: return save.total.points;
    case P.PlayGames: return save.total.games;
    case P.PlayDays: return save.days.length;
    case P.PerfectPerGame: return save.best.perfects;
    case P.TotalPerfect: return save.total.perfects;
    case P.PerfectInARow: return save.best.inRow;
    case P.RageSeconds: return save.total.rageSeconds;
  }
  throw new Error('Unknown achievement type ' + type);
}
// A skin is available when bought, or when its challenge is done
function isUnlocked(kind, i) {
  const skin = SKIN_SETS[kind][i];
  if (save.owned[kind].includes(i)) return true;
  return !!skin.ach && statValue(skin.ach[1]) >= skin.ach[2];
}
function buySkin(kind, i) {
  const skin = SKIN_SETS[kind][i];
  if (isUnlocked(kind, i) || save.coins < skin.price) return false;
  save.coins -= skin.price;
  save.owned[kind].push(i);
  writeSave();
  return true;
}

// ---------- Missions ----------
function newMission(excludeTypes) {
  const pool = MISSION_POOL.filter(m => !excludeTypes.includes(m.type));
  const m = pool[Math.floor(Math.random() * pool.length)];
  const target = m.targets[Math.floor(Math.random() * m.targets.length)];
  return { type: m.type, target, progress: 0 };
}
function missionDef(m) { return MISSION_POOL.find(d => d.type === m.type); }
function ensureMissions() {
  save.missions = save.missions.filter(m => MISSION_POOL.some(d => d.type === m.type));
  while (save.missions.length < 3) save.missions.push(newMission(save.missions.map(m => m.type)));
  writeSave();
}
function resetRunMissions() {
  for (const m of save.missions) if (missionDef(m).perRun) m.progress = 0;
}
// mode 'add' adds to progress, 'max' keeps the highest value seen in this run
function missionEvent(type, value, mode = 'add') {
  let changed = false;
  for (let i = 0; i < save.missions.length; i++) {
    const m = save.missions[i];
    if (m.type !== type) continue;
    const before = m.progress;
    m.progress = mode === 'max' ? Math.max(m.progress, value) : m.progress + value;
    if (m.progress !== before) changed = true;
    if (m.progress >= m.target) {
      const def = missionDef(m), reward = def.reward(m.target);
      save.coins += reward;
      onMissionComplete(def.text(m.target), reward);
      save.missions[i] = newMission(save.missions.map(x => x.type));
    }
  }
  if (changed) writeSave();
}
