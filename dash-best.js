// The progress dashboard, part 8 of 9: "When you play best", your 2-minute Arithmetic scores (the
// daily challenge and zetamac games included) by time of day and by how many games into a sitting
// you were. Off until you switch it on; the switch is remembered per browser.
const BEST_KEY = 'zm-best-on';
const SITTING_GAP = 30 * 60 * 1000;  // games further apart than this start a new sitting
const BEST_MIN_GAMES = 5;            // below this there's too little to say anything
const BEST_MIN_GROUP = 3;            // a group needs this many games to be called your best
const DAYPARTS = [['Morning', 5, 12], ['Afternoon', 12, 17], ['Evening', 17, 22], ['Night', 22, 5]];
const NTH_GAME = ['1st game', '2nd game', '3rd game', '4th–5th', '6th or later'];

const daypartOf = hour => DAYPARTS.findIndex(([, from, to]) => (from < to ? hour >= from && hour < to : hour >= from || hour < to));
const nthGroupOf = n => (n <= 3 ? n - 1 : n <= 5 ? 3 : 4);

// Each 2-minute Arithmetic game with its hour and its place in the sitting. Every played game counts
// toward a sitting (a round of squares first is still a warm-up); hand-logged scores have no real
// time and are left out.
function sittingGames(list) {
  const played = list.filter(g => g.source !== 'manual').sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const out = [];
  let previous = null, nth = 0;
  for (const g of played) {
    const at = new Date(g.ts);
    nth = previous && at - previous <= SITTING_GAP ? nth + 1 : 1;
    previous = at;
    if ((g.mode === 'standard' || g.mode === 'daily') && g.seconds === 120) out.push({ score: g.score, hour: at.getHours(), nth });
  }
  return out;
}

const groupAverages = (rows, groupOf, labels) => labels.map((label, i) => {
  const scores = rows.filter(r => groupOf(r) === i).map(r => r.score);
  return { label, n: scores.length, avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null };
});
// The group with the highest average, among those with enough games, when there are two to compare.
const bestGroup = groups => {
  const enough = groups.filter(g => g.n >= BEST_MIN_GROUP);
  return enough.length >= 2 ? enough.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
};

function playBest(list) {
  const rows = sittingGames(list);
  const byTime = groupAverages(rows, r => daypartOf(r.hour), DAYPARTS.map(d => d[0]));
  const byGame = groupAverages(rows, r => nthGroupOf(r.nth), NTH_GAME);
  return { n: rows.length, byTime, byGame, bestTime: bestGroup(byTime), bestGame: bestGroup(byGame) };
}

// One sentence for each view, or nothing when there isn't enough to compare.
function bestLines({ byGame, bestTime, bestGame }) {
  const lines = [];
  if (bestTime) lines.push(`You score best in the ${bestTime.label.toLowerCase()}: ${Math.round(bestTime.avg)} on average over ${plural(bestTime.n, 'game')}.`);
  const first = byGame[0];
  if (bestGame && bestGame === first) lines.push('Your first game of a sitting is usually your best.');
  else if (bestGame && first.n >= BEST_MIN_GROUP && bestGame.avg - first.avg >= 1)
    lines.push(`You warm up: your ${bestGame.label.replace(' game', '').replace('–', ' to ')} game of a sitting averages ${Math.round(bestGame.avg - first.avg)} more than your first.`);
  return lines;
}

const bestBars = (title, groups, best) => {
  const top = Math.max(...groups.map(g => g.avg || 0)) || 1;
  return `<div class="best-col"><h3>${title}</h3><ol class="best-bars">${groups.map(g =>
    `<li${g === best ? ' class="is-best"' : ''}><span class="best-label">${g.label}</span>` +
    `<span class="track" aria-hidden="true"><i style="transform:scaleX(${g.avg ? (g.avg / top).toFixed(3) : 0})"></i></span>` +
    `<b>${g.avg === null ? '—' : Math.round(g.avg)}</b><small>${g.n ? plural(g.n, 'game') : 'none yet'}</small></li>`).join('')}</ol></div>`;
};

function renderBest() {
  let on = false;
  try { on = localStorage.getItem(BEST_KEY) === '1'; } catch {}
  $('#best-on').checked = on;
  $('#best-off').hidden = on;
  $('#best').hidden = !on;
  if (!on) return;
  const result = playBest(allGames);
  if (result.n < BEST_MIN_GAMES) {
    $('#best').innerHTML = `<p class="empty-state">Play at least ${BEST_MIN_GAMES} two-minute Arithmetic games to see when you play best (${result.n} so far).</p>`;
    return;
  }
  const lines = bestLines(result);
  $('#best').innerHTML = (lines.length ? `<div class="best-lines">${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : '') +
    `<div class="best-grid">${bestBars('Time of day', result.byTime, result.bestTime)}${bestBars('Game of the sitting', result.byGame, result.bestGame)}</div>` +
    `<p class="best-note">Average 2-minute Arithmetic score. A sitting is games less than 30 minutes apart.</p>`;
}

$('#best-on').addEventListener('change', e => {
  try { localStorage.setItem(BEST_KEY, e.target.checked ? '1' : '0'); } catch {}
  renderBest();
});
