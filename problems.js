// Every game's questions, in one place: the solo games ask at random, and duels, the daily challenge
// and the quant tests build lists from a seed, the same in every browser (both duel players build
// the same list from the match's seed; the daily's seed comes from the database, which builds the
// same list to check a result: schema.sql, private.zm_daily_list).
window.ZM_PROBLEMS = (() => {
  // mulberry32: a small seeded generator, the same in every browser.
  const seeded = seed => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Numbers are built from whole hundredths and printed without float noise: 3.40 → "3.4".
  const fmt = x => String(Number(x.toFixed(4)));
  const hund = n => fmt(n / 100);
  const comma = n => n.toLocaleString('en-US');

  // The quant tests' kinds: [weight, make(rand, coin, pick)] → [question, answer, kind, tolerance].
  // A tolerance (estimation) means any answer within that fraction of the true one is right.
  const TEST_KINDS = {
    o80: [
      // whole numbers
      [12, ({ rand }) => { const a = rand(100, 999), b = rand(100, 999); return [`${a} + ${b}`, a + b, 'add']; }],
      [12, ({ rand }) => { const a = rand(300, 999), b = rand(100, a - 50); return [`${a} − ${b}`, a - b, 'sub']; }],
      [16, ({ rand, rnd }) => {
        if (rnd() < 0.6) { const a = rand(12, 99), b = rand(3, 9); return [`${a} × ${b}`, a * b, 'mul']; }
        const a = rand(11, 25), b = rand(11, 39); return [`${a} × ${b}`, a * b, 'mul'];
      }],
      [12, ({ rand }) => { const d = rand(3, 19), q = rand(6, 60); return [`${d * q} ÷ ${d}`, q, 'div']; }],
      // decimals
      [18, ({ rand, pick }) => {
        const kind = rand(0, 3);
        if (kind === 0) {  // tenths × tenths: 3.4 × 2.5
          const x = rand(11, 99), y = pick([2, 4, 5, 12, 15, 25, 35, 45]);
          return [`${hund(x * 10)} × ${hund(y * 10)}`, x * y / 100, 'dec'];
        }
        if (kind === 1) {  // hundredths + tenths: 12.75 + 6.5
          const a = rand(101, 4999), b = rand(11, 499) * 10;
          return [`${hund(a)} + ${hund(b)}`, (a + b) / 100, 'dec'];
        }
        if (kind === 2) {  // a decimal take-away: 24.6 − 7.85
          const a = rand(50, 499) * 10, b = rand(101, a - 100);
          return [`${hund(a)} − ${hund(b)}`, (a - b) / 100, 'dec'];
        }
        const y = pick([2, 4, 5, 8, 12, 15, 25]), k = rand(3, 40);  // 7.2 ÷ 0.8 = 9
        return [`${hund(y * k * 10)} ÷ ${hund(y * 10)}`, k, 'dec'];
      }],
      // percentages: 12% of 850, 2.5% of 360
      [16, ({ rand, rnd, pick }) => {
        if (rnd() < 0.7) { const p = pick([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75]), n = rand(2, 90) * 10; return [`${p}% of ${n}`, p * n / 100, 'pct']; }
        const p10 = pick([25, 75, 125, 175]), n = rand(1, 24) * 40;  // 2.5%, 7.5%, 12.5%, 17.5%
        return [`${fmt(p10 / 10)}% of ${n}`, p10 * n / 1000, 'pct'];
      }],
      // brackets
      [14, ({ rand, rnd }) => {
        const kind = rand(0, 2);
        if (kind === 0) {  // (160 − 17) ÷ 11
          const c = rand(3, 15), total = c * rand(5, 40);
          if (rnd() < 0.5) { const b = rand(5, 60); return [`(${total + b} − ${b}) ÷ ${c}`, total / c, 'mix']; }
          const a = rand(Math.min(10, total - 1), total - 1); return [`(${a} + ${total - a}) ÷ ${c}`, total / c, 'mix'];
        }
        if (kind === 1) { const a = rand(12, 60), b = rand(11, 39), c = rand(3, 9); return [`(${a} + ${b}) × ${c}`, (a + b) * c, 'mix']; }
        const a = rand(12, 49), b = rand(3, 9), c = rand(11, 99); return [`${a} × ${b} − ${c}`, a * b - c, 'mix'];
      }],
    ],
    // Number sequences: five or six terms, then the next one.
    seq: [
      [3, ({ rand, coin }) => { const a = rand(2, 60), d = rand(3, 19) * (coin() ? 1 : -1); const t = [0, 1, 2, 3, 4].map(i => a + 80 * (d < 0) + d * i); return [t, t[4] + d]; }],
      [3, ({ rand, pick }) => { const r = pick([2, 2, 3]), a = rand(1, r === 2 ? 12 : 5); const t = [0, 1, 2, 3, 4].map(i => a * r ** i); return [t, t[4] * r]; }],
      [3, ({ rand }) => { const a = rand(1, 30), d = rand(1, 6), k = rand(1, 4); const t = [a]; for (let i = 0; i < 4; i++) t.push(t[i] + d + k * i); return [t, t[4] + d + k * 4]; }],
      [2, ({ rand, coin }) => { const n = rand(1, 8), c = rand(-3, 6), cube = coin() && n < 6; const f = i => (cube ? (n + i) ** 3 : (n + i) ** 2) + c; return [[0, 1, 2, 3, 4].map(f), f(5)]; }],
      [2, ({ rand }) => { const t = [rand(1, 9), rand(1, 9)]; while (t.length < 6) t.push(t[t.length - 1] + t[t.length - 2]); return [t, t[4] + t[5]]; }],
      [3, ({ rand, pick }) => { const m = pick([2, 2, 3]), c = rand(-3, 5) || 1; const t = [rand(1, 6)]; for (let i = 0; i < 4; i++) t.push(t[i] * m + c); return [t, t[4] * m + c]; }],
      [3, ({ rand }) => {  // two sequences, alternating
        const a = rand(1, 40), d = rand(2, 9), b = rand(1, 40), e = rand(2, 9) * -1 + 20;
        const t = [0, 1, 2, 3, 4, 5].map(i => (i % 2 ? b + e * ((i - 1) / 2) : a + d * (i / 2)));
        return [t, a + d * 3];
      }],
    ].map(([w, make]) => [w, h => { const [t, next] = make(h); return [t.join(', '), next, 'seq']; }]),
    // Fractions, decimals and percents.
    frac: [
      [5, ({ rand, pick }) => { const [n, d] = pick(FRACS(rand)); return [`${n}/${d}`, n / d, 'frac']; }],
      [3, ({ rand, pick }) => { const [n, d] = pick(FRACS(rand)); return [`${PARTS[d]} in ${fmt(n / d)}`, n, 'frac']; }],
      [3, ({ rand, pick }) => { const [n, d] = pick(FRACS(rand).filter(([n2, d2]) => n2 < d2)); return [`${n}/${d} in %`, n / d * 100, 'frac']; }],
      [2, ({ rand, pick }) => { const w = rand(1, 4), [n, d] = pick(FRACS(rand).filter(([n2, d2]) => n2 < d2)); return [`${w} ${n}/${d}`, w + n / d, 'frac']; }],
    ],
    // Estimation: within 5% counts.
    est: [
      [4, ({ rand }) => { const a = rand(1100, 9900) / 100, b = rand(110, 990) / 10; return [`${fmt(a)} × ${fmt(b)}`, a * b, 'est', 0.05]; }],
      [3, ({ rand }) => { const a = rand(1200, 98000), b = rand(110, 990) / 10; return [`${comma(a)} ÷ ${fmt(b)}`, a / b, 'est', 0.05]; }],
      [3, ({ rand }) => { const p = rand(110, 890) / 10, n = rand(1200, 98000); return [`${fmt(p)}% of ${comma(n)}`, p * n / 100, 'est', 0.05]; }],
      [2, ({ rand }) => { let n; do n = rand(150, 9900); while (Number.isInteger(Math.sqrt(n))); return [`√${comma(n)}`, Math.sqrt(n), 'est', 0.05]; }],
      [2, ({ rand }) => { const a = rand(110, 990), b = rand(110, 990), c = rand(11, 99); return [`${a} × ${b} ÷ ${c}`, a * b / c, 'est', 0.05]; }],
    ],
  };
  // Fractions with exact decimals: halves to fortieths, proper and (a quarter of the time) improper.
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const ALL_FRACS = [2, 4, 5, 8, 10, 16, 20, 25, 40].flatMap(d => Array.from({ length: Math.ceil(d * 1.5) - 1 }, (_, i) => [i + 1, d])).filter(([n, d]) => gcd(n, d) === 1);
  const FRACS = rand => ALL_FRACS.filter(([n, d]) => n < d || rand(0, 3) === 0);
  const PARTS = { 2: 'Halves', 4: 'Quarters', 5: 'Fifths', 8: 'Eighths', 10: 'Tenths', 16: 'Sixteenths', 20: 'Twentieths', 25: 'Twenty-fifths', 40: 'Fortieths' };
  // The tests: how many questions, how long, and the name.
  // `sign` sits between the question and the answer box.
  const TESTS = { o80: { count: 80, seconds: 480, name: '80 in 8', sign: '=' }, seq: { count: 30, seconds: 240, name: 'Sequences', sign: '→' },
                  frac: { count: 60, seconds: 240, name: 'Fractions', sign: '=' }, est: { count: 40, seconds: 240, name: 'Estimation', sign: '≈' } };

  const helpers = rnd => ({ rnd, rand: (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1)), coin: () => rnd() < 0.5, pick: l => l[Math.floor(rnd() * l.length)] });
  // One quant-test question, picked by weight (or of one kind: 'pct', 'dec', …), as { q, a, o, tol }.
  function testQuestion(game, rnd, kind) {
    const h = helpers(rnd);
    for (;;) {
      const kinds = TEST_KINDS[game];
      let r = rnd() * kinds.reduce((t, [w]) => t + w, 0), make = kinds[0][1];
      for (const [w, m] of kinds) { if ((r -= w) < 0) { make = m; break; } }
      const [q, a, o, tol] = make(h);
      if (a > 0 && (!kind || o === kind)) return { q, a: Number(a.toFixed(4)), o, ...(tol && { tol }) };
    }
  }

  // ---- the games' questions, for both the seeded lists below and the solo games (Math.random) ----
  // Zetamac arithmetic: one of the chosen operations, from the ranges (the defaults are zetamac's).
  // Subtraction is addition run backwards, division multiplication run backwards.
  const ARITH_DEFAULTS = { 'add-a-lo': 2, 'add-a-hi': 100, 'add-b-lo': 2, 'add-b-hi': 100, 'mul-a-lo': 2, 'mul-a-hi': 12, 'mul-b-lo': 2, 'mul-b-hi': 100 };
  const ALL_OPS = ['add', 'sub', 'mul', 'div'];
  function arith(r, ops, rand) {
    const op = ops[rand(0, ops.length - 1)];
    if (op === 'add' || op === 'sub') {
      const a = rand(r['add-a-lo'], r['add-a-hi']), b = rand(r['add-b-lo'], r['add-b-hi']);
      return op === 'add' ? { q: `${a} + ${b}`, a: a + b, o: op } : { q: `${a + b} – ${a}`, a: b, o: op };
    }
    let a = rand(r['mul-a-lo'], r['mul-a-hi']);
    while (op === 'div' && a === 0) a = rand(r['mul-a-lo'], r['mul-a-hi']);
    const b = rand(r['mul-b-lo'], r['mul-b-hi']);
    return op === 'mul' ? { q: `${a} × ${b}`, a: a * b, o: op } : { q: `${a * b} ÷ ${a}`, a: b, o: op };
  }
  // The combined game's four kinds: (5 + 2) × (15 + 9), (13 – 4) × 23, (7 × 8) + (6 × 14), (84 + 12) ÷ 8.
  // Each returns [text, answer]; the multiplying ones use zetamac's sizes (2–12 by 2–100).
  const MIXED_KINDS = ['both', 'one', 'prod', 'div'];
  function mixedKinds(rand, coin) {
    // v written as a bracket: a sum (7 → 5 + 2) or a difference (7 → 15 – 8), both parts at least 1
    // and a sum's parts under 100 where v allows.
    const bracket = v => {
      if (v >= 2 && coin()) { const a = rand(Math.max(1, v - 99), v - 1); return `(${a} + ${v - a})`; }
      const b = v < 13 ? rand(2, 9) : rand(2, 30);
      return `(${v + b} – ${b})`;
    };
    return {
      both: () => { const m = rand(2, 12), n = rand(2, 100); const [l, r] = coin() ? [m, n] : [n, m]; return [`${bracket(l)} × ${bracket(r)}`, m * n]; },
      one: () => { const m = rand(2, 12), n = rand(2, 100); const [shown, hidden] = coin() ? [n, m] : [m, n];
                   return [coin() ? `${bracket(hidden)} × ${shown}` : `${shown} × ${bracket(hidden)}`, m * n]; },
      // bigger product first when taking away, so the answer stays positive
      prod: () => { let p = [rand(2, 12), rand(2, 20)], q = [rand(2, 12), rand(2, 20)]; const add = coin();
                    if (!add) { while (p[0] * p[1] === q[0] * q[1]) q = [rand(2, 12), rand(2, 20)]; if (p[0] * p[1] < q[0] * q[1]) [p, q] = [q, p]; }
                    const side = ([a, b]) => (coin() ? `(${a} × ${b})` : `(${b} × ${a})`);
                    return [`${side(p)} ${add ? '+' : '–'} ${side(q)}`, add ? p[0] * p[1] + q[0] * q[1] : p[0] * p[1] - q[0] * q[1]]; },
      div: () => { const d = rand(2, 12), n = rand(2, 50); return [`${bracket(d * n)} ÷ ${d}`, n]; },
    };
  }
  // The squares games' numbers. sq99h and sq999h leave out numbers ending in 0 or 5 (both are tricks)
  // and, for two-digit squares, 1 to 20; sq99 and sq999 are older games with every number.
  function squarePool(game) {
    const m = /^sq(99|999)(h?)$/.exec(game);
    if (!m) return null;
    const [lo, hi] = m[1] === '99' ? [1, 99] : [100, 999], hard = !!m[2], pool = [];
    for (let n = lo; n <= hi; n++) if (!(hard && (n % 5 === 0 || (m[1] === '99' && n <= 20)))) pool.push(n);
    return pool;
  }
  const square = n => ({ q: `${n}²`, a: n * n, o: 'sq' });

  function maker(game, rnd) {
    const { rand, coin } = helpers(rnd);
    if (game === 'standard' || game === 'daily') return () => arith(ARITH_DEFAULTS, ALL_OPS, rand);
    if (TEST_KINDS[game]) return () => testQuestion(game, rnd);
    if (game === 'mixed') {
      const make = mixedKinds(rand, coin);
      return () => { const [q, a] = make[MIXED_KINDS[rand(0, 3)]](); return { q, a, o: 'mix' }; };
    }
    const pool = squarePool(game);
    if (pool) return () => square(pool[rand(0, pool.length - 1)]);
    throw new Error('Unknown game.');
  }
  // The same, at random, for the solo games.
  const random = helpers(Math.random);

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

  // The daily challenge's seed: the calendar date, so everyone gets the same questions that day.
  const daySeed = date => [...date].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  // Whether a typed answer is right: exact, or within a tolerance (estimation).
  const isRight = (p, v) => Number.isFinite(v) && (p.tol ? Math.abs(v - p.a) <= p.tol * Math.abs(p.a) : Math.abs(v - p.a) < 1e-9);
  // One random quant-test question of a kind (practice drills): ZM_PROBLEMS.one('o80', 'pct').
  const one = (game, kind) => testQuestion(game, Math.random, kind);

  // The kind of arithmetic question, read from its text: "54 + 87" → "+ carry", "7 × 86" → "× 7".
  function factOf(q) {
    const m = /^(\d+) (\+|–|×|÷) (\d+)$/.exec(q.q || '');
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[3]);
    if (q.o === 'add') return a % 10 + b % 10 >= 10 ? '+ carry' : '+ no carry';
    if (q.o === 'sub') return b % 10 > a % 10 ? '– borrow' : '– no borrow';
    if (q.o === 'mul') return `× ${a <= 12 ? a : b}`;
    if (q.o === 'div') return `÷ ${b}`;
    return null;
  }
  // A new question of that kind, from zetamac's ranges: '+ carry', '– borrow', '× 7', '÷ 8', …
  function ofFact(kind, rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))) {
    const [sign, rest] = kind.split(' ');
    for (;;) {
      if (sign === '×' || sign === '÷') {
        const n = Number(rest), b = rand(2, 100);
        return sign === '×' ? { q: `${n} × ${b}`, a: n * b, o: 'mul' } : { q: `${n * b} ÷ ${n}`, a: b, o: 'div' };
      }
      const a = rand(2, 100), b = rand(2, 100), p = sign === '+' ? { q: `${a} + ${b}`, a: a + b, o: 'add' } : { q: `${a + b} – ${a}`, a: b, o: 'sub' };
      if (factOf(p) === kind) return p;
    }
  }

  const NAMES = { any: 'Any problems', standard: 'Arithmetic', mixed: 'Combined', sq99: 'Two-digit squares', sq99h: 'Two-digit squares', sq999: 'Three-digit squares', sq999h: 'Three-digit squares' };
  return { list, NAMES, TESTS, daySeed, isRight, one, fmt, factOf, ofFact,
    ARITH_DEFAULTS, ALL_OPS, MIXED_KINDS, squarePool, square,
    arith: (r = ARITH_DEFAULTS, ops = ALL_OPS) => arith(r, ops, random.rand),
    mixed: kinds => { const make = mixedKinds(random.rand, random.coin); const [q, a] = make[kinds[random.rand(0, kinds.length - 1)]](); return { q, a, o: 'mix' }; } };
})();
