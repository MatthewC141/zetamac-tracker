---
name: Zetamac Live Timing
description: A mental-arithmetic progress tracker read like an F1 live-timing screen.
colors:
  timing-black: "#0b0c10"
  panel: "#13141a"
  raise: "#1b1c24"
  grid-rule: "#1c1e26"
  hairline: "#262833"
  hairline-hover: "#3d4050"
  menu-surface: "#1d1e27"
  menu-edge: "#333645"
  menu-active: "#2a2c38"
  figure-white: "#f2f3f5"
  muted-grey: "#9a9eab"
  prose: "#c7cad3"
  dim: "#4a4d58"
  projection-silver: "#b9bfcc"
  neutral-bar: "#6b7080"
  sector-purple: "#b561ff"
  sector-green: "#22d764"
  sector-yellow: "#ffd21f"
  signal-red: "#ff5147"
  team-add: "#2fd0f5"
  team-sub: "#ff5147"
  team-mul: "#6d8bff"
  team-div: "#ff62b8"
  team-sq: "#ffa53d"
  heat-0: "#181a21"
  heat-1: "#2c303c"
  heat-2: "#545a6b"
  heat-3: "#969cad"
  heat-4: "#eceef2"
  scrim: "rgba(5, 6, 8, .78)"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "104px"
    fontWeight: 700
    lineHeight: 0.82
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  start-word:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 0.85
    letterSpacing: "0.01em"
  dialog-headline:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tnum"
  guide-headline:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  bench-figure:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "54px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  method-heading:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.1
  lede:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.5
  step-title:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  prose:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.55
  board-headline:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
  account-name:
    fontFamily: "Barlow Semi Condensed, Titillium Web, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.01em"
  wordmark:
    fontFamily: "Titillium Web, Barlow Semi Condensed, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
  label-section:
    fontFamily: "Titillium Web, Barlow Semi Condensed, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
  label-control:
    fontFamily: "Titillium Web, Barlow Semi Condensed, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.12em"
  label-field:
    fontFamily: "Titillium Web, Barlow Semi Condensed, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
rounded:
  hair: "1px"
  inner: "2px"
  control: "3px"
  panel: "4px"
  round: "50%"
spacing:
  xs: "4px"
  sm: "6px"
  md: "12px"
  panel-gap: "14px"
  lg: "18px"
  panel-x: "20px"
  xl: "22px"
components:
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "18px 20px 20px"
  nav-button:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.figure-white}"
    typography: "{typography.label-control}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  nav-button-go:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.timing-black}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.timing-black}"
    typography: "{typography.label-control}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
  segmented:
    backgroundColor: "{colors.timing-black}"
    rounded: "{rounded.control}"
    padding: "2px"
  segmented-option:
    textColor: "{colors.muted-grey}"
    typography: "{typography.label-control}"
    rounded: "{rounded.inner}"
    padding: "7px 11px"
  segmented-option-selected:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.figure-white}"
  input:
    backgroundColor: "{colors.timing-black}"
    textColor: "{colors.figure-white}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 11px"
  dropdown-menu:
    backgroundColor: "{colors.menu-surface}"
    rounded: "{rounded.panel}"
    padding: "4px"
  dropdown-option-active:
    backgroundColor: "{colors.menu-active}"
    textColor: "{colors.figure-white}"
    rounded: "{rounded.inner}"
    padding: "8px 10px"
  tower-row:
    height: "46px"
    padding: "0 10px 0 6px"
  tower-row-fact:
    height: "38px"
  lap-tile:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.figure-white}"
    rounded: "{rounded.inner}"
    padding: "8px 0 7px"
  legend-toggle:
    textColor: "{colors.muted-grey}"
    rounded: "{rounded.control}"
    padding: "7px 11px 7px 9px"
  pb-badge:
    backgroundColor: "{colors.sector-purple}"
    textColor: "{colors.timing-black}"
    rounded: "{rounded.inner}"
    padding: "3px 4px 2px"
  button-outline:
    textColor: "{colors.muted-grey}"
    typography: "{typography.label-control}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  launch-row:
    height: "64px"
    padding: "10px 6px 10px 4px"
  switch:
    backgroundColor: "{colors.hairline}"
    rounded: "{rounded.control}"
    width: "44px"
    height: "24px"
  switch-on:
    backgroundColor: "{colors.figure-white}"
  switch-thumb:
    backgroundColor: "{colors.muted-grey}"
    rounded: "{rounded.inner}"
    size: "18px"
  switch-thumb-on:
    backgroundColor: "{colors.timing-black}"
  choice-ring:
    rounded: "{rounded.round}"
    size: "24px"
  range-field:
    backgroundColor: "{colors.timing-black}"
    textColor: "{colors.figure-white}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    width: "52px"
    height: "32px"
  range-field-changed:
    textColor: "{colors.sector-yellow}"
  length-option:
    textColor: "{colors.muted-grey}"
    rounded: "{rounded.inner}"
    padding: "12px 6px 11px"
  length-option-selected:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.figure-white}"
  start-slab:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.timing-black}"
    typography: "{typography.start-word}"
    rounded: "{rounded.panel}"
    padding: "20px"
  start-gantry:
    backgroundColor: "{colors.timing-black}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  start-light:
    backgroundColor: "{colors.raise}"
    rounded: "{rounded.round}"
    size: "22px"
  start-light-on:
    backgroundColor: "{colors.signal-red}"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.figure-white}"
    rounded: "{rounded.panel}"
    width: "min(760px, calc(100vw - 32px))"
    height: "min(660px, calc(100dvh - 32px))"
  dialog-well:
    backgroundColor: "{colors.timing-black}"
    rounded: "{rounded.panel}"
    padding: "14px 16px 16px"
  dialog-button-go:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.timing-black}"
    typography: "{typography.label-control}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  dialog-button-ghost:
    textColor: "{colors.muted-grey}"
    typography: "{typography.label-control}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  step-bar:
    backgroundColor: "{colors.hairline}"
    rounded: "{rounded.hair}"
    height: "3px"
  step-bar-done:
    backgroundColor: "{colors.neutral-bar}"
  step-bar-current:
    backgroundColor: "{colors.sector-purple}"
  bay-bar:
    backgroundColor: "{colors.timing-black}"
    rounded: "{rounded.control}"
    padding: "2px"
  bay-tab:
    textColor: "{colors.muted-grey}"
    rounded: "{rounded.inner}"
    padding: "12px 14px 12px 12px"
  bay-tab-selected:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.figure-white}"
  step-row:
    textColor: "{colors.prose}"
    typography: "{typography.prose}"
    padding: "14px 8px 14px 0"
  bench-button:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.figure-white}"
    typography: "{typography.label-control}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  mark-chip:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.figure-white}"
    rounded: "{rounded.inner}"
    padding: "3px 5px"
  answer-field:
    backgroundColor: "{colors.timing-black}"
    textColor: "{colors.figure-white}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    width: "150px"
    height: "56px"
  answer-field-right:
    textColor: "{colors.sector-green}"
  table-cell:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.prose}"
    rounded: "{rounded.inner}"
    height: "38px"
  table-cell-here:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.timing-black}"
  drill-start:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.timing-black}"
    rounded: "{rounded.panel}"
    padding: "18px 20px"
  aside-note:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.prose}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  fact-row-all:
    height: "34px"
  status-flash:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.figure-white}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-raise:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.figure-white}"
    typography: "{typography.label-control}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  button-danger:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.signal-red}"
    typography: "{typography.label-control}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  slab:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.timing-black}"
    rounded: "{rounded.panel}"
    padding: "18px 20px"
  standings-row:
    textColor: "{colors.figure-white}"
    padding: "12px 12px 12px 10px"
  standings-row-selected:
    backgroundColor: "{colors.raise}"
  classification-row:
    textColor: "{colors.figure-white}"
    height: "48px"
    padding: "6px 12px 6px 6px"
  classification-row-you:
    backgroundColor: "{colors.raise}"
  you-tag:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.timing-black}"
    rounded: "{rounded.inner}"
    padding: "3px 5px"
  account-field:
    backgroundColor: "{colors.timing-black}"
    textColor: "{colors.figure-white}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "48px"
