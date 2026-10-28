'use strict';
// ---------- Leaderboards ----------
// Global board: our own database (Supabase RPC functions fd_submit / fd_top / fd_rank).
// CrazyGames: their own weekly leaderboard through the SDK (see platform.js); our board is off there.
// Every platform also keeps "My runs": the player's 10 best runs on this device.
const LB = (() => {
  const cfg = window.FD_CONFIG || {};
  const url = cfg.lbUrl, key = cfg.lbKey;
  const enabled = !!(url && key);

  async function rpc(fn, body) {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${fn} failed: ${r.status} ${await r.text()}`);
    return r.json();
  }
  function randomId() {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }
  function ensureIds() {
    if (!save.pid) { save.pid = randomId(); save.secret = randomId(); writeSave(); }
  }
  function country() {
    const region = (navigator.language || '').split('-')[1];
    return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : null;
  }
  return {
    enabled,
    submit(score) {
      ensureIds();
      return rpc('fd_submit', { p_pid: save.pid, p_secret: save.secret, p_name: save.playerName, p_cc: country(), p_score: score });
    },
    top(period) { ensureIds(); return rpc('fd_top', { p_period: period, p_limit: 50, p_pid: save.pid }); },
    rank() { ensureIds(); return rpc('fd_rank', { p_pid: save.pid }); },
  };
})();

// Name rules shared by the name boxes (the database applies the same limits)
function cleanName(raw) {
  return (raw || '').replace(/[^A-Za-z0-9 _.\-ÀÁÂÃÄÅÆÇČĆĐŠŽàáâãäåæçčćđšžèéêëìíîïñòóôõöùúûüýÿ]/g, '').trim().slice(0, 16);
}

// The 10 best runs on this device
function addRun(score) {
  if (score <= 0) return;
  save.runs.push({ score, date: today(), zone: zoneIndex(S.screen) % ZONES.length, daily: S.daily });
  save.runs.sort((a, b) => b.score - a.score);
  save.runs = save.runs.slice(0, 10);
  writeSave();
}
