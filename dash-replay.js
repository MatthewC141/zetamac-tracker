// The progress dashboard, part 7 of 8: replaying a saved game.
// ---------- replay: a saved game played back question by question ----------
// Each question shows for as long as it took, and its answer appears as it was finished (the log
// has each answer's time, not each keystroke). Long stalls are called out as they pass, and the
// bar under the game is every question's time: click it to jump.
const replay = (() => {
  const dlg = $('#replay');
  let qs = [], starts = [], total = 0, pos = 0, speed = 1, playing = false, last = 0, raf = 0, median = 0, game = null;
  const W = 800, H = 90;
  const at = ms => { let i = starts.findIndex((s, k) => ms < s + qs[k].t); return i < 0 ? qs.length - 1 : i; };
  function drawLine() {
    const top = Math.max(...qs.map(q => q.t), 1), bw = W / qs.length;
    let h = '';
    qs.forEach((q, i) => {
      const y = H - 4 - (q.t / top) * (H - 10);
      h += `<rect class="op-${esc(q.o)}" x="${i * bw + Math.min(1, bw * 0.15)}" y="${y}" width="${Math.max(0.6, bw - Math.min(2, bw * 0.3))}" height="${H - 4 - y}"></rect>`;
    });
    h += `<line class="gridline" x1="0" x2="${W}" y1="${H - 4}" y2="${H - 4}"/><line class="head" x1="0" x2="0" y1="0" y2="${H}"/>`;
    $('#rp-line').setAttribute('viewBox', `0 0 ${W} ${H}`);
    $('#rp-line').innerHTML = h;
  }
  function frame() {
    const i = at(pos), q = qs[i], into = pos - starts[i], done = pos >= total;
    // The answer goes in over the last part of the question's time (at most 0.4 s of it).
    const typing = Math.min(400, q.t * 0.4), shown = done || into >= q.t ? 1 : Math.max(0, (into - (q.t - typing)) / typing);
    const ans = String(q.a), typed = ans.slice(0, Math.round(ans.length * shown));
    const scored = qs.slice(0, i + (done ? 1 : 0)).filter(x => x.r === 'y').length;
    $('#rp-q').textContent = q.q;
    $('#rp-typed').innerHTML = q.r === 'n' && shown >= 1 ? `<s>${esc(q.g)}</s>${esc(ans)}` : q.r === 's' && shown >= 1 ? '<span style="color:#555">skipped</span>' : esc(typed);
    $('#rp-score').textContent = scored;
    $('#rp-clock').textContent = clock(Math.floor(pos / 1000));
    $('#rp-qn').textContent = `Question ${i + 1} of ${qs.length}`;
    const slow = q.t >= median * 2 && q.t >= 1500;
    $('#rp-note').innerHTML = slow && into > median ? `<b>Stall:</b> ${secs(q.t)} s on this one, ${round1(q.t / median)}× your median` : q.c ? `${plural(q.c, 'correction')} on this one` : '';
    const x = (pos / total) * W;
    const head = $('#rp-line .head');
    head.setAttribute('x1', x); head.setAttribute('x2', x);
    $('#rp-line').querySelectorAll('rect').forEach((r, k) => r.classList.toggle('past', k < i));
    $('#rp-play').textContent = playing ? 'Pause' : done ? 'Again' : 'Play';
  }
  function loop(now) {
    if (!playing) return;
    pos = Math.min(total, pos + (now - last) * speed);
    last = now;
    if (pos >= total) playing = false;
    frame();
    if (playing) raf = requestAnimationFrame(loop);
  }
  const play = () => { if (pos >= total) pos = 0; playing = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };
  const pause = () => { playing = false; cancelAnimationFrame(raf); frame(); };
  const seek = ms => { pos = Math.max(0, Math.min(total, ms)); if (playing) last = performance.now(); frame(); };
  const step = d => seek(starts[Math.max(0, Math.min(qs.length - 1, at(pos) + d))]);
  $('#rp-play').addEventListener('click', () => (playing ? pause() : play()));
  $('#rp-prev').addEventListener('click', () => step(into() > 300 ? 0 : -1));
  const into = () => pos - starts[at(pos)];
  $('#rp-next').addEventListener('click', () => step(1));
  $('#rp-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', pause);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  $('#rp-line').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * total); });
  $('#rp-speed').addEventListener('click', e => {
    const b = e.target.closest('[data-speed]');
    if (!b) return;
    speed = Number(b.dataset.speed);
    $('#rp-speed').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
  dlg.addEventListener('keydown', e => {
    if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(into() > 300 ? 0 : -1); }
  });
  return {
    open(list, g) {
      if (!list.length) return;
      qs = list; game = g; let sum = 0;
      starts = qs.map(q => { const s = sum; sum += q.t; return s; });
      total = sum; pos = 0; playing = false;
      const sorted = qs.map(q => q.t).sort((a, b) => a - b);
      median = sorted[Math.floor(sorted.length / 2)] || 1;
      $('#rp-sub').textContent = game ? `${modeName(game.mode)} · ${longDate(parseDate(game.date))} · scored ${game.score}` : '';
      drawLine();
      frame();
      dlg.showModal();
      $('#rp-play').focus();
    },
  };
})();
