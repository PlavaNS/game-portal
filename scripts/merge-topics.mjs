import fs from 'node:fs';
const cur = JSON.parse(fs.readFileSync('data/topics.json', 'utf8'));
const add = JSON.parse(fs.readFileSync('data/topics-new.json', 'utf8'));
const have = new Set(cur.map(t => t.slug));
for (const t of add) if (!have.has(t.slug)) cur.push(t);
fs.writeFileSync('data/topics.json', JSON.stringify(cur, null, 1));
fs.unlinkSync('data/topics-new.json');
console.log('topics:', cur.length);
