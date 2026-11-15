// Writes original long-form articles for the /guides/ section with the Claude API: three per collection page
// (tips, a beginner's start guide, the main kinds explained), grounded in the games that are really on that page.
//
//   ANTHROPIC_API_KEY=...  node scripts/write-articles.mjs [howMany]
//
// Needs .cache/topic-games.json, which scripts/build.mjs writes. Run build first.
// Writes data/articles.json. Articles already written are left alone, so it can be run again.
// Optional env: ARTICLE_MODEL (model id; default = newest Sonnet), ARTICLE_CONC, BUDGET_USD (stop when the estimate passes it).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const COUNT = Math.max(1, Math.min(1000, parseInt(process.argv[2] || '60', 10) || 60));
const CONC = Math.max(1, Math.min(10, parseInt(process.env.ARTICLE_CONC || '6', 10) || 6));
const BUDGET = parseFloat(process.env.BUDGET_USD || '10');
const KEY = process.env.ANTHROPIC_API_KEY;
const API = 'https://api.anthropic.com/v1';
const HEADERS = { 'x-api-key': KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^﻿/, '')); } catch { return d; } };

const topics = read('.cache/topic-games.json', null);
if (!topics) { console.error('No .cache/topic-games.json - run: node scripts/build.mjs'); process.exit(1); }
if (!KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }
const FILE = 'data/articles.json';
const out = read(FILE, {});
const save = () => fs.writeFileSync(path.join(ROOT, FILE), JSON.stringify(out, null, 1) + '\n');
const TODAY = new Date().toISOString().slice(0, 10);

const ANGLES = {
  tips: {
    slug: 'tips',
    brief: `Angle: practical advice for getting better at this kind of game. Title pattern: "How to Get Better at <subject>: <N> Tips" or a natural variation. Sections cover habits and decisions that carry over to every game of this kind (planning ahead, reading the screen, managing risk, practice routine, common mistakes), explained with concrete reasoning. Keep it about the genre in general; mention a specific game only in the "picks" list.`,
  },
  start: {
    slug: 'beginners-guide',
    brief: `Angle: a beginner's guide. Title pattern: "<Subject>: Where to Start and What to Look For". Sections: what these games are, what a first session looks like, how to tell a good one from a weak one, how long a session takes, what to try next. Talk to someone who has never played this kind of game.`,
  },
  kinds: {
    slug: 'types-explained',
    brief: `Angle: the main kinds of this game explained. Title pattern: "<Subject> Explained: The Main Types and How They Differ". Sections: split the games on the page into 3 or 4 kinds that really differ in how they play (use the descriptions to decide), explain each kind and who it suits, then how to pick one. In the "picks" list, give each kind at least one representative game.`,
  },
};

const SYSTEM = `You write articles for the editorial section of the free browser-game site "I Love Web Games".
You are given one collection (for example "Mahjong Games") and a numbered list of games that are really on the site, each with its own description.
Write ONE article following the angle in the message. Output rules:
- 750 to 1000 words in total across "intro" and "sections". 5 or 6 sections, each with 2 or 3 paragraphs.
- Be specific and useful. Explain the reasoning behind every piece of advice. Give examples a reader can act on in the next five minutes.
- Facts about specific games come ONLY from the descriptions given. Never invent a feature, mode, level, control, score or character. General facts about the game type (how mahjong matching works, how a tower defense wave works) are fine when you are certain of them.
- You did not play the games and no staff tested them. Never write "we tested", "we played", "our team found", "in our experience" or similar. Never claim studies, statistics or rankings.
- Plain, friendly English addressed to "you". No hype words ("ultimate", "epic", "amazing", "game-changer"), no emoji, no marketing, no questions as section titles unless natural, no "In today's world", no "Let's dive in", no "Whether you're a beginner or a pro". No dashes used as punctuation: use commas and full stops.
- Never mention other websites, brands that are not games on the list, prices, downloads, app stores or sign-ups.
- "picks": 3 to 6 games from the numbered list, with the number and one sentence (max 28 words) on what the game is like and who it suits, from its description only.
- "faq": 3 questions a real reader would ask about this kind of game, each with a 2 sentence answer. Do not ask whether the games are free or need a download.
- "title" max 62 characters, "description" 120 to 155 characters, written for a search result: specific, no clickbait.
Reply with JSON only, exactly this shape:
{"title": "...", "description": "...", "intro": "2 or 3 sentences", "sections": [{"h2": "...", "body": ["paragraph", "paragraph"]}], "picks": [{"n": 3, "line": "..."}], "faq": [["question", "answer"]]}`;

const PRICE = { haiku: [1, 5], sonnet: [3, 15], opus: [5, 25] };
let inTok = 0, outTok = 0, rate = [3, 15];
const spent = () => (inTok * rate[0] + outTok * rate[1]) / 1e6;

