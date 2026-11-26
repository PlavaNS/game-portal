// Community covers come from the developer's own server, and some of them are huge:
// 4Wall Pong shipped a 2.6 MB PNG that was a third of the whole homepage.
// This pulls any oversized remote cover into static/assets/community/ as a 512x384 JPEG
// (plus the 400px "-s" copy the cards use) and points data/community-games.json at our copy.
// Run from the workflow of the same name; it needs sharp, which the main build does not.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILE = path.join(ROOT, 'data/community-games.json');
const DIR = path.join(ROOT, 'static/assets/community');
const LIMIT = Number(process.env.LIMIT_KB || 250) * 1024;   // anything bigger gets hosted by us
const OURS = /ilovewebgames\.com/i;

const games = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let changed = 0;

for (const g of games) {
  const url = String(g.thumb || '');
  if (!url.startsWith('http') || OURS.test(url)) continue;
  let buf;
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'ilovewebgames-thumbs/1.0' } });
    if (!r.ok) { console.log(`skip ${g.slug}: HTTP ${r.status}`); continue; }
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) { console.log(`skip ${g.slug}: ${e.message}`); continue; }

  if (buf.length <= LIMIT) { console.log(`ok   ${g.slug}: ${Math.round(buf.length / 1024)} KB, left alone`); continue; }

  const base = path.join(DIR, `${g.slug}.jpg`);
  const small = path.join(DIR, `${g.slug}-s.jpg`);
  await sharp(buf).resize(512, 384, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82, mozjpeg: true }).toFile(base);
  await sharp(buf).resize(400, 300, { fit: 'cover', position: 'centre' }).jpeg({ quality: 78, mozjpeg: true }).toFile(small);
  g.thumb = `https://ilovewebgames.com/assets/community/${g.slug}.jpg?v=1`;
  changed++;
  console.log(`fix  ${g.slug}: ${Math.round(buf.length / 1024)} KB -> ${Math.round(fs.statSync(base).size / 1024)} KB (+${Math.round(fs.statSync(small).size / 1024)} KB small)`);
}

if (changed) fs.writeFileSync(FILE, JSON.stringify(games, null, 2) + '\n');
console.log(`${changed} cover(s) moved to our own server`);

// 26.11.2026: covers added by hand (a developer mails us a PNG, we drop it in static/assets/community/)
// never went through the loop above, so 25 of them had no "-s" copy and the card shipped the full
// 800-1440px JPEG to a phone that draws it at ~100px. Backfill anything still missing its small copy.
// No cropping here: .card.fit shows the whole image over a blurred fill, so keep the aspect ratio.
let filled = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.jpg') || f.endsWith('-s.jpg')) continue;
  const base = path.join(DIR, f);
  const small = path.join(DIR, `${f.slice(0, -4)}-s.jpg`);
  if (fs.existsSync(small)) continue;
  await sharp(base).resize({ width: 400, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(small);
  filled++;
  console.log(`small ${f}: ${Math.round(fs.statSync(base).size / 1024)} KB -> ${Math.round(fs.statSync(small).size / 1024)} KB`);
}
if (filled) console.log(`${filled} missing small copy/copies generated`);
