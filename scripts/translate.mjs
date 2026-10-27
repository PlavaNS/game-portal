// Translates the portal into another language with the Claude API.
//
//   ANTHROPIC_API_KEY=...  node scripts/translate.mjs <lang> [howManyGames]
//
// Needs .cache/phrases.json, .cache/cats.json and .cache/games.json, which scripts/build.mjs writes.
// Writes data/i18n/ui/<lang>.json, data/i18n/cats/<lang>.json and data/i18n/games/<lang>.json.
// Everything already translated is left alone, so the script can be run again to add more.
// Game TITLES are never translated: people search for the English name in every language.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const LANG = (process.argv[2] || '').trim();
const COUNT = Math.max(0, Math.min(6000, parseInt(process.argv[3] || '300', 10) || 0));
const CONC = Math.max(1, Math.min(24, parseInt(process.env.TRANSLATE_CONC || '6', 10) || 6));
const KEY = process.env.ANTHROPIC_API_KEY;
const API = 'https://api.anthropic.com/v1';
const HEADERS = { 'x-api-key': KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^﻿/, '')); } catch { return d; } };

const langs = read('data/i18n/langs.json', []);
const L = langs.find(l => l.code === LANG);
if (!L) { console.error(`Unknown language "${LANG}". Known: ${langs.map(l => l.code).join(', ')}`); process.exit(1); }
const phrases = read('.cache/phrases.json', null);
const cats = read('.cache/cats.json', null);
const games = read('.cache/games.json', null);
if (!phrases || !cats || !games) { console.error('Run: node scripts/build.mjs  (it writes .cache/)'); process.exit(1); }
const guides = read('data/guides.json', {});
if (!KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }

const F_UI = `data/i18n/ui/${LANG}.json`, F_CAT = `data/i18n/cats/${LANG}.json`, F_GAME = `data/i18n/games/${LANG}.json`;
const ui = read(F_UI, {}), cat = read(F_CAT, {}), game = read(F_GAME, {});
const save = (f, o) => fs.writeFileSync(path.join(ROOT, f), JSON.stringify(o, null, 1) + '\n');

const SYSTEM = `You translate a free online games website from English into ${L.label}.
Rules:
- Translate naturally, the way a native ${L.label} games site would write it. Never translate word by word.
- NEVER translate the names of games, studios or brands. Leave every proper name exactly as it is in English.
- Keep the meaning and the length roughly the same. Keep any emoji, punctuation and capitalisation style.
- Use the wording real players search for in ${L.label} (for example the common local phrase for "free online games").
- Never add, remove or explain anything. Never write notes.
Reply with JSON only, no other text.`;