async function pickModel() {
  if (process.env.ARTICLE_MODEL) return process.env.ARTICLE_MODEL;
  const r = await fetch(`${API}/models?limit=100`, { headers: HEADERS });
  if (!r.ok) throw new Error(`models list: HTTP ${r.status}`);
  const j = await r.json();
  const so = (j.data || []).filter(m => /sonnet/i.test(m.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!so.length) throw new Error('no Sonnet model available');
  return so[0].id;
}
const MODEL = await pickModel();
rate = PRICE[Object.keys(PRICE).find(k => MODEL.includes(k))] || [3, 15];
console.log('model:', MODEL, '| assumed price per million tokens (in/out):', rate.join('/'), '| budget:', BUDGET);

const jobs = [];
for (const t of [...topics].sort((a, b) => b.games.length - a.games.length)) {
  if (t.games.length < 8) continue;
  for (const [key, a] of Object.entries(ANGLES)) {
    const slug = `${t.slug}-${a.slug}`;
    if (!out[slug]) jobs.push({ slug, t, key, a });
  }
}
const todo = jobs.slice(0, COUNT);
console.log(`articles possible: ${jobs.length + Object.keys(out).length}, already written: ${Object.keys(out).length}, writing now: ${todo.length}`);
if (!todo.length) process.exit(0);

const BAD = /ultimate|epic\b|amazing|game-changer|dive in|delve|we tested|we played|our team|in our experience|whether you'?re a (beginner|newcomer)|in today'?s/i;
const clean = s => String(s).replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
const words = x => [x.intro, ...x.sections.flatMap(s => s.body)].join(' ').split(/\s+/).length;

async function write(job) {
  const list = job.t.games.slice(0, 18);
  const user = `Collection: ${job.t.h1}
What people search for: ${job.t.kw}

${job.a.brief}

Games on the site for this collection:
${list.map((g, i) => `${i + 1}. ${g.title}: ${String(g.description).slice(0, 360)}`).join('\n')}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (spent() >= BUDGET) return 'budget';
    const r = await fetch(`${API}/messages`, { method: 'POST', headers: HEADERS,
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages: [{ role: 'user', content: user }] }) });
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 5000 * attempt)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    inTok += j.usage?.input_tokens || 0; outTok += j.usage?.output_tokens || 0;
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    let x = null; try { x = m && JSON.parse(m[0]); } catch {}
    if (!x) console.warn(`unparsable ${job.slug}: stop=${j.stop_reason} out=${j.usage?.output_tokens} head=${JSON.stringify(text.slice(0, 120))} tail=${JSON.stringify(text.slice(-160))}`);
    if (!x || typeof x.title !== 'string' || typeof x.description !== 'string' || typeof x.intro !== 'string' || !Array.isArray(x.sections) || !Array.isArray(x.picks) || !Array.isArray(x.faq)) continue;
    const sections = x.sections.map(s => s && typeof s.h2 === 'string' && Array.isArray(s.body) ? { h2: clean(s.h2), body: s.body.filter(p => typeof p === 'string').map(clean).filter(p => p.length > 40) } : null)
      .filter(s => s && s.body.length);
    const picks = x.picks.map(p => { const g = list[(p && p.n | 0) - 1]; return g && typeof p.line === 'string' && p.line.length > 15 ? { slug: g.slug, title: g.title, line: clean(p.line) } : null; }).filter(Boolean);
    const faq = x.faq.filter(p => Array.isArray(p) && p.length === 2 && p.every(s => typeof s === 'string' && s.length > 5)).map(([q, a]) => [clean(q), clean(a)]);
    const art = { topic: job.t.slug, angle: job.key, title: clean(x.title), description: clean(x.description), intro: clean(x.intro), sections, picks: picks.slice(0, 6), faq: faq.slice(0, 3), date: TODAY };
    const bad = BAD.test(JSON.stringify(art));
    if (sections.length < 4 || picks.length < 3 || faq.length < 2 || words(art) < 600 || art.title.length > 70 || art.description.length < 90 || art.description.length > 165 || bad) { console.warn(`retry ${job.slug}: sections=${sections.length} picks=${picks.length} faq=${faq.length} words=${words(art)} bad=${bad}`); continue; }
    return art;
  }
  return null;
}

let i = 0, done = 0, failed = 0, stop = false;
async function worker() {
  while (i < todo.length && !stop) {
    const job = todo[i++];
    try {
      const a = await write(job);
      if (a === 'budget') { stop = true; console.warn('budget reached, stopping'); break; }
      if (a) { out[job.slug] = a; done++; } else { failed++; console.warn('skipped:', job.slug); }
    } catch (e) { failed++; console.warn('failed:', job.slug, e.message); if (/HTTP 40[13]/.test(e.message)) stop = true; }
    if ((done + failed) % 10 === 0) save();
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save();
console.log(`written: ${done}, failed: ${failed}, total: ${Object.keys(out).length}`);
console.log(`tokens: input ${inTok}, output ${outTok}, estimated cost at assumed prices: $${spent().toFixed(2)}`);
