// Writes the site logo as static/favicon.svg (+ HTML pages used to render PNG icons with headless Chrome)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5c8a"/><stop offset="1" stop-color="#ff2d55"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><path d="M32 52S10 39.5 10 24.5C10 17.6 15.3 12.5 21.8 12.5c4.4 0 8 2.4 10.2 6 2.2-3.6 5.8-6 10.2-6C48.7 12.5 54 17.6 54 24.5 54 39.5 32 52 32 52z" fill="#fff"/><path d="M27.5 22.5v15l12-7.5z" fill="#ff2d55"/></svg>`;
fs.writeFileSync('static/favicon.svg', LOGO + '\n');
for (const s of [180, 192, 512]) {
  fs.writeFileSync(path.join(os.tmpdir(), `ic${s}.html`), `<html><body style="margin:0;background:transparent">${LOGO.replace('<svg ', `<svg width="${s}" height="${s}" style="display:block" `)}</body></html>`);
}
console.log('ok');
