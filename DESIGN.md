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
---

# Design System: Zetamac Live Timing

## Overview

**Creative North Star: "The Live Timing Tower"**

The tracker dashboard is an F1 live-timing screen. The four arithmetic operations are drivers, each question is a sector, and the page leads with the timing tower: operations ranked slowest first, each with a position number, a team stripe, a three-letter code (ADD, SUB, MUL, DIV), a bar, its seconds per question, and its gap to the fastest. Everything sits on a near-black ground in flat panels divided by hairlines, with white tabular figures and one small vocabulary of bright, meaningful color.

The screen is dense and quick to read. Numbers carry the page; labels stay small, uppercase and tracked, and step aside. Color is information: sector purple, green and yellow say best, improved and slower, and team colors say which operation you are looking at. Everything else is greyscale. The one oversized element is the current 2-minute score, set against a TARGET 80 rail.

The same world carries the pre-session moment. Each game's start screen is the timing tower before the race: every operation or mode is a driver row you switch in or out, the length is a segmented control of big figures, and START is a white slab carrying a five-light gantry. A first-visit welcome dialog on the dashboard explains the product in three steps inside the same flat, hairlined panel language.

Scope: this system governs the tracker dashboard (`index.html`, including its welcome dialog) and the start/settings screen of all three games (`play.html`, `squares.html`, `practice.html`). On the game pages it applies only while the start screen shows: the page body carries a launch state then, and the dark ground, fonts and tokens are scoped to it. The in-game question screen and the end screen deliberately keep arithmetic.zetamac.com's plain white look. They sit outside this system and must not take on its tokens, and this system must not be bent to match them.

**Key Characteristics:**
- Near-black ground, flat panels, 1px hairline rules; no drop shadows on surfaces.
- Tabular condensed figures for every number; tracked uppercase Titillium for every label.
- Sector colors (purple / green / yellow) carry meaning, never decoration.
- Each operation always shows its team color, as a 4px stripe or a tag.
- Tight corners (1-4px); controls look like timing-screen hardware, not soft SaaS pills. Circles appear only where the real object is round: dots, start lights, the single-choice ring.

## Colors

A greyscale timing screen with two small families of saturated ink: sector semantics and team identity.

