// For screen readers during a game: a hidden live region the games speak through (each new
// question in words, the time at a few points, the result), so a game can be played by ear. It
// isn't seen, so the game screen looks the same.
window.zmSay = (() => {
  let el = null;
  // A question in words: "54 + 87" → "54 plus 87", "13²" → "13 squared".
  const words = q => String(q).replace(/(\d+)²/g, '$1 squared').replace(/√/g, 'square root of ')
    .replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/[–−]/g, ' minus ').replace(/\+/g, ' plus ')
    .replace(/% of/g, ' percent of').replace(/\s+/g, ' ').trim();
  const say = text => {
    if (!el) {
      el = document.createElement('div');
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.id = 'sr-say';
      Object.assign(el.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' });
      document.body.append(el);
    }
    el.textContent = text;
  };
  say.question = q => say(words(q));
  // Time left, said at a minute, 30 and 10 seconds (each once a game).
  let said = new Set();
  say.clock = left => {
    if (![60, 30, 10].includes(left) || said.has(left)) return;
    said.add(left);
    say(`${left} seconds left`);
  };
  say.reset = () => { said = new Set(); };
  say.words = words;
  return say;
})();
