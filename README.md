# Game portal (I Love Web Games — ilovewebgames.com — "Play free. Play now.")

StatiÄki sajt sa ~1.200 besplatnih HTML5 igara iz zvaniÄnog GameMonetize publisher feed-a
(+ GameDistribution kad se aktivira publisher nalog). Bubble Wrap je istaknut kao "Our game".

## Kako radi
- `scripts/fetch-feeds.mjs` â€” skida feed-ove (mostplayed, hot, best, editor picks, newest) u `data/raw/`
- `scripts/build.mjs` â€” filtrira (bez kopija poznatih brendova i adult sadrÅ¾aja), pravi stranice u `dist/`
- `.github/workflows/deploy.yml` â€” GitHub svakog dana u 06:17 (po naÅ¡em vremenu) osveÅ¾i igre i objavi sajt
- `data/our-games.json` â€” naÅ¡e igre (Bubble Wrap). Kad GameMonetize odobri igru, upiÅ¡i njen embed URL u `gmEmbedUrl` (tada ide 90% udela)
- `site.config.json` â€” ime sajta, email, broj igara

## Lokalno
```
node scripts/fetch-feeds.mjs
node scripts/build.mjs
node scripts/serve.mjs   # http://localhost:8404
```

## Domen (kad ga kupiÅ¡)
1. U `site.config.json` promeni `name` i `contactEmail`.
2. GitHub repo â†’ Settings â†’ Secrets and variables â†’ Actions â†’ Variables:
   `SITE_URL` = `https://tvojdomen.com`, `SITE_BASE` = prazno, `CNAME` = `tvojdomen.com`
3. Kod registrara domena dodaj DNS zapise za GitHub Pages (ili prebaci na Cloudflare Pages).

## GameDistribution
Kad aktiviraÅ¡ publisher nalog, URL feed-a iz GD dashboard-a stavi u repo Secret `GD_FEED_URL`.

