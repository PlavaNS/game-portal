// Writes the player FAQ for /faq/ with the Claude API, from facts about the site that are
// true and checkable (taken from site.config.json and the built game index), never invented.
//
//   ANTHROPIC_API_KEY=...  node scripts/write-faq.mjs
//
// Writes data/faq.json: [["question", "answer"], ...]. scripts/build.mjs renders it on /faq/
// and falls back to the built-in questions when the file is missing.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const KEY = process.env.ANTHROPIC_API_KEY;
const API = 'https://api.anthropic.com/v1';
const HEADERS = { 'x-api-key': KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^﻿/, '')); } catch { return d; } };
if (!KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }

const cfg = read('site.config.json', {});
const ours = read('data/our-games.json', []);
const community = read('data/community-games.json', []);
const published = (() => { try { return fs.readFileSync(path.join(ROOT, 'data/published.txt'), 'utf8').split('\n').filter(Boolean).length; } catch { return 0; } })();

const FACTS = `Site: ${cfg.name} (${cfg.url}), run by ${cfg.studio}, an escape room and game studio from Novi Sad, Serbia.
Contact email: ${cfg.contactEmail}.
About ${published.toLocaleString('en-US')} free browser games, playable instantly, no download, no installs, no account, no newsletter.
Where the games come from: ${ours.length} games made by ${cfg.studio} itself; games licensed from the distribution networks Playgama, GameMonetize and GamePix; and ${community.length} games sent in directly by independent developers. Games are never copied from other portals.
Money: the site is free for players; short ads inside the games pay the developers and the site. There is nothing to buy on the site.
Browser storage: recently played games, favourites and the light/dark choice are kept in the visitor's own browser and never leave their device. Clearing browser data or using private mode loses them. Most games also save their own progress in the browser the same way.
Cookie consent: visitors in Europe are asked before non-essential cookies are used; the choice can be changed with "Cookie settings" in the footer.
Mobile: many games are made for touch and are collected in the Mobile category; games built for a wide screen ask the player to turn the phone sideways; a few older games need a keyboard and mouse and say so on their page.
Content rules: family-friendly only, no adult content, no gambling, no hate. Games for younger players are in the Kids category.
Submitting a game: free and non-exclusive at ${cfg.url}/submit-game/. A real person plays every submission. Accepted games get their own page that credits the developer and links back to them; the game stays hosted on the developer's own server and can be removed at any time by emailing us.
Embedding: the site's own games have an "Embed this game" box with ready-made code on their page. Games from other developers are not ours to licence.
Other pages: /publish-html5-game/ compares the portals a developer can publish on; /our-games/ lists the studio's own games.`;

const SYSTEM = `You write the FAQ page for players on a free browser-game website.
You are given a block of facts about the site. Write 10 to 12 question-and-answer pairs.
Rules:
- Use ONLY the facts given. Never invent a feature, a number, a partner, a price or a policy. If something is not in the facts, do not mention it.
- Write the questions the way a real visitor would ask them, in their own words ("Is it really free?", "A game will not load"), not as marketing headings.
- Answers: 1 to 3 sentences, plain friendly English, concrete and honest. Say plainly when something is a limitation (for example that clearing browser data loses progress).
- Cover, in a sensible order: cost, account, downloads, phones and tablets, safety for children, saved progress, a game that will not load, where the games come from, submitting your own game, removing your game, embedding, and how to reach a human.
- No hype words, no emoji, no exclamation marks, no mention of other websites except those named in the facts.
Reply with JSON only, exactly this shape:
{"faq": [["question", "answer"], ["question", "answer"]]}`;

async function pickModel() {
  if (process.env.FAQ_MODEL) return process.env.FAQ_MODEL;
  const r = await fetch(`${API}/models?limit=100`, { headers: HEADERS });
  if (!r.ok) throw new Error(`models list: HTTP ${r.status}`);
  const j = await r.json();
  const pool = (j.data || []).filter(m => /sonnet/i.test(m.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!pool.length) throw new Error('no Sonnet model available');
  return pool[0].id;
}

const MODEL = await pickModel();
console.log('model:', MODEL);

let out = null;
for (let attempt = 1; attempt <= 4; attempt++) {
  const r = await fetch(`${API}/messages`, { method: 'POST', headers: HEADERS,
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: 'user', content: FACTS }] }) });
  if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 4000 * attempt)); continue; }
  if (!r.ok) { console.error(`HTTP ${r.status} ${(await r.text()).slice(0, 300)}`); process.exit(1); }
  const j = await r.json();
  console.log(`tokens in ${j.usage?.input_tokens}, out ${j.usage?.output_tokens}`);
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  let x = null; try { x = m && JSON.parse(m[0]); } catch {}
  const faq = (x && Array.isArray(x.faq) ? x.faq : [])
    .filter(p => Array.isArray(p) && p.length === 2 && p.every(t => typeof t === 'string' && t.length > 8))
    .map(([q, a]) => [q.replace(/\s+/g, ' ').trim(), a.replace(/\s+/g, ' ').trim()]);
  if (faq.length >= 8) { out = faq.slice(0, 12); break; }
}
if (!out) { console.error('no usable FAQ came back'); process.exit(1); }
fs.writeFileSync(path.join(ROOT, 'data/faq.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`written: ${out.length} questions -> data/faq.json`);
