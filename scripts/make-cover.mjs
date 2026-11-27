// One-off cover maker for a community game whose own share image does not carry the game's title:
// crops a region of a source image to 4:3 and writes the title on it, then saves the 800x600 cover
// and the 400px "-s" copy the cards use. Needs sharp (run from the make-cover workflow).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { SRC, SLUG, TITLE = '', CROP = '' } = process.env;
if (!SRC || !/^[a-z0-9-]+$/.test(SLUG || '')) { console.error('SRC and SLUG are required'); process.exit(1); }
const r = await fetch(SRC, { headers: { 'user-agent': 'ilovewebgames-thumbs/1.0' } });
if (!r.ok) { console.error('HTTP ' + r.status); process.exit(1); }
let img = sharp(Buffer.from(await r.arrayBuffer()));
if (CROP) { const [left, top, width, height] = CROP.split(',').map(Number); img = img.extract({ left, top, width, height }); }
const base = await img.resize(800, 600, { fit: 'cover' }).toBuffer();
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// textLength makes the title fit the 720px safe area whatever its length, so nothing is ever clipped
const size = Math.min(88, Math.floor(820 / Math.max(5, TITLE.length)) + 24);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe45c"/><stop offset="1" stop-color="#ff5fb0"/></linearGradient><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05040f" stop-opacity=".85"/><stop offset="1" stop-color="#05040f" stop-opacity="0"/></linearGradient></defs><rect width="800" height="230" fill="url(#s)"/><text x="400" y="${70 + size * 0.75}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="${size}" fill="url(#g)" stroke="#1a0b2e" stroke-width="5" paint-order="stroke" textLength="${Math.min(720, TITLE.length * size * 0.62)}" lengthAdjust="spacingAndGlyphs">${esc(TITLE.toUpperCase())}</text></svg>`;
const out = TITLE ? await sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 84 }).toBuffer() : await sharp(base).jpeg({ quality: 84 }).toBuffer();
const dir = path.join(ROOT, 'static/assets/community');
fs.writeFileSync(path.join(dir, SLUG + '.jpg'), out);
fs.writeFileSync(path.join(dir, SLUG + '-s.jpg'), await sharp(out).resize(400, 300).jpeg({ quality: 80 }).toBuffer());
console.log('wrote', SLUG, out.length);
