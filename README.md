# zetamac-tracker

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
- An optional pace ghost: your best game's score at the same second, beside the clock
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
