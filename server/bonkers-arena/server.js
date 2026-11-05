// Bonkers Arena — game server. Serves the game files and runs online rooms over WebSocket.
// Each room holds up to 12 players; empty seats are filled with bots so a round never feels empty.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
// the game files: next to this folder, or wherever PUBLIC_DIR points (on Render they live in the site repo)
const PUBLIC = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public'));
const Sim = require(path.join(PUBLIC, 'sim.js'));
const SEATS = 12, TICK = 1 / 60, SEND_EVERY = 3, WAIT_S = 6, END_S = 7;
// Every online round is team against team: 4 teams of 3. Friends who share an invite code play in the same team.
const TEAMS = 4, PER_TEAM = SEATS / TEAMS;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };

// Online rounds rotate through four arenas.
const ROTATION = [
  { theme: 'cyber', bumpers: 3, blockers: [{ k: 'sweep', x: 0, y: 0, len: 150, w: 15, speed: 0.8 }] },
  { theme: 'frost', friction: 0.5, bumpers: 0, blockers: [{ k: 'pillar', x: 0, y: -260, w: 30 }, { k: 'pillar', x: 225, y: 130, w: 30 }, { k: 'pillar', x: -225, y: 130, w: 30 }] },
  { theme: 'synth', bumpers: 4, blockers: [{ k: 'wall', x: -120, y: -40, x2: 120, y2: -40, w: 12 }, { k: 'wall', x: -120, y: 40, x2: 120, y2: 40, w: 12 }] },
  { theme: 'inferno', hole: 90, rMin: 230, bumpers: 0, blockers: [{ k: 'slide', x: 0, y: -300, len: 70, w: 13, ang: 0, amp: 140, speed: 1.1 }, { k: 'slide', x: 0, y: 300, len: 70, w: 13, ang: 0, amp: 140, speed: -1.1 }] },
  { theme: 'aurora', hole: 70, rMin: 210, wind: 50, bumpers: 2 },
];

const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'puss', 'nigg', 'fag', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'porn', 'sex', 'anal', 'kurac', 'kurc', 'picka', 'pička', 'jebem', 'jebi', 'jeb', 'govno', 'kurva', 'peder', 'sranje', 'pizda', 'drolja', 'retard'];
function cleanName(s) {
  s = String(s || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14);
  const flat = s.toLowerCase().replace(/[^a-zčćšđž]/g, '');
  if (!s || BLOCK.some(w => flat.includes(w))) return 'Player' + (100 + Math.random() * 900 | 0);
  return s;
}

