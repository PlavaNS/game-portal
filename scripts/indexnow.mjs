// Pings IndexNow (Bing, Yandex, Seznam, Naver…) with all URLs from dist/sitemap.xml.
// Run after deploy: node scripts/indexnow.mjs
import fs from 'node:fs';
const KEY = 'a7c3e9f15b2d48e6b0c4d1f8e2a96b37';
const cfg = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
const host = new URL(cfg.url).host;
const urls = [...fs.readFileSync('dist/sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: KEY, keyLocation: `https://${host}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
});
console.log('IndexNow', r.status, urls.length, 'URLs');
