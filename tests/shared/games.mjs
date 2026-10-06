// Real games for the tests: the site's own question generator (problems.js), run here, and logs
// shaped the way the game pages save them.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const box = { window: {}, Math, Number, String, Array, Object, JSON };
vm.runInNewContext(fs.readFileSync(ROOT + 'problems.js', 'utf8'), box);
export const P = box.window.ZM_PROBLEMS;

// n answered questions from a game's list, each taking `t` ms: what an arithmetic-style game logs.
export const arithLog = (game, seed, n, t = 1500) =>
  P.list(game, seed, n).map(p => ({ q: p.q, a: p.a, o: p.o, c: 0, t }));

// A quant test: `answers(p, i)` gives what was typed for each question ('' skips it). Marks
// each the way optiver.js does, and returns { detail, score }.
export function testLog(game, seed, answers, t = 3000) {
  const qs = P.list(game, seed, P.TESTS[game].count);
  const shown = p => (p.tol ? String(Number(p.a.toPrecision(3))) : P.fmt(p.a));
  const detail = [];
  let y = 0, n = 0;
  qs.forEach((p, i) => {
    const g = answers(p, i);
    if (g === undefined) return;  // not reached
    const r = g === '' ? 's' : P.isRight(p, Number(g)) ? 'y' : 'n';
    if (r === 'y') y++; else if (r === 'n') n++;
    detail.push({ q: p.q, a: shown(p), o: p.o, g, r, c: 0, t });
  });
  return { detail, score: Math.max(0, y - n) };
}