// ---------- leaderboard: points per online round, kept for today and this week ----------
const LB_FILE = path.join(DATA_DIR, 'leaderboard.json');
const dayKey = () => new Date().toISOString().slice(0, 10);
function weekKey() { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
let lb = { day: { key: dayKey(), players: {} }, week: { key: weekKey(), players: {} } };
try { lb = JSON.parse(fs.readFileSync(LB_FILE, 'utf8')); } catch (e) { console.log('leaderboard: starting fresh'); }
let lbDirty = false;

function addPoints(uid, name, pts) {
  if (lb.day.key !== dayKey()) lb.day = { key: dayKey(), players: {} };
  if (lb.week.key !== weekKey()) lb.week = { key: weekKey(), players: {} };
  for (const t of [lb.day, lb.week]) {
    const p = t.players[uid] || (t.players[uid] = { name, pts: 0 });
    p.name = name; p.pts += pts;
  }
  lbDirty = true;
}
function topOf(t) { return Object.values(t.players).sort((a, b) => b.pts - a.pts).slice(0, 10).map(p => [p.name, p.pts]); }
setInterval(() => {
  if (!lbDirty) return;
  lbDirty = false;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFile(LB_FILE, JSON.stringify(lb), err => { if (err) console.error('leaderboard save failed:', err.message); });
}, 10000);

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') { res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*', 'cache-control': 'no-cache' }); res.end('ok ' + rooms.length + ' rooms'); return; }
  if (url === '/api/top') {
    if (lb.day.key !== dayKey()) lb.day = { key: dayKey(), players: {} };
    if (lb.week.key !== weekKey()) lb.week = { key: weekKey(), players: {} };
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-cache' });
    res.end(JSON.stringify({ day: topOf(lb.day), week: topOf(lb.week) }));
    return;
  }
  const file = path.normalize(path.join(PUBLIC, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

const rooms = [];
let roundNo = 0;

class Room {
  constructor() { this.clients = new Set(); this.newRound(); }

  newRound() {
    const lv = Object.assign({}, Sim.ONLINE, ROTATION[roundNo++ % ROTATION.length], { teams: TEAMS });
    this.w = Sim.createWorld(lv);
    this.ph = 'wait'; this.cd = WAIT_S; this.tick = 0; this.events = []; this.res = null;
    this.inputs = {};
    for (const c of this.clients) this.seat(c);
    Sim.fillBots(this.w, SEATS, [...this.clients].map(c => c.color));
    this.teamBots();
    this.sendRound();
  }

  // a player keeps their team between rounds; a newcomer joins their party's team, or the team with the fewest players
  pickTeam(c) {
    const count = t => [...this.clients].filter(o => o !== c && o.team === t).length;
    const mate = c.party && [...this.clients].find(o => o !== c && o.party === c.party && o.team >= 0 && count(o.team) < PER_TEAM);
    if (mate) return mate.team;
    let best = 0;
    for (let t = 1; t < TEAMS; t++) if (count(t) < count(best)) best = t;
    return best;
  }

  // bots fill the empty spots so every team has three
  teamBots() {
    const size = t => this.w.balls.filter(b => b.team === t).length;
    for (const b of this.w.balls) if (b.team < 0) { let t = 0; for (let k = 1; k < TEAMS; k++) if (size(k) < size(t)) t = k; b.team = t; }
  }

  seat(c) {
    if (c.team == null || c.team < 0) c.team = this.pickTeam(c);
    const b = Sim.addBall(this.w, { name: c.name, skin: c.skin, human: true, col: c.col, team: c.team });
    c.ballId = b.id;
    this.inputs[b.id] = { a: b.face, p: 0, d: false };
  }

  join(c) {
    this.clients.add(c);
    c.team = this.pickTeam(c);
    if (this.ph === 'wait') {
      // take a bot's seat in the player's team so the human plays this round
      const bot = this.w.balls.find(b => !b.human && b.team === c.team) || this.w.balls.find(b => !b.human);
      if (bot) { this.w.balls.splice(this.w.balls.indexOf(bot), 1); this.w.alive--; }
      this.seat(c);
    } else c.ballId = 0;
    send(c.ws, { t: 'welcome', id: c.ballId });
    send(c.ws, { t: 'round', lv: this.lvMsg() });
    this.sendRoster();
  }

  leave(c) {
    this.clients.delete(c);
    const b = c.ballId && Sim.byId(this.w, c.ballId);
    if (b) { b.human = false; b.name += ' (bot)'; this.sendRoster(); }
  }

  lvMsg() {
    const lv = this.w.lv;
    return { id: 0, teams: TEAMS, name: lv.name, theme: lv.theme, time: lv.time, rMax: lv.rMax, rMin: lv.rMin, hole: lv.hole || 0, wind: lv.wind || 0, bumpers: this.w.bumpers.map(b => [b.x | 0, b.y | 0, b.r]), blockers: lv.blockers || [] };
  }

  sendRound() {
    for (const c of this.clients) { send(c.ws, { t: 'welcome', id: c.ballId }); send(c.ws, { t: 'round', lv: this.lvMsg() }); }
    this.sendRoster();
  }

  sendRoster() {
    const list = this.w.balls.map(b => [b.id, b.name, b.skin, b.human ? 1 : 0, b.col, b.team]);
    for (const c of this.clients) send(c.ws, { t: 'roster', list });
  }

  update() {
    const w = this.w;
    if (this.ph === 'wait') {
      this.cd -= TICK;
      if (this.cd <= 0) this.ph = 'play';
    } else if (this.ph === 'play') {
      Sim.step(w, TICK, this.inputs);
      for (const id in this.inputs) this.inputs[id].d = false;
      for (const e of w.events) if (e.e !== 'end') this.events.push(e);
      w.events.length = 0;
      if (w.over) {
        this.ph = 'end'; this.cd = END_S;
        this.res = w.balls.map(b => [b.id, b.place || 1, b.bonks, b.team, w.winTeam]);
        for (const c of this.clients) {
          const b = c.ballId && Sim.byId(w, c.ballId);
          if (!b) continue;
          addPoints(c.uid, c.name, (TEAMS - (b.place || TEAMS)) * 3 + b.bonks * 3 + (b.place === 1 ? 10 : 0));
        }
      }
    } else {
      Sim.step(w, TICK, this.inputs); // finishes the falls of balls already going over the edge
      for (const e of w.events) this.events.push(e);
      w.events.length = 0;
      this.cd -= TICK;
      if (this.cd <= 0) { this.newRound(); return; }
    }
    if (++this.tick % SEND_EVERY === 0) this.broadcast();
  }

  broadcast() {
    const w = this.w;
    const msg = {
      t: 's', ph: this.ph, cd: +this.cd.toFixed(1), T: +w.t.toFixed(2), R: Math.round(w.R),
      b: w.balls.filter(b => b.alive).map(b => [b.id, Math.round(b.x), Math.round(b.y), +b.r.toFixed(1), Math.round(b.face * 100), b.dashT > 0 ? 1 : 0, Math.round(b.dashCd * 10), Math.round(b.falling * 100), b.dizzy > 0 ? 1 : 0, b.bonks, Sim.PU_TYPES.indexOf(b.pu), Math.round(b.puT * 10)]),
      pu: w.powerups.flatMap(p => [Math.round(p.x), Math.round(p.y), Sim.PU_TYPES.indexOf(p.type)]),
      fz: w.freezeT > 0 ? w.freezeBy : 0,
      p: w.pellets.flatMap(p => [Math.round(p.x), Math.round(p.y), p.k]),
      bu: w.bumpers.map(b => Math.round(b.pulse * 10)),
      e: this.events.map(roundEvent),
    };
    if (this.res) msg.res = this.res;
    this.events = [];
    const data = JSON.stringify(msg);
    for (const c of this.clients) if (c.ws.readyState === 1) c.ws.send(data);
  }
}

function roundEvent(e) {
  const o = {};
  for (const k in e) o[k] = typeof e[k] === 'number' ? Math.round(e[k] * 100) / 100 : e[k];
  return o;
}

function send(ws, m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }

// friends go to the room where their party already plays (when their team still has a free spot)
function roomFor(c) {
  const humans = r => r.clients.size;
  if (c.party) {
    const r = rooms.find(x => humans(x) < SEATS && [...x.clients].some(o => o.party === c.party && [...x.clients].filter(p => p.team === o.team).length < PER_TEAM));
    if (r) return r;
  }
  let r = rooms.find(x => humans(x) < SEATS);
  if (!r) { r = new Room(); rooms.push(r); }
  return r;
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 512 });
wss.on('connection', ws => {
  let c = null, room = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'join' && !c) {
      const uid = String(m.uid || '').replace(/[^a-z0-9]/gi, '').slice(0, 24) || ('anon' + Math.random().toString(36).slice(2, 10));
      const color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#46e6ff';
      const col = Number.isInteger(m.col) && m.col >= -1 && m.col < Sim.COLORS.length ? m.col : -1;
      const party = /^[A-Z0-9]{5}$/.test(m.party) ? m.party : null;
      c = { ws, uid, name: cleanName(m.name), skin: Math.max(0, Math.min(14, m.skin | 0)), col, color, ballId: 0, party, team: -1 };
      room = roomFor(c); room.join(c);
      console.log(`join "${c.name}" → room ${rooms.indexOf(room)} (${room.clients.size} players)`);
    } else if (m.t === 'in' && c && c.ballId) {
      const i = room.inputs[c.ballId]; if (!i) return;
      const a = Number(m.a), p = Number(m.p);
      if (Number.isFinite(a)) i.a = a;
      if (Number.isFinite(p)) i.p = Math.max(0, Math.min(1, p));
      if (m.d) i.d = true;
    }
  });
  ws.on('close', () => {
    if (!c) return;
    room.leave(c);
    if (room.clients.size === 0) rooms.splice(rooms.indexOf(room), 1);
  });
});

setInterval(() => { for (const r of rooms) r.update(); }, TICK * 1000);

server.listen(PORT, () => console.log(`Bonkers Arena server on :${PORT}`));
