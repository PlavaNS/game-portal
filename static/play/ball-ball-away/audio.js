'use strict';
// ---------- Sound effects and music (all synthesised: no audio files, no licensing) ----------
// The game sets audio.save (sound/music flags) and audio.blocked (true during an ad / platform mute).
const audio = (() => {
  let ac = null, noiseBuf = null, comp = null;
  const state = { save: { sound: true, music: true }, blocked: false, intensity: 0 };
  const on = () => state.save.sound && !state.blocked;
  function ctx() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type, vol, slide, delay = 0) {
    if (!on()) return;
    const a = ctx(), t = a.currentTime + delay;
    const o = a.createOscillator(), gn = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn).connect(comp); o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol, f0, f1, delay = 0) {
    if (!on()) return;
    const a = ctx(), t = a.currentTime + delay;
    const s = a.createBufferSource(); s.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gn = a.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(gn).connect(comp); s.start(t); s.stop(t + dur);
  }
  const sfx = {
    bounce: v => { tone(300 + Math.min(v, 800) * 0.6, 0.16, 'triangle', Math.min(0.3, 0.1 + v / 3000), 460); tone(900 + Math.min(v, 800), 0.06, 'sine', 0.05); },
    thud: v => tone(110 + v * 0.1, 0.12, 'sine', Math.min(0.25, v / 1200), 70),
    rim: () => tone(1150, 0.1, 'square', 0.05),
    gate: () => { tone(240, 0.25, 'sawtooth', 0.06, 140); noise(0.15, 0.15, 2000, 500); },
    bumper: () => { tone(520, 0.2, 'square', 0.08, 1020); noise(0.1, 0.1, 3000, 1000); },
    portal: perfect => { (perfect ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047]).forEach((f, i) => tone(f, 0.26, 'triangle', 0.2, null, i * 0.065)); noise(0.4, 0.12, 3000, 800); },
    golden: () => { [659, 784, 988, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, null, i * 0.06)); noise(0.6, 0.15, 4000, 900); },
    coin: () => { tone(1320, 0.07, 'square', 0.05); tone(1980, 0.16, 'square', 0.05, null, 0.06); },
    heart: () => [523, 659, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.13, null, i * 0.08)),
    powerup: () => { [660, 990, 1320].forEach((f, i) => tone(f, 0.16, 'square', 0.05, null, i * 0.05)); noise(0.3, 0.12, 2000, 6000); },
    rocket: () => { tone(120, 0.5, 'sawtooth', 0.12, 900); noise(0.5, 0.25, 600, 4000); },
    fail: () => { tone(392, 0.25, 'triangle', 0.2, 272); tone(262, 0.4, 'triangle', 0.18, 182, 0.18); },
    launch: () => { tone(240, 0.35, 'sine', 0.22, 840); noise(0.3, 0.12, 1500, 3000); },
    pen: () => tone(1600, 0.04, 'sine', 0.05),
    place: () => tone(700, 0.08, 'triangle', 0.12, 1000),
    tick: () => tone(1000, 0.05, 'square', 0.05),
    click: () => tone(800, 0.05, 'triangle', 0.12),
    buy: () => [784, 988, 1319].forEach((f, i) => tone(f, 0.15, 'square', 0.07, null, i * 0.06)),
    no: () => tone(180, 0.18, 'square', 0.08),
    mission: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, null, i * 0.08)),
    combo: n => [0, 1, 2].slice(0, Math.min(3, n)).forEach(i => tone(880 + i * 220, 0.12, 'triangle', 0.1, null, i * 0.07)),
    zone: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, null, i * 0.1)),
    whoosh: () => noise(0.25, 0.2, 400, 5000),
  };

  // ---------- Music: a bright 104 bpm synth-pop loop; layers come in as the combo climbs ----------
  const music = (() => {
    const BPM = 104, SIX = 60 / BPM / 4;
    // Dm9 – Bbmaj7 – F – C  (MIDI numbers)
    const CHORDS = [[62, 65, 69, 72, 76], [58, 62, 65, 69], [53, 57, 60, 65], [60, 64, 67, 71]];
    const ROOTS = [38, 34, 41, 36];
    const ARP = [0, 2, 1, 3, 2, 4, 1, 3];
    const LEAD = [[74, 76, 77, 81], [77, 74, 72, 69], [72, 74, 77, 72], [76, 74, 71, 67]];
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    let out, delayIn, timer = null, next = 0, step = 0, running = false, ready = false;
    function setup() {
      const a = ctx();
      out = a.createGain(); out.gain.value = 0;
      const master = a.createGain(); master.gain.value = 0.5;
      out.connect(master).connect(comp);
      const len = a.sampleRate * 2.2, ir = a.createBuffer(2, len, a.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      const verb = a.createConvolver(); verb.buffer = ir;
      const wet = a.createGain(); wet.gain.value = 0.28;
      out.connect(verb).connect(wet).connect(master);
      delayIn = a.createDelay(1); delayIn.delayTime.value = SIX * 3;
      const fb = a.createGain(); fb.gain.value = 0.3; const dl = a.createGain(); dl.gain.value = 0.28;
      delayIn.connect(fb).connect(delayIn); delayIn.connect(dl).connect(out);
      ready = true;
    }
    function note(f, t, dur, type, vol, cutoff, echo) {
      const o = ac.createOscillator(), flt = ac.createBiquadFilter(), gn = ac.createGain();
      o.type = type; o.frequency.value = f;
      flt.type = 'lowpass'; flt.frequency.value = cutoff;
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + 0.015); gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(flt).connect(gn).connect(out);
      if (echo) gn.connect(delayIn);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function hit(t, vol, type, freq, dur) {
      const s = ac.createBufferSource(); s.buffer = noiseBuf;
      const flt = ac.createBiquadFilter(); flt.type = type; flt.frequency.value = freq;
      const gn = ac.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(flt).connect(gn).connect(out); s.start(t); s.stop(t + dur);
    }
    function kick(t) {
      const o = ac.createOscillator(), gn = ac.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.2);
      gn.gain.setValueAtTime(0.34, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(gn).connect(out); o.start(t); o.stop(t + 0.3);
    }
    function play(s16, t) {
      const bar = Math.floor(s16 / 16) % 4, pos = s16 % 16, chord = CHORDS[bar], hot = state.intensity;
      if (pos === 0 || pos === 10) chord.forEach(m => note(hz(m), t, SIX * 9, 'sawtooth', 0.022, 900 + hot * 500));      // pad
      if (pos % 4 === 0) note(hz(ROOTS[bar]), t, SIX * 3.5, 'square', 0.09, 420);                                        // bass
      if (pos % 4 === 2) note(hz(ROOTS[bar] + 12), t, SIX * 1.6, 'square', 0.06, 420);
      if (pos % 2 === 0) note(hz(chord[ARP[pos / 2] % chord.length] + 12), t, SIX * 2, 'triangle', 0.05, 2800, true);   // arp
      if (hot >= 1 && pos % 4 === 1 && s16 % 64 >= 32) note(hz(LEAD[bar][(pos >> 2) % 4]), t, SIX * 3.5, 'sine', 0.07, 4000, true); // lead
      if (pos === 0 || pos === 8 || (hot >= 2 && pos === 11)) kick(t);
      if (pos === 4 || pos === 12) hit(t, 0.09, 'bandpass', 1800, 0.18);                                                  // snare
      if (pos % 2 === 0 || hot >= 1) hit(t, pos % 4 === 2 ? 0.035 : 0.02, 'highpass', 7500, 0.045);                      // hats
    }
    function tick() { while (next < ac.currentTime + 0.3) { play(step, next); next += SIX; step = (step + 1) % 64; } }
    return {
      start() {
        if (!state.save.music || !state.save.sound || state.blocked || running) return;
        if (!ready) setup();
        running = true; next = ac.currentTime + 0.1;
        out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(1, ac.currentTime, 0.8);
        timer = setInterval(tick, 60);
      },
      stop() {
        if (!running) return;
        running = false; clearInterval(timer);
        out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(0, ac.currentTime, 0.15);
      },
      get running() { return running; },
    };
  })();

  return {
    state, sfx, music,
    unlock() { if (on()) ctx(); },
    // Re-apply the sound/music flags (settings change, ad start/end, platform mute)
    apply() {
      if (state.save.music && state.save.sound && !state.blocked) music.start(); else music.stop();
      if (ac && state.blocked) ac.suspend(); else if (ac) ac.resume();
    },
  };
})();
