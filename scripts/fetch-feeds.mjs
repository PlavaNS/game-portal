// Downloads the official GameMonetize publisher feed (JSON) into data/raw/.
// GameDistribution: once the publisher account is active, put the feed URL from
// the GD publisher dashboard into the GD_FEED_URL env var / GitHub secret.
import fs from 'node:fs/promises';
import path from 'node:path';

const RAW = path.resolve('data/raw');
await fs.mkdir(RAW, { recursive: true });

const GM = 'https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&company=All&amount=All&popularity=';
const lists = ['mostplayed', 'hotgames', 'bestgames', 'editorpicks', 'newest'];

async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'portal-feed-import/1.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      if (i === tries) throw e;
      await new Promise(res => setTimeout(res, 3000 * i));
    }
  }
}

let ok = 0;
for (const p of lists) {
  try {
    const txt = await get(GM + p);
    const arr = JSON.parse(txt);
    if (!Array.isArray(arr) || arr.length < 50) throw new Error('feed too small: ' + arr.length);
    await fs.writeFile(path.join(RAW, `gm-${p}.json`), txt);
    console.log(`gm-${p}: ${arr.length} games`);
    ok++;
  } catch (e) {
    // keep the previous copy so a feed outage never empties the site
    console.warn(`gm-${p}: FAILED (${e.message}) - keeping previous file`);
  }
}

if (process.env.GD_FEED_URL) {
  try {
    const txt = await get(process.env.GD_FEED_URL);
    JSON.parse(txt);
    await fs.writeFile(path.join(RAW, 'gd.json'), txt);
    console.log('gd: saved');
  } catch (e) {
    console.warn('gd: FAILED - ' + e.message);
  }
}

if (!ok) console.warn('No feed refreshed; build will use cached data.');
