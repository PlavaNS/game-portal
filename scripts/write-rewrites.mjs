// Rewrites the partner-supplied description of each game in our own words, so the "About" text on the game page
// is not the same text every other portal shows. Facts stay the same, wording is new. Result: data/rewrites.json.
//
//   ANTHROPIC_API_KEY=...  node scripts/write-rewrites.mjs [howMany]
//
// Needs .cache/games.json (scripts/build.mjs writes it). Games with a guide first (pages Google shows first, then the most played).
// Optional env: REWRITE_MODEL (default = newest Haiku), REWRITE_CONC, BUDGET_USD (stop when the estimate passes it).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const COUNT = Math.max(1, Math.min(12000, parseInt(process.argv[2] || '500', 10) || 500));
const CONC = Math.max(1, Math.min(16, parseInt(process.env.REWRITE_CONC || '8', 10) || 8));
const BUDGET = parseFloat(process.env.BUDGET_USD || '10');
const KEY = process.env.ANTHROPIC_API_KEY;
const API = 'https://api.anthropic.com/v1';
const HEADERS = { 'x-api-key': KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^﻿/, '')); } catch { return d; } };
const games = read('.cache/games.json', null);
if (!games) { console.error('No .cache/games.json - run: node scripts/build.mjs'); process.exit(1); }
if (!KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }
const FILE = 'data/rewrites.json';
const out = read(FILE, {});
const guides = read('data/guides.json', {});
const save = () => fs.writeFileSync(path.join(ROOT, FILE), JSON.stringify(out, null, 1) + '\n');

const prio = (() => { try { return fs.readFileSync(path.join(ROOT, 'data/priority-slugs.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).join(',').split(',').map(x => x.trim()).filter(Boolean); } catch { return []; } })();
const rank = new Map(prio.map((s, i) => [s, i]));
const cand = games.filter(g => g.slug && guides[g.slug] && !out[g.slug] && String(g.description || '').length >= 80);
cand.sort((a, b) => (rank.has(a.slug) ? rank.get(a.slug) : 1e9) - (rank.has(b.slug) ? rank.get(b.slug) : 1e9));
const todo = cand.slice(0, COUNT);
console.log(`games: ${games.length}, rewritten: ${Object.keys(out).length}, candidates: ${cand.length}, writing now: ${todo.length}`);
if (!todo.length) process.exit(0);

const PRICE = { haiku: [1, 5], sonnet: [3, 15] };
let inTok = 0, outTok = 0, rate = [1, 5];
const spent = () => (inTok * rate[0] + outTok * rate[1]) / 1e6;
async function pickModel() {
  if (process.env.REWRITE_MODEL) return process.env.REWRITE_MODEL;
  const r = await fetch(`${API}/models?limit=100`, { headers: HEADERS });
  if (!r.ok) throw new Error(`models list: HTTP ${r.status}`);
  const j = await r.json();
  const h = (j.data || []).filter(m => /haiku/i.test(m.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!h.length) throw new Error('no Haiku model available');
  return h[0].id;
}
const MODEL = await pickModel();
rate = PRICE[Object.keys(PRICE).find(k => MODEL.includes(k))] || [1, 5];
console.log('model:', MODEL, '| assumed price per million tokens (in/out):', rate.join('/'), '| budget:', BUDGET);

const SYSTEM = `You rewrite the description of a free browser game for the website "I Love Web Games", in your own words.
Rules:
- Keep every fact the original gives (what you do, goals, modes, features, controls). Add NOTHING that is not in the original or the instructions: no invented levels, items, characters, numbers or comparisons.
- Use new wording and a new sentence structure. Do not copy sentences or long phrases from the original.
- 80 to 140 words in 2 short paragraphs. Plain, friendly English. No hype words ("ultimate", "epic", "amazing", "exciting"), no emoji, no calls to action ("play now", "download"), no questions.
- Do not mention the developer, other websites, ads, prices, downloads or sign-up.
Reply with the rewritten text only, paragraphs separated by one blank line.`;

const words = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const shingles = (w, n = 5) => { const s = new Set(); for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' ')); return s; };
const BAD = /ultimate|epic\b|amazing|exciting|play now|download|sign.?up|developer|click here/i;

async function write(g) {
  const user = `Title: ${g.title}\nCategory: ${g.cat || ''}${g.tags?.length ? `\nTags: ${g.tags.slice(0, 8).join(', ')}` : ''}\nOriginal description: ${String(g.description).slice(0, 2200)}\nInstructions: ${String(g.instructions || '(none)').slice(0, 800)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (spent() >= BUDGET) return 'budget';
    const r = await fetch(`${API}/messages`, { method: 'POST', headers: HEADERS,
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: SYSTEM, messages: [{ role: 'user', content: user }] }) });
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 4000 * attempt)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    inTok += j.usage?.input_tokens || 0; outTok += j.usage?.output_tokens || 0;
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').replace(/[—–]/g, ', ').trim();
    const paras = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const n = words(text).length;
    const a = shingles(words(g.description)), b = shingles(words(text));
    let same = 0; for (const s of b) if (a.has(s)) same++;
    const overlap = b.size ? same / b.size : 1;
    if (paras.length < 1 || paras.length > 3 || n < 55 || n > 190 || BAD.test(text) || overlap > 0.2) continue;
    return paras;
  }
  return null;
}

let i = 0, done = 0, failed = 0, stop = false;
async function worker() {
  while (i < todo.length && !stop) {
    const g = todo[i++];
    try {
      const p = await write(g);
      if (p === 'budget') { stop = true; console.warn('budget reached, stopping'); break; }
      if (p) { out[g.slug] = p; done++; } else { failed++; }
    } catch (e) { failed++; console.warn('failed:', g.slug, e.message); if (/HTTP 40[13]/.test(e.message)) stop = true; }
    if ((done + failed) % 50 === 0) save();
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save();
console.log(`written: ${done}, failed: ${failed}, total: ${Object.keys(out).length}`);
console.log(`tokens: input ${inTok}, output ${outTok}, estimated cost at assumed prices: $${spent().toFixed(2)}`);
