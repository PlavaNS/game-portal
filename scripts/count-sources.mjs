import fs from 'node:fs';
const dirs = fs.readdirSync('dist/games');
let pg = 0, gm = 0, other = 0;
for (const d of dirs) {
  const h = fs.readFileSync(`dist/games/${d}/index.html`, 'utf8');
  if (h.includes('clid=p_')) pg++; else if (h.includes('play.gamepix.com')) other++; else if (h.includes('gamemonetize')) gm++; else other++;
}
const raw = JSON.parse(fs.readFileSync('data/raw/pg.json', 'utf8'));
console.log({ total: dirs.length, playgama: pg, gamemonetize: gm, other, pgRaw: raw.length });
