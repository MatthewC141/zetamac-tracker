# Product

## Platform

web

## Users

The owner (primary): a student training mental arithmetic for quant and trading interview screens (SIG, Optiver, Jane Street style), playing zetamac rounds most days and checking progress between sessions on a laptop. A few friends will use it soon, each tracking their own scores; for now it runs locally for one person.

## Product Purpose

A zetamac clone plus a progress tracker. The games (arithmetic, squares, subtraction practice) record every round and every question's timing; the tracker turns that record into a clear answer to "am I getting faster, and what's holding me back?" Success is reaching and holding a 2-minute arithmetic score of 80+, the common bar for trading-firm screens.

## Positioning

The real zetamac shows one score and forgets it. This keeps every round, times every question, and breaks performance down by operation and drill, so weak spots (slow division, borrowing subtraction) are visible and trainable.

## Operating Context

- Played in short daily sessions; the dashboard is opened between rounds or at the end of a session.
- Scores come from the browser games (auto-saved), the C++ terminal game, or are logged by hand from the real arithmetic.zetamac.com.
- Game modes: arithmetic (zetamac defaults: add/sub 2–100, mul/div 2–12 × 2–100), two- and three-digit squares (normal and hard), subtraction drills (with / without borrowing), guided arithmetic (off the start screen for now; earlier guided games stay saved but hidden).
- Website accounts (username + password, no email; Supabase) sync scores across devices; a public leaderboard (leaderboard.html) shows personal bests per board, counting only games played on the site whose question logs pass server-side checks.
- A method guide (guide.html) teaches the quickest mental route for each operation and has a times-table grid and drill; it replaces guided mode as the teaching surface and saves nothing.
- Lengths: 120 seconds (the canonical score), 30 seconds (projected ×4 to 2 minutes), and endless (questions answered and seconds per problem).

## Capabilities and Constraints

- Single local C++ server (`./zetamac tracker`) serving static HTML pages and a small JSON API; data in `scores.csv` plus `details/*.json` per-question timings. No build step, no external JS libraries; pages are plain HTML/CSS/JS.
- Dashboard features to preserve: per-game stats and score chart (range tabs, toggleable lines, 30-second projection overlay), practice drill table, endless-run records, days-played calendar, manual score logging, recent games with filters, sorting, per-question breakdowns, hidden edit/delete.
- The in-game question and end screens deliberately copy arithmetic.zetamac.com's white look; the games' start screens use the dashboard's live-timing world.
- Public hosting is a static site (GitHub Pages): with no server, `store.js` keeps each visitor's scores in their own browser, so everyone starts with an empty tracker.

## Evidence on Hand

- Real score history in `scores.csv` (from August 2026 onward, ~70 games) and per-question timing files in `details/`.
- No testimonials, users beyond the owner, or published results exist; do not invent any.

## Product Principles

1. The 2-minute arithmetic score is the headline; everything else explains it.
2. Show the gap to the target (80) and the trend, not just raw numbers.
3. Make weak spots findable: per-operation and per-question timing beats totals.
4. Fast to glance at between rounds; details on demand.
5. Every game is honest data: keep separate what isn't comparable (30 s, endless, guided, squares).
