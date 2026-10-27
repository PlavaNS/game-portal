// Writes original tips + FAQ for the most played games that still have no guide,
// using the Claude API, and adds them to data/guides.json.
//
//   ANTHROPIC_API_KEY=...  node scripts/write-guides.mjs [count]
//
// Needs .cache/games.json, which scripts/build.mjs writes. Run build first.
// Optional env: GUIDE_MODEL (model id; default = newest Haiku), DRY_RUN=1 (no API calls).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const COUNT = Math.max(1, Math.min(1000, parseInt(process.argv[2] || process.env.GUIDE_COUNT || '200', 10) || 200));
const KEY = process.env.ANTHROPIC_API_KEY;
const DRY = process.env.DRY_RUN === '1';
const API = 'https://api.anthropic.com/v1';
const HEADERS = { 'x-api-key': KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };

const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const games = readJSON(path.join(ROOT, '.cache/games.json'), null);
if (!games) { console.error('No .cache/games.json - run: node scripts/build.mjs'); process.exit(1); }
const GUIDES_FILE = path.join(ROOT, 'data/guides.json');
const guides = readJSON(GUIDES_FILE, {});

// pages Google already shows first (data/priority-slugs.txt, from Search Console), then the most played
// (build.mjs already sorts by score); only games without a guide
const prio = (() => { try { return fs.readFileSync(path.join(ROOT, 'data/priority-slugs.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).join(',').split(',').map(x => x.trim()).filter(Boolean); } catch { return []; } })();
const rank = new Map(prio.map((s, i) => [s, i]));
const cand = games.filter(g => g.slug && !guides[g.slug] && (g.description || '').length >= 60);
cand.sort((a, b) => (rank.has(a.slug) ? rank.get(a.slug) : 1e9) - (rank.has(b.slug) ? rank.get(b.slug) : 1e9));
const todo = cand.slice(0, COUNT);
console.log(`priority list: ${prio.length} pages, ${cand.filter(g => rank.has(g.slug)).length} of them still without a guide`);
console.log(`games: ${games.length}, with guide: ${Object.keys(guides).length}, writing now: ${todo.length}`);
if (!todo.length) process.exit(0);
if (DRY) { todo.slice(0, 20).forEach(g => console.log(' -', g.slug)); process.exit(0); }
if (!KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }

async function pickModel() {
  if (process.env.GUIDE_MODEL) return process.env.GUIDE_MODEL;
  const r = await fetch(`${API}/models?limit=100`, { headers: HEADERS });
  if (!r.ok) throw new Error(`models list: HTTP ${r.status} ${await r.text()}`);
  const j = await r.json();
  const haiku = (j.data || []).filter(m => /haiku/i.test(m.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!haiku.length) throw new Error('no Haiku model available');
  return haiku[0].id;
}

const SYSTEM = `You write short, original player guides for free browser games on the website "I Love Web Games".
Rules:
- Use ONLY facts found in the game's own description and instructions. Never invent levels, characters, modes, items, controls or numbers that are not mentioned there.
- Tips must be practical advice a player can act on (strategy, habits, what to focus on), not a restatement of the description.
- Plain, friendly English. No hype words ("ultimate", "epic", "amazing"), no emojis, no marketing.
- Do not mention download, sign-up, price, other websites or the game's developer.
- FAQ questions must be specific to how this game is played (goal, controls, scoring, difficulty, strategy). Do NOT ask whether the game is free, works on phone, or needs a download.
Reply with JSON only, no other text, exactly this shape:
{"intro": "1-2 sentences, max 40 words", "tips": ["4 or 5 tips, each 1-2 sentences"], "faq": [["question", "answer in 1-2 sentences"], ["question", "answer"]]}`;

function userMsg(g) {
  return `Game title: ${g.title}
Category: ${g.cat || ''}${g.tags?.length ? `\nTags: ${g.tags.slice(0, 8).join(', ')}` : ''}
Description: ${String(g.description).slice(0, 2500)}
Instructions: ${String(g.instructions || '(none)').slice(0, 1200)}`;
}

function valid(x) {
  if (!x || typeof x.intro !== 'string' || x.intro.length < 20) return false;
  if (!Array.isArray(x.tips) || x.tips.length < 3 || x.tips.some(t => typeof t !== 'string' || t.length < 15)) return false;
  if (!Array.isArray(x.faq) || x.faq.length < 1 || x.faq.some(p => !Array.isArray(p) || p.length !== 2 || p.some(s => typeof s !== 'string' || s.length < 5))) return false;
  const all = [x.intro, ...x.tips, ...x.faq.flat()].join(' ');
  if (/https?:\/\/|www\.|<[a-z]/i.test(all)) return false;
  return true;
}

const tidy = s => s.replace(/\s+/g, ' ').trim();
let inTok = 0, outTok = 0;

async function write(g, model) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(`${API}/messages`, {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ model, max_tokens: 900, system: SYSTEM, messages: [{ role: 'user', content: userMsg(g) }] }),
    });
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 4000 * attempt)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    inTok += j.usage?.input_tokens || 0; outTok += j.usage?.output_tokens || 0;
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    let x = null; try { x = m && JSON.parse(m[0]); } catch {}
    if (valid(x)) return { intro: tidy(x.intro), tips: x.tips.slice(0, 5).map(tidy), faq: x.faq.slice(0, 2).map(([q, a]) => [tidy(q), tidy(a)]) };
  }
  return null;
}

const model = await pickModel();
console.log('model:', model);
let done = 0, failed = 0, i = 0;
const CONC = 4;
async function worker() {
  while (i < todo.length) {
    const g = todo[i++];
    try {
      const guide = await write(g, model);
      if (guide) { guides[g.slug] = guide; done++; } else { failed++; console.warn('skipped (bad output):', g.slug); }
    } catch (e) {
      failed++; console.warn('failed:', g.slug, e.message);
      if (/HTTP 40[13]/.test(e.message)) { i = todo.length; } // bad key / no credit: stop
    }
    if ((done + failed) % 25 === 0) fs.writeFileSync(GUIDES_FILE, JSON.stringify(guides, null, 2) + '\n');
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
fs.writeFileSync(GUIDES_FILE, JSON.stringify(guides, null, 2) + '\n');
console.log(`written: ${done}, failed: ${failed}, total guides: ${Object.keys(guides).length}`);
console.log(`tokens: input ${inTok}, output ${outTok}`);
if (!done) process.exit(1);
