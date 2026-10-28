'use strict';
/*
 * Forever Dunk — tuning, content tables and catalogues.
 * World units: the camera shows 10 units of height (Unity orthographic size 5). y points up.
 * Core physics values come from the Unity prototype (Forever_Dunk 0.1).
 */

// ---------- Tuning ----------
const VIEW_H = 10;
// The field is as wide as the screen: portrait on phones, full width on monitors.
// VIEW_W / HALF_W are updated on every resize.
const PORTRAIT_W = VIEW_H * 9 / 16;          // the classic phone field (daily challenge always uses it)
const MIN_ASPECT = 0.45, MAX_ASPECT = 2.4;   // beyond these the stage is letterboxed
let VIEW_W = PORTRAIT_W;
let HALF_W = VIEW_W / 2;
// Hoops stay within reach of the ball, however wide the field is
const HOOP_MIN_DX = 1.5, HOOP_MAX_DX = 3.8;
const GRAVITY = 9.81 * 1.2;        // Unity used gravityScale 1.5; lowered so the ball falls a bit slower
const DRAG = 1.9;                  // Unity: linearDrag 1.9
const BALL_R = 0.39;               // Unity: ball collider radius
const LINE_LIFE = 1.5;             // Unity: trail lifetime 1.5 s
const LONG_LINE_LIFE = 3.0;        // with the Long Line power-up
const LINE_TH = 0.07;
const LINE_MIN_STEP = 0.12;
const METERS_PER_SCREEN = 3;       // Unity: customMetersHeight 3
const POINT = 1, PERFECT_POINT = 2;// Unity: pointValue / perfectPointValue
const GOLDEN_POINTS = 5;
const PERFECTS_FOR_RAGE = 3;       // Unity: PerfectsForRageMode
const BRAVO_CHANCE = 0.4;          // Unity: BravoTextUI showChance 40
const LIVES = 3;
const SHAKE_DUR = 0.3, SHAKE_MAG = 0.3;
const SCREEN_ANIM = 0.55;
const SCREENS_PER_ZONE = 8;
const ENTER_HINT = 1.3;            // seconds the drop indicator follows a ball into a new screen
const DAILY_GOAL = 15;             // baskets for the daily challenge reward
const DAILY_REWARD = 100;
const GIFT_COINS = 150;
const BOSS_COINS = 25, BOSS_POINTS = 5;

// Combo multiplier: consecutive baskets without losing a life
function comboMult(combo) { return combo >= 20 ? 4 : combo >= 10 ? 3 : combo >= 5 ? 2 : 1; }

// Hoop geometry (local units, origin = rim centre; hoops can be scaled by h.k)
const RIM_X = 0.82, RIM_R = 0.1, RIM_RY = 0.17;
const NET_COLLIDE = [[RIM_X, 0], [0.68, -0.35], [0.52, -0.66]];
const NET_ROWS = 5, NET_COLS = 7, NET_DEPTH = 0.78, NET_BOTTOM_HW = 0.47;

// Screen index at which each obstacle / feature first appears
const UNLOCK = {
  star: 2, tilt: 3, bumper: 4, powerup: 4, heart: 6, golden: 6, spinner: 7, trampoline: 8, moving: 9, slider: 10,
  conveyor: 12, wind: 13, portal: 15, pendulum: 17, drone: 19, blackhole: 21, cross: 23, gate: 25, cloud: 27,
};
const OBSTACLE_TYPES = ['bumper', 'spinner', 'trampoline', 'slider', 'conveyor', 'wind', 'portal', 'pendulum', 'drone', 'blackhole', 'cross', 'gate', 'cloud'];
function isBossScreen(screen) { return screen >= 7 && screen % SCREENS_PER_ZONE === SCREENS_PER_ZONE - 1; }

// ---------- Power-ups ----------
const POWERUPS = {
  long: { label: 'LONG LINE', color: '#5cf2ff', dur: 10 },
  magnet: { label: 'MAGNET', color: '#ff5f8a', dur: 8 },
  shield: { label: 'SHIELD', color: '#7dff9a' },
};

