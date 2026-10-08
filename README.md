# Zetamach

A clone of [zetamac](https://arithmetic.zetamac.com) that saves every game, plus a dashboard to track progress over time. I made it to practice for trading interview mental math tests.

**Live:** [matthewc141.github.io/zetamac-tracker](https://matthewc141.github.io/zetamac-tracker/)

## Features

- Same game and default settings as zetamac (2 min, +/−/×/÷), plus 30-second and endless modes
- A daily challenge: the same 2 minutes of questions for everyone each day, one try, with its own board and streak
- Squares mode (two- and three-digit) and practice drills, including one built from your own weak spots that brings back the questions you were slow on until they're quick
- Combined mode: two-step problems like (5 + 2) × (15 + 9)
- Quant tests, marked right minus wrong: 80 in 8 (Optiver-style), number sequences, fractions and estimation
- Duels on the website: ranked (Elo, quarterly seasons) or unranked, a public queue, a private code or a challenge by name, and a ghost race against a saved game when nobody's around
- Per-question timing, so you can see which kinds of problems slow you down, and a replay of any saved game
- Dashboard with score history, daily bests, a calendar heatmap, and slowest question types
- A guide page with mental math shortcuts for each operation and the quant tests
- Optional accounts, public profiles and a leaderboard (all time or this week) on Supabase
- Installs on a phone and plays offline; games played offline while signed in go up when you're back online

## Running locally

The local version is a single C++ program with no dependencies:

```sh
make
./zetamac tracker     # dashboard at http://127.0.0.1:8777
./zetamac             # play in the terminal
./zetamac add 52      # log a score from the real zetamac
./zetamac stats
```

Scores are saved to `scores.csv` next to the binary (set `ZETAMAC_HOME` to change that).

## Website

The same HTML/JS runs as a static site on GitHub Pages. With no server, scores are kept in localStorage, and you can export them from the local version and import them on the site.

Accounts are optional. To turn them on, create a Supabase project, disable email confirmation, run `schema.sql`, and put the project URL and anon key in `cloud.js`.

Errors in the site's scripts are reported to a `client_errors` table (read it in Supabase's table editor).

## Tests

```sh
cd tests && npm install
npm test              # everything, about 3 minutes
npm run test:db       # the database: schema.sql on an in-process Postgres (PGlite)
npm run test:browser  # the website in headless Chrome, against a stand-in Supabase
node run.mjs browser duel   # one file
```

The browser tests need Google Chrome (or set `CHROME` to its path). They run on a fresh stand-in database, a test copy of the site and a scratch local tracker, so they never touch your `scores.csv`. Set `ZM_SHOTS=1` to save screenshots to `tests/shots/`.

## Using your own domain

GitHub Pages can serve the site on a domain you own: add it under the repository's Settings → Pages (this adds a `CNAME` file) and point the domain's DNS at GitHub as that page explains. Then change the address in two places: `ZM_SITE` in `cloud.js` (the links from the local tracker to the website) and the `og:image` address in each page's head (the picture shown when a link is shared). Supabase needs nothing changed.