let inTok = 0, outTok = 0;
async function ask(user, maxTokens = 4000) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(`${API}/messages`, {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
    });
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 4000 * attempt)); continue; }
    if (!r.ok) { const t = await r.text(); if (/40[13]/.test(String(r.status))) throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`); continue; }
    const j = await r.json();
    inTok += j.usage?.input_tokens || 0; outTok += j.usage?.output_tokens || 0;
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const m = text.match(/[[{][\s\S]*[\]}]/);
    try { return m ? JSON.parse(m[0]) : null; } catch { /* try again */ }
  }
  return null;
}

async function pickModel() {
  if (process.env.TRANSLATE_MODEL) return process.env.TRANSLATE_MODEL;
  const r = await fetch(`${API}/models?limit=100`, { headers: HEADERS });
  if (!r.ok) throw new Error(`models list: HTTP ${r.status}`);
  const j = await r.json();
  const haiku = (j.data || []).filter(m => /haiku/i.test(m.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!haiku.length) throw new Error('no Haiku model available');
  return haiku[0].id;
}
const MODEL = await pickModel();
console.log(`${LANG} (${L.label}) · model ${MODEL}`);

// ---- 1. interface phrases ----
{
  const todo = phrases.filter(p => !ui[p]);
  if (todo.length) {
    for (let i = 0; i < todo.length; i += 40) {
      const part = todo.slice(i, i + 40);
      const out = await ask(`Translate each of these website interface strings into ${L.label}.\nReply with a JSON object: the English string as the key, the translation as the value.\n\n${JSON.stringify(part, null, 1)}`);
      if (out) for (const k of part) if (typeof out[k] === 'string' && out[k].trim()) ui[k] = out[k].trim();
    }
    save(F_UI, ui);
  }
  console.log(`interface: ${Object.keys(ui).length}/${phrases.length}`);
}

// ---- 2. categories and topic landing pages ----
{
  const items = [...cats.cats.map(c => ({ ...c, kind: 'cat' })), ...cats.topics.map(t => ({ ...t, kind: 'topic' }))].filter(x => !cat[x.key]);
  for (let i = 0; i < items.length; i += 6) {
    const part = items.slice(i, i + 6);
    const out = await ask(`Translate these landing pages of a free online games site into ${L.label}.
"name" and "h1" are headings, "kw" is the search phrase people type, "intro" is one or two short paragraphs.
Keep the same shape and the same number of intro paragraphs. Do not translate game names inside the text.
Reply with a JSON object keyed by "key".

${JSON.stringify(part.map(x => ({ key: x.key, ...(x.name ? { name: x.name } : {}), h1: x.h1, ...(x.kw ? { kw: x.kw } : {}), intro: x.intro })), null, 1)}`);
    if (out) for (const x of part) {
      const o = out[x.key];
      if (o && o.h1) cat[x.key] = { ...(o.name ? { name: o.name } : {}), h1: o.h1, ...(o.kw ? { kw: o.kw } : {}), intro: Array.isArray(o.intro) ? o.intro : (typeof o.intro === 'string' ? [o.intro] : x.intro) };
    }
    if (i % 30 === 0) save(F_CAT, cat);
  }
  save(F_CAT, cat);
  console.log(`landing pages: ${Object.keys(cat).length}/${cats.cats.length + cats.topics.length}`);
}

// ---- 3. game pages, the ones Google already shows first ----
{
  const prio = (() => { try { return fs.readFileSync(path.join(ROOT, 'data/priority-slugs.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).join(',').split(',').map(x => x.trim()).filter(Boolean); } catch { return []; } })();
  const rank = new Map(prio.map((s, i) => [s, i]));
  const todo = games.filter(g => g.slug && !game[g.slug] && (g.description || '').length >= 60)
    .sort((a, b) => (rank.has(a.slug) ? rank.get(a.slug) : 1e9) - (rank.has(b.slug) ? rank.get(b.slug) : 1e9))
    .slice(0, COUNT);
  console.log(`games: ${todo.length} to translate (${Object.keys(game).length} already done)`);
  let i = 0, done = 0, failed = 0;
  async function worker() {
    while (i < todo.length) {
      const g = todo[i++];
      const gd = guides[g.slug];
      const payload = { description: String(g.description).slice(0, 2200), instructions: String(g.instructions || '').slice(0, 1000) || undefined,
        guide: gd ? { intro: gd.intro, tips: gd.tips, faq: gd.faq } : undefined };
      try {
        const out = await ask(`This is the text of the game "${g.title}" on a free online games site. Translate it into ${L.label}.
Keep exactly the same JSON shape and the same number of tips and FAQ pairs. Keep the game's own name "${g.title}" in English everywhere it appears.
Reply with the translated JSON object only.

${JSON.stringify(payload, null, 1)}`, 2500);
        if (out && typeof out.description === 'string' && out.description.length > 30) {
          const entry = { description: out.description.trim() };
          if (payload.instructions && typeof out.instructions === 'string' && out.instructions.trim()) entry.instructions = out.instructions.trim();
          if (payload.guide && out.guide && typeof out.guide.intro === 'string' && Array.isArray(out.guide.tips) && out.guide.tips.length) {
            entry.guide = { intro: out.guide.intro.trim(), tips: out.guide.tips.filter(t => typeof t === 'string'),
              faq: Array.isArray(out.guide.faq) ? out.guide.faq.filter(p => Array.isArray(p) && p.length === 2 && p.every(x => typeof x === 'string')) : [] };
          }
          game[g.slug] = entry; done++;
        } else failed++;
      } catch (e) { failed++; console.warn('failed:', g.slug, e.message); if (/HTTP 40[13]/.test(e.message)) i = todo.length; }
      if ((done + failed) % 25 === 0) save(F_GAME, game);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save(F_GAME, game);
  console.log(`games translated: ${done}, failed: ${failed}, total: ${Object.keys(game).length}`);
}
console.log(`tokens: input ${inTok}, output ${outTok}`);
