'use strict';
// ---------- Sound effects and music (all synthesised: no audio files, no licensing) ----------
let audioBlocked = false; // true while an ad plays or the platform muted us
const sfx = (() => {
  let ac = null, noiseBuf = null;
  function ctx() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type, vol, slide, delay = 0) {
    if (!save.sound || audioBlocked) return;
    const a = ctx(), t = a.currentTime + delay;
    const o = a.createOscillator(), gn = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn).connect(a.destination); o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol, f0, f1) {
    if (!save.sound || audioBlocked) return;
    const a = ctx(), t = a.currentTime;
    const s = a.createBufferSource(); s.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gn = a.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(gn).connect(a.destination); s.start(t); s.stop(t + dur);
  }
  return {
    unlock: () => { if (save.sound && !audioBlocked) ctx(); },
    suspend: on => { if (ac) { if (on) ac.suspend(); else ac.resume(); } },
    bounce: v => tone(150, 0.12, 'sine', Math.min(0.45, 0.06 + v * 0.05), 70),
    rim: v => { tone(1150, 0.18, 'triangle', Math.min(0.22, 0.05 + v * 0.03)); tone(1730, 0.12, 'sine', 0.04); },
    swish: () => noise(0.35, 0.35, 2400, 600),
    perfect: () => { tone(880, 0.16, 'triangle', 0.17); tone(1320, 0.3, 'triangle', 0.17, null, 0.09); },
    fail: () => tone(260, 0.45, 'sawtooth', 0.11, 70),
    portal: () => { tone(300, 0.3, 'sine', 0.2, 1200); noise(0.3, 0.15, 800, 4000); },
    clunk: () => { tone(110, 0.15, 'square', 0.12, 60); noise(0.08, 0.2, 600, 200); },
    rage: () => { noise(0.6, 0.4, 300, 3000); tone(220, 0.6, 'square', 0.05, 660); },
    boing: () => tone(300, 0.25, 'sine', 0.3, 900),
    star: () => { tone(1568, 0.12, 'triangle', 0.12); tone(2093, 0.2, 'triangle', 0.12, null, 0.07); },
    heart: () => [523, 659, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.13, null, i * 0.08)),
    powerup: () => { [660, 990, 1320].forEach((f, i) => tone(f, 0.16, 'square', 0.05, null, i * 0.05)); noise(0.3, 0.12, 2000, 6000); },
    coin: () => { tone(1320, 0.07, 'square', 0.05); tone(1980, 0.18, 'square', 0.05, null, 0.06); },
    mission: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, null, i * 0.08)),
    lost: () => tone(420, 0.25, 'triangle', 0.08, 160),
    boss: () => { tone(110, 0.8, 'sawtooth', 0.08, 55); [220, 277, 330].forEach((f, i) => tone(f, 0.5, 'square', 0.04, null, i * 0.12)); },
    zap: () => noise(0.12, 0.25, 4000, 1500),
    shoot: () => tone(900, 0.15, 'square', 0.05, 300),
    zone: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, null, i * 0.1)),
    context: () => ctx(),
    click: () => tone(660, 0.06, 'triangle', 0.1),
    unlocked: () => [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, null, i * 0.09)),
  };
})();

// ---------- Music (original lo-fi loop, synthesised live: no audio files, no licensing) ----------
const music = (() => {
  const BPM = 84, SIX = 60 / BPM / 4;                       // length of a 16th note
  const CHORDS = [[53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 67]]; // Fmaj7 G6 Em7 Am7
  const ROOTS = [41, 43, 40, 45];
  const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  let ac = null, out, delayIn, noiseBuf, timer = null, next = 0, step = 0, running = false;

  function setup() {
    ac = sfx.context();
    out = ac.createGain(); out.gain.value = 0;
    const master = ac.createGain(); master.gain.value = 0.55;
    out.connect(master).connect(ac.destination);
    // Soft room reverb from a decaying noise impulse
    const len = ac.sampleRate * 2.4, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const verb = ac.createConvolver(); verb.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.32;
    out.connect(verb).connect(wet).connect(master);
    // Dotted-eighth echo for the plucks
    delayIn = ac.createDelay(1); delayIn.delayTime.value = SIX * 3;
    const fb = ac.createGain(); fb.gain.value = 0.32; const dl = ac.createGain(); dl.gain.value = 0.3;
    delayIn.connect(fb).connect(delayIn); delayIn.connect(dl).connect(out);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
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
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    gn.gain.setValueAtTime(0.32, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(gn).connect(out); o.start(t); o.stop(t + 0.32);
  }
  function play(s16, t) {
    const bar = Math.floor(s16 / 16) % 4, pos = s16 % 16, chord = CHORDS[bar];
    const rage = typeof S !== 'undefined' && S.rage;
    if (pos === 0 || pos === 10) chord.forEach(m => note(hz(m), t, SIX * 10, 'triangle', 0.04, 1500));     // warm keys
    if (pos === 0) note(hz(ROOTS[bar] - 12), t, SIX * 7, 'sine', 0.2, 600);                                  // bass
    if (pos === 8) note(hz(ROOTS[bar] - 5), t, SIX * 6, 'sine', 0.15, 600);
    if (pos % 2 === 0 && (pos % 4 === 2 || s16 % 32 >= 16)) note(hz(chord[ARP[pos / 2]] + 12), t, SIX * 2.2, 'sine', 0.05, 3200, true); // pluck arp
    if (pos === 0 || pos === 9) kick(t);
    if (pos === 4 || pos === 12) hit(t, 0.07, 'bandpass', 1900, 0.16);                                       // soft snap
    if (pos % 4 === 2 || (rage && pos % 2 === 1)) hit(t, rage ? 0.045 : 0.03, 'highpass', 7000, 0.05);       // hats
  }
  function tick() {
    while (next < ac.currentTime + 0.3) { play(step, next); next += SIX; step = (step + 1) % 64; }
  }
  return {
    start() {
      if (!save.music || !save.sound || running) return;
      if (!ac) setup();
      running = true; next = ac.currentTime + 0.1;
      out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(1, ac.currentTime, 0.8);
      timer = setInterval(tick, 60);
    },
    stop() {
      if (!running) return;
      running = false; clearInterval(timer);
      out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(0, ac.currentTime, 0.15);
    },
  };
})();

function vibrate(ms) {
  if (save.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* not allowed in this frame */ } }
}