### Primary
- **Figure White** (figure-white): every number and primary text; also fills the one solid call-to-action per surface (Play, Add score, the START slab, the welcome's Next / Play a 2-minute round) and the "on" track of a switch, so the main action and the live state read as the brightest objects.
- **Sector Purple** (sector-purple): "best of the field": the fastest operation, a lap that set a new best, personal-best dots and the PB badge. It also marks the target (the dashed 80 line, the TARGET 80 rail mark and label) and the system's selection state: the underline on a selected segment or game tab, the current step bar in the welcome track, the open-dropdown border, the selected-option bar, the focused range field's border, the focus ring, the text caret and text selection, and the in-progress answer underline in the welcome's example round.

### Secondary
- **Sector Green** (sector-green): improved on its previous window, a lap up on form, a fast question in the breakdown, an upward readout delta, a success message, the save-line dot when a run will count, and the example answer's underline once it is right.
- **Sector Yellow** (sector-yellow): slower than its previous window, a lap down on form, a slow question, a downward readout delta, and the "N to go" gap to target. On the start screen it is the caution ink: a range field moved off zetamac's default, and the save-line dot when a run won't save.
- **Signal Red** (signal-red): errors (the server banner edge, form errors, delete hover, the save-line dot and white text for a settings error), the session dot in the timing strip, and the lit sockets of the start gantry.

### Tertiary (team colors)
- **Team Add Cyan** (team-add), **Team Sub Red** (team-sub), **Team Mul Blue** (team-mul), **Team Div Pink** (team-div), **Team Squares Orange** (team-sq): each operation's identity. They fill the 4px tower stripe (dashboard and start screens), the breakdown operation keys and bars, and the per-game tags in results (30 s games in add cyan, squares in orange, practice drills in sub red). Squares start-screen rows all take the orange stripe; practice drills take sub red. Team Sub Red is the same value as Signal Red.

### Neutral
- **Timing Black** (timing-black): page ground, and the inset well behind segmented controls, game tabs, inputs, range fields, dropdown buttons, the start gantry and the welcome's example panels.
- **Panel** (panel): every section surface, and the welcome dialog.
- **Raise** (raise): one step up: lap tiles, selected segment or tab, secondary nav buttons, hovered and open result rows, the expanded breakdown, and the unlit start-light sockets.
- **Grid Rule** (grid-rule) and **Hairline** (hairline): row dividers and chart gridlines use grid-rule; panel borders, control borders, table header rules and the switch's "off" track use hairline. **Hairline Hover** (hairline-hover) is the border on hover, the dialog's border, the unchecked choice ring and the light-socket ring.
- **Neutral Bar** (neutral-bar): a bar with no comparison yet (the tower bar fallback) and completed steps in the welcome track.
- **Menu Surface / Menu Edge / Menu Active**: the floating dropdown menu, its border, and the keyboard/pointer-active option.
- **Muted Grey** (muted-grey): labels, units, gaps, axis text, secondary copy, the switch thumb when off.
- **Projection Silver** (projection-silver): the dotted 30-second ×4 projection line and the Endless tag.
- **Heat 0-4**: the days-played calendar ramp, from empty day to highest best. It stays greyscale.
- **Scrim** (scrim): the backdrop behind the modal welcome dialog.

### Named Rules
**The Sector Rule.** Purple, green and yellow mean best, improved and slower (and, on the start screen, counts / won't save / changed-from-default). They are never used for decoration, and a number only takes a sector color when the data or the setting earned it. A row with no comparison yet stays neutral grey (neutral-bar).

**The Team Stripe Rule.** An operation never appears without its team color. The color sits on a 4px stripe or a small tag, never as a fill for the whole row.

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
- **Wordmark** (Titillium 700, 20px, 0.02em, uppercase): "ZETAMAC". Its suffix ("Live timing" on the dashboard, the game name on start screens) is 13px, muted, tracked.
- **Label** (Titillium, uppercase, tracked): panel titles 700 13px at 0.12em; sub-heads 700 12px at 0.12em in muted grey; control text (segments, tabs, nav, outline and dialog buttons, edit) 700 11-12px at 0.12-0.14em; field labels, table headers and welcome row keys 600-700 11-12px at 0.1em; micro labels (breakdown stats, dropdown groups, mobile stacked-cell labels) 600-700 10px at 0.1-0.14em.
- **Operation codes** (Titillium 700, 17px, 0.06em; 15px on phone start screens): ADD / SUB / MUL / DIV in the tower, and the three-letter row codes on start screens.

### Named Rules
**The Two-Voice Rule.** Labels (panel titles, codes, controls, keys, step names) are in Titillium, uppercase and tracked. Values and sentences (figures, row names, ledes, dialog headlines) are in Barlow with tabular figures. Never set a number in the label face. START is the one word the figure face takes at display size.

**The Unit Whisper Rule.** Units and qualifiers sit smaller and muted beside their figure (for example 2.40 with a 13px muted "s", or 0:30 over "×4 PROJECTED"). The figure carries the weight.

## Layout

A single centered column (max-width 1240px, 20px side padding, 72px bottom) of stacked panels with a 14px gap. At the top, a timing strip runs full width: wordmark, session date and game count, and the Play / Squares / Practice buttons pushed right, followed by the outlined "How it works" button. It has 14px vertical padding and a hairline underneath.

The first viewport is a 7fr / 5fr grid: the Weak Spots tower on the left, the 2-minute score on the right. Below that, full width, are the scores chart, Practice & Endless, Days played, Log a score, and Results. The order goes from diagnosis to archive.

Tower rows are fixed-height grid rows (46px for operations, 38px for facts) with columns for position, stripe, code, bar, time and gap. Lap tiles are a 10-column grid with a 4px gap. Panel heads are a flex row with the title on the left and controls on the right, wrapping at 12-16px gaps.

Start screens reuse the dashboard's shape at a narrower max-width (1080px, 24px side padding): a strip (wordmark with game name, the ARITHMETIC / SQUARES / PRACTICE tabs, and a "View progress" outline link pushed right) over a 7fr / 5fr grid with a 14px gap. The left panel is the tower of rows; the right panel holds the lede, the LENGTH head (with the real "Best N" for the armed game and length on its right), the length segments, the save line and the START slab.

The welcome dialog is a fixed frame (min(760px, 100vw − 32px) by min(660px, 100dvh − 32px)) so its controls never move between steps: a top bar with the step track and close, a step body (a text column beside a 250px example well), and a footer with the step count left and the buttons right. A placeholder keeps Back's slot on step one.

Responsive: at 1000px and below the dashboard's first-viewport grid collapses to one column and the log form becomes two columns. At 640px and below, side padding drops to 12px, panel padding to 16px 14px, and the nav buttons stretch to share a full-width row; "How it works" moves up beside the wordmark. The tower's columns tighten. The practice and endless tables become stacked tables: each row is a two-column block, and each value carries its own tiny uppercase label, so no column hides off-screen. The calendar opens scrolled to today, with a 28px fade at its left edge to show it scrolls. Start screens collapse to one column at 860px with the LENGTH / START panel moved first, so a phone can start without scrolling; at 600px the tabs take a full row and share it equally, row columns tighten, and panel padding drops to 16px 14px. Under 640px the welcome dialog fills the viewport less 8px each side, the example well moves above the text (and the third step's example and the rail example drop out), and the primary button takes the full footer row above the ghosts.

## Elevation & Depth

The system is flat. Depth comes from tone (timing black → panel → raise → menu surface) and 1px hairlines, not from shadows. Only two floating layers cast a shadow: the custom dropdown menu and the chart tooltip. The tooltip is also the one inverted surface (figure white on timing black), so it reads as a callout above the data. The modal welcome dialog does not cast a shadow: it separates from the page with the scrim and a hairline-hover border.

### Shadow Vocabulary
- **Menu lift** (`box-shadow: 0 16px 40px rgba(0, 0, 0, .55)`): the open dropdown menu.
- **Tooltip lift** (`box-shadow: 0 8px 24px rgba(0, 0, 0, .45)`): the chart hover tooltip.
- **Selected-segment underline** (`box-shadow: inset 0 -2px 0 #b561ff`): not elevation. It is the 2px purple underline on a selected segment, game tab or length option.
- **Light-socket ring** (`box-shadow: inset 0 0 0 1px #3d4050`, red when lit): not elevation. It draws the rim of each start-light socket.

### Named Rules
**The Flat Panel Rule.** Panels, rows, tiles, buttons and dialogs never cast shadows. A shadow means a small layer floats above the page and will close; a modal gets the scrim instead.

## Shapes

Hard, instrument-like corners. Bars, stripes, tracks and step bars use 1px; inner segment buttons, lap tiles, the PB badge, dropdown options and the switch thumb use 2px; controls, inputs, range fields, buttons, the switch track, the gantry housing and legend toggles use 3px; panels, the START slab, the welcome dialog, its example wells and the dropdown menu use 4px. Full circles appear only where the real-world object is round: the small dots (session dot, personal-best and game dots, the save-line dot), the five start-light sockets, and the single-choice ring. Chevrons for folds, dropdowns and breakdown rows are drawn from two 2px borders of a rotated square, not glyphs or icon fonts. The only icons are inline SVG crosses: delete in edit mode and the dialog's close.

## Components

### Timing Strip (navigation)
- **Style:** full-width flex row under a hairline. The wordmark is on the left. The session line (uppercase, 12px, muted, with key values in white) is led by a 7px red dot with a soft 3px halo.
- **Nav buttons:** raise background, hairline border, 3px corners, 11-12px tracked uppercase. Play is the "go" variant: solid figure white with timing-black text, turning pure white on hover. Secondary buttons brighten their border to hairline-hover on hover (150ms).
- **How it works:** an outline button (see Buttons) after the nav; it reopens the welcome dialog.
- **Mobile:** the buttons take a full row and split it equally; How it works sits beside the wordmark.

### Start-Screen Strip (game navigation)
- Wordmark with the game name as its muted suffix; the three games as an inset segmented tab set (timing-black well, 2px padding, 12px tracked options, the current game on raise with the purple underline); "View progress" as an outline link pushed right.

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
- **Facts variant:** 38px rows and a wider name column, with the gap column showing the question count.

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
- **Outline:** no fill, hairline border, muted 12px tracked uppercase, 3px corners, 10px 14px padding; hover turns the text white and the border hairline-hover. Used for How it works and View progress.
- **Ghost (Edit):** hairline border, muted 11px tracked uppercase. It turns white with the hover border when pressed or hovered.
- **Delete:** a muted inline SVG cross that turns red on a raise background on hover. It only appears in edit mode.

### Welcome Dialog
- **Frame:** a modal on the panel surface with a hairline-hover border, 4px corners, no shadow, over the scrim. It opens by itself once (the first visit) and reopens from How it works. It rises 12px and fades in over 450ms; each step slides 18px in the direction of travel over 500ms. Both are removed under reduced motion.
- **Step track:** three equal columns, each a 3px bar over an 11px tracked step name. Upcoming bars are hairline, completed bars neutral-bar, the current bar purple with its name in white. Beside it, a 36px square close button (hairline border, 3px) holding the SVG cross.
- **Step body:** a dialog headline, a 16px lede, then plain key / value rows: a 96px tracked key column and a muted value with key phrases in white, divided by grid-rule hairlines. No stripes: these rows describe, they don't rank.
- **Example wells:** timing-black insets (hairline border, 4px, 14px 16px 16px padding) headed by a muted tracked label naming them as examples. Step one types a round (38px figures, the answer underlined in purple, turning green when right, the score ticking up) above a TARGET 80 rail; step three shows a small weak-spots tower. The typed round becomes a static solved problem under reduced motion.
- **Footer:** on a hairline, the "1 of 3" count on the left, ghost buttons (Back, Look around; 12px 18px padding) and one white primary (Next, then "Play a 2-minute round").

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
- **Do** keep every start-screen control a real form control (checkbox, radio, number field) with the id the game reads; the styling dresses it, it never replaces it.

### Don't:
- **Don't** lay out headline numbers as a grid of separate KPI cards; use tower rows, a readout line or a hairline-joined stat strip.
- **Don't** use purple, green or yellow as decoration or brand accents; the only sector-colored fill is the purple PB badge, and sector bars (selected option, current step) are state marks.
- **Don't** put drop shadows on panels, rows, tiles, buttons or dialogs; shadows belong only to the dropdown menu and the chart tooltip.
- **Don't** color the lap-chart lines or the calendar ramp beyond white, grey, silver, the target purple and PB purple; per-question breakdown bars are the one chart that takes team colors.
- **Don't** apply this system to the game pages' in-game question screen or end screen; they deliberately keep arithmetic.zetamac.com's white look. Only the start screen belongs to this world.
- **Don't** use pill controls, rounded switches or radii above 4px on surfaces and controls; full circles are reserved for dots, start lights and the single-choice ring.
