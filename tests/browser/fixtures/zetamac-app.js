// A stand-in for arithmetic.zetamac.com's game script (dist/app.js), without jQuery: the same
// questions, the same way of taking an answer the moment it's right, and the same end (the
// answer box disabled when the clock runs out). `?end=ms` ends the game early so tests are quick.
const rand = n => Math.floor(Math.random() * n);

export function init(options) {
  const problem = document.querySelector('#game .problem'), answer = document.querySelector('#game .answer');
  const correct = document.querySelector('#game .correct'), left = document.querySelector('#game .left');
  const gen = (min, max) => () => min + rand(max - min + 1);
  const g = { al: gen(options.add_left_min, options.add_left_max), ar: gen(options.add_right_min, options.add_right_max),
    ml: gen(options.mul_left_min, options.mul_left_max), mr: gen(options.mul_right_min, options.mul_right_max) };
  const kinds = [
    () => { const l = g.al(), r = g.ar(); return [`${l} + ${r}`, l + r]; },
    () => { const f = g.al(), s = g.ar(); return [`${f + s} – ${f}`, s]; },
    () => { const l = g.ml(), r = g.mr(); return [`${l} \xD7 ${r}`, l * r]; },
    () => { const f = g.ml(), s = g.mr(); return [`${f * s} \xF7 ${f}`, s]; },
  ];
  let current, score = 0;
  const next = () => {
    const [text, a] = kinds[rand(kinds.length)]();
    current = a;
    problem.textContent = text;
    answer.value = '';
  };
  answer.addEventListener('input', e => {
    if (e.currentTarget.value.trim() === String(current)) {
      next();
      correct.textContent = 'Score: ' + ++score;
    }
  });
  next();
  answer.focus();
  const duration = options.duration || 120;
  left.textContent = 'Seconds left: ' + duration;
  const end = Number(new URLSearchParams(location.search).get('end')) || duration * 1000;
  setTimeout(() => { answer.disabled = true; }, end);
}
