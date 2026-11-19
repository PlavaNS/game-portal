(() => {
  let q = [], vt = 0;
  window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => vt;
  const base = Date.now();
  Date.now = () => base + vt;
  window.__V = { step(ms){ vt += ms; const l = q; q = []; for (const cb of l) { try { cb(vt); } catch(e){} } } };
})();
