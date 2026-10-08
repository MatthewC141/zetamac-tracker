// The progress dashboard, part 9 of 9 (index.html loads dash-*.js first): drawing everything, loading
// the games, the page's controls, the collapsible sections, the dropdowns and the first-visit
// welcome. Kept out of the page so the page's security policy can refuse inline scripts.
function render() {
  renderWeak(); renderScore(); renderO80Line();
  renderStats(); renderChart(); renderPractice(); renderEndless(); renderHeatmap(); renderRecent(); renderBest();
  syncAccount();
  $('#start-here').hidden = !loaded || allGames.length > 0;
}

let loaded = false;  // whether the games could be read at all
async function load() {
  try {
    setGames(await api('api/scores'));
    $('#banner').style.display = 'none';
    loaded = true;
  } catch {
    $('#banner').style.display = 'block';
  }
  render();
}

document.querySelectorAll('.tabs button[data-range]').forEach(b => b.addEventListener('click', () => {
  range = b.dataset.range;
  try { localStorage.setItem('zm-range', range); } catch {}
  renderStats(); renderChart();
}));
document.querySelectorAll('#legend button').forEach(b => {
  b.setAttribute('aria-pressed', !chartHidden.has(b.dataset.series));
  b.addEventListener('click', () => {
    const key = b.dataset.series;
    chartHidden.has(key) ? chartHidden.delete(key) : chartHidden.add(key);
    b.setAttribute('aria-pressed', !chartHidden.has(key));
    try { localStorage.setItem('zm-hidden', JSON.stringify([...chartHidden])); } catch {}
    renderChart();
  });
});
if ([...$('#chart-game').options].some(o => o.value === chartGame)) $('#chart-game').value = chartGame;
else chartGame = 'standard';
$('#chart-game').addEventListener('change', e => {
  chartGame = e.target.value;
  try { localStorage.setItem('zm-chart-game', chartGame); } catch {}
  setGames(allGames);
  renderStats(); renderChart();
});

// A note carried over from the account page (after signing up or logging in).
try {
  const flash = sessionStorage.getItem('zm-flash');
  if (flash) { $('#flash').textContent = flash; $('#flash').hidden = false; sessionStorage.removeItem('zm-flash'); }
} catch {}
// On the website: the account button (kept in step with the sign-in, which can run out).
const syncAccount = () => {
  if (!window.ZM_WEB || !window.ZM_CLOUD?.ready) return;
  const u = window.ZM_CLOUD.user();
  $('#acct-btn').hidden = false;
  $('#acct-btn').textContent = u ? u.name : 'Sign up';
};
syncAccount();
// On the website, scores live only in this browser; say so where scores go in.
if (window.ZM_WEB) $('#log-note').textContent = window.ZM_CLOUD?.user()
  ? `For scores from the zetamac website. Games played here save to your account (${window.ZM_CLOUD.user().name})`
  : 'For scores from the zetamac website. Games played here save themselves, in this browser only; clearing site data erases them';

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderChart(); renderHeatmap(); }, 100); });
window.addEventListener('focus', load);

// ---------- collapsible sections (Practice, Endless runs), remembered per browser ----------
const folded = new Set();
try { for (const k of JSON.parse(localStorage.getItem('zm-folded') || '[]')) folded.add(k); } catch {}
document.querySelectorAll('.collapsible').forEach(panel => {
  const btn = panel.querySelector('.fold'), key = panel.dataset.panel;
  const apply = () => {
    panel.classList.toggle('folded', folded.has(key));
    btn.setAttribute('aria-expanded', !folded.has(key));
  };
  btn.addEventListener('click', () => {
    folded.has(key) ? folded.delete(key) : folded.add(key);
    try { localStorage.setItem('zm-folded', JSON.stringify([...folded])); } catch {}
    apply();
  });
  apply();
});

