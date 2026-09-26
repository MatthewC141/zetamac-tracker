# Zetamac tracker

A clone of [arithmetic.zetamac.com](https://arithmetic.zetamac.com) that saves every game, plus a
local dashboard that charts your progress. Everything is one small C++ program with no dependencies.

## Setup

```sh
make            # builds ./zetamac (needs a C++17 compiler)
```

## Use

| Command | What it does |
|---|---|
| `./zetamac tracker` | Opens the dashboard at http://127.0.0.1:8777. Click **Play** for the browser game. |
| `./zetamac` | Plays in the terminal. Enter/Space to go again after each round, `q` to quit. |
| `./zetamac add 52` | Logs a 2-minute score by hand for today (or `./zetamac add 52 2026-09-20`). |
| `./zetamac stats` | Prints today's games, best score, streak and a sparkline. |

## The game

The browser game at `/play` looks and plays like zetamac, including the settings page. Its defaults
are the same as zetamac's:

- **Addition:** (2–100) + (2–100)
- **Subtraction:** addition problems in reverse
- **Multiplication:** (2–12) × (2–100)
- **Division:** multiplication problems in reverse
- **Duration:** 120 seconds

A correct answer is accepted the moment you type it, with no Enter. Games with the default ranges
at 120 or 30 seconds are saved to the tracker. Games with other settings are not saved, so every
score on the chart is comparable.

## Dashboard

- **2-minute games:** daily best, 7-day average and every game, for the past month, 3 months, year
  or all time.
- **30-second games:** a separate chart with a second line projecting each score to a 2-minute game
  (score × 4).
- **Days played:** a calendar of the past year, shaded by each day's best score.
- **Stats:** all-time best, best and average for the chosen range, last 7 days compared with the week
  before, and your streak.
- **Log a score:** add scores from the real zetamac site. Deleting is hidden behind **Edit** on
  the recent games list.

## Data

Scores live in `scores.csv` next to the binary, one row per game:
`timestamp,date,score,seconds,source`. The file is not committed to git. You can edit it by hand or
back it up. Set `ZETAMAC_HOME` to keep the data somewhere else, and `ZETAMAC_NO_OPEN=1` to stop
`tracker` from opening a browser.

The server only listens on 127.0.0.1 and has no login, so don't expose it to the internet.
