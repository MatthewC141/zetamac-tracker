// The method guide (guide.html): operation tabs, the worked-problem bench that steps through each
// method, Try one, and the times-table grid and drill. Nothing here is saved to the tracker.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const saved = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const tens = n => Math.floor(n / 10), ones = n => n % 10;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // The answer as far as it's known: the last `known` digits show, the rest are placeholders.
  const mask = (ans, known) => ans.split('').map((d, i) => (i >= ans.length - known ? d : '·')).join('');
  // The problem with a small mark written over the first number's tens digit (a carry, a borrow).
  const marked = (text, mark) => {
    const sp = text.indexOf(' '), first = text.slice(0, sp), k = first.length - 2;
    if (!mark || k < 0) return esc(text);
    return `${esc(first.slice(0, k))}<span class="mk" data-mark="${esc(mark)}">${first[k]}</span>${esc(first.slice(k + 1))}${esc(text.slice(sp))}`;
  };

  // ---- methods: a problem generator and a walk through its steps ----
  // Each walk step names the article step it matches, what you hold in your head, the answer as
  // far as it's known, and the working line.
  const METHODS = {
    add: {
      label: 'Carry', first: { a: 47, b: 38 },
      gen: () => ({ a: rand(11, 99), b: rand(11, 99) }),
      text: p => `${p.a} + ${p.b}`,
      answer: p => p.a + p.b,
      walk(p) {
        const s = ones(p.a) + ones(p.b), carry = s >= 10, ans = String(p.a + p.b);
        const t = tens(p.a) + tens(p.b) + (carry ? 1 : 0);
        return [
          { step: 1, line: `${ones(p.a)} + ${ones(p.b)} = ${s}`, hold: String(s), ans: mask(ans, 0) },
          { step: 2, line: carry ? `${s} is past 10: keep ${ones(s)}, carry 1` : `${s} is under 10: nothing carries`, hold: carry ? `${ones(s)}, carry 1` : String(s), ans: mask(ans, 1), mark: carry ? '1' : '' },
          { step: 3, line: `${tens(p.a)} + ${tens(p.b)}${carry ? ' + 1' : ''} = ${t}`, hold: '', ans, mark: carry ? '1' : '' },
        ];
      },
    },
    'sub-plain': {
      label: 'No borrow', first: { top: 68, a: 23 },
      gen() {
        for (;;) {
          const a = rand(11, 99), b = rand(10, 99), top = a + b;
          if (ones(top) >= ones(a)) return { top, a };
        }
      },
      text: p => `${p.top} – ${p.a}`,
      answer: p => p.top - p.a,
      walk(p) {
        const ans = String(p.top - p.a), o = ones(p.top) - ones(p.a);
        return [
          { step: 1, line: `${ones(p.top)} – ${ones(p.a)} = ${o}`, hold: String(o), ans: mask(ans, 1) },
          { step: 2, line: `${tens(p.top)} – ${tens(p.a)} = ${tens(p.top) - tens(p.a)}`, hold: '', ans },
        ];
      },
    },
    'sub-up': {
      label: 'Count up', first: { top: 62, a: 17 },
      gen: () => borrowing(),
      text: p => `${p.top} – ${p.a}`,
      answer: p => p.top - p.a,
      walk(p) {
        const ans = String(p.top - p.a), up = 10 - ones(p.a), next = p.a + up, rest = p.top - next;
        return [
          { step: 1, line: `${p.a} up to ${next} is ${up}`, hold: String(up), ans: mask(ans, 0) },
          { step: 2, line: `${next} up to ${p.top} is ${rest}`, hold: `${up} and ${rest}`, ans: mask(ans, 0) },
          { step: 3, line: `${up} + ${rest} = ${ans}`, hold: '', ans },
        ];
      },
    },
    'sub-ten': {
      label: 'From ten', first: { top: 62, a: 17 },
      gen: () => borrowing(),
      text: p => `${p.top} – ${p.a}`,
      answer: p => p.top - p.a,
      walk(p) {
        const ans = String(p.top - p.a), left = ones(p.a) - ones(p.top), d = 10 - left;
        return [
          { step: 1, line: `${ones(p.a)} – ${ones(p.top)} = ${left} left over`, hold: String(left), ans: mask(ans, 0) },
          { step: 2, line: `10 – ${left} = ${d}`, hold: `ones digit ${d}`, ans: mask(ans, 1) },
          { step: 3, line: `${tens(p.top)} – ${tens(p.a)} – 1 = ${tens(p.top) - tens(p.a) - 1}`, hold: '', ans, mark: '−1' },
        ];
      },
    },
    'mul-split': {
      label: 'Split', first: { s: 7, n: 43 },
      gen() {
        let s; do s = rand(2, 12); while (s === 11 || s === 10);
        let n; do n = rand(11, 99); while (n % 10 === 0);
        return { s, n };
      },
      text: p => `${p.s} × ${p.n}`,
      answer: p => p.s * p.n,
      walk(p) {
        const big = p.s * tens(p.n) * 10, small = p.s * ones(p.n), ans = String(p.s * p.n);
        return [
          { step: 1, line: `${p.s} × ${tens(p.n) * 10} = ${big}`, hold: String(big), ans: mask(ans, 0) },
          { step: 2, line: `${p.s} × ${ones(p.n)} = ${small}`, hold: `${big} and ${small}`, ans: mask(ans, 0) },
          { step: 3, line: `${big} + ${small} = ${ans}`, hold: '', ans },
        ];
      },
    },
    'mul-11': {
      label: '× 11', first: { n: 43 },
      gen: () => ({ n: rand(12, 99) }),
      text: p => `11 × ${p.n}`,
      answer: p => 11 * p.n,
      walk(p) {
        const a = tens(p.n), b = ones(p.n), sum = a + b, spread = a * 100 + b, ans = String(11 * p.n);
        const steps = [{ step: 1, line: `${p.n} spreads to ${spread}`, hold: String(spread), ans: mask(ans, 0) }];
        if (sum < 10) steps.push({ step: 2, line: `${a} + ${b} = ${sum} under the 0: ${ans}`, hold: '', ans });
        else steps.push(
          { step: 2, line: `${a} + ${b} = ${sum}`, hold: `${spread} and ${sum}`, ans: mask(ans, 0) },
          { step: 3, line: `${sum} is 10 or more: ${spread} + ${sum * 10} = ${ans}`, hold: '', ans },
        );
        return steps;
      },
    },
    div: {
      label: 'Divide', first: { d: 7, q: 62 },
      gen() {
        let q; do q = rand(11, 99); while (q % 10 === 0);
        return { d: rand(2, 12), q };
      },
      text: p => `${p.d * p.q} ÷ ${p.d}`,
      answer: p => p.q,
      walk(p) {
        const n = p.d * p.q, m = tens(p.q) * 10, base = p.d * m, diff = n - base, ans = String(p.q);
        const table = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => p.d * k).join(', ');
        return [
          { step: 1, line: `${p.d}s: ${table}`, hold: `the ${p.d} times table`, ans: mask(ans, 0) },
          { step: 2, line: `${p.d} × ${m} = ${base}`, hold: String(m), ans: mask(ans, 0) },
          { step: 3, line: `${n} – ${base} = ${diff}`, hold: `${m}, and ${diff} left`, ans: mask(ans, 0) },
          { step: 4, line: `${diff} ÷ ${p.d} = ${ones(p.q)}, and ${m} + ${ones(p.q)} = ${ans}`, hold: '', ans },
        ];
      },
    },
  };
  function borrowing() {
    for (;;) {
      const a = rand(11, 99), b = rand(10, 99), top = a + b;
      if (ones(top) < ones(a)) return { top, a };
    }
  }
  const BAY_METHODS = { add: ['add'], sub: ['sub-plain', 'sub-up', 'sub-ten'], mul: ['mul-split', 'mul-11'], div: ['div'] };

  // ---- the bench: one per operation, beside the article ----
  const benches = {};
  function makeBench(bay) {
    const host = $(`[data-bench="${bay}"]`);
    const ids = BAY_METHODS[bay];
    host.innerHTML =
      `<section class="panel bench" aria-label="Worked problem">` +
        `<div class="panel-head"><h3>Worked problem</h3>` +
          (ids.length > 1 ? `<div class="seg" role="group" aria-label="Method">${ids.map(id => `<button type="button" data-method="${id}">${esc(METHODS[id].label)}</button>`).join('')}</div>` : '') +
        `</div>` +
        `<div class="prob" aria-live="polite"><span class="q"></span><span class="eq">=</span><span class="ans"></span></div>` +
        `<div class="hold"><span class="k">In your head</span><span class="v"></span></div>` +
        `<ol class="ledger"></ol>` +
        `<div class="bench-ctl"><span class="count"></span>` +
          `<button class="btn" type="button" data-act="back">Back</button>` +
          `<button class="btn go" type="button" data-act="step">Next step</button>` +
          `<button class="btn" type="button" data-act="new">New problem</button></div>` +
      `</section>` +
      `<section class="panel try" aria-label="Try one">` +
        `<div class="panel-head"><h3>Try one</h3><span class="sub try-method"></span></div>` +
        `<div class="try-row"><span class="q"></span><span class="eq">=</span><input class="answer" type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Your answer"></div>` +
        `<p class="try-out" aria-live="polite"></p>` +
        `<div class="try-ctl"><button class="btn" type="button" data-act="walk">Walk through this one</button><button class="btn" type="button" data-act="skip">Skip</button><span class="try-stats"></span></div>` +
      `</section>`;

    const bench = $('.bench', host), tryEl = $('.try', host);
    const state = { method: ids[0], p: null, steps: [], at: 0, auto: 0, played: false };
    const article = $(`#bay-${bay}`);

    const paint = (animate = true) => {
      const m = METHODS[state.method];
      const shown = state.steps.slice(0, state.at);
      const cur = shown[shown.length - 1];
      $('.q', bench).innerHTML = marked(m.text(state.p), cur && cur.mark);
      const ans = cur ? cur.ans : mask(String(m.answer(state.p)), 0);
      const before = $('.ans', bench).textContent;
      $('.ans', bench).innerHTML = ans.split('').map((d, i) => `<i class="${d === '·' ? 'unknown' : animate && before[i] !== d ? 'lit' : ''}">${d}</i>`).join('');
      $('.ans', bench).classList.toggle('done', state.at === state.steps.length);
      $('.ans', bench).setAttribute('aria-label', state.at === state.steps.length ? `answer ${ans}` : 'answer not worked out yet');
      $('.hold .v', bench).textContent = !cur ? '—' : state.at === state.steps.length ? `${cur.ans}, type it` : cur.hold || '—';
      const ledger = $('.ledger', bench);
      const had = ledger.querySelectorAll('li').length;
      ledger.innerHTML = shown.length
        ? shown.map((s, i) => `<li class="${i === shown.length - 1 ? 'cur' : ''}${animate && i >= had ? ' new' : ''}"><span class="sn">${s.step}</span><span>${esc(s.line)}</span></li>`).join('')
        : '<li><span class="idle">Press Next step to work it through.</span></li>';
      // counted in the article's step numbers (division's walk starts at its step 2)
      $('.count', bench).textContent = `Step ${cur ? cur.step : 0} of ${state.steps[state.steps.length - 1].step}`;
      $('[data-act="back"]', bench).disabled = state.at === 0;
      $('[data-act="step"]', bench).textContent = state.at === state.steps.length ? 'Again' : 'Next step';
      // the article follows the bench: its method block is current and the matching step lights up
      $$('.method', article).forEach(el => el.classList.toggle('current', el.dataset.method === state.method && ids.length > 1));
      $$('.method .steps li', article).forEach(li => li.classList.toggle('on',
        li.closest('.method').dataset.method === state.method && !!cur && Number(li.dataset.step) === cur.step));
      $$('.seg button', bench).forEach(b => b.setAttribute('aria-pressed', b.dataset.method === state.method));
    };
    const stopAuto = () => { clearTimeout(state.auto); state.auto = 0; };
    // keepTry: the Try one problem stays (walking through it keeps it there to answer).
    const load = (method, p = null, keepTry = false) => {
      stopAuto();
      state.method = method;
      state.p = p || METHODS[method].gen();
      state.steps = METHODS[method].walk(state.p);
      // With reduced motion the whole working shows at once.
      state.at = reduceMotion.matches ? state.steps.length : 0;
      paint(false);
      if (!keepTry) newTry();
    };
    const go = to => { state.at = Math.max(0, Math.min(state.steps.length, to)); paint(); };
    // Plays the working through at reading pace: once by itself the first time a bench is seen,
    // and again whenever Work one is pressed.
    const play = (force = false) => {
      if ((state.played && !force) || reduceMotion.matches) return;
      state.played = true;
      stopAuto();
      state.at = 0;
      paint(false);
      const tick = () => {
        if (state.at >= state.steps.length) { state.auto = 0; return; }
        go(state.at + 1);
        state.auto = setTimeout(tick, 1500);
      };
      state.auto = setTimeout(tick, 700);
    };

    bench.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      stopAuto();
      if (b.dataset.method) load(b.dataset.method);
      else if (b.dataset.act === 'step') go(state.at === state.steps.length ? 1 : state.at + 1);
      else if (b.dataset.act === 'back') go(state.at - 1);
      else if (b.dataset.act === 'new') load(state.method);
    });

    // ---- Try one ----
    const input = $('.answer', tryEl), out = $('.try-out', tryEl);
    const tryState = { p: null, method: null, startAt: 0, times: [], busy: false };
    const idleLine = 'Type the answer. It’s taken the moment it’s right.';
    function newTry() {
      tryState.method = state.method;
      tryState.p = METHODS[state.method].gen();
      tryState.startAt = performance.now();  // from when it appears; reset when you click into the box
      tryState.busy = false;
      $('.q', tryEl).textContent = METHODS[state.method].text(tryState.p);
      $('.try-method', tryEl).textContent = ids.length > 1 ? METHODS[state.method].label : '';
      input.value = '';
      input.classList.remove('right');
      input.disabled = false;
      out.textContent = idleLine;
    }
    input.addEventListener('focus', () => { if (!input.value && !tryState.busy) tryState.startAt = performance.now(); });
    input.addEventListener('input', () => {
      if (tryState.busy) return;
      if (input.value.trim() !== String(METHODS[tryState.method].answer(tryState.p))) return;
      const t = (performance.now() - tryState.startAt) / 1000;
      tryState.times.push(t);
      tryState.busy = true;
      input.classList.add('right');
      const best = Math.min(...tryState.times);
      out.innerHTML = `Right in <span class="t">${t.toFixed(2)} s</span>${tryState.times.length > 1 && t === best ? ' · your quickest yet' : ''}`;
      const avg = tryState.times.reduce((a, b) => a + b, 0) / tryState.times.length;
      $('.try-stats', tryEl).textContent = `${tryState.times.length} solved · ${avg.toFixed(2)} s average`;
      setTimeout(() => { newTry(); input.focus(); }, 900);
    });
    tryEl.addEventListener('click', e => {
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'skip') { newTry(); input.focus(); }
      if (act === 'walk') {
        load(tryState.method, tryState.p, true);
        if (!reduceMotion.matches) go(1);
        if (innerWidth <= 1000) bench.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      }
    });

    load(ids[0], METHODS[ids[0]].first);
    return { play, setMethod: id => load(id, METHODS[id].first), el: bench };
  }
  for (const bay of Object.keys(BAY_METHODS)) benches[bay] = makeBench(bay);

  // "Work one" beside each method in the article puts that method on the bench.
  document.addEventListener('click', e => {
    const w = e.target.closest('[data-work]');
    if (!w) return;
    const bay = w.closest('.bay-panel').dataset.bay, b = benches[bay];
    b.setMethod(w.dataset.work);
    b.play(true);
    if (innerWidth <= 1000) b.el.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });

  // ---- tabs ----
  const BAYS = ['add', 'sub', 'mul', 'div', 'table'];
  const tabs = $$('.bay');
  let current = null;
  function select(bay, { focus = false, scroll = false } = {}) {
    if (!BAYS.includes(bay)) bay = 'add';
    tabs.forEach(t => {
      const on = t.dataset.bay === bay;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$('.bay-panel').forEach(p => {
      const on = p.dataset.bay === bay;
      if (on && p.hidden && current && !reduceMotion.matches) {
        p.classList.remove('enter'); void p.offsetWidth; p.classList.add('enter');
      }
      p.hidden = !on;
    });
    current = bay;
    saved.set('zm-guide-bay', bay);
    if (location.hash !== `#${bay}`) history.replaceState(null, '', `#${bay}`);
    if (scroll) $('.bays').scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    if (benches[bay]) benches[bay].play();
  }
  tabs.forEach(t => t.addEventListener('click', () => select(t.dataset.bay)));
  $('.bays').addEventListener('keydown', e => {
    const i = BAYS.indexOf(current);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: BAYS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    select(BAYS[(to + BAYS.length) % BAYS.length], { focus: true });
  });
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) select(g.dataset.go, { scroll: true });
  });
  window.addEventListener('hashchange', () => select(location.hash.slice(1)));

  // ---- times table ----
  const NUMS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const tt = $('#tt');
  const picked = new Set();
  try { for (const n of JSON.parse(saved.get('zm-guide-rows') || '[]')) if (NUMS.includes(n)) picked.add(n); } catch {}
  tt.innerHTML =
    `<thead><tr><th class="corner" scope="col"><span class="sr">Row times column</span>×</th>${NUMS.map(n => `<th scope="col" data-col="${n}">${n}</th>`).join('')}</tr></thead>` +
    `<tbody>${NUMS.map(r => `<tr data-row="${r}"><th scope="row"><button class="rowh" type="button" data-pick="${r}" aria-pressed="false" aria-label="Pick the ${r} times table for the drill">${r}</button></th>` +
      NUMS.map(c => `<td><button class="cell${r === c ? ' sq' : ''}" type="button" data-r="${r}" data-c="${c}">${r * c}</button></td>`).join('') + '</tr>').join('')}</tbody>`;
  const cells = $$('.cell', tt);
  const hideBox = $('#tt-hide');
  const labelCells = () => cells.forEach(c => {
    const r = c.dataset.r, col = c.dataset.c, hidden = tt.classList.contains('hide') && !c.classList.contains('peek');
    c.setAttribute('aria-label', hidden ? `${r} × ${col}, hidden. Press to show.` : `${r} × ${col} = ${r * col}`);
  });
  const syncPicks = () => {
    $$('.rowh', tt).forEach(b => {
      const on = picked.has(Number(b.dataset.pick));
      b.setAttribute('aria-pressed', on);
      b.closest('tr').classList.toggle('picked', on);
    });
    $('#tt-clear').disabled = !picked.size;
    $('#tt-hint').textContent = picked.size
      ? `Picked: ${[...picked].sort((a, b) => a - b).join(', ')}.`
      : 'Pick row numbers to drill just those rows.';
    saved.set('zm-guide-rows', JSON.stringify([...picked]));
    drill.sync();
  };
  // crosshair: the hovered or focused fact lights its row and column
  const cross = cell => {
    $$('.cell.x, .cell.here', tt).forEach(c => c.classList.remove('x', 'here'));
    $$('tr.x, th.x', tt).forEach(el => el.classList.remove('x'));
    if (!cell) return;
    const r = cell.dataset.r, c = cell.dataset.c;
    cells.forEach(x => { if (x.dataset.r === r || x.dataset.c === c) x.classList.add('x'); });
    cell.classList.add('here');
    $(`tr[data-row="${r}"]`, tt).classList.add('x');
    $(`th[data-col="${c}"]`, tt).classList.add('x');
  };
  tt.addEventListener('pointerover', e => cross(e.target.closest('.cell')));
  tt.addEventListener('pointerleave', () => cross(null));
  tt.addEventListener('focusin', e => cross(e.target.closest('.cell')));
  tt.addEventListener('focusout', () => cross(null));
  tt.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (cell && tt.classList.contains('hide')) { cell.classList.toggle('peek'); labelCells(); }
    const row = e.target.closest('[data-pick]');
    if (row) {
      const n = Number(row.dataset.pick);
      picked.has(n) ? picked.delete(n) : picked.add(n);
      drill.follow();  // picking a row points the drill at the picked rows
      syncPicks();
    }
  });
  tt.addEventListener('keydown', e => {  // arrow keys move around the grid
    const cell = e.target.closest('.cell');
    const move = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
    if (!cell || !move) return;
    const r = NUMS.indexOf(Number(cell.dataset.r)) + move[0], c = NUMS.indexOf(Number(cell.dataset.c)) + move[1];
    if (r < 0 || c < 0 || r >= NUMS.length || c >= NUMS.length) return;
    e.preventDefault();
    $(`.cell[data-r="${NUMS[r]}"][data-c="${NUMS[c]}"]`, tt).focus();
  });
  hideBox.checked = saved.get('zm-guide-hide') === '1';
  const applyHide = () => {
    tt.classList.toggle('hide', hideBox.checked);
    cells.forEach(c => c.classList.remove('peek'));
    saved.set('zm-guide-hide', hideBox.checked ? '1' : '0');
    labelCells();
  };
  hideBox.addEventListener('change', applyHide);
  $('#tt-clear').addEventListener('click', () => { picked.clear(); syncPicks(); });

  // ---- drill: one fact at a time, taken the moment it's right ----
  const drill = (() => {
    const el = $('#drill');
    const opts = { rows: 'all', kind: 'mul', len: '20' };
    try {
      const o = JSON.parse(saved.get('zm-guide-drill') || '{}');
      for (const k of Object.keys(opts)) if (typeof o?.[k] === 'string') opts[k] = o[k];
    } catch {}
    if (!['all', 'picked'].includes(opts.rows)) opts.rows = 'all';
    if (!['mul', 'both'].includes(opts.kind)) opts.kind = 'mul';
    if (!['20', '60'].includes(opts.len)) opts.len = '20';
    let run = null, only = null;  // `only`: a set of slow facts to drill again

    const seg = (key, choices) => `<div class="seg" role="group">${choices.map(([v, l]) => `<button type="button" data-opt="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
    function setup() {
      run = null;
      el.innerHTML =
        `<div class="panel-head"><h3>Drill</h3><span class="sub">Not saved to your tracker</span></div>` +
        `<div class="drill-field"><span>Rows</span>${seg('rows', [['all', 'All rows'], ['picked', 'Picked rows']])}</div>` +
        `<div class="drill-field"><span>Facts</span>${seg('kind', [['mul', 'Times'], ['both', 'Times and divide']])}</div>` +
        `<div class="drill-field"><span>Length</span>${seg('len', [['20', '20 facts'], ['60', '60 seconds']])}</div>` +
        `<button class="drill-start" type="button" data-act="start"><span class="lights" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="go"><b>Start</b><span>Enter</span></span></button>` +
        `<p class="drill-note" id="drill-note"></p>`;
      sync();
    }
    function sync() {
      if (run || !$('[data-act="start"]', el)) return;
      if (opts.rows === 'picked' && !picked.size) opts.rows = 'all';
      $$('[data-opt]', el).forEach(b => {
        b.setAttribute('aria-pressed', opts[b.dataset.opt] === b.dataset.v);
        if (b.dataset.opt === 'rows' && b.dataset.v === 'picked') {
          b.disabled = !picked.size;
          b.textContent = picked.size ? `Picked rows (${picked.size})` : 'Picked rows';
        }
      });
      const rows = opts.rows === 'picked' ? [...picked].sort((a, b) => a - b) : null;
      $('#drill-note', el).textContent = only ? `Drilling your ${only.length} slowest facts from last time.`
        : rows ? `The ${rows.join(', ')} ${rows.length === 1 ? 'row' : 'rows'}, against 2 to 12.` : 'Every fact from 2 × 2 to 12 × 12.';
      saved.set('zm-guide-drill', JSON.stringify(opts));
    }
    // Five lights come on, then go out, and the drill starts (skipped with reduced motion).
    function lightsThen(button, then) {
      const lights = $$('.lights i', button);
      if (reduceMotion.matches || !lights.length || button.classList.contains('arming')) return reduceMotion.matches && then();
      button.classList.add('arming');
      lights.forEach((l, i) => setTimeout(() => l.classList.add('on'), 90 * i));
      setTimeout(then, 90 * lights.length + 160);
    }
    function pool() {
      if (only) return only;
      const rows = opts.rows === 'picked' && picked.size ? [...picked] : NUMS;
      const list = [];
      for (const r of rows) for (const c of NUMS) {
        list.push({ q: `${r} × ${c}`, a: r * c });
        if (opts.kind === 'both') list.push({ q: `${r * c} ÷ ${r}`, a: c });
      }
      return list;
    }
    function start() {
      const facts = pool();
      run = { facts, n: 0, log: [], start: performance.now(), last: '', timed: !only && opts.len === '60', total: only ? Math.min(20, facts.length * 2) : 20, timer: 0 };
      el.innerHTML =
        `<div class="drill-top"><span id="d-prog"></span><button class="btn" type="button" data-act="stop">Stop</button></div>` +
        `<div class="drill-rail"><i id="d-rail"></i></div>` +
        `<div class="drill-q"><span id="d-q"></span><span class="eq">=</span><input class="answer" id="d-in" type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Your answer"></div>` +
        `<p class="drill-note">Esc stops. Nothing here is saved.</p>`;
      const input = $('#d-in', el);
      input.addEventListener('input', () => {
        if (!run || input.value.trim() !== String(run.cur.a)) return;
        run.log.push({ q: run.cur.q, t: (performance.now() - run.shownAt) / 1000 });
        run.n++;
        if (!run.timed && run.n >= run.total) return finish();
        ask();
      });
      input.addEventListener('keydown', e => { if (e.key === 'Escape') finish(); });
      if (run.timed) run.timer = setInterval(progress, 200);
      ask();
      input.focus();
    }
    function progress() {
      if (!run) return;
      if (run.timed) {
        const left = Math.max(0, 60 - (performance.now() - run.start) / 1000);
        $('#d-prog', el).innerHTML = `<b>${Math.ceil(left)}</b> s left · ${run.n} done`;
        $('#d-rail', el).style.width = `${(1 - left / 60) * 100}%`;
        if (left <= 0) finish();
      } else {
        $('#d-prog', el).innerHTML = `<b>${run.n}</b> of ${run.total}`;
        $('#d-rail', el).style.width = `${run.n / run.total * 100}%`;
      }
    }
    function ask() {
      let f;
      do f = run.facts[Math.floor(Math.random() * run.facts.length)]; while (f.q === run.last && run.facts.length > 1);
      run.cur = f; run.last = f.q; run.shownAt = performance.now();
      $('#d-q', el).textContent = f.q;
      $('#d-in', el).value = '';
      progress();
    }
    function finish() {
      if (!run) return;
      clearInterval(run.timer);
      const { log } = run;
      run = null;
      if (!log.length) { only = null; return setup(); }
      const total = log.reduce((s, x) => s + x.t, 0);
      // each fact's slowest time, slowest first
      const worst = new Map();
      for (const x of log) worst.set(x.q, Math.max(worst.get(x.q) || 0, x.t));
      const slow = [...worst.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      el.innerHTML =
        `<div class="panel-head"><h3>Drill done</h3><span class="sub">Not saved to your tracker</span></div>` +
        `<div class="drill-sum"><span class="big">${(total / log.length).toFixed(2)}<small> s</small></span>` +
          `<span class="side"><b>${log.length} ${log.length === 1 ? 'fact' : 'facts'}</b>seconds per fact, ${total.toFixed(1)} s in all</span></div>` +
        `<p class="slow-head">Slowest facts</p>` +
        `<ol class="slow">${slow.map(([q, t]) => `<li><span>${esc(q)}</span><span class="track"><i style="width:${(t / slow[0][1] * 100).toFixed(1)}%"></i></span><span class="t">${t.toFixed(2)} s</span></li>`).join('')}</ol>` +
        `<div class="drill-ctl"><button class="btn go" type="button" data-act="slow">Drill these again</button><button class="btn" type="button" data-act="setup">New drill</button></div>`;
      el.dataset.slow = JSON.stringify(slow.map(([q]) => q));
      $('[data-act="slow"]', el).focus();
    }
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.opt && !b.disabled) { opts[b.dataset.opt] = b.dataset.v; only = null; sync(); }
      else if (b.dataset.act === 'start') lightsThen(b, start);
      else if (b.dataset.act === 'stop') finish();
      else if (b.dataset.act === 'setup') { only = null; setup(); }
      else if (b.dataset.act === 'slow') {
        const qs = JSON.parse(el.dataset.slow || '[]');
        only = qs.map(q => {
          const [x, op, y] = q.split(' ');
          return { q, a: op === '×' ? x * y : x / y };
        });
        start();
      }
    });
    // Enter starts from anywhere on the drill's setup, like the games.
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && $('[data-act="start"]', el) && !e.target.closest('button')) { e.preventDefault(); lightsThen($('[data-act="start"]', el), start); }
    });
    setup();
    return { sync, follow() { if (!run) { opts.rows = 'picked'; only = null; } } };
  })();
  syncPicks();
  applyHide();

  select(location.hash.slice(1) || saved.get('zm-guide-bay') || 'add');
})();