// Practice and endless runs share a panel; which view shows is remembered.
let drillView = 'practice';
try { drillView = localStorage.getItem('zm-drill-view') || drillView; } catch {}
const showDrillView = () => {
  if (!['practice', 'endless'].includes(drillView)) drillView = 'practice';
  $('#practice-view').hidden = drillView !== 'practice';
  $('#endless-view').hidden = drillView !== 'endless';
  document.querySelectorAll('[data-drill-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.drillView === drillView));
};
document.querySelectorAll('[data-drill-view]').forEach(b => b.addEventListener('click', () => {
  drillView = b.dataset.drillView;
  try { localStorage.setItem('zm-drill-view', drillView); } catch {}
  showDrillView();
}));
showDrillView();

// ---------- custom dropdowns ----------
// Wraps a <select> in a button + listbox that always opens next to the button. The select keeps
// working as before: setting .value updates the button, and picking an option fires 'change'.
function enhanceSelect(sel) {
  const wrap = document.createElement('div');
  wrap.className = 'dd';
  sel.before(wrap);
  wrap.append(sel);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dd-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  const labelEl = sel.id && document.querySelector(`label[for="${sel.id}"]`) || sel.closest('label');
  if (labelEl) btn.setAttribute('aria-label', labelEl.firstChild.textContent.trim());
  btn.innerHTML = '<span></span>';
  const menu = document.createElement('div');
  menu.className = 'dd-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  wrap.append(btn, menu);

  const opts = [];
  for (const node of sel.children) {
    const group = node.tagName === 'OPTGROUP' ? node : null;
    if (group) menu.insertAdjacentHTML('beforeend', `<div class="dd-group" role="presentation">${esc(group.label)}</div>`);
    for (const o of group ? group.children : [node]) {
      const el = document.createElement('div');
      el.className = 'dd-opt';
      el.setAttribute('role', 'option');
      el.textContent = o.textContent;
      el.dataset.value = o.value;
      menu.append(el);
      opts.push(el);
    }
  }

  let active = -1;
  const sync = () => {
    btn.firstChild.textContent = sel.selectedOptions[0]?.textContent || '';
    for (const el of opts) el.setAttribute('aria-selected', el.dataset.value === sel.value);
  };
  // Keep the button in step when code sets sel.value directly.
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); sync(); } });

  const setActive = i => {
    opts[active]?.classList.remove('active');
    active = Math.max(0, Math.min(opts.length - 1, i));
    opts[active].classList.add('active');
    opts[active].scrollIntoView({ block: 'nearest' });
  };
  const open = () => {
    for (const other of document.querySelectorAll('.dd.open')) other.closeDD?.();
    menu.hidden = false;
    menu.style.maxHeight = 'none';
    // Open downward unless there's clearly more room above.
    const r = btn.getBoundingClientRect(), natural = menu.scrollHeight;
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = natural > below && above > below;
    wrap.classList.toggle('up', up);
    menu.style.maxHeight = `${Math.max(120, Math.min(natural, up ? above : below))}px`;
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    setActive(opts.findIndex(el => el.dataset.value === sel.value));
    btn.focus({ preventScroll: true });  // Safari doesn't focus buttons on click; the keys below need it
  };
  const close = (focus = false) => {
    menu.hidden = true;
    wrap.classList.remove('open', 'up');
    btn.setAttribute('aria-expanded', 'false');
    if (focus) btn.focus();
  };
  wrap.closeDD = close;
  const choose = el => {
    close(true);
    if (el.dataset.value === sel.value) return;
    sel.value = el.dataset.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  };

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  // preventDefault: inside a <label>, a click would otherwise also be forwarded to the hidden select.
  menu.addEventListener('click', e => { e.preventDefault(); const el = e.target.closest('.dd-opt'); if (el) choose(el); });
  menu.addEventListener('mousemove', e => { const i = opts.indexOf(e.target.closest('.dd-opt')); if (i >= 0 && i !== active) setActive(i); });
  wrap.addEventListener('keydown', e => {
    if (menu.hidden) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && e.target === btn) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(opts[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close();
  });
  document.addEventListener('mousedown', e => { if (!wrap.contains(e.target)) close(); });
  sync();
}

document.querySelectorAll('main select').forEach(enhanceSelect);
window.addEventListener('resize', () => document.querySelectorAll('.dd.open').forEach(d => d.closeDD()));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.dd.open').forEach(d => d.closeDD(true));
});