// ---------- Zones (visual themes) ----------
const ZONES = [
  { name: 'SUNSET COURT', top: '#ff8a4c', bot: '#5b2a86', accent: '#ffd166', glow: '#ff6b3d', fx: 'bokeh' },
  { name: 'NEON NIGHT', top: '#14123a', bot: '#3a0d5e', accent: '#22e6ff', glow: '#ff2bd6', fx: 'bokeh' },
  { name: 'DEEP SPACE', top: '#050818', bot: '#1d1550', accent: '#9db4ff', glow: '#7a5cff', fx: 'stars' },
  { name: 'TOXIC LAB', top: '#062b22', bot: '#0b1a2e', accent: '#7dff5a', glow: '#00ffa3', fx: 'bubbles' },
  { name: 'LAVA CORE', top: '#3a0703', bot: '#140308', accent: '#ffb000', glow: '#ff3d00', fx: 'embers' },
  { name: 'ICE PEAK', top: '#9fd8ff', bot: '#24508f', accent: '#ffffff', glow: '#7fe7ff', fx: 'snow' },
];
function zoneIndex(screen) { return Math.floor(screen / SCREENS_PER_ZONE); }
function zoneOf(screen) { return ZONES[zoneIndex(screen) % ZONES.length]; }

// ---------- Skins (Unity: SkinRepository / Achievement assets) ----------
// Every locked skin can be unlocked by its challenge OR bought with coins.
const P = { DistancePerGame: 0, TotalDistance: 1, PointsPerGame: 2, TotalPoints: 3, PlayGames: 4, PlayDays: 5, PerfectPerGame: 6, TotalPerfect: 7, PerfectInARow: 8, RageSeconds: 9 };
const BALL_SKINS = [
  { name: 'Classic', img: 'ball0' },
  { name: '8 Ball', img: 'ball1', price: 300, ach: ['Travel 60 m in one game.', P.DistancePerGame, 60] },
  { name: 'Pumpkin', img: 'ball2', price: 500, ach: ['Travel 3000 m in total.', P.TotalDistance, 3000] },
  { name: 'Beach Ball', img: 'ball4', price: 400, ach: ['Score 3000 points in total.', P.TotalPoints, 3000] },
  { name: 'Watermelon', img: 'ball5', price: 400, ach: ['Play 30 games.', P.PlayGames, 30] },
  { name: 'Planet', img: 'ball6', price: 300, ach: ['Play on 2 different days.', P.PlayDays, 2] },
  { name: 'Smiley', img: 'ball7', price: 400, ach: ['Score 10 perfect dunks in one game.', P.PerfectPerGame, 10] },
  { name: 'Cactus', img: 'ball8', price: 600, ach: ['Score 100 perfect dunks in total.', P.TotalPerfect, 100] },
  { name: 'Steel', img: 'ball9', price: 700, ach: ['Stay 120 seconds in rage mode.', P.RageSeconds, 120] },
];
const BASKET_SKINS = [
  { name: 'Classic', rim: '#ff5a1f', net: '#ffffff' },
  { name: 'Crimson', rim: '#e0103f', net: '#ffe3ea', price: 250, ach: ['Travel 60 m in one game.', P.DistancePerGame, 60] },
  { name: 'Ocean', rim: '#1f8bff', net: '#dff0ff', price: 300, ach: ['Travel 800 m in total.', P.TotalDistance, 800] },
  { name: 'Lime', rim: '#5fd12a', net: '#f0ffe6', price: 300, ach: ['Score 80 points in one game.', P.PointsPerGame, 80] },
  { name: 'Grape', rim: '#9b4dff', net: '#e6d6ff', price: 300, ach: ['Score 800 points in total.', P.TotalPoints, 800] },
  { name: 'Bubblegum', rim: '#ff5fb4', net: '#ffe1f1', price: 300, ach: ['Play 15 games.', P.PlayGames, 15] },
  { name: 'Ice', rim: '#7fe7ff', net: '#ffffff', price: 350, ach: ['Score 50 perfect dunks in total.', P.TotalPerfect, 50] },
  { name: 'Gold', rim: '#ffc21a', net: '#fff2b8', price: 500, ach: ['Play on 4 different days.', P.PlayDays, 4] },
  { name: 'Shadow', rim: '#2a2a36', net: '#9aa0b4', price: 350, ach: ['Score 7 perfect dunks in one game.', P.PerfectPerGame, 7] },
  { name: 'Lava', rim: '#ff3d00', net: '#ffb347', price: 450, ach: ['Score 6 perfect dunks in a row.', P.PerfectInARow, 6] },
];
// mode: solid = glow + core colour, rainbow = shifting hue, candy = alternating stripes
const LINE_SKINS = [
  { name: 'Neon', mode: 'zone' },
  { name: 'Fire', mode: 'solid', glow: '#ff6a00', core: '#ffe08a', sparkle: '#ffb347', price: 250 },
  { name: 'Ice', mode: 'solid', glow: '#7fe7ff', core: '#ffffff', sparkle: '#dff8ff', price: 250 },
  { name: 'Toxic', mode: 'solid', glow: '#7dff5a', core: '#f0ffd8', price: 250 },
  { name: 'Candy', mode: 'candy', glow: '#ff5fb4', core: '#ffffff', price: 300 },
  { name: 'Gold', mode: 'solid', glow: '#ffcc33', core: '#fff3b0', sparkle: '#fff1a6', price: 400 },
  { name: 'Galaxy', mode: 'solid', glow: '#9b5cff', core: '#efe4ff', sparkle: '#ffffff', price: 450 },
  { name: 'Rainbow', mode: 'rainbow', glow: '#ffffff', price: 600 },
];
const SKIN_SETS = { ball: BALL_SKINS, basket: BASKET_SKINS, line: LINE_SKINS };

