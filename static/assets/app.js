(() => {
  const B = (window.SITE && window.SITE.base) || '';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const card = g => `<a class="card" href="${B}/games/${g.id}/"><img src="${esc(g.thumb)}" alt="${esc(g.title)}" width="512" height="384" loading="lazy"><span>${esc(g.title)}</span></a>`;

  // mobile menu
  const mb = $('[data-menu]');
  if (mb) mb.addEventListener('click', () => { const o = document.body.classList.toggle('menu-open'); mb.setAttribute('aria-expanded', o); });
  document.addEventListener('click', e => { if (document.body.classList.contains('menu-open') && !e.target.closest('.side,[data-menu]')) document.body.classList.remove('menu-open'); });
  const here = location.pathname.replace(/\/\d+\/$/, '/');
  $$('.side a').forEach(a => { if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });

  // cookie consent
  const box = $('[data-consent]');
  const choice = store.get('consent', null);
  if (box && !choice) box.hidden = false;
  const setConsent = v => { store.set('consent', { v, t: Date.now() }); if (box) box.hidden = true; };
  $('[data-consent-accept]')?.addEventListener('click', () => setConsent('all'));
  $('[data-consent-reject]')?.addEventListener('click', () => setConsent('essential'));
  $$('[data-consent-open]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); if (box) box.hidden = false; }));

  // recently played row
  const recent = store.get('recent', []);
  const rec = $('[data-recent]');
  if (rec && recent.length) { rec.hidden = false; $('.grid', rec).innerHTML = recent.slice(0, 12).map(card).join(''); }

  // hero video plays on view
  $$('video[data-hover-play]').forEach(v => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause(); }), { threshold: .4 });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !(navigator.connection && navigator.connection.saveData)) io.observe(v);
  });

  // game player
  const p = $('[data-player]');
  if (p) {
    const info = { id: p.dataset.id, title: p.dataset.title, thumb: p.dataset.thumb };
    const stage = $('.stage', p);
    const mobile = () => matchMedia('(max-width: 860px), (pointer: coarse)').matches;
    const remember = () => store.set('recent', [info, ...store.get('recent', []).filter(g => g.id !== info.id)].slice(0, 24));
    const frame = () => {
      const f = document.createElement('iframe');
      f.src = p.dataset.src;
      f.title = info.title;
      f.allow = 'autoplay; fullscreen; gamepad; accelerometer; gyroscope; clipboard-write';
      f.allowFullscreen = true;
      f.setAttribute('scrolling', 'no');
      return f;
    };
    const play = () => {
      remember();
      if (mobile()) {
        const ov = document.createElement('div');
        ov.className = 'overlay';
        ov.innerHTML = '<button class="close" aria-label="Close game">✕</button>';
        ov.appendChild(frame());
        document.body.appendChild(ov); document.body.classList.add('noscroll');
        history.pushState({ ov: 1 }, '');
        const close = () => { ov.remove(); document.body.classList.remove('noscroll'); };
        $('.close', ov).addEventListener('click', () => history.back());
        addEventListener('popstate', close, { once: true });
        ov.requestFullscreen?.().catch(() => {});
      } else if (!$('iframe', stage)) {
        stage.appendChild(frame());
      }
    };
    $('[data-play]', p).addEventListener('click', play);
    $('[data-fs]', p).addEventListener('click', () => {
      if (mobile()) return play();
      if (!$('iframe', stage)) play();
      (document.fullscreenElement ? document.exitFullscreen() : p.requestFullscreen?.())?.catch?.(() => {});
    });
    const like = $('[data-like]', p);
    const favs = () => store.get('favs', []);
    const paint = () => { const on = favs().some(g => g.id === info.id); like.classList.toggle('on', on); like.textContent = on ? '♥' : '♡'; };
    like.addEventListener('click', () => { const f = favs(); store.set('favs', f.some(g => g.id === info.id) ? f.filter(g => g.id !== info.id) : [info, ...f]); paint(); });
    paint();
    $('[data-share]', p).addEventListener('click', async () => {
      const data = { title: info.title, text: `Play ${info.title} for free`, url: location.href };
      if (navigator.share) { try { await navigator.share(data); } catch {} }
      else { try { await navigator.clipboard.writeText(location.href); $('[data-share]', p).textContent = '✓'; } catch {} }
    });
  }

  // search page
  const si = $('[data-search-input]');
  if (si) {
    const out = $('[data-search-results]'), cnt = $('[data-search-count]');
    const q0 = new URLSearchParams(location.search).get('q') || '';
    si.value = q0;
    fetch(`${B}/search.json`).then(r => r.json()).then(rows => {
      const items = rows.map(([id, title, thumb, cat, tags]) => ({ id, title, thumb, hay: `${title} ${cat} ${tags}`.toLowerCase() }));
      const run = () => {
        const q = si.value.trim().toLowerCase();
        if (!q) { cnt.textContent = ''; out.innerHTML = items.slice(0, 48).map(card).join(''); return; }
        const words = q.split(/\s+/);
        const hits = items.filter(g => words.every(w => g.hay.includes(w)))
          .sort((a, b) => (b.title.toLowerCase().startsWith(q)) - (a.title.toLowerCase().startsWith(q)));
        cnt.textContent = `${hits.length} game${hits.length === 1 ? '' : 's'} found`;
        out.innerHTML = hits.slice(0, 120).map(card).join('');
      };
      let t; si.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { run(); history.replaceState(null, '', `?q=${encodeURIComponent(si.value)}`); }, 120); });
      run();
    });
  }
})();