// ---------- first-visit welcome (three steps; "How it works" reopens it) ----------
(() => {
  const dlg = $('#welcome');
  const steps = [...dlg.querySelectorAll('.w-step')];
  const track = [...dlg.querySelectorAll('.w-track li')];
  const btn = name => dlg.querySelector(`[data-w="${name}"]:not(#w-look)`);
  let at = 0;
  if (window.ZM_WEB) $('#w-store').textContent = window.ZM_CLOUD?.user()
    ? 'Every game you play saves itself to your account, so your tracker is the same on every device.'
    : 'Every game you play saves itself here, in this browser only. Sign up (no email) to keep your scores on every device and get on the leaderboard.';

  const show = (i, dir = 1) => {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => { s.hidden = k !== at; s.classList.remove('enter'); });
    steps[at].style.setProperty('--from', `${dir * 18}px`);
    void steps[at].offsetWidth;
    steps[at].classList.add('enter');
    track.forEach((li, k) => { li.classList.toggle('done', k < at); k === at ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current'); });
    dlg.setAttribute('aria-labelledby', `w-title-${at}`);
    $('#w-count').textContent = `${at + 1} of ${steps.length}`;
    const last = at === steps.length - 1;
    // Back keeps its place on step one (invisible), so the buttons never move under a finger.
    btn('back').classList.toggle('is-placeholder', at === 0);
    btn('back').disabled = at === 0;
    btn('next').hidden = last;
    $('#w-look').hidden = !last;
    $('#w-play').hidden = !last;
    (last ? $('#w-play') : btn('next')).focus();
  };
  const seen = () => { try { localStorage.setItem('zm-welcome-seen', '1'); } catch {} };
  const open = () => { show(0); dlg.showModal(); show(0); demo.start(); };
  dlg.addEventListener('close', () => { seen(); demo.stop(); });
  dlg.addEventListener('click', e => {
    const w = e.target.closest('[data-w]')?.dataset.w;
    if (w === 'next') show(at + 1, 1);
    else if (w === 'back') show(at - 1, -1);
    else if (w === 'close') dlg.close();
    else if (e.target === dlg) dlg.close();  // a click on the backdrop
  });
  $('#w-play').addEventListener('click', seen);
  dlg.addEventListener('keydown', e => {
    if (e.target.closest('a, button') && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.key === 'ArrowRight') show(at + 1, 1);
    else if (e.key === 'ArrowLeft') show(at - 1, -1);
  });
  $('#help-open').addEventListener('click', open);
  $('#start-help').addEventListener('click', e => { e.preventDefault(); open(); });

  // The example round on step one: a problem is typed out and taken the moment it's right.
  const demo = (() => {
    const probs = [['47 + 38', '85'], ['9 × 64', '576'], ['132 – 57', '75'], ['378 ÷ 7', '54'], ['86 + 29', '115']];
    let timer = 0, running = false;
    const typed = $('#w-typed'), prob = $('#w-prob'), score = $('#w-score');
    const run = (i, n) => {
      const [q, a] = probs[i % probs.length];
      prob.textContent = q; typed.textContent = ''; typed.classList.remove('ok');
      let k = 0;
      const type = () => {
        if (!running) return;
        typed.textContent = a.slice(0, ++k);
        if (k < a.length) { timer = setTimeout(type, 170); return; }
        typed.classList.add('ok'); score.textContent = n + 1;
        timer = setTimeout(() => run(i + 1, n + 1), 650);
      };
      timer = setTimeout(type, 500);
    };
    return {
      start() {
        running = true; clearTimeout(timer);
        if (reduceMotion.matches) { prob.textContent = '47 + 38'; typed.textContent = '85'; typed.classList.add('ok'); score.textContent = '1'; return; }
        score.textContent = '0'; run(0, 0);
      },
      stop() { running = false; clearTimeout(timer); },
    };
  })();

  let first = false;
  try { first = !localStorage.getItem('zm-welcome-seen'); } catch {}
  if (first) open();
})();

load().then(openFromHash);
