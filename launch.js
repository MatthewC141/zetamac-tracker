// Start-screen behavior shared by the three games. It only dresses the page's own controls: every
// input keeps the id the game reads, so each game's settings code works unchanged.
(() => {
  const settings = document.querySelector('#settings');
  const start = document.querySelector('#start');
  if (!settings || !start) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // The dark launcher look applies only while the start screen is showing; the game stays white.
  const syncLaunch = () => document.body.classList.toggle('launch', getComputedStyle(settings).display !== 'none');
  new MutationObserver(syncLaunch).observe(settings, { attributes: true, attributeFilter: ['style'] });
  syncLaunch();

  // Tower rows: the whole row flips its switch or picks its option. Rows that are out (switched
  // off, or an option not picked) dim, and the rows still in are numbered as a running order.
  const rows = [...settings.querySelectorAll('.lt-row')];
  const syncRows = () => {
    let pos = 0;
    rows.forEach(row => {
      const input = row.querySelector('input.switch, input.pick');
      const out = !!input && !input.checked;
      row.classList.toggle('off', out);
      const cell = row.querySelector('.lt-pos');
      if (cell) cell.textContent = out || row.classList.contains('mod') ? '' : ++pos;  // modifiers aren't in the order
    });
  };
  rows.forEach(row => row.addEventListener('click', e => {
    if (e.target.closest('input, label, a, button')) return;
    const input = row.querySelector('input.switch, input.pick');
    if (!input || (input.type === 'radio' && input.checked)) return;
    input.click();
  }));
  settings.addEventListener('change', syncRows);
  syncRows();

  // Length segments write the hidden #duration the game reads, then announce it like a select would.
  const duration = settings.querySelector('#duration');
  settings.querySelectorAll('input[name=len]').forEach(r => r.addEventListener('change', () => {
    duration.value = r.value;
    duration.dispatchEvent(new Event('input', { bubbles: true }));
    duration.dispatchEvent(new Event('change', { bubbles: true }));
  }));

  // Personal best for the armed game and length, from the same scores the tracker shows.
  const best = settings.querySelector('#lt-best');
  let games = [];
  const showBest = () => {
    if (!best || typeof readSettings !== 'function') return;
    const cfg = readSettings();
    const mode = cfg.mode || 'standard';
    const same = cfg.error || mode === 'guided' || cfg.tracked === false ? [] : games.filter(g => (g.mode || 'standard') === mode && g.seconds === cfg.duration);
    const top = same.reduce((m, g) => Math.max(m, g.score), 0);
    best.textContent = same.length ? `Best ${top}${cfg.duration === 0 ? ' questions' : ''}` : '';
  };
  settings.addEventListener('input', () => setTimeout(showBest));
  settings.addEventListener('change', () => setTimeout(showBest));
  // The game's own script (with readSettings) loads after this one, so wait for the page too.
  const parsed = new Promise(r => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', r, { once: true }) : r()));
  fetch('api/scores').then(r => r.json()).then(async d => { await parsed; if (Array.isArray(d)) { games = d; showBest(); } }).catch(() => {});

  // A range moved off zetamac's default is marked, since custom ranges don't save.
  const markRanges = () => settings.querySelectorAll('input.num').forEach(i => i.classList.toggle('changed', i.value !== i.defaultValue));
  settings.addEventListener('input', markRanges);

  // The save line: green when the run counts, yellow when it won't save, red for a settings error.
  const note = settings.querySelector('#custom-note');
  const save = note && note.closest('.lt-save');
  const tone = () => {
    const t = note.textContent;
    save.dataset.tone = /^(Pick|Each range|Division)/.test(t) ? 'error' : /won’t|not saved|Only /.test(t) ? 'warn' : '';
  };
  if (save) { new MutationObserver(tone).observe(note, { childList: true, characterData: true, subtree: true }); tone(); }

  // Enter from anywhere on the start screen starts, except where Enter already means something.
  settings.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.closest('button, a, input[type=color]')) return;
    e.preventDefault();
    start.click();
  });

  // START runs the five-light gantry, lights out, then hands over to the game's own start.
  const lights = [...start.querySelectorAll('.lt-lights i')];
  let armed = false;
  start.addEventListener('click', e => {
    if (armed || reduceMotion.matches || !lights.length) { armed = false; return; }
    e.stopImmediatePropagation();
    start.classList.add('arming');
    lights.forEach((l, i) => setTimeout(() => l.classList.add('on'), 90 * i));
    setTimeout(() => {
      lights.forEach(l => l.classList.remove('on'));
      start.classList.remove('arming');
      armed = true;
      start.click();
    }, 90 * lights.length + 160);
  }, true);
})();

// Fullscreen keeps the game where it was on the screen. Two things move the page's top edge:
// hiding the tabs and toolbar in fullscreen (the page gets taller at the top by their height),
// and leaving the window (the page starts higher on the screen). In fullscreen the game screen is
// pushed down by whichever of these is larger:
//  - how much taller the page is than it was in fullscreen with the tabs showing, which every
//    browser reports truthfully, and
//  - how much higher the page starts than it did in the window, from the window's position on
//    the screen, when the browser reports that truthfully. (Brave doesn't: to stop
//    fingerprinting it reports a toolbar a few pixels tall, so its window position is ignored.)
// (This file loads above the game screen, so the game screen is looked up each time.)
(() => {
  const fullMedia = matchMedia('(display-mode: fullscreen)');
  const isFull = () => fullMedia.matches || !!document.fullscreenElement;
  const height = () => document.documentElement.clientHeight;
  const pageTop = () => window.screenY + (window.outerHeight - window.innerHeight);  // the page's top edge, on the screen
  const load = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  // Remembered between visits, for a game opened while already in fullscreen.
  let windowed = load('zm-windowed');       // { top, chrome }: where the page started, and the toolbar's height
  let tabsShown = load('zm-full-height');   // { w, h }: the page's height in fullscreen with the tabs showing
  let settle = 0;
  const remember = () => {
    if (!isFull()) {
      windowed = { top: pageTop(), chrome: window.outerHeight - window.innerHeight };
      save('zm-windowed', windowed);
    } else if (!tabsShown || tabsShown.w !== innerWidth || height() < tabsShown.h) {
      // The shortest fullscreen page at this width is the one with the tabs showing.
      tabsShown = { w: innerWidth, h: height() };
      save('zm-full-height', tabsShown);
    }
  };
  const place = () => {
    const game = document.querySelector('#game');
    if (!game) return;
    let shift = 0;
    if (isFull()) {
      const byTabs = tabsShown && tabsShown.w === innerWidth ? height() - tabsShown.h : 0;
      const byWindow = windowed && windowed.chrome >= 20 ? windowed.top - pageTop() : 0;
      shift = Math.min(240, Math.max(0, byTabs, byWindow));
    }
    game.style.paddingTop = shift ? `${shift}px` : '';
  };
  // Switching animates through in-between sizes (and the last size event can come before the
  // window stops moving), so the new sizes are only remembered once it settles, and the game is
  // placed again then.
  const hold = () => {
    place();
    clearTimeout(settle);
    settle = setTimeout(() => { remember(); place(); }, 600);
  };
  addEventListener('resize', hold);
  fullMedia.addEventListener('change', hold);
  document.addEventListener('fullscreenchange', hold);
  const first = () => { remember(); place(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', first, { once: true }); else first();
})();
