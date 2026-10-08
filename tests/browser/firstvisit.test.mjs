// A first visit to the website: one clear way to start on the empty progress page, and the
// header's account link saying the same thing on every page.
import { browser, check, done, answerMany, signUp, uniq } from './lib.mjs';

const b = await browser();
await b.go('');
await b.ev(`localStorage.setItem('zm-welcome-seen', '1')`);

await b.go('', 1200);
check('before any game the progress page leads with how to start', await b.shown('#start-here') &&
  /Start with one 2-minute round/.test(await b.text('#start-here')), await b.text('#start-here'));
check('…with a Play 2:00 button', (await b.ev(`document.querySelector('#start-here a.go').getAttribute('href')`)) === 'play.html');
await b.click('#start-help');
check('…and How it works opens the welcome', await b.ev(`!!document.querySelector('dialog[open]')`));
await b.ev(`document.querySelector('dialog[open]').close()`);

await b.go('play.html');
check('signed out, every page’s header offers to sign up', (await b.text('.zh-acct')) === 'Sign up', await b.text('.zh-acct'));
await b.click('#start'); await b.until('running');
await answerMany(b, 2);
await b.ev('finish()');
await b.until(`/Saved|personal best/.test(document.querySelector('#saved').textContent)`);
await b.go('', 1200);
check('after a game the start card is gone', !(await b.shown('#start-here')));

const name = uniq('fv');
await signUp(b, name);
for (const page of ['play.html', 'squares.html', 'optiver.html', 'leaderboard.html', '']) {
  await b.go(page, 900);
  const label = await b.ev(`document.querySelector('.zh-acct')?.textContent`);
  check(`signed in, the header shows the name (${page || 'progress'})`, label === name, label);
}

check('no errors in the pages', b.errors.length === 0, b.errors);
b.close();
done();
