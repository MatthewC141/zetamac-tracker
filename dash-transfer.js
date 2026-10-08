// The progress dashboard, part 6 of 9: moving scores between copies of the tracker (export, import).
// ---------- moving scores between copies of the tracker ----------
// Export: every score with its question log, as one JSON file. Import (website only): merges a file in.
if (window.ZM_WEB) {
  $('#import-label').hidden = false;
  $('#move-note').textContent = 'Bring your history over: export it from the tracker on your computer (./zetamac tracker), then import the file here. Export also makes a backup of this browser’s scores.';
}
$('#export').addEventListener('click', async () => {
  const msg = $('#move-msg');
  msg.className = 'msg'; msg.textContent = 'Gathering your games…';
  try {
    const rows = await api('api/scores');
    const scores = [];
    const logs = {};
    const withLog = rows.filter(g => g.detail).map(g => g.ts);
    for (let k = 0; k < withLog.length; k += 100) {  // 100 games a request
      try { Object.assign(logs, (await api(`api/details?ts=${withLog.slice(k, k + 100).map(encodeURIComponent).join(',')}`)).details); } catch {}
    }
    for (const g of rows) {
      const { ts, date, score, seconds, source, mode, elapsed } = g;
      scores.push({ ts, date, score, seconds, source, mode, elapsed, ...(g.detail && Array.isArray(logs[ts]) && { detail: logs[ts] }) });
    }
    const file = new Blob([JSON.stringify({ app: 'zetamac-tracker', version: 1, exported: new Date().toISOString(), scores })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = `zetamach-scores-${dateKey(today())}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg.className = 'msg ok'; msg.textContent = `Exported ${plural(scores.length, 'game')}.`;
  } catch (err) {
    msg.className = 'msg err'; msg.textContent = `Couldn’t export: ${err.message}`;
  }
});
$('#import').addEventListener('change', async e => {
  const file = e.target.files[0], msg = $('#move-msg');
  e.target.value = '';
  if (!file) return;
  if (file.size > 50e6) { msg.className = 'msg err'; msg.textContent = 'That file is too big to be a tracker export (over 50 MB).'; return; }
  msg.className = 'msg'; msg.textContent = 'Importing…';
  try {
    const r = await fetch('api/import', { method: 'POST', headers: { 'X-Zetamac': '1' }, body: await file.text() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Import failed');
    detailCache.clear();
    setGames(data.scores);
    render();
    msg.className = 'msg ok';
    msg.textContent = `Imported ${plural(data.added, 'game')}${data.skipped ? ` · ${data.skipped} already here or unreadable, skipped` : ''}.`;
  } catch (err) {
    msg.className = 'msg err'; msg.textContent = err.message;
  }
});
