# Squeek Wheel Oracle design system

## Overview

An independent prediction game for the Squeekchain community. The visual idea is a tiny, warm hamster powering a precise forest-green control room. The wheel is the central illustration; the prediction controls are the central interaction. The requester’s dark greens, lime highlights, wheel animation and Vacuum boss remain recognizable.

The implementation is a single page: compact brand/utility header, game-mode selector, wheel and prediction panel, boss/score strip, narrative feedback, history and statistical opponent, then expandable rules. This is an active game interface, not a marketing landing page. Source: `src/App.tsx`, `src/Artwork.tsx`, `src/styles.css`.

## Colors

Canonical notation is hex, matching the prototype. Semantic custom properties are declared in `src/styles.css:1`.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#101810` | Page and prediction background |
| `--surface` | `#19231a` | Wheel scene, dialogs, mode selector |
| `--raised` | `#243020` | Selected options, inactive primary action, small state surfaces |
| `--line` | `#3c4c35` | Structural borders and separators |
| `--text` | `#f0f3e9` | Primary text |
| `--muted` | `#aab8a0` | Secondary copy, metadata and captions |
| `--accent` | `#dcff78` | Primary action, selected choice, positive score and wheel art |
| `--accent-ink` | `#17220e` | Text on lime actions |
| `--warm` | `#ffb27c` | Hamster, boss health, demo and unavailable-state text |
| `--focus` | `#f0f3e9` | Keyboard focus outline |

The primary hover background is `#e8ffa7`; option hover border is `#91a56f`. Decorative SVGs have supporting green and peach shades local to the art, not additional interface meanings. Every state also has text, a symbol or pressed/disabled semantics.

Computed foreground/background pairs were inspected in Chromium. Measured contrast: text/page **16.12:1**, muted/page **8.68:1**, muted/surface **7.77:1**, primary ink/lime **14.64:1**, lime/page **16.05:1**. The probe and both browser axe audits found no failing measured text contrast. Artwork is not a substitute for a textual status.

## Typography

System stack: `'Trebuchet MS', 'Segoe UI', sans-serif`. No remote fonts or font downloads. Actual glyphs depend on installed system fallbacks; a computed family name does not prove Trebuchet was available. CSS requests weights 400 and 600, with `font-synthesis: none`.

The six-size scale is shared across the page:

| Token | Size at default root | Role |
| --- | --- | --- |
| `--xs` | 12px | Source metadata, small captions |
| `--sm` | 14px | Supporting copy, utility text |
| `--base` | 16px | Body, actions, mobile panel heading |
| `--lg` | 20px | Section headings, desktop brand |
| `--xl` | 32px | Main heading, readouts, mobile target |
| `--display` | 48px | Desktop target, human/algorithm scores |

Body line height is 1.5; the main heading is 1.15 with −0.035em tracking; section headings are 1.3 with −0.02em. Headings balance, descriptions use pretty wrapping. Numeric scores and timers use tabular numerals. Longer helper prose has constrained measures where useful. No monospaced prose, text clipping or ellipsis hides an important value. Mobile select text is 16px to avoid input zoom.

## Layout

`.shell` caps the page at 1280px including 40px side padding. Shared spacing uses 4, 8, 12, 16, 20, 24, 32 and 40px; small gaps join labels to values and larger gaps separate tasks.

- Above 1100px: the arena is a 1.36:1 two-column grid with 24px gap. Boss information and three score values share one row. The lower history/opponent grid uses the same proportions.
- At 1100px: page padding becomes 24px and the arena ratio becomes 1.15:1.
- At 850px: the introduction stacks; the arena remains two columns; score values move to their own row below the boss.
- At 620px: page padding is 16px; the arena stacks, wheel first and prediction second. The wheel illustration is 148px high, the target becomes 32px, and the decorative intro sentence is hidden. The heading, mode selector and primary interaction remain visible at 390×844. History and opponent stack; utilities retain accessible names while the help label is visually hidden.
- At 360px: page padding is 12px with smaller brand/choice text. Important labels remain complete.

Reflow was checked at 320, 390, 768 and 1440px in Chromium and WebKit. There is no fixed header or floating control covering content. The browser suite confirms that the demo’s enabled lock action ends at about 821px in Chromium and 784px in WebKit in a 390×844 viewport. These differences reflect system font metrics.

## Elevation & Depth

The design is flat: surface tones, spacing and one-pixel structural borders, without card shadows. The wheel’s grid and radial light exist only inside the SVG scene. The native dialog uses a dark `#080f08d9` backdrop and the browser’s top layer. No gradient text or nested decorative cards.

## Shapes

Desktop main panels and the dialog use 16px radii; mobile panels use 12px. Choice buttons use 10px, the primary action 9px, utility buttons 8px, selects 6px. Circular marks identify results; the boss bar contains five segments, each representing 20 HP. The progressbar also exposes its numeric value.

## Components

- **Game modes** (`.mode-picker`, `App.tsx`): two native buttons with `aria-pressed`; live and demo keep separate progress. Mode switching does not cancel an already locked live round.
- **Prediction choices** (`.choices`, `.choice`): native UNDER and AT/OVER buttons; selected state uses a lime border, raised background and `aria-pressed`. Both disable after locking. One lime `.primary` action confirms the choice. Loading/error explanations stay next to it.
- **Source indicator** (`.feed-state`): text and a colored dot for LIVE, STALE, OFFLINE, SYNCING or DEMO. Source links and successful update time remain visible; detailed observation/coverage times appear in the rules disclosure.
- **Wheel** (`Wheel` in `Artwork.tsx`): original inline SVG; `running` follows device ACTIVE status in live mode, or an active simulated window in demo. `motion` is controlled by the pause button. Rotation and paws animate only under `prefers-reduced-motion: no-preference`; spinning is illustrative, not a speed gauge.
- **Boss** (`Vacuum`, `.health-bar`, `.score-strip`): original SVG, accessible 0–100 progressbar, numeric HP, points, streak and defeated bosses. Correct calls visibly remove one bar segment.
- **Results/history** (`.result`, `.history-list`): persistent inline results, text/symbol cues, native outcome filter, JSON download and an actionable empty state. The latest ten results are shown; export contains up to 100 retained results per mode.
- **Guide/disclosures**: native `<dialog>`, `<details>` and `<summary>`. Escape closes the guide, focus returns to its trigger, and native modal behavior keeps focus inside it. Buttons support Tab/Enter/Space without custom gesture-only paths.
- **Feedback**: stable polite narrative and action regions. Source failures explain recovery. Browser storage failure is disclosed. Sound is optional and off by default.

Focus uses a 2px outline offset by 4px. Forced colors use system Highlight. Hover styles are gated by pointer hover support. Button transitions list specific properties and last 150ms; press scale is 0.96. Reduced motion removes all recurring animation, with labels retaining its meaning.

## Do’s and Don’ts

Reuse the existing semantic tokens, six type sizes, `.section-top`, action styles and layout edges. Keep the main game action before supporting history. Use native controls and label real status explicitly. Keep source health separate from a measured result, and preserve the visible distinction between live and demo.

Do not add a wallet, monetary framing, invented telemetry, a shared-score claim, extra font dependencies or promotional sections ahead of the game. A future view should begin with `.shell`, reuse the header and utility controls, use one primary action, and preserve static-hosting-compatible links.

Screen readers, physical phones, browser-native 200% zoom, audible output and every forced-colors combination were not manually tested. Detailed evidence and fixes are in `artifacts/validation.md`.
