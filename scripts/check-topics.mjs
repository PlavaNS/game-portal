import fs from 'node:fs';
for (const t of JSON.parse(fs.readFileSync('data/topics.json', 'utf8'))) {
  const f = `dist/${t.slug}/index.html`;
  if (!fs.existsSync(f)) { console.log('SKIP', t.slug); continue; }
  const h = fs.readFileSync(f, 'utf8');
  const titles = [...h.matchAll(/<span>([^<]+)<\/span><\/a>/g)].map(m => m[1]);
  console.log(t.slug.padEnd(28), String(titles.length).padStart(3), '|', titles.slice(0, 6).join(' ; '));
}
