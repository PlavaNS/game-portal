'use strict';
/*
 * Platform layer: one game build, different ad/SDK back-ends.
 * The build script sets window.FD_CONFIG.platform to one of:
 *   preview | ilovewebgames | crazygames | gamedistribution | gamemonetize | poki | playgama
 * The game only talks to window.Platform; nothing in game.js knows which portal it runs on.
 */
(function () {
  const cfg = Object.assign({ platform: 'preview' }, window.FD_CONFIG || {});
  const hooks = { adStart() {}, adEnd() {}, audio() {} }; // set by the game
  let playing = false, lastAdAt = 0, rewardOffer = null;

  function loadScript(src, attrs = {}) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      for (const k in attrs) s.setAttribute(k, attrs[k]);
      s.onload = res; s.onerror = () => rej(new Error('SDK failed to load: ' + src));
      document.head.appendChild(s);
    });
  }
  // Wrap an ad call so the game is always paused + muted during it and resumed after, exactly once.
  function adWindow(run) {
    return new Promise(resolve => {
      let started = false, done = false;
      const start = () => { if (!started && !done) { started = true; hooks.adStart(); } };
      const end = result => { if (done) return; done = true; if (started) hooks.adEnd(); lastAdAt = Date.now(); resolve(result); };
      try { run(start, end); } catch (e) { console.warn('Ad error', e); end(false); }
    });
  }
  const sinceLastAd = () => (Date.now() - lastAdAt) / 1000;

  // ---------- Back-ends ----------
  const backends = {
    // Shows clearly marked placeholder ads so the ad spots can be reviewed.
    preview: {
      init: async () => {},
      hasRewarded: () => true,
      interstitial: () => adWindow((start, end) => { start(); mockOverlay('Interstitial ad', 2000, () => end(true)); }),
      rewarded: () => adWindow((start, end) => { start(); mockOverlay('Rewarded ad', 2500, () => end(true)); }),
      showBanner: (el, w, h) => { el.innerHTML = `<div class="ad-mock">AD ${w}×${h}</div>`; el.hidden = false; },
      hideBanner: el => { el.hidden = true; el.innerHTML = ''; },
    },

    // ilovewebgames.com — Google AdSense H5 Games Ads (adBreak) + AdSense display units.
    // Ads stay off until cfg.adsenseClient is filled in.
    ilovewebgames: {
      init: async () => {
        if (!cfg.adsenseClient) return;
        window.adsbygoogle = window.adsbygoogle || [];
        window.adBreak = window.adConfig = o => window.adsbygoogle.push(o);
        await loadScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + cfg.adsenseClient,
          Object.assign({ crossorigin: 'anonymous', 'data-ad-frequency-hint': '45s' }, cfg.adsenseTest ? { 'data-adbreak-test': 'on' } : {}));
        window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
      },
      hasRewarded: () => !!cfg.adsenseClient,
      // H5 Games Ads only offers a reward when one is actually available: ask first, show later.
      prepareRewarded: () => new Promise(resolve => {
        if (!cfg.adsenseClient) { resolve(false); return; }
        rewardOffer = null;
        let answered = false;
        // AdSense ignores ad breaks it cannot serve (site not approved, H5 ads off): no answer = no reward
        setTimeout(() => { if (!answered) { answered = true; resolve(false); } }, 2000);
        window.adBreak({
          type: 'reward', name: 'continue',
          beforeAd: () => rewardOffer && rewardOffer.start(), afterAd: () => {},
          beforeReward: showAdFn => { rewardOffer = { show: showAdFn, granted: false }; answered = true; resolve(true); },
          adDismissed: () => {}, adViewed: () => { if (rewardOffer) rewardOffer.granted = true; },
          adBreakDone: () => { if (!answered) { answered = true; resolve(false); return; } if (rewardOffer && rewardOffer.end) rewardOffer.end(rewardOffer.granted); },
        });
      }),
      interstitial: () => !cfg.adsenseClient ? Promise.resolve(false) : adWindow((start, end) => {
        let started = false;
        setTimeout(() => { if (!started) end(false); }, 2000); // AdSense never answered
        window.adBreak({
          type: 'next', name: 'play-again', beforeAd: () => { started = true; start(); }, afterAd: () => {}, adBreakDone: () => end(started),
        });
      }),
      rewarded: () => !rewardOffer ? Promise.resolve(false) : adWindow((start, end) => {
        rewardOffer.start = start; rewardOffer.end = end;
        rewardOffer.show();
      }),
      showBanner: (el, w, h) => {
        const slot = w >= 300 && h >= 250 ? cfg.adsenseMpuSlot : cfg.adsenseBannerSlot;
        if (!cfg.adsenseClient || !slot) { el.hidden = true; return; }
        el.innerHTML = `<ins class="adsbygoogle" style="display:inline-block;width:${w}px;height:${h}px" data-ad-client="${cfg.adsenseClient}" data-ad-slot="${slot}"></ins>`;
        el.hidden = false;
        try { window.adsbygoogle.push({}); } catch (e) { console.warn('Banner error', e); }
      },
      hideBanner: el => { el.hidden = true; el.innerHTML = ''; },
    },

    // CrazyGames SDK v3
    crazygames: {
      init: async () => {
        await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
        await window.CrazyGames.SDK.init();
        window.CrazyGames.SDK.game.loadingStart();
      },
      loadingDone: () => window.CrazyGames.SDK.game.loadingStop(),
      gameplayStart: () => window.CrazyGames.SDK.game.gameplayStart(),
      gameplayStop: () => window.CrazyGames.SDK.game.gameplayStop(),
      happy: () => window.CrazyGames.SDK.game.happytime(),
      hasRewarded: () => true,
      interstitial: () => adWindow((start, end) => window.CrazyGames.SDK.ad.requestAd('midgame', {
        adStarted: start, adFinished: () => end(true), adError: () => end(false),
      })),
      rewarded: () => adWindow((start, end) => window.CrazyGames.SDK.ad.requestAd('rewarded', {
        adStarted: start, adFinished: () => end(true), adError: () => end(false),
      })),
      showBanner: (el, w, h) => {
        el.hidden = false;
        el.innerHTML = `<div id="${el.id}-cg" style="width:${w}px;height:${h}px"></div>`;
        window.CrazyGames.SDK.banner.requestBanner({ id: el.id + '-cg', width: w, height: h }).catch(e => { console.warn('Banner error', e); el.hidden = true; });
      },
      hideBanner: el => { el.hidden = true; el.innerHTML = ''; },
      // CrazyGames weekly leaderboard (enabled by CrazyGames for invited games; needs cfg.cgLeaderboardKey)
      hasLeaderboard: () => !!cfg.cgLeaderboardKey,
      submitScore: async score => {
        if (!cfg.cgLeaderboardKey) return;
        const encryptedScore = await encryptScore(score, cfg.cgLeaderboardKey);
        window.CrazyGames.SDK.user.submitScore({ encryptedScore, score });
      },
      // The player's CrazyGames username, used as the default leaderboard name
      userName: async () => {
        if (!window.CrazyGames.SDK.user.isUserAccountAvailable) return null;
        const u = await window.CrazyGames.SDK.user.getUser();
        return u ? u.username : null;
      },
    },

    // GameDistribution — needs cfg.gdGameId (from the GD developer dashboard)
    gamedistribution: (() => {
      let pending = null;
      return {
        init: () => new Promise((resolve, reject) => {
          if (!cfg.gdGameId) { reject(new Error('Missing GameDistribution game id')); return; }
          window.GD_OPTIONS = {
            gameId: cfg.gdGameId,
            onEvent: e => {
              if (e.name === 'SDK_READY') resolve();
              if (e.name === 'SDK_GAME_PAUSE' && pending) { pending.started = true; pending.start(); }
              if (e.name === 'SDK_REWARDED_WATCH_COMPLETE' && pending) pending.rewarded = true;
              if (e.name === 'SDK_GAME_START' && pending) { const p = pending; pending = null; p.end(p.kind === 'rewarded' ? !!p.rewarded : true); }
            },
          };
          loadScript('https://html5.api.gamedistribution.com/main.min.js').catch(reject);
        }),
        hasRewarded: () => true,
        interstitial: () => adWindow((start, end) => {
          pending = { kind: 'interstitial', start, end };
          window.gdsdk.showAd()
            .then(() => { if (pending && !pending.started) { pending = null; end(false); } }) // resolved without showing an ad
            .catch(() => { pending = null; end(false); });
        }),
        rewarded: () => adWindow((start, end) => {
          pending = { kind: 'rewarded', start, end };
          window.gdsdk.showAd('rewarded')
            .then(() => { if (pending && !pending.started) { pending = null; end(false); } }) // resolved without showing an ad
            .catch(() => { pending = null; end(false); });
        }),
      };
    })(),

    // GameMonetize — needs cfg.gmGameId; interstitials only (no rewarded ads)
    gamemonetize: (() => {
      let pending = null;
      return {
        init: () => new Promise((resolve, reject) => {
          if (!cfg.gmGameId) { reject(new Error('Missing GameMonetize game id')); return; }
          window.SDK_OPTIONS = {
            gameId: cfg.gmGameId,
            onEvent: e => {
              if (e.name === 'SDK_READY') resolve();
              if (e.name === 'SDK_ERROR') reject(new Error('GameMonetize SDK error'));
              if (e.name === 'SDK_GAME_PAUSE' && pending) { pending.started = true; pending.start(); }
              if (e.name === 'SDK_GAME_START' && pending) { const p = pending; pending = null; p.end(true); }
            },
          };
          loadScript('https://api.gamemonetize.com/sdk.js').catch(reject);
        }),
        hasRewarded: () => false,
        interstitial: () => adWindow((start, end) => {
          pending = { start, end };
          if (typeof window.sdk === 'undefined' || typeof window.sdk.showBanner !== 'function') { pending = null; end(false); return; }
          window.sdk.showBanner();
          setTimeout(() => { if (pending && !pending.started) { pending = null; end(false); } }, 1500); // no ad was shown
        }),
      };
    })(),

    // Poki SDK v2
    poki: {
      init: async () => {
        await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
        await window.PokiSDK.init();
      },
      loadingDone: () => window.PokiSDK.gameLoadingFinished(),
      gameplayStart: () => window.PokiSDK.gameplayStart(),
      gameplayStop: () => window.PokiSDK.gameplayStop(),
      hasRewarded: () => true,
      interstitial: () => adWindow((start, end) => window.PokiSDK.commercialBreak(start).then(() => end(true), () => end(false))),
      rewarded: () => adWindow((start, end) => window.PokiSDK.rewardedBreak(start).then(ok => end(!!ok), () => end(false))),
    },

    // Playgama Bridge
    playgama: (() => {
      let pending = null;
      return {
        init: async () => {
          await loadScript('https://bridge.playgama.com/v1/stable/playgama-bridge.js');
          const b = window.bridge;
          await b.initialize();
          b.platform.on(b.EVENT_NAME.AUDIO_STATE_CHANGED, on => hooks.audio(on));
          b.platform.on(b.EVENT_NAME.PAUSE_STATE_CHANGED, paused => paused ? hooks.adStart() : hooks.adEnd());
          b.advertisement.on(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, st => {
            if (!pending || pending.kind !== 'interstitial') return;
            if (st === 'opened') pending.start();
            if (st === 'closed' || st === 'failed') { const p = pending; pending = null; p.end(st === 'closed'); }
          });
          b.advertisement.on(b.EVENT_NAME.REWARDED_STATE_CHANGED, st => {
            if (!pending || pending.kind !== 'rewarded') return;
            if (st === 'opened') pending.start();
            if (st === 'rewarded') pending.granted = true;
            if (st === 'closed' || st === 'failed') { const p = pending; pending = null; p.end(!!p.granted); }
          });
        },
        loadingDone: () => window.bridge.platform.sendMessage('game_ready'),
        gameplayStart: () => window.bridge.platform.sendMessage('gameplay_started'),
        gameplayStop: () => window.bridge.platform.sendMessage('gameplay_stopped'),
        hasRewarded: () => window.bridge.advertisement.isRewardedSupported,
        interstitial: () => !window.bridge.advertisement.isInterstitialSupported ? Promise.resolve(false)
          : adWindow((start, end) => { pending = { kind: 'interstitial', start, end }; window.bridge.advertisement.showInterstitial('play_again'); }),
        rewarded: () => adWindow((start, end) => { pending = { kind: 'rewarded', start, end }; window.bridge.advertisement.showRewarded('continue'); }),
      };
    })(),
  };

  // AES-GCM score encryption for the CrazyGames leaderboard (their documented sample, ported)
  async function encryptScore(score, base64Key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const keyBytes = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(score)));
    const out = new Uint8Array(iv.length + data.byteLength);
    out.set(iv, 0); out.set(new Uint8Array(data), iv.length);
    return btoa(String.fromCharCode(...out));
  }

  // ---------- Mock ad overlay (preview build only) ----------
  function mockOverlay(label, ms, done) {
    const el = document.createElement('div');
    el.className = 'ad-overlay';
    el.innerHTML = `<div class="ad-overlay-box"><b>${label}</b><span>Placeholder — the real portal ad shows here</span><i></i></div>`;
    (document.getElementById('stage') || document.body).appendChild(el);
    const bar = el.querySelector('i');
    bar.animate([{ width: '0%' }, { width: '100%' }], { duration: ms, fill: 'forwards' });
    setTimeout(() => { el.remove(); done(); }, ms);
  }

  const be = backends[cfg.platform];
  if (!be) throw new Error('Unknown platform: ' + cfg.platform);
  let ready = false;
  const call = (fn, ...a) => { if (!ready || !fn) return; try { fn(...a); } catch (e) { console.warn('Platform call failed', e); } };

  window.Platform = {
    name: cfg.platform,
    hooks,
    // The game starts after at most 5 s even when a portal SDK never answers (ad blockers, network);
    // ads switch on as soon as the SDK reports ready.
    async init() {
      const sdk = be.init().then(() => { ready = true; }, e => console.warn('Platform SDK unavailable, running without ads', e));
      await Promise.race([sdk, new Promise(r => setTimeout(r, 5000))]);
    },
    get hasRewarded() { return ready && !!be.rewarded && !!(be.hasRewarded && be.hasRewarded()); },
    loadingDone: () => call(be.loadingDone),
    gameplayStart: () => { if (!playing) { playing = true; call(be.gameplayStart); } },
    gameplayStop: () => { if (playing) { playing = false; call(be.gameplayStop); } },
    happy: () => call(be.happy),
    get hasPlatformLeaderboard() { return ready && !!be.hasLeaderboard && be.hasLeaderboard(); },
    submitScore(score) { if (ready && be.submitScore) be.submitScore(score).catch(e => console.warn('Score submit failed', e)); },
    userName() { return ready && be.userName ? be.userName().catch(() => null) : Promise.resolve(null); },
    // Interstitial at a natural break (game over -> play again). Our own floor of 45 s between ads.
    interstitial() {
      if (!ready || !be.interstitial || (lastAdAt && sinceLastAd() < 45)) return Promise.resolve(false);
      return be.interstitial().catch(() => false);
    },
    // Resolves true when a rewarded ad can be offered right now
    prepareRewarded() {
      if (!this.hasRewarded) return Promise.resolve(false);
      return be.prepareRewarded ? be.prepareRewarded().catch(() => false) : Promise.resolve(true);
    },
    rewarded() {
      if (!this.hasRewarded) return Promise.resolve(false);
      return be.rewarded().catch(() => false);
    },
    showBanner(id, w, h) { const el = document.getElementById(id); if (el && ready && be.showBanner) be.showBanner(el, w, h); },
    hideBanner(id) { const el = document.getElementById(id); if (el && be.hideBanner) be.hideBanner(el); else if (el) el.hidden = true; },
  };
})();