---

# Design System: Zetamac Live Timing

## Overview

**Creative North Star: "The Live Timing Tower"**

The tracker dashboard is an F1 live-timing screen. The four arithmetic operations are drivers, each question is a sector, and the page leads with the timing tower: operations ranked slowest first, each with a position number, a team stripe, a three-letter code (ADD, SUB, MUL, DIV), a bar, its seconds per question, and its gap to the fastest. Everything sits on a near-black ground in flat panels divided by hairlines, with white tabular figures and one small vocabulary of bright, meaningful color.

The screen is dense and quick to read. Numbers carry the page; labels stay small, uppercase and tracked, and step aside. Color is information: sector purple, green and yellow say best, improved and slower, and team colors say which operation you are looking at. Everything else is greyscale. The one oversized element is the current 2-minute score, set against a TARGET 80 rail.

The same world carries the pre-session moment. Each game's start screen is the timing tower before the race: every operation or mode is a driver row you switch in or out, the length is a segmented control of big figures, and START is a white slab carrying a five-light gantry. A first-visit welcome dialog on the dashboard explains the product in three steps inside the same flat, hairlined panel language.

The same world also carries a read-mode surface: the guide is the garage. Each operation (and the times table) is a bay, picked from a five-tab bay bar. A bay reads as a short article (one-line headline, lede, numbered steps) beside a worked problem that fills in step by step and a problem you solve yourself. Reading is the one place long-form prose appears, so it takes a softer prose ink and a larger, looser body size; figures, labels, stripes and sector colors behave exactly as on the dashboard.

The website adds two more surfaces in the same world. The leaderboard is the classification: it opens on your standings (one row per board, with your place and how many points take the next one) beside the full classification of the board you pick, where your own row is lit. The account page is taking a seat on the grid: you type a name and watch it write itself into the tower row you will appear as; signed in, it shows your name at display size, a few plain settings rows and your places on the boards.

Scope: this system governs the tracker dashboard (`index.html`, including its welcome dialog), the guide (`guide.html`), the leaderboard (`leaderboard.html`), the account page (`account.html`), the shared stylesheet those two pages are built on (`site.css`: tokens, strip, panels, segments, buttons, the white slab, the aside note and tower rows) and the start/settings screen of all three games (`play.html`, `squares.html`, `practice.html`). On the game pages it applies only while the start screen shows: the page body carries a launch state then, and the dark ground, fonts and tokens are scoped to it. The in-game question screen and the end screen deliberately keep arithmetic.zetamac.com's plain white look. They sit outside this system and must not take on its tokens, and this system must not be bent to match them.

**Key Characteristics:**
- Near-black ground, flat panels, 1px hairline rules; no drop shadows on surfaces.
- Tabular condensed figures for every number; tracked uppercase Titillium for every label.
- Sector colors (purple / green / yellow) carry meaning, never decoration.
- Each operation always shows its team color, as a 4px stripe or a tag.
- Tight corners (1-4px); controls look like timing-screen hardware, not soft SaaS pills. Circles appear only where the real object is round: dots, start lights, the single-choice ring.

## Colors

A greyscale timing screen with two small families of saturated ink: sector semantics and team identity.

