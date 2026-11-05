// Bonkers Arena — daily quests and the 7-day login streak. Works on the save object only.
(function (root) {
  const POOL = [
    { id: 'bonk', text: n => `Bonk ${n} orbs into the void`, ns: [4, 7, 10] },
    { id: 'win', text: n => `Win ${n} ${n > 1 ? 'rounds' : 'round'}`, ns: [1, 2, 3] },
    { id: 'eat', text: n => `Collect ${n} energy cubes`, ns: [50, 90, 140] },
    { id: 'pu', text: n => `Grab ${n} power-ups`, ns: [3, 5, 8] },
    { id: 'dash', text: n => `Dash ${n} times`, ns: [20, 35, 50] },
    { id: 'online', text: n => `Play ${n} online ${n > 1 ? 'rounds' : 'round'}`, ns: [1, 2, 3], online: true },
  ];
  const REWARDS = [40, 60, 90];                     // easy, medium, hard quest
  const STREAK = [20, 30, 40, 50, 70, 90, 150];     // day 1 … day 7

  function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  function dayNum(key) { const [y, m, d] = key.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); }

  // New day: three fresh quests, and the streak resets if a day was missed. Returns true when it changed the save.
  function refresh(save, onlineOk) {
    const key = today();
    if (save.daily && save.daily.day === key) return false;
    const picks = POOL.filter(q => onlineOk || !q.online).sort(() => Math.random() - .5).slice(0, 3);
    save.daily = { day: key, quests: picks.map((q, i) => ({ id: q.id, n: q.ns[i], p: 0, claimed: false, reward: REWARDS[i] })), streakClaimed: false };
    if (!save.streak) save.streak = { count: 0, last: null };
    if (save.streak.last && dayNum(key) - dayNum(save.streak.last) > 1) save.streak.count = 0;
    return true;
  }

  // Adds progress; returns the quest when this call completed it.
  function progress(save, id, amount) {
    const q = save.daily && save.daily.quests.find(x => x.id === id);
    if (!q || q.p >= q.n) return null;
    q.p = Math.min(q.n, q.p + amount);
    return q.p >= q.n ? q : null;
  }

  function claimQuest(save, i) {
    const q = save.daily.quests[i];
    if (q.claimed || q.p < q.n) return 0;
    q.claimed = true; save.coins += q.reward;
    return q.reward;
  }

  function streakReward(save) { return STREAK[save.streak.count % 7]; }

  function claimStreak(save, mult) {
    if (save.daily.streakClaimed) return 0;
    const r = streakReward(save) * mult;
    save.daily.streakClaimed = true;
    save.streak.count = (save.streak.count % 7) + 1;
    save.streak.last = save.daily.day;
    save.coins += r;
    return r;
  }

  function pending(save) {
    if (!save.daily) return 0;
    return (save.daily.streakClaimed ? 0 : 1) + save.daily.quests.filter(q => q.p >= q.n && !q.claimed).length;
  }

  function label(q) { return POOL.find(p => p.id === q.id).text(q.n); }

  root.Daily = { refresh, progress, claimQuest, claimStreak, streakReward, pending, label, STREAK };
})(this);
