# zetamac-tracker

A clone of [zetamac](https://arithmetic.zetamac.com) that saves every game, plus a dashboard to track progress over time. I made it to practice for trading interview mental math tests.

**Live:** [matthewc141.github.io/zetamac-tracker](https://matthewc141.github.io/zetamac-tracker/)

## Features

- Same game and default settings as zetamac (2 min, +/−/×/÷), plus 30-second and endless modes
- Squares mode (two- and three-digit) and a subtraction-with-borrowing drill
- Per-question timing, so you can see which kinds of problems slow you down
- Dashboard with score history, daily bests, a calendar heatmap, and slowest question types
- A guide page with mental math shortcuts for each operation
- Optional accounts and a leaderboard (Supabase)

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