### Primary
- **Figure White** (figure-white): every number and primary text; also fills the one solid call-to-action per surface (Play, Add score, the START slab, the welcome's Next / Play a 2-minute round) and the "on" track of a switch, so the main action and the live state read as the brightest objects. The same white fills the slab on the leaderboard and account pages (Sign up, Log in), the small YOU tag on your leaderboard row, and the stripe of the arithmetic boards.
- **Sector Purple** (sector-purple): "best of the field": the fastest operation, a lap that set a new best, personal-best dots and the PB badge. It also marks the target (the dashed 80 line, the TARGET 80 rail mark and label) and the system's selection state: the underline on a selected segment or game tab, the current step bar in the welcome track, the open-dropdown border, the selected-option bar, the focused range field's border, the focus ring, the text caret and text selection, and the in-progress answer underline in the welcome's example round. On the leaderboard, purple is the P1 figure (best of the field) and the underline of the selected standings row; on the account page it is the focused field's border.

### Secondary
- **Sector Green** (sector-green): improved on its previous window, a lap up on form, a fast question in the breakdown, an upward readout delta, a success message, the save-line dot when a run will count, the example answer's underline once it is right, and the dot on the status line after signing in.
- **Sector Yellow** (sector-yellow): slower than its previous window, a lap down on form, a slow question, a downward readout delta, and the "N to go" gap to target. On the start screen it is the caution ink: a range field moved off zetamac's default, and the save-line dot when a run won't save.
- **Signal Red** (signal-red): errors (the server banner edge, form errors, delete hover, the save-line dot and white text for a settings error, an invalid account field's border), the Delete account button's text (and its border on hover), the session dot in the timing strip, and the lit sockets of the start gantry.

### Tertiary (team colors)
- **Team Add Cyan** (team-add), **Team Sub Red** (team-sub), **Team Mul Blue** (team-mul), **Team Div Pink** (team-div), **Team Squares Orange** (team-sq): each operation's identity. They fill the 4px tower stripe (dashboard and start screens), the breakdown operation keys and bars, and the per-game tags in results (30 s games in add cyan, squares in orange, practice drills in sub red). Squares start-screen rows all take the orange stripe; practice drills take sub red. Team Sub Red is the same value as Signal Red. On the guide, the times-table bay (not an operation) takes a figure-white stripe. Leaderboard boards are identified the same way: arithmetic boards (2:00 and 0:30) take a figure-white stripe, the four squares boards Team Squares Orange, and the endless board Projection Silver.

### Neutral
- **Timing Black** (timing-black): page ground, and the inset well behind segmented controls, game tabs, inputs, range fields, dropdown buttons, the start gantry and the welcome's example panels.
- **Panel** (panel): every section surface, and the welcome dialog.
- **Raise** (raise): one step up: lap tiles, selected segment or tab, secondary nav buttons, hovered and open result rows, the expanded breakdown, and the unlit start-light sockets.
- **Grid Rule** (grid-rule) and **Hairline** (hairline): row dividers and chart gridlines use grid-rule; panel borders, control borders, table header rules and the switch's "off" track use hairline. **Hairline Hover** (hairline-hover) is the border on hover, the dialog's border, the unchecked choice ring and the light-socket ring.
- **Neutral Bar** (neutral-bar): a bar with no comparison yet (the tower bar fallback) and completed steps in the welcome track.
- **Prose** (prose): long-form reading text on the guide: the lede, method paragraphs, step bodies, aside notes, and the times-table cell figures. It sits between muted grey and figure white so paragraphs read comfortably without competing with the figures; key figures inside a sentence lift to figure white 600.
- **Dim** (dim): what isn't known or isn't available yet: placeholder answer digits before a step fills them, the "=" between problem and answer, disabled controls, the hide-answers dot in the times table, the ENTER hint on a white START slab, the "—" place on a board you aren't on, and the "your name" placeholder in the account preview row.
- **Menu Surface / Menu Edge / Menu Active**: the floating dropdown menu, its border, and the keyboard/pointer-active option.
- **Muted Grey** (muted-grey): labels, units, gaps, axis text, secondary copy, the switch thumb when off, and the name, time and "too few" of an unranked question type.
- **Projection Silver** (projection-silver): the dotted 30-second ×4 projection line, the Endless tag, and the endless board's stripe on the leaderboard and account pages.
- **Heat 0-4**: the days-played calendar ramp, from empty day to highest best. It stays greyscale.
- **Scrim** (scrim): the backdrop behind the modal welcome dialog.

### Named Rules
**The Sector Rule.** Purple, green and yellow mean best, improved and slower (and, on the start screen, counts / won't save / changed-from-default). They are never used for decoration, and a number only takes a sector color when the data or the setting earned it. A row with no comparison yet stays neutral grey (neutral-bar).

**The Team Stripe Rule.** An operation never appears without its team color. The color sits on a 4px stripe or a small tag, never as a fill for the whole row and never on a figure: Team Sub Red is Signal Red, and a red number reads as an error.

**The Ranked Stripe Rule.** A stripe ranks or identifies: it sits on tower rows, bays, steps and boards. Rows that describe (welcome key / value rows, the account's settings rows, the "What counts" list, aside notes) never take a side stripe.

**The Dim Rule.** Dim ink marks what is not there yet (a placeholder digit, a disabled control, the equals sign). It is never used for text someone has to read to proceed; instructions and step numbers stay at muted grey or brighter.

**The Greyscale Archive Rule.** Chart lines, the calendar heat ramp and table text stay white and grey. Color in the archive is reserved for sector and team meaning, target purple and PB marks.

## Typography

**Label Font:** Titillium Web (self-hosted 400/600/700; falls back to Barlow Semi Condensed, system-ui)
**Figure/Body Font:** Barlow Semi Condensed (self-hosted 400/500/600/700; falls back to Titillium Web, system-ui), with `font-variant-numeric: tabular-nums` set on the body

**Character:** Titillium's squared, technical uppercase labels paired with Barlow's narrow, upright figures. Together they read like broadcast timing graphics, and the tabular figures keep columns of times aligned.

### Hierarchy
- **Display** (700, 104px, line-height 0.82, -0.02em; 84px under 640px): the current 2-minute score only.
- **Start Word** (Barlow 700, 64px, line-height 0.85, 0.01em, uppercase; 46px under 600px): "START" on the start slab, the only word set in the figure face at display size.
- **Dialog Headline** (Barlow 700, 34px, line-height 1.02, -0.01em, sentence case, balanced, max 20ch; 28px under 640px): the one sentence headline per welcome step.
- **Headline** (700, 30px): the gap to target ("9 to go"). Sibling figures at 38px (the welcome's example problem), 26px (endless summary, the length figures 0:30 / 2:00 / ∞) and 19px (breakdown stats) sit around headline and title.
- **Title** (700, 21px): tower times. Fact times drop to 18px, lap tiles are 18px (15px on mobile), and emphasized inline figures in the readout, form average and table scores are 17px. Start-screen row names are Barlow 600 17px; range-field figures are 600 16px.
- **Body** (500, 15px, line-height 1.4): body copy, table cells, inputs, dropdown options. Secondary copy is 13-14px in muted grey; the welcome lede is 16px at 1.45, capped at 58ch, with key phrases lifted to white 600. Empty-state copy is capped at 46ch; the start-screen lede at 60ch.
- **Reading surface (guide):** Guide Headline (Barlow 700, 42px, 1.02, -0.01em, balanced, max 21ch; 32px under 600px) states each bay's method in one line. Lede (500, 18px, 1.5, max 58ch; 17px under 600px) in prose ink. Method Heading (700, 23px, 1.1) with its example in muted 500 beside it. Step Title (600, 18px, 1.3) in white over Prose body (500, 16px, 1.55, max 62ch). Step numbers are 700 26px (22px under 600px). Aside notes are 15px.
- **Guide figures:** the worked-problem Bench Figure (700, 54px, 1, -0.01em; 44px under 600px), the Try one row at 40px with a 34px answer field, the drill question at 56px (44px under 600px), and the drill result at 64px (0.9, -0.02em) with a 0.4em muted unit. The "In your head" held value is 600 21px; ledger lines are 500 18px.
- **Leaderboard and account:** the chosen board's name is the Board Headline (34px; 28px under 600px) with its length ("2:00") beside it in muted 600 18px. Standings rows name the board in 600 17px with the length in muted 600 14px, a muted 14px line under it ("PB 71 · 3 to pass alex"), and the place on the right (P-number 700 22px over a muted 13px "of 8"). Classification rows set the name in 600 18px and the score in 700 22px, with a muted 13px "N to pass NAME" line under your own name. The account page reuses the Guide Headline (42px, max 18ch) and Lede (18px, max 54ch) for its form, sets field text at 600 20px, and shows the signed-in name as the Account Name (56px, 0.95; 42px under 600px) with no label above it.
- **Wordmark** (Titillium 700, 20px, 0.02em, uppercase): "ZETAMAC". Its suffix ("Live timing" on the dashboard, the game name on start screens) is 13px, muted, tracked.
- **Label** (Titillium, uppercase, tracked): panel titles 700 13px at 0.12em; sub-heads 700 12px at 0.12em in muted grey; control text (segments, tabs, nav, outline and dialog buttons, edit) 700 11-12px at 0.12-0.14em; field labels, table headers and welcome row keys 600-700 11-12px at 0.1em; micro labels (breakdown stats, dropdown groups, mobile stacked-cell labels) 600-700 10px at 0.1-0.14em.
- **Operation codes** (Titillium 700, 17px, 0.06em; 15px on phone start screens): ADD / SUB / MUL / DIV in the tower, and the three-letter row codes on start screens.

### Named Rules
**The Two-Voice Rule.** Labels (panel titles, codes, controls, keys, step names, the YOU tag) are in Titillium, uppercase and tracked. Values and sentences (figures, row names, ledes, dialog headlines) are in Barlow with tabular figures. Never set a number in the label face: a figure that sits beside a word, such as "of 8", "2:00" or "3 on board", stays in Barlow. START is the one word the figure face takes at display size.

**The Unit Whisper Rule.** Units and qualifiers sit smaller and muted beside their figure (for example 2.40 with a 13px muted "s", or 0:30 over "×4 PROJECTED"). The figure carries the weight.

## Layout

A single centered column (max-width 1240px, 20px side padding, 72px bottom) of stacked panels with a 14px gap. At the top, a timing strip runs full width: wordmark, session date and game count, and the Play / Squares / Practice buttons pushed right, followed by the outlined Leaderboard, Guide and How it works buttons and, on the website, the account button. It has 14px vertical padding and a hairline underneath. After signing in, a status line sits under the strip, above the first panels.

The first viewport is a 7fr / 5fr grid: the Weak Spots tower on the left; on the right the 2-minute score, with the Days played calendar stacked beneath it and stretched to the tower's height. Below that, full width, are the scores chart, Practice & Endless, Log a score, and Results. The order goes from diagnosis to archive.

Tower rows are fixed-height grid rows (46px for operations, 38px for facts) with columns for position, stripe, code, bar, time and gap. Lap tiles are a 10-column grid with a 4px gap. Panel heads are a flex row with the title on the left and controls on the right, wrapping at 12-16px gaps.

Start screens reuse the dashboard's shape at a narrower max-width (1080px, 24px side padding): a strip (wordmark with game name, the ARITHMETIC / SQUARES / PRACTICE tabs, and a "View progress" outline link pushed right) over a 7fr / 5fr grid with a 14px gap. The left panel is the tower of rows; the right panel holds the lede, the LENGTH head (with the real "Best N" for the armed game and length on its right), the length segments, the save line and the START slab.

The welcome dialog is a fixed frame (min(760px, 100vw − 32px) by min(660px, 100dvh − 32px)) so its controls never move between steps: a top bar with the step track and close, a step body (a text column beside a 250px example well), and a footer with the step count left and the buttons right. A placeholder keeps Back's slot on step one.

The guide uses the dashboard's 1240px column with 24px side padding: a strip (wordmark with GUIDE, the white Play button, View progress), the full-width bay bar (five equal columns, 14px below), then a bay as a 7fr / 5fr grid with a 14px gap. The left column is one panel split into an intro (30px 34px padding) and the methods; the right column is the bench and Try one (or the grid tools and drill) stacked 14px apart and sticky 14px from the top, so the worked problem stays beside the steps it illustrates. Methods are divided by hairlines with 24px above each, and every bay ends with a Next link to the following bay. At 1000px and below the bay becomes one column in reading order (intro, methods, then the bench, which Work one scrolls to); at 760px the bay tabs drop their name and example and keep stripe and code; at 600px the stripe turns horizontal (22 by 4px) above the code, side padding drops to 16px, intro and methods padding to 22px 18px, and the grid cells to 30px.

The leaderboard and account pages share one base: a 1240px column with 24px side padding and 72px bottom, a strip (wordmark with the page name as its muted suffix, the white Play button, then outline links) 18px above its hairline, and panels with a 14px gap. The leaderboard is a 5fr / 7fr grid: your standings on the left, sticky 14px from the top (with the sign-up panel under them when signed out), and the chosen board's classification on the right. The account page is a 7fr / 5fr grid: the form panel on the left, the preview row and "What counts" on the right; signed in, the name panel sits over the "On the leaderboard" panel. Both collapse to one column at 900px: the leaderboard keeps standings first and scrolls to the classification when a board is picked; the account preview row moves inline under the name field, so it fills in as you type. At 600px side padding drops to 16px, panels to 16px, the wordmark takes its own row, the strip links share the next row equally, and the classification drops its date column.

Responsive: at 1000px and below the dashboard's first-viewport grid collapses to one column and the log form becomes two columns. At 640px and below, side padding drops to 12px and panel padding to 16px 14px, and the strip stacks in four rows: the wordmark with the account button at its right, the date line, the three games sharing a full-width row, then Leaderboard / Guide / How it works as three equal outline buttons. The tower's columns tighten, and the All facts columns stack. The practice and endless tables become stacked tables: each row is a two-column block, and each value carries its own tiny uppercase label, so no column hides off-screen. The calendar opens scrolled to today, with a 28px fade at its left edge to show it scrolls. Start screens collapse to one column at 860px with the LENGTH / START panel moved first, so a phone can start without scrolling; at 600px the tabs take a full row and share it equally, row columns tighten, and panel padding drops to 16px 14px. Under 640px the welcome dialog fills the viewport less 8px each side, the example well moves above the text (and the third step's example and the rail example drop out), and the primary button takes the full footer row above the ghosts.

## Elevation & Depth

The system is flat. Depth comes from tone (timing black → panel → raise → menu surface) and 1px hairlines, not from shadows. Only two floating layers cast a shadow: the custom dropdown menu and the chart tooltip. The tooltip is also the one inverted surface (figure white on timing black), so it reads as a callout above the data. The modal welcome dialog does not cast a shadow: it separates from the page with the scrim and a hairline-hover border.

### Shadow Vocabulary
- **Menu lift** (`box-shadow: 0 16px 40px rgba(0, 0, 0, .55)`): the open dropdown menu.
- **Tooltip lift** (`box-shadow: 0 8px 24px rgba(0, 0, 0, .45)`): the chart hover tooltip.
- **Selected-segment underline** (`box-shadow: inset 0 -2px 0 #b561ff`): not elevation. It is the 2px purple underline on a selected segment, game tab, length option or standings row.
- **Light-socket ring** (`box-shadow: inset 0 0 0 1px #3d4050`, red when lit): not elevation. It draws the rim of each start-light socket.
- **Mark-chip ring** (`box-shadow: inset 0 0 0 1px #3d4050`): not elevation. It outlines the small carry / borrow chip on the guide's worked problem.

### Named Rules
**The Flat Panel Rule.** Panels, rows, tiles, buttons and dialogs never cast shadows. A shadow means a small layer floats above the page and will close; a modal gets the scrim instead.

## Shapes

Hard, instrument-like corners. Bars, stripes, tracks and step bars use 1px; inner segment buttons, lap tiles, the PB badge, dropdown options and the switch thumb use 2px; controls, inputs, range fields, buttons, the switch track, the gantry housing and legend toggles use 3px; panels, the START slab, the welcome dialog, its example wells and the dropdown menu use 4px. Full circles appear only where the real-world object is round: the small dots (session dot, personal-best and game dots, the save-line dot), the five start-light sockets, and the single-choice ring. Chevrons for folds, dropdowns and breakdown rows are drawn from two 2px borders of a rotated square, not glyphs or icon fonts. The only icons are inline SVG crosses: delete in edit mode and the dialog's close.

## Components

### Timing Strip (navigation)
- **Style:** full-width flex row under a hairline. The wordmark is on the left. The session line (uppercase, 12px, muted, with key values in white) is led by a 7px red dot with a soft 3px halo.
- **Nav buttons:** raise background, hairline border, 3px corners, 11-12px tracked uppercase. Play is the "go" variant: solid figure white with timing-black text, turning pure white on hover. Secondary buttons brighten their border to hairline-hover on hover (150ms).
- **Leaderboard / Guide / How it works:** outline buttons (see Buttons) after the nav, sitting together; How it works reopens the welcome dialog. The welcome dialog's rows include a Guide row pointing to the guide.
- **Account button (website only):** an outline button with white text, reading "Sign up" or the signed-in name, linking to the account page.
- **Mobile:** four rows: the wordmark with the account button at its right, the date line, the three games splitting a full row equally, then Leaderboard / Guide / How it works as three equal buttons (11px, 0.08em).

### Status Line
- After signing in, a one-line message sits under the strip: panel surface, 1px hairline, 3px corners, 12px 16px padding, 15px white text led by an 8px sector-green dot. It shows once and is gone on the next load.

### Leaderboard and Account Strip
- Wordmark with the page name as its muted suffix ("Leaderboard", "Account"), then the white go-variant Play button and outline links (Leaderboard or Sign up / your name, View progress). On phones the wordmark takes its own row and the links share the next equally.

### Start-Screen Strip (game navigation)
- Wordmark with the game name as its muted suffix; the three games as an inset segmented tab set (timing-black well, 2px padding, 12px tracked options, the current game on raise with the purple underline); "Guide" and "View progress" as outline links pushed right and sitting together.

### Panels (cards / containers)
- **Corner Style:** 4px. **Background:** panel. **Border:** 1px hairline. **Shadow:** none. **Padding:** 18px 20px 20px on the dashboard, 20px on start screens (16px 14px on mobile).
- **Head:** uppercase section title on the left; segmented control, dropdown or muted note on the right.
- **Collapsible:** a panel may make its title a fold button with a CSS chevron that rotates over 200ms. Folding hides the body and removes the head's bottom margin.

### Segmented Controls
- **Style:** an inset well (timing-black background, hairline border, 3px corners, 2px padding) holding unboxed 11px tracked uppercase options in muted grey.
- **State:** hover turns the text white. Selected (`aria-pressed="true"`, `aria-current`, or a checked radio) gets the raise background, white text and a 2px purple underline. Used for the tower window, chart range (MONTH / 3 MONTHS / YEAR / ALL), the drills view and the start-screen game tabs.
- **Length variant (start screens):** three equal columns of real radios, each a 26px bold figure (0:30 / 2:00 / ∞) over an 11px tracked qualifier, 12px 6px 11px padding. Keyboard focus draws the purple outline inside the option.

### Timing Tower Rows (signature)
- **Structure:** position number (17px, muted), 4px team stripe, code or fact name, an 8px bar on a grid-rule track scaled to the slowest row, the time with a small "s" unit, and the gap to the fastest ("+0.96" or "Fastest").
- **Sector:** the bar and time take the row's sector color. The fastest row is purple. Once a previous window exists, other rows are green (faster than before) or yellow (slower). Otherwise they stay neutral grey.
- **Motion:** switching the window re-ranks rows in place with a FLIP slide (650ms, cubic-bezier(.16, 1, .3, 1)). A row whose sector changes flashes a 9% white wash for 1.1s. Bar widths ease over 600ms. All of this is removed under reduced motion.
- **Facts variant (Slowest question types):** 38px rows and a wider name column, with the gap column showing the question count. Its head carries two inset segmented wells: Top 6 / All facts, and a single-option Exclude outliers toggle that takes the same selected mark when pressed. All facts shows two ranked columns under muted 11px tracked heads (Multiplication ×2–×12, Division ÷2–÷12), with 34px rows and 16px times; they stack on phones. A type with fewer than 3 answers is unranked: no position number, an empty bar, muted name and time, its stripe at 35%, and "too few" (or "none yet") in the gap column, listed below the ranked rows. A muted 13px note under the tower says what is ranked and how many outliers were left out.

### Start-Screen Tower Rows (launch variant)
- **Structure:** at least 64px tall, grid-rule dividers top and bottom: position number, a 34px-tall 4px team stripe, a three-letter code, the name (Barlow 600 17px) over a muted 14px detail or inline range fields, and the control on the right. The whole row is the hit area for its switch or choice; a faint 2.5% white wash on hover.
- **Running order:** positions number only the rows still in (1, 2, 3…). Modifier rows (guided mode, hard mode) never take a number.
- **Off:** a row switched off or not picked dims to 42% (70% on hover) and its stripe collapses to nothing (scaleY(0), 450ms), so the dimmed row reads as out of the race.
- **Range fields:** inline "(2 – 100) + (2 – 100)" with the operator in white bold; each field is a 52px by 32px timing-black well, right-aligned 16px figures, purple caret and purple border on focus. A field moved off zetamac's default turns its border and figure yellow, because custom ranges don't save.
- **Switch:** a square-cornered 44 by 24px track (3px) with an 18px thumb (2px). Off: hairline track, muted thumb on the left. On: figure-white track, timing-black thumb slid right (300ms thumb, 250ms track). It is a real checkbox.
- **Single choice:** a 24px ring (2px hairline-hover border); checked turns the ring white with a white dot inset 4px. It is a real radio.
- **Unfolding detail:** guided mode unfolds its color controls beneath the tower on a grid-rule divider, indented to the name column.

### Save Line
- Under the length control, on a grid-rule divider: an 8px dot and a 14px muted line saying whether this run counts. Green dot when it counts, yellow when it won't save, red with white text for a settings error. It reserves its height so the START slab never jumps.

### START Slab with Gantry (signature)
- **Style:** a full-width figure-white slab (4px corners, 20px padding) with timing-black ink. Top left, a timing-black gantry housing (3px corners, 10px 12px padding) holds five 22px round sockets in raise with a 1px hairline-hover rim. Below, "START" in the start word face on the left and a tracked 11px "ENTER" hint on the right in dark grey (#4a4d58). Hover lifts the slab to pure white; focus draws the purple ring 3px out.
- **Behavior:** pressing START (or Enter from anywhere on the start screen except where Enter already means something) lights the sockets signal red one by one, 90ms apart, holds 160ms, then all go out and the white game screen appears (about 610ms). Under reduced motion the gantry is skipped and the game starts at once.

### 2-Minute Score and Target Rail
- **Score:** the display figure next to a small stack: a muted uppercase label, the yellow "N to go" (purple "Target made" once reached), and the last-5 average.
- **Rail:** a 6px grid-rule track with a figure-white fill for the current score, a 2px muted tick for the personal best, and a 2px purple mark labeled "TARGET 80" in 11px tracked purple. The scale runs from 0 to at least 100. The fill eases over 700ms.

### Lap Tiles
- **Style:** the last 10 games as raise-colored 2px tiles, each showing the score (18px bold) over a muted 11px date.
- **State:** the score takes a sector color: purple for a new best at the time, green for at or above the previous five games' average, yellow for below it. A key above the tiles explains the three colors with 10×4px swatches.

### Readout Line
- A wrapping line of stats under the chart head. Each stat is a 17px white figure followed by a muted 14px qualifier, with deltas in green (up) or yellow (down). It closes with a grid-rule hairline and replaces a KPI-card row.

### Lap Chart
- An SVG chart with grid-rule gridlines and muted 12px axis text. The daily best is a 2px white line with white points, and points that set a personal best turn purple. The 30-second ×4 projection is a dotted silver line with hollow points. Individual games are 26%-white dots. The target is a purple 6/5 dashed line labeled TARGET 80.
- **Legend toggles:** hairline-bordered 3px buttons with a drawn line sample matching each series. Hover brightens them. Off (`aria-pressed="false"`) drops to 45% opacity with a strikethrough. A non-interactive purple-dot note explains the personal-best mark.

### Inputs / Fields and Custom Dropdowns
- **Style:** timing-black well, hairline border, 3px corners, 15px Barlow, 10px 11px padding, dark color-scheme. Labels are 11px tracked uppercase above the field.
- **Focus / hover:** hover brightens the border to hairline-hover. Keyboard focus shows a 2px purple outline with a 2px offset.
- **Dropdowns:** native selects are replaced by a button in the same style with a CSS chevron. When open, the button border turns purple and the chevron flips. The menu floats 4px away (upward when space is short), with a max width of min(340px, 100vw − 32px). Group headers are 10px tracked uppercase. The selected option is bold and led by a 3px purple bar. The active option takes the menu-active background.

### Buttons
- **Primary:** solid figure white with timing-black 12px tracked uppercase text, 3px corners, 14px 20px padding. Hover is pure white. There is exactly one per form or dialog step.
- **Outline:** no fill, hairline border, muted 12px tracked uppercase, 3px corners, 10px 14px padding; hover turns the text white and the border hairline-hover. Used for the strip links (Leaderboard, Guide, How it works, View progress, the account button), Export / Import, and the strip links on the leaderboard and account pages.
- **Raise:** raise fill, hairline border, white 12px tracked uppercase, 3px corners, 12px 14px padding; hover lifts the border to hairline-hover and the fill slightly (#22232d). Used for secondary actions in panels (bench buttons, Log out, Open it, Go to your tracker).
- **Danger:** the raise button with signal-red text; hover turns the border red. Only for Delete account.
- **Ghost (Edit):** hairline border, muted 11px tracked uppercase. It turns white with the hover border when pressed or hovered.
- **Delete:** a muted inline SVG cross that turns red on a raise background on hover. It only appears in edit mode.

### Welcome Dialog
- **Frame:** a modal on the panel surface with a hairline-hover border, 4px corners, no shadow, over the scrim. It opens by itself once (the first visit) and reopens from How it works. It rises 12px and fades in over 450ms; each step slides 18px in the direction of travel over 500ms. Both are removed under reduced motion.
- **Step track:** three equal columns, each a 3px bar over an 11px tracked step name. Upcoming bars are hairline, completed bars neutral-bar, the current bar purple with its name in white. Beside it, a 36px square close button (hairline border, 3px) holding the SVG cross.
- **Step body:** a dialog headline, a 16px lede, then plain key / value rows: a 96px tracked key column and a muted value with key phrases in white, divided by grid-rule hairlines. No stripes: these rows describe, they don't rank.
- **Example wells:** timing-black insets (hairline border, 4px, 14px 16px 16px padding) headed by a muted tracked label naming them as examples. Step one types a round (38px figures, the answer underlined in purple, turning green when right, the score ticking up) above a TARGET 80 rail; step three shows a small weak-spots tower. The typed round becomes a static solved problem under reduced motion.
- **Footer:** on a hairline, the "1 of 3" count on the left, ghost buttons (Back, Look around; 12px 18px padding) and one white primary (Next, then "Play a 2-minute round").

### Guide Bay Bar (tabs)
- **Style:** the inset segmented control widened into a five-column tablist: timing-black well, hairline border, 3px corners, 2px padding and gap. Each tab is a 4px by 32px team stripe (50% opacity until hovered or selected), the three-letter code (Titillium 700 17px), the name (13px muted) under it, and the bay's example problem on the right (600 15px).
- **State:** hover turns the text white on a 2% white wash. Selected takes the raise fill, white text, the 2px purple underline and a full-opacity stripe. Arrow keys move between tabs.
- **Motion:** the new bay panel rises 10px and fades in over 500ms; the right column follows 60ms later.

### Numbered Steps
- **Structure:** a list of rows divided by grid-rule hairlines: a right-aligned step number (700 26px), a 4px team stripe, and a white step title over prose body. The sequence is the method, so the numbers stay.
- **Active step:** as the bench reaches a step, its row takes a 2.5% white wash, its number turns white and its stripe scales in from the top (scaleY 0 to 1, 450ms). The article and the worked problem always move together.

### Worked-Problem Bench (signature)
- **Frame:** a panel whose heading is led by a 4px by 18px team stripe, the only team color on the bench. A segmented control picks the method where a bay has several.
- **Problem:** the bench figure line (54px). Answer digits start as dim placeholders and drop in (12px, 500ms) as each step settles them; the "=" stays dim. Carry and borrow are small mark chips ("1", "−1") written above the first number's tens digit: raise fill, 2px corners, 15px bold figure, the hairline-hover inset ring, dropping in the same way.
- **In your head:** a row between grid-rule hairlines with a tracked muted key and the held value in 600 21px white.
- **Ledger:** one line per step taken (500 18px, muted, the current line white), each rising 8px as it arrives, with small step numbers.
- **Controls:** a count on the left ("Step 2 of 3"), then raise-filled bench buttons (Next step, New problem) with hairline borders; hover lifts the border to hairline-hover. "Work one" in the article is the ghost version.
- **Motion:** on first view each bench plays its example once, one step every 1.5s. Under reduced motion every step shows at once and nothing animates.

### Try One
- A panel with a 40px problem, a dim "=", and a 150 by 56px timing-black answer field (34px figures, purple caret and border on focus). Like zetamac, the answer is taken the moment it's right: the field's border and figure turn sector green and the time appears in green 700 18px. A muted line counts problems solved and the average time; Walk through this one hands the problem to the bench.

### Times-Table Grid
- **Structure:** 2–12 by 2–12 cells (38px tall, 2px apart, 2px corners) on raise with prose figures; squares on the diagonal are bold white. Row headers are buttons.
- **Crosshair:** hovering or focusing a cell lifts its row and column to a slightly brighter raise (#23242e) and turns the cell itself figure white with timing-black ink.
- **Picked rows:** a picked row header takes raise, white text and the purple underline; its cells take a faint purple tint (#211d2c). Picked rows feed the drill.
- **Hide answers:** a square switch hides every figure behind a centered 4px dim dot; tapping a cell peeks at it.

### Drill Panel
- Segmented options (full-width equal columns) under tracked field labels, then a compact START slab: the same white slab and five-light gantry as the start screens at a smaller size (18px sockets, 44px START, 18px 20px padding), lighting red before the drill begins. Running, it shows a count, a 2px purple progress rail and a 56px question with the same answer field. Results show the average at 64px, and the slowest facts as rows with sector-yellow bars and yellow times.

### Aside Note
- A raise-filled 3px box (12px 16px padding) under a method, in prose ink at 15px, opened by an inline uppercase tracked run-in label in muted grey. No border stripe: stripes belong to operations.

### Standings Rows (leaderboard)
- **Structure:** one button row per board between grid-rule dividers: a 4px by 38px board stripe, the board name with its length, a muted line under it, and the place on the right. Signed in, the line reads "PB 71 · 3 to pass alex" (or "leading") and the place is your P-number over "of N"; not on a board, the line names the leader and the place is a dim "—" over "N on board" or "open".
- **State:** hover takes a 2.5% white wash. The selected row takes the raise fill and the 2px purple inset underline, the segment's selection mark, and its "of N" turns white. P1 in your place column is purple.

### Classification Tower (leaderboard)
- **Structure:** tower rows at least 48px tall: position (700 18px, muted), 4px board stripe, name, score (700 22px; endless adds a muted "in 4:12"), gap to P1 ("−6", or "P1" for the leader) and a muted date. Tied scores share a place.
- **P1:** the leader's score is sector purple.
- **You:** your row sits on the raise band with your position in white, a white YOU tag (Titillium 700 10px on figure white, 2px corners) after your name, and a muted "N to pass NAME" line under it.
- **Motion:** picking a board slides the new classification in 12px from the right over 450ms and scrolls your row into view; standings rows ease their fill over 200ms. Both are removed under reduced motion.
- **Empty:** a muted 16px sentence (max 52ch) saying how to set the first mark.

### Slab (leaderboard and account)
- The START slab's shape without the gantry: a full-width figure-white slab (4px corners, 18px 20px padding) with a 40px uppercase Barlow word on the left (32px in the sign-up panel, 34px on phones) and a tracked 11px hint in dark grey on the right ("Enter", "Free"). Hover is pure white. It is the one primary action on these pages.

### Account Form
- A Sign up / Log in segmented tab set over tall fields: 48px timing-black wells (hairline border, 3px corners, 0 14px padding, 600 20px Barlow, up to 420px wide) under 11px tracked muted labels, with a 13px muted hint below. Hover lifts the border to hairline-hover; focus turns it purple; an invalid field turns it red. The "move this browser's scores" choice is the square switch.
- **Preview row:** a single classification row on the raise band showing "P–", a hairline-hover stripe, your typed name (dim "your name" until you type), "—" and "PB".

### Account Rows (signed in)
- The name at Account Name size with a muted 16px line under it and a raise button beside it; nothing sits above the name. Below, plain rows between grid-rule dividers: a white 600 17px title over a prose 15px sentence (max 40ch), with a raise button on the right. These rows describe, so they carry no stripe. Delete account is the danger button.

### Export / Import Row
- Under the Log a score form, on a hairline divider: a muted 14px note (max 70ch) on the left and outline buttons on the right, Export scores and (website only) Import a file, which wraps a hidden file input and shows the purple focus outline when focused. On phones the buttons drop under the note.

### Results Table and Per-Question Breakdown
- **Table:** 11px tracked uppercase headers over a hairline; 9px 8px cells divided by grid-rule. Scores are right-aligned and 17px bold, preceded by game-type tags in team colors (11px tracked uppercase) and followed by a purple PB badge (timing-black text, 2px corners).
- **Rows with detail:** hover and open states use the raise background. A CSS chevron rotates on open.
- **Breakdown:** opens in a raise-colored row. It contains a four-cell stat strip (panel cells joined by 1px hairline gaps inside a 3px hairline frame, with 19px figures over 10px labels), operation keys with team-color stripes, a 130px per-question bar chart, and a scrollable question list where slow times are yellow and fast times green.

### Mobile Stacked Tables
- Under 640px the practice and endless tables drop their header. Each row becomes a two-column grid block, and each cell carries its own 10px tracked uppercase muted label (from `data-label`). The lead cell spans both columns at 16px bold.

### Days-Played Calendar
- An SVG grid of 1.5px-rounded day squares filled from the heat-0 to heat-4 grey ramp by that day's best score. A small legend shows the ramp, running from "Lower best" to "Higher best".

## Do's and Don'ts

### Do:
- **Do** set every number in Barlow Semi Condensed with tabular figures, and every label in uppercase Titillium Web tracked 0.1-0.14em.
- **Do** color a time, bar or lap only by its sector meaning: purple for best, green for improved, yellow for slower. Leave it neutral when there is nothing to compare against.
- **Do** mark every operation with its team color (add #2fd0f5, sub #ff5147, mul #6d8bff, div #ff62b8, squares #ffa53d) on a 4px stripe or a small tag.
- **Do** build surfaces from tone and 1px hairlines: timing black, then panel, then raise.
- **Do** use the inset segmented control for any mutually exclusive view switch, with the selected option marked by the raise fill and a 2px purple underline.
- **Do** give every animation the cubic-bezier(.16, 1, .3, 1) ease-out and remove it under `prefers-reduced-motion`.
- **Do** keep the 1-4px corner scale; 4px is the largest radius on any surface or control.
- **Do** scope the system on game pages to the start screen only: switch the page dark while the settings screen shows and hand back to zetamac's white for play and results.
- **Do** set long-form reading text (guide ledes, step bodies, asides) in prose ink at 16-18px with 1.5-1.55 line height, and lift figures inside a sentence to white 600.
- **Do** keep a worked problem and its numbered steps in step: advancing one lights the other.
- **Do** mark your own row in a ranked list with the raise band, a white YOU tag and the "N to pass NAME" line, and give P1's figure sector purple.
- **Do** mark a selected row in a pick list with the same raise fill and 2px purple inset underline as a selected segment.
- **Do** keep every start-screen control a real form control (checkbox, radio, number field) with the id the game reads; the styling dresses it, it never replaces it.

### Don't:
- **Don't** lay out headline numbers as a grid of separate KPI cards; use tower rows, a readout line or a hairline-joined stat strip.
- **Don't** use purple, green or yellow as decoration or brand accents; the only sector-colored fill is the purple PB badge, and sector bars (selected option, current step) are state marks.
- **Don't** put drop shadows on panels, rows, tiles, buttons or dialogs; shadows belong only to the dropdown menu and the chart tooltip.
- **Don't** color the lap-chart lines or the calendar ramp beyond white, grey, silver, the target purple and PB purple; per-question breakdown bars are the one chart that takes team colors.
- **Don't** apply this system to the game pages' in-game question screen or end screen; they deliberately keep arithmetic.zetamac.com's white look. Only the start screen belongs to this world.
- **Don't** set a figure, answer or number in a team color; team color lives on stripes and tags only.
- **Don't** use dim ink for instructions or anything a reader must read; it is for placeholders, the equals sign and disabled states.
- **Don't** use pill controls, rounded switches or radii above 4px on surfaces and controls; full circles are reserved for dots, start lights and the single-choice ring.
- **Don't** put a side stripe on a row that only describes (settings rows, key / value rows, fact lists, asides); stripes rank or identify.
- **Don't** put a small uppercase label above a headline or the signed-in name; the name or headline stands on its own.
