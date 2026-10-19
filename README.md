# Game portal (radno ime: 404 Arcade)

Statički sajt sa ~1.200 besplatnih HTML5 igara iz zvaničnog GameMonetize publisher feed-a
(+ GameDistribution kad se aktivira publisher nalog). Bubble Wrap je istaknut kao "Our game".

## Kako radi
- `scripts/fetch-feeds.mjs` — skida feed-ove (mostplayed, hot, best, editor picks, newest) u `data/raw/`
- `scripts/build.mjs` — filtrira (bez kopija poznatih brendova i adult sadržaja), pravi stranice u `dist/`
- `.github/workflows/deploy.yml` — GitHub svakog dana u 06:17 (po našem vremenu) osveži igre i objavi sajt
- `data/our-games.json` — naše igre (Bubble Wrap). Kad GameMonetize odobri igru, upiši njen embed URL u `gmEmbedUrl` (tada ide 90% udela)
- `site.config.json` — ime sajta, email, broj igara

## Lokalno
```
node scripts/fetch-feeds.mjs
node scripts/build.mjs
node scripts/serve.mjs   # http://localhost:8404
```

## Domen (kad ga kupiš)
1. U `site.config.json` promeni `name` i `contactEmail`.
2. GitHub repo → Settings → Secrets and variables → Actions → Variables:
   `SITE_URL` = `https://tvojdomen.com`, `SITE_BASE` = prazno, `CNAME` = `tvojdomen.com`
3. Kod registrara domena dodaj DNS zapise za GitHub Pages (ili prebaci na Cloudflare Pages).

## GameDistribution
Kad aktiviraš publisher nalog, URL feed-a iz GD dashboard-a stavi u repo Secret `GD_FEED_URL`.
