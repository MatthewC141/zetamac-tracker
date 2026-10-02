// Offline play for the installed app (and any visit): every page and file is kept as it's
// fetched, and served from here only when the network can't be reached, so an online visit
// always gets the latest version. Scores are handled by the pages themselves (store.js): signed
// out they live in the browser, signed in they wait for a connection to go up.
const CACHE = 'zetamac-v3';
const PAGES = ['./', 'index.html', 'play.html', 'squares.html', 'mixed.html', 'practice.html', 'optiver.html', 'duel.html', 'guide.html',
  'leaderboard.html', 'account.html', 'profile.html', 'cloud.js', 'store.js', 'launch.js', 'launch.css', 'site.css', 'theme.css', 'dashboard.js',
  'game.js', 'play.js', 'squares.js', 'mixed.js', 'practice.js', 'optiver.js', 'problems.js', 'guide.js', 'manifest.webmanifest', 'fonts/Geist-Variable.woff2', 'fonts/GeistMono-Variable.woff2'];

self.addEventListener('install', e => {
  // Best effort: a file that fails to load doesn't stop the rest from being kept.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(PAGES.map(p => c.add(p).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;  // the database, fonts elsewhere: untouched
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
