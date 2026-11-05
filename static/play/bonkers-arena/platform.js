// Bonkers Arena — everything that talks to the game portal goes through the Playgama Bridge SDK:
// saving progress, ads, pause and sound requests from the portal. Outside a portal Bridge runs in its
// own "mock" mode (saves in the browser, no ads), so the game uses this one path everywhere.
(function (root) {
  const B = () => root.bridge;

  const Platform = {
    init() { return B().initialize(); },

    async load() {
      const [data] = await B().storage.get(['save']);
      return data || null;
    },
    save(data) { B().storage.set(['save'], [data]).catch(e => console.error('Saving progress failed:', e)); },

    get id() { return B().platform.id; },
    get canReachServer() { return B().platform.isExternalCallsSupported; },
    get rewardedSupported() { return B().advertisement.isRewardedSupported; },
    get audioAllowed() { return B().platform.isAudioEnabled; },

    onPause(fn) { B().platform.on(B().EVENT_NAME.PAUSE_STATE_CHANGED, fn); },
    onAudio(fn) { B().platform.on(B().EVENT_NAME.AUDIO_STATE_CHANGED, fn); },

    gameReady() { B().platform.sendMessage('game_ready'); },
    levelStarted(level) { B().platform.sendMessage('level_started', { level: String(level) }); },
    levelEnded(level, won) { B().platform.sendMessage(won ? 'level_completed' : 'level_failed', { level: String(level) }); },

    // Bridge decides whether an ad is actually shown now.
    breakAd() { B().advertisement.showInterstitial('round_end'); },

    // Resolves true only when the player watched the ad to the end.
    rewardedAd(placement) {
      const ad = B().advertisement, ev = B().EVENT_NAME.REWARDED_STATE_CHANGED;
      return new Promise(resolve => {
        let earned = false;
        const onState = state => {
          if (state === 'rewarded') earned = true;
          if (state === 'closed' || state === 'failed') { ad.off(ev, onState); resolve(earned); }
        };
        ad.on(ev, onState);
        ad.showRewarded(placement);
      });
    },
  };

  root.Platform = Platform;
})(this);
