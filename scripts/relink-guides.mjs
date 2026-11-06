// Adds ONE natural in-text link to an existing guide: rewrites a single tip so it mentions a related
// collection page, written as [[collection-slug|anchor words]] (build.mjs turns it into a link).
// Only touches guides that have no link yet and whose game belongs to at least one collection.
//
//   ANTHROPIC_API_KEY=...  node scripts/relink-guides.mjs [count]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const COUNT = Math.max(1, Math.min(10000, parseInt(process.argv[2] || '1000', 10) || 1000));
const KEY = process.env.ANTHROPIC_API_KEY;
const API = 'https://api.anthropic.com/v1';
const HEADERS = { 'x-api-key': KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

const games = readJSON(path.join(ROOT, '.cache/games.json'), null);
if (!games) { console.error('No .cache/games.json - run: node scripts/build.mjs'); process.exit(1); }
const GUIDES_FILE = path.join(ROOT, 'data/guides.json');
const guides = readJSON(GUIDES_FILE, {});
const TOPICS = readJSON(path.join(ROOT, 'data/topics.json'), []).filter(t => t.match).map(t => ({ slug: t.slug, h1: t.h1, re: new RegExp('(^|[^a-z0-9])(' + t.match + ')(?=$|[^a-z0-9])', 'i') }))
  .filter(t => games.filter(g => t.re.test(g.title) || t.re.test((g.tags || []).join(' , '))).length >= 8);
const related = g => TOPICS.filter(t => t.re.test(g.title) || t.re.test((g.tags || []).join(' , '))).slice(0, 3);
const MARK = /\[\[([a-z0-9-]+)\|([^\]]{3,60})\]\]/g;

const todo = games.filter(g => guides[g.slug] && !JSON.stringify(guides[g.slug]).includes('[[') && related(g).length).slice(0, COUNT);
console.log(`guides: ${Object.keys(guides).length}, to link now: ${todo.length}`);
if (!todo.length) process.exit(0);
if (!KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }

const SYSTEM = `You edit one tip in a short player guide for a free browser game site. Pick the ONE tip where a link to one of the listed collections fits most naturally, and rewrite only that tip so it contains exactly one link written as [[slug|anchor words]].
Rules: keep the tip's advice and meaning; the anchor is 2-5 natural words that fit the sentence and say what the collection is about (vary the wording, do not just paste the collection title); no hype words, no emojis, no URLs; keep it 1-2 sentences.
If no tip can carry a link without sounding forced, reply {"i": -1}.
Reply with JSON only: {"i": <index of the tip, 0-based>, "tip": "<rewritten tip>"}`;

let inTok = 0, outTok = 0, done = 0, skipped = 0, failed = 0, i = 0;
const model = process.env.GUIDE_MODEL || await (async () => {
  const r = await fetch(`${API}/models?limit=100`, { headers: HEADERS });
  const j = await r.json();
  return (j.data || []).filter(m => /haiku/i.test(m.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0].id;
})();
console.log('model:', model);

async function one(g) {
  const gd = guides[g.slug], rel = related(g), ok = new Set(rel.map(t => t.slug));
  const msg = `Game: ${g.title}\nTips:\n${gd.tips.map((t, n) => `${n}. ${t}`).join('\n')}\nCollections (slug: title): ${rel.map(t => `${t.slug}: ${t.h1}`).join('; ')}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(`${API}/messages`, { method: 'POST', headers: HEADERS, body: JSON.stringify({ model, max_tokens: 300, system: SYSTEM, messages: [{ role: 'user', content: msg }] }) });
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 4000 * attempt)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    inTok += j.usage?.input_tokens || 0; outTok += j.usage?.output_tokens || 0;
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    let x = null; try { x = JSON.parse((text.match(/\{[\s\S]*\}/) || [''])[0]); } catch {}
    if (x && x.i === -1) return 'skip';
    if (!x || !Number.isInteger(x.i) || x.i < 0 || x.i >= gd.tips.length || typeof x.tip !== 'string') continue;
    const marks = [...x.tip.matchAll(MARK)];
    if (marks.length !== 1 || !ok.has(marks[0][1]) || /https?:\/\/|www\.|<[a-z]/i.test(x.tip) || x.tip.length < 20 || x.tip.length > 400) continue;
    gd.tips[x.i] = x.tip.replace(/\s+/g, ' ').trim();
    return 'ok';
  }
  return 'fail';
}

const CONC = Math.max(1, Math.min(24, parseInt(process.env.GUIDE_CONC || '8', 10) || 8));
async function worker() {
  while (i < todo.length) {
    const g = todo[i++];
    try { const r = await one(g); if (r === 'ok') done++; else if (r === 'skip') skipped++; else failed++; }
    catch (e) { failed++; console.warn('failed:', g.slug, e.message); if (/HTTP 40[13]/.test(e.message)) i = todo.length; }
    if ((done + skipped + failed) % 50 === 0) fs.writeFileSync(GUIDES_FILE, JSON.stringify(guides, null, 2) + '\n');
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
fs.writeFileSync(GUIDES_FILE, JSON.stringify(guides, null, 2) + '\n');
console.log(`linked: ${done}, no natural fit: ${skipped}, failed: ${failed}`);
console.log(`tokens: input ${inTok}, output ${outTok}`);
