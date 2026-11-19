#!/usr/bin/env node
// Keeps the Indie Game of the Week/Month/Day/Year badges moving on their own (Marko 19.11.2026:
// automate Week+Day+Year, Week had gone stale 18 days because nobody proposed the next pick).
// Pool: data/community-games.json — every outside developer's game we already reviewed and
// published, so anything in it has already cleared Marko's quality bar at accept time.
// Run daily, before scripts/build.mjs, from .github/workflows/deploy.yml.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return d; } };
const write = (p, v) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 1) + '\n');
const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
const year = today.slice(0, 4);
const days = iso => Math.floor(new Date(iso + 'T00:00:00Z').getTime() / 86400000);

const pool = read('data/community-games.json', []);
const bySlug = Object.fromEntries(pool.map(g => [g.slug, g]));
const why = g => (g.short || g.description || `A game by ${g.studio}.`).replace(/\s+/g, ' ').trim();

// thumbs-up count, same public counter the live site uses, so "best this month" means something
let VOTES = {};
try {
  const K = 'sb_publishable_bl8XkH55cD8R7M0cdpe6Xw_5osxFI1k';
  const r = await fetch('https://pxjlcbjwdalctlyeljql.supabase.co/rest/v1/rpc/game_votes', { method: 'POST', headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
  if (r.ok) for (const x of await r.json()) VOTES[x.slug] = Number(x.up) || 0;
} catch { /* badge rotation must not fail the build over a vote fetch */ }

const changes = [];

// ---------------- Indie Game of the Week (homepage slot) ----------------
let gotw = read('data/game-of-week.json', null);
let gotwHist = read('data/game-of-week-history.json', []);
if (!gotw || days(today) - days(gotw.since) >= 7) {
  if (gotw && !gotwHist.some(h => h.since === gotw.since && h.slug === gotw.slug)) gotwHist.push({ slug: gotw.slug, since: gotw.since });
  const used = new Set(gotwHist.map(h => h.slug));
  let candidates = pool.filter(g => !used.has(g.slug));
  if (!candidates.length) { used.clear(); candidates = pool.slice(); }   // pool exhausted: start the queue over
  candidates.sort((a, b) => (a.added || '').localeCompare(b.added || ''));   // oldest-waiting game first = fair queue
  const pick = candidates[0];
  if (pick) {
    gotw = { slug: pick.slug, since: today, why: why(pick) };
    changes.push(`Indie Game of the Week -> ${pick.title} (${pick.studio}): email them the win.`);
  }
}
write('data/game-of-week.json', gotw);
write('data/game-of-week-history.json', gotwHist);

// ---------------- Indie Game of the Month (badge, picked from that month's Week winners) --------
let gotm = read('data/game-of-month.json', null);
let gotmHist = read('data/game-of-month-history.json', []);
if (!gotm || gotm.month !== month) {
  if (gotm && gotm.slug && !gotmHist.some(h => h.month === gotm.month)) gotmHist.push({ slug: gotm.slug, month: gotm.month });
  gotm = { slug: null, month, why: null };   // provisional: fills in as this month's Week winners come in, below
}
{
  const thisMonth = gotwHist.filter(h => h.since.slice(0, 7) === month);
  if (gotw && gotw.since.slice(0, 7) === month) thisMonth.push({ slug: gotw.slug, since: gotw.since });
  const best = thisMonth.map(h => bySlug[h.slug]).filter(Boolean)
    .sort((a, b) => (VOTES[b.slug] || 0) - (VOTES[a.slug] || 0))[0];
  if (best && best.slug !== gotm.slug) { gotm = { slug: best.slug, month, why: why(best) }; changes.push(`Indie Game of the Month (so far, ${month}) -> ${best.title}.`); }
}
write('data/game-of-month.json', gotm);
write('data/game-of-month-history.json', gotmHist);

// ---------------- Indie Game of the Day (badge) ----------------
let gotd = read('data/game-of-day-badge.json', null);
let gotdHist = read('data/game-of-day-history.json', []);
if (!gotd || gotd.date !== today) {
  if (gotd && gotd.slug) { gotdHist.push({ slug: gotd.slug, date: gotd.date }); if (gotdHist.length > 120) gotdHist = gotdHist.slice(-120); }
  const recent = new Set(gotdHist.filter(h => days(today) - days(h.date) < 10).map(h => h.slug));
  recent.add(gotw ? gotw.slug : '');   // don't double up with this week's headline pick
  let eligible = pool.filter(g => !recent.has(g.slug));
  if (!eligible.length) eligible = pool.slice();
  eligible.sort((a, b) => a.slug.localeCompare(b.slug));   // stable order so the deterministic index below is reproducible
  const pick = eligible[days(today) % eligible.length];
  if (pick) { gotd = { slug: pick.slug, date: today, why: why(pick) }; changes.push(`Indie Game of the Day -> ${pick.title} (${pick.studio}).`); }
}
write('data/game-of-day-badge.json', gotd);
write('data/game-of-day-history.json', gotdHist);

// ---------------- Indie Game of the Year (badge, picked from that year's Month winners, December only) --------
let gotyAll = read('data/game-of-year.json', {});
if (month.slice(5) === '12' && !gotyAll[year]) {
  const thisYear = gotmHist.filter(h => h.month.slice(0, 4) === year);
  if (gotm && gotm.month.slice(0, 4) === year && gotm.slug) thisYear.push({ slug: gotm.slug, month: gotm.month });
  const best = thisYear.map(h => bySlug[h.slug]).filter(Boolean)
    .sort((a, b) => (VOTES[b.slug] || 0) - (VOTES[a.slug] || 0))[0];
  if (best) { gotyAll[year] = { slug: best.slug, year, why: why(best) }; changes.push(`Indie Game of the Year ${year} -> ${best.title} (${best.studio}): email them the win.`); }
}
write('data/game-of-year.json', gotyAll);

// so the nightly ILWG task can congratulate the winning developer by email (it has the submission
// queue with their address; this repo is public and never stores developer emails) and then clear this.
if (changes.length) {
  const pend = read('data/indie-badge-notifications.json', []);
  for (const c of changes) pend.push({ at: today, note: c });
  write('data/indie-badge-notifications.json', pend);
  console.log(changes.join('\n'));
} else console.log('indie badges: no change today');