// ---------- Missions ----------
// perRun missions must be done inside one run; the others add up across runs.
const MISSION_POOL = [
  { type: 'baskets', perRun: true, targets: [10, 15, 25], text: n => `Score ${n} baskets in one run`, reward: n => 30 + n * 3 },
  { type: 'perfects', perRun: true, targets: [3, 5, 8], text: n => `Make ${n} perfect dunks in one run`, reward: n => 40 + n * 8 },
  { type: 'streak', perRun: true, targets: [3, 4, 5], text: n => `Make ${n} perfect dunks in a row`, reward: n => 40 + n * 12 },
  { type: 'combo', perRun: true, targets: [2, 3], text: n => `Reach a x${n} combo`, reward: n => 40 + n * 25 },
  { type: 'screen', perRun: true, targets: [8, 16], text: n => `Reach ${ZONES[n / SCREENS_PER_ZONE].name}`, reward: n => 60 + n * 5 },
  { type: 'stars', perRun: false, targets: [5, 10, 20], text: n => `Collect ${n} stars`, reward: n => 30 + n * 4 },
  { type: 'portal', perRun: false, targets: [2, 4], text: n => `Travel through ${n} portals`, reward: n => 50 + n * 10 },
  { type: 'trampoline', perRun: false, targets: [3, 6], text: n => `Bounce on a trampoline ${n} times`, reward: n => 40 + n * 8 },
  { type: 'bumper', perRun: false, targets: [5, 10], text: n => `Hit bumpers ${n} times`, reward: n => 30 + n * 5 },
  { type: 'games', perRun: false, targets: [2, 3, 5], text: n => `Play ${n} games`, reward: n => 20 + n * 10 },
  { type: 'powerups', perRun: false, targets: [2, 4], text: n => `Pick up ${n} power-ups`, reward: n => 40 + n * 10 },
  { type: 'golden', perRun: false, targets: [1, 2], text: n => `Score in ${n} golden hoop${n > 1 ? 's' : ''}`, reward: n => 60 + n * 20 },
];
