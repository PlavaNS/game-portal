// Gives each topic landing page its own content: a short "where to start" list of real picks
// from that page, and an FAQ. Written with the Claude API from the games actually on the page.
//
//   ANTHROPIC_API_KEY=...  node scripts/write-topic-guides.mjs [howMany]
//
// Needs .cache/topic-games.json, which scripts/build.mjs writes. Run build first.
// Writes data/topic-guides.json. Topics already done are left alone, so it can be run again.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const COUNT = Math.max(1, Math.min(500, parseInt(process.argv[2] || '200', 10) || 200));
const CONC = Math.max(1, Math.min(16, parseInt(process.env.TOPIC_CONC || '4', 10) || 4));
const KEY = process.env.ANTHROPIC_API_KEY;
const API = 'https://api.anthropic.com/v1';
const HEADERS = { 'x-api-key': KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^﻿/, '')); } catch { return d; } };

const topics = read('.cache/topic-games.json', null);
if (!topics) { console.error('No .cache/topic-games.json - run: node scripts/build.mjs'); process.exit(1); }
if (!KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }
const FILE = 'data/topic-guides.json';
const out = read(FILE, {});
const save = () => fs.writeFileSync(path.join(ROOT, FILE), JSON.stringify(out, null, 1) + '\n');

const SYSTEM = `You write the editorial part of a collection page on the free browser-game site "I Love Web Games".
You are given the collection's heading and a numbered list of games that are really on that page, each with its own description.
Write two things:
1. "picks": 4 or 5 of those games, the ones a newcomer should try first. For each, give its number from the list and one sentence (max 25 words) saying what it is like and who it suits. Pick a varied set, not five of the same thing.
2. "faq": 3 questions a real visitor to this page would ask, each with a 1-2 sentence answer. Ask about the games and how they play (what makes a good one, what to start with, what the difference is between two kinds, whether they suit kids, how long a session takes). Do NOT ask whether the games are free, need a download, or work on a phone.
Rules:
- Use ONLY what the descriptions say. Never invent a feature, a mode, a number or a character.
- Plain, friendly English. No hype words ("ultimate", "epic", "amazing"), no emoji, no marketing.
- Never mention other websites, prices, downloads or app stores.
Reply with JSON only, exactly this shape:
{"picks": [{"n": 3, "line": "..."}, ...], "faq": [["question", "answer"], ["question", "answer"], ["question", "answer"]]}`;

let inTok = 0, outTok = 0;
async function pickModel() {
  if (process.env.TOPIC_MODEL) return process.env.TOPIC_MODEL;
  const r = await fetch(`${API}/models?limit=100`, { headers: HEADERS });
  if (!r.ok) throw new Error(`models list: HTTP ${r.status}`);
  const j = await r.json();
  const haiku = (j.data || []).filter(m => /haiku/i.test(m.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!haiku.length) throw new Error('no Haiku model available');
  return haiku[0].id;
}
const MODEL = await pickModel();
console.log('model:', MODEL);

const todo = topics.filter(t => !out[t.slug]).slice(0, COUNT);
console.log(`topics: ${topics.length}, already written: ${Object.keys(out).length}, writing now: ${todo.length}`);
if (!todo.length) process.exit(0);

async function write(t) {
  const list = t.games.slice(0, 18);
  const user = `Collection: ${t.h1}
What people search for: ${t.kw}

Games on this page:
${list.map((g, i) => `${i + 1}. ${g.title} — ${String(g.description).slice(0, 320)}`).join('\n')}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(`${API}/messages`, { method: 'POST', headers: HEADERS,
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content: user }] }) });
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 4000 * attempt)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    inTok += j.usage?.input_tokens || 0; outTok += j.usage?.output_tokens || 0;
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    let x = null; try { x = m && JSON.parse(m[0]); } catch {}
    if (!x || !Array.isArray(x.picks) || !Array.isArray(x.faq)) continue;
    const picks = x.picks.map(p => {
      const g = list[(p && p.n | 0) - 1];
      return g && typeof p.line === 'string' && p.line.length > 15 ? { slug: g.slug, title: g.title, line: p.line.replace(/\s+/g, ' ').trim() } : null;
    }).filter(Boolean);
    const faq = x.faq.filter(p => Array.isArray(p) && p.length === 2 && p.every(s => typeof s === 'string' && s.length > 5))
      .map(([q, a]) => [q.replace(/\s+/g, ' ').trim(), a.replace(/\s+/g, ' ').trim()]);
    if (picks.length >= 3 && faq.length >= 2) return { picks: picks.slice(0, 5), faq: faq.slice(0, 3) };
  }
  return null;
}

let i = 0, done = 0, failed = 0;
async function worker() {
  while (i < todo.length) {
    const t = todo[i++];
    try { const g = await write(t); if (g) { out[t.slug] = g; done++; } else { failed++; console.warn('skipped:', t.slug); } }
    catch (e) { failed++; console.warn('failed:', t.slug, e.message); if (/HTTP 40[13]/.test(e.message)) i = todo.length; }
    if ((done + failed) % 10 === 0) save();
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save();
console.log(`written: ${done}, failed: ${failed}, total: ${Object.keys(out).length}`);
console.log(`tokens: input ${inTok}, output ${outTok}`);
