// Seeded question lists for duels (duel.html): both players build the same list from the match's
// seed. The problems match the solo games: zetamac's default arithmetic, the combined game's four
// kinds, and the squares modes.
window.ZM_PROBLEMS = (() => {
  // mulberry32: a small seeded generator, the same in every browser.
  const seeded = seed => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  function maker(game, rnd) {
    const rand = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const coin = () => rnd() < 0.5;
    if (game === 'standard') return () => {
      const op = ['add', 'sub', 'mul', 'div'][rand(0, 3)];
      if (op === 'add' || op === 'sub') {
        const a = rand(2, 100), b = rand(2, 100);
        return op === 'add' ? { q: `${a} + ${b}`, a: a + b, o: op } : { q: `${a + b} – ${a}`, a: b, o: op };
      }
      const a = rand(2, 12), b = rand(2, 100);
      return op === 'mul' ? { q: `${a} × ${b}`, a: a * b, o: op } : { q: `${a * b} ÷ ${a}`, a: b, o: op };
    };
    if (game === 'mixed') {
      const bracket = v => {
        if (v >= 2 && coin()) { const a = rand(Math.max(1, v - 99), v - 1); return `(${a} + ${v - a})`; }
        const b = v < 13 ? rand(2, 9) : rand(2, 30);
        return `(${v + b} – ${b})`;
      };
      const kinds = [
        () => { const m = rand(2, 12), n = rand(2, 100); const [l, r] = coin() ? [m, n] : [n, m]; return [`${bracket(l)} × ${bracket(r)}`, m * n]; },
        () => { const m = rand(2, 12), n = rand(2, 100); const [shown, hidden] = coin() ? [n, m] : [m, n];
                return [coin() ? `${bracket(hidden)} × ${shown}` : `${shown} × ${bracket(hidden)}`, m * n]; },
        () => { let p = [rand(2, 12), rand(2, 20)], q = [rand(2, 12), rand(2, 20)]; const add = coin();
                if (!add) { while (p[0] * p[1] === q[0] * q[1]) q = [rand(2, 12), rand(2, 20)]; if (p[0] * p[1] < q[0] * q[1]) [p, q] = [q, p]; }
                const side = ([a, b]) => (coin() ? `(${a} × ${b})` : `(${b} × ${a})`);
                return [`${side(p)} ${add ? '+' : '–'} ${side(q)}`, add ? p[0] * p[1] + q[0] * q[1] : p[0] * p[1] - q[0] * q[1]]; },
        () => { const d = rand(2, 12), n = rand(2, 50); return [`${bracket(d * n)} ÷ ${d}`, n]; },
      ];
      return () => { const [q, a] = kinds[rand(0, 3)](); return { q, a, o: 'mix' }; };
    }
    const m = /^sq(99|999)(h?)$/.exec(game);
    if (m) {
      const [lo, hi] = m[1] === '99' ? [1, 99] : [100, 999], hard = !!m[2], pool = [];
      for (let n = lo; n <= hi; n++) if (!(hard && (n % 10 === 5 || (m[1] === '99' && n <= 20)))) pool.push(n);
      return () => { const n = pool[rand(0, pool.length - 1)]; return { q: `${n}²`, a: n * n, o: 'sq' }; };
    }
    throw new Error('Unknown game.');
  }

  // n questions for this game and seed, never the same one twice in a row.
  function list(game, seed, n) {
    const next = maker(game, seeded(seed));
    const out = [];
    while (out.length < n) {
      const p = next();
      if (!out.length || out[out.length - 1].q !== p.q) out.push(p);
    }
    return out;
  }

  const NAMES = { any: 'Any problems', standard: 'Arithmetic', mixed: 'Combined', sq99: 'Two-digit squares', sq99h: 'Two-digit squares', sq999: 'Three-digit squares', sq999h: 'Three-digit squares' };
  return { list, NAMES };
})();
