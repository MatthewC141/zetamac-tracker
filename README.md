# Zetamac tracker

A clone of [arithmetic.zetamac.com](https://arithmetic.zetamac.com) that saves every game, plus a
local dashboard that charts your progress. Everything is one small C++ program with no dependencies.

**Try it online:** [matthewc141.github.io/zetamac-tracker](https://matthewc141.github.io/zetamac-tracker/)
(scores stay in your own browser; see [Website](#website)).

## Setup

```sh
make            # builds ./zetamac (needs a C++17 compiler)
```

## Use

| Command | What it does |
|---|---|
| `./zetamac tracker` | Opens the dashboard at http://127.0.0.1:8777/. Click **Play** for the browser game. |
| `./zetamac` | Plays in the terminal. Enter/Space to go again after each round, `q` to quit. |
| `./zetamac add 52` | Logs a 2-minute score by hand for today (or `./zetamac add 52 2026-09-20`). |
| `./zetamac stats` | Prints today's games, best score, streak and a sparkline. |

## The game

The browser game (`play.html`) looks and plays like zetamac, including the settings page. Its defaults
are the same as zetamac's:

- **Addition:** (2–100) + (2–100)
- **Subtraction:** addition problems in reverse
- **Multiplication:** (2–12) × (2–100)
- **Division:** multiplication problems in reverse
- **Duration:** 120 seconds

A correct answer is accepted the moment you type it, with no Enter. Games with the default ranges
at 120 or 30 seconds, or endless, are saved to the tracker. Games with other settings are not saved, so every
score on the chart is comparable.

## Squares game

`squares.html` (the **Squares** button) asks for two-digit squares (1–99) or three-digit squares
(100–999). **Hard mode** skips numbers ending in 5, and for two-digit squares also skips 1–20. Games
at 120 or 30 seconds, or endless, are saved, and each of the four modes gets its own chart on the dashboard.

## Practice

`practice.html` (the **Practice** button) drills one kind of problem, untimed by default (120 and 30
seconds are options). Problems come from zetamac's subtraction range:

- **Subtraction with borrowing:** the ones digit being subtracted is bigger, like 62 – 17.
- **Subtraction without borrowing:** every other case, like 68 – 23 or 64 – 24.

The dashboard's **Practice** section shows each drill's games, bests, and average time per question.

## Guide

`guide.html` (the **Guide** button) explains the quickest mental method for each operation, one tab
each: carrying in addition; subtraction with and without borrowing (counting up, or taking the
leftover from 10); multiplication by splitting the big number, plus the × 11 shortcut; and division
by finding the round multiple underneath. Each tab has a worked problem you can step through and a
**Try one** box. The **Times table** tab has a 2–12 grid (hide it to test yourself) and a drill that
ends with your slowest facts. Nothing on the guide page is saved to the tracker.

## Endless mode

Pick **Endless** as the length in any of the three games to play with no timer. The clock counts up, and you
stop with **Stop** or Esc. Each run saves how many questions you answered and how long it took. The
dashboard's **Endless runs** section shows your longest run for arithmetic, squares and practice, your
total endless questions, and your top 10 runs with their seconds per problem.

## Question-by-question times

Every browser game records how long each question took and how many times you backspaced. In
**Recent games**, click a game marked ▶ to expand it: average, median, fastest and slowest times,
your average for each operation, a bar per question, and the full list of questions (sortable
slowest first). The **See breakdown** link on the end screen opens the same view. The data lives in
`details/`, one JSON file per game (on the website, in the browser with the scores).

## Dashboard

- **Weak spots:** the four operations ranked by seconds per question, slowest first, for your last
  game, last 10 games or all time, plus your slowest question types (like × 7 or + with a carry).
- **2-minute score:** your best this week against the target of 80, and your last 10 games.
- **2-minute games:** daily best, 7-day average and every game, for the past month, 3 months, year
  or all time.
- **30-second games:** a separate chart with a second line projecting each score to a 2-minute game
  (score × 4).
- **Days played:** a calendar of the past year, shaded by each day's best score.
- **Stats:** all-time best, best and average for the chosen range, last 7 days compared with the week
  before, and your streak.
- **How it works:** a short guide that opens on your first visit and from the button in the header.
- **Log a score:** add scores from the real zetamac site. Deleting is hidden behind **Edit** on
  the recent games list.

## Data

Scores live in `scores.csv` next to the binary, one row per game:
`timestamp,date,score,seconds,source,mode,elapsed`. The file is not committed to git. You can edit it by hand or
back it up. Set `ZETAMAC_HOME` to keep the data somewhere else, and `ZETAMAC_NO_OPEN=1` to stop
`tracker` from opening a browser.

The server only listens on 127.0.0.1 and has no login, so don't expose it to the internet.

## Website

The same pages also work as a static website, such as GitHub Pages. With no server behind them,
`store.js` keeps each visitor's scores in their own browser (localStorage), so everyone starts with
an empty tracker and no one sees anyone else's scores. Clearing site data, a private window or a
different device starts fresh. Opened through `./zetamac tracker`, the pages use `scores.csv` as
usual.

To publish: on GitHub, **Settings → Pages → Deploy from a branch**, branch `main`, folder `/ (root)`.
The site appears at `https://<user>.github.io/<repo>/`.
