# Implementation and validation record

Completed on 31 October 2026. These are worker observations, not an independent certification. The deliverable is the production export in `dist/`, its source, lockfile and documentation. Public hosting is performed by IMD after submission; no separate deployment command was run.

## What was built

The game uses the official Squeekchain measurement API for 60-second future windows of accepted wheel-magnet passages. Choices lock three seconds before measurement starts. The target and statistical baseline freeze before lock; valid cumulative differences settle the round. Equality is AT/OVER. Scoring, capped streak bonuses, 20-point boss damage, replacement bosses, narrative feedback, history, local saves, JSON export and optional sound are implemented. An explicitly synthetic eight-second demo has separate progress and never replaces a failed live source automatically.

The production interface shows hardware-source links, freshness, last successful update, LIVE/STALE/OFFLINE/SYNCING/DEMO labels, settlement rules and the local-score limitation. No wallet, contract transaction, approval, money, private credential or affiliation claim is present. The wheel and boss are original SVG artwork. The prototype informed the requested green/lime direction and gameplay, not copied implementation.

## Executed checks

| Check | Actual result |
| --- | --- |
| `npm run build` | Passed. Vite 7.3.7 generated `dist/index.html`, relative CSS/JS URLs, favicon and local share assets. Final JS: 263.05 kB, CSS: 18.81 kB, before compression. |
| `npm run typecheck` | Passed, TypeScript `tsc --noEmit`. |
| `npm test` | Passed: 34 tests, zero failures. |
| `npm run test:browser` | Passed: eight scenario groups each in Chromium and WebKit, 16 total. |
| Axe accessibility audit within each browser run | Zero violations in the tested demo page state in both engines. This is not a full accessibility certification. |
| Pinned design probe | Passed 16/16 checks against `dist/` at 320, 390 and 1440 pixels. |
| Real official-source round | Completed an unmocked 60-second future window: zero measured work, target 59, UNDER correct, +100 points and boss HP 100 → 80. |
| Final visual inspection | Opened and inspected desktop and 390×844 screenshots of the actual production export with LIVE status. No horizontal overflow or clipped main controls observed. |
| Static hosting | Browser suite loaded the production export under `/preview/`, exercising relative asset URLs rather than a dev-server route. |

Dependencies and browser runtimes were installed outside the repository. The production source/configuration were copied to that isolated build directory, and its completed export was copied back. No dependency archive, cache, browser executable or `node_modules` directory is part of the submission. WebKit needed additional runtime libraries in a temporary directory and software EGL; its actual browser scenarios then passed. Skipping the host-library preflight for that private library path did not skip execution of the browser tests.

The final export was compared byte-for-byte with the tested build; all relative HTML assets exist. The delivered files total approximately **0.96 MiB**, below the 8 MiB limit. No dependency/cache directories, dependency archives or symlinks are included. The explicit path budget for `.gitignore` is **256 bytes**; it excludes generated dependencies/caches at every depth and keeps `dist/` and `artifacts/` included. No protected Git metadata or workflow files were modified.

The pinned probe was run from the repository root:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Its Playwright module and browser path were supplied from temporary directories. The pinned inputs and disposable scratch output are not runtime dependencies. The retained [probe summary](design-probe.json) contains the actual check records and the original report's SHA-256. [Browser results](browser-results.json) retain the actual per-engine scenario results. [Axe results](accessibility-results.json) retain both violation arrays.

## Interaction and data coverage

The 34 unit tests cover boundary equality; points, streak cap and boss replacement; misses and voids; idempotent settlement; invalid or premature evidence; immutable targets; forecast duration and past-only sample filtering; save validation and mode separation. Data tests cover exact nanosecond timestamps, cumulative anchors, complete cursor traversal, valid idle zero, missing final coverage, discontinuities, broken links, schema/provenance/count/order errors, duplicate segments, installation changes, stale data, faults, clock disagreement and the documented absolute-time choice.

The browser suite uses explicit API fixtures and accelerated clocks. It verifies six consecutive wins produce 750 points, one defeated boss and 80 HP on the next boss; a subsequent miss resets the streak without damage or points. It locks with the keyboard, checks choices disable, reloads an active round, verifies the new round does not display the previous round's work, reloads completed progress, filters history and reads an actual JSON download. It opens/closes the native guide with Escape and checks focus return.

Each engine checks 320, 390, 768 and 1440-pixel reflow, no script errors, reduced motion during an active demo, and the enabled main action on the first 390×844 screen. The demo action ends at 821.19 px in Chromium and 784.39 px in WebKit. The separately inspected LIVE screen's action ends at 771.19 px. The [mobile screenshot](mobile.png) also shows the visible keyboard focus ring; the [desktop screenshot](desktop.png) shows the completed real round in history.

Live fixtures exercise a ten-unit cumulative difference over a future 60-second window, frozen targets, HTTP 503 after locking, stale-source lock prevention and an epoch change during a round. Unverifiable rounds void without altering score, streak or boss HP. A missing observation cannot become a zero result.

The actual API was also traversed and tested without mocks. The real round ran during ordinary elapsed time, with coverage arriving after its end. Its boundary counts were both 59,730, establishing a valid idle zero rather than a missing-data fallback. See [source research](source-research.md) and [the captured round](live-round.json). This single observation demonstrates an actual integration, not a guarantee of future API availability.

Sound and animation toggles were exercised manually and their pressed states persisted. Audio quality was not assessed by listening.

## Better Interface review

The pinned guide's workflow and core principles in all six domains were read during implementation, with the relevant supporting sections consulted. The final review combined source inspection, the pinned rendered probe, automated browser interaction checks, axe audits and manual screenshot inspection. The requester’s dark forest-green/lime visual direction took precedence over generic style suggestions.

| Domain | Source and rendered coverage | Remaining limits |
| --- | --- | --- |
| Accessibility | Semantic main/header/footer, one h1, skip link, named native buttons, pressed/disabled states, native dialog/disclosures, keyboard lock, Escape/focus return, visible focus, textual health/state, live feedback, reduced motion. Both browser axe runs found zero violations in the checked state. | No manual screen-reader session or full assistive-technology matrix. Four secondary controls/links are below the comfortable 44px target size; the probe found all controls at least 24px or sufficiently spaced. |
| Layout | Shared alignment and spacing, restrained two-column desktop layout, single-column mobile, product and main action above the first 390×844 fold. Four widths tested in both engines; probe found no horizontal scroll, overlapping text, clipping or obscuring floating controls. | No physical-device testing; native 200% browser zoom was not manually exercised. |
| Writing | English, explicit work units and future duration, UNDER/AT/OVER boundary wording, baseline described as statistical, concise adjacent lock instructions, distinct source/error/demo states and recoverable empty history. Probe counted 23 first-screen prose words at 390, 37 at 1440. | Only English is supported. Generated source errors are intentionally conservative and may pause play during delayed responses. |
| Typography | Six shared sizes (12/14/16/20/32/48px), one system stack, two requested weights, tabular numerals, readable wrapping, no clipped important labels. Probe confirmed the scale and one computed family. | Actual system font fallback differs across platforms; no claim that a particular font is installed. |
| Colors | Implemented semantic tokens match the requested forest/lime palette. State is conveyed with text as well as color. Computed text/page contrast 16.12:1, muted/page 8.68:1, muted/surface 7.77:1, primary ink/lime 14.64:1, lime/page 16.05:1. Probe and axe found no failing measured text pairs. | Decorative SVG colors were not individually treated as text. Full forced-colors combinations were not visually audited. |
| UI | Single clear lock action, native selectable choices, nearby wait/failure explanations, fixed targets, persistent results, usable empty states, confirmation for destructive progress reset, local export, optional sound and animation control. Scoring/progression/reloads and unavailable-data flows tested in both engines. | Browser storage can be edited, cleared or unavailable; this is single-player progress, not an authenticated leaderboard. |

### Findings and repairs

Locations below refer to the final delivered source.

| Finding | Fix and verification |
| --- | --- |
| Initial live parser rejected historic records because unused offsets disagreed with absolute passage times. | `src/evidence.ts:79`: use documented absolute `at` timestamps; retain endpoint, order, count and continuity validation. Real archive traversal, unit tests and the unmocked round passed. The discrepancy remains disclosed as a source limitation. |
| A mobile icon could lose its accessible name when its visible help label was hidden. | `src/App.tsx:139`: explicit `aria-label="How to play"`; verified with axe and the guide keyboard/focus test. |
| A new locked round could show the preceding round's work before measurements existed. | `src/App.tsx:128` and `src/App.tsx:158`: active unknown work displays an em-dash instead of falling back to history. Browser assertion checks the new round's reading after every lock. |
| A browser clock behind the source could undermine the future-window lead time. | `src/evidence.ts:34` and `src/evidence.ts:62`: reject source timestamps more than one second ahead, and excessively old status snapshots. Unit tests cover disagreement; subsequent actual source synchronization recovered to LIVE. Slow or delayed status responses can conservatively pause live play. |
| Mobile utility hit areas and wheel height competed with the primary action. | `src/styles.css:221` and `src/styles.css:226`: 44px utility controls and a compact 148px illustration. Both engines confirm the primary action fits in the first 390×844 screen. |
| Intro copy initially triggered the probe's stacked-slogan threshold. | `src/App.tsx:144`: one short headline plus a plain descriptive sentence. Final copy and all 16 probe checks pass. The probe's remaining three two-beat matches include abbreviations in “No.” and “vs.” |
| The share-image action arrow was clipped. | `public/share.svg`: widen the action background, then regenerate and inspect the local 1200×630 PNG. Metadata points to `./share.png`. |

`DESIGN.md` records the final implemented tokens, typography, component states and responsive rules. No first-screen or repeated failed probe check remains.

## Operational limitations

Initial live synchronization walks the archive and can take a minute or more; reloads must synchronize again. The feed is not cached as authoritative evidence across reloads, so a pending round may void if its evidence cannot be rebuilt before the deadline. The client retains 30 minutes of timestamps and the exact earlier count anchor, plus 100 result records per mode.

The game trusts the verified official public API and hardware-provenance fields; it does not independently verify device signatures or certify Ethereum work. API cadence is variable, and API/schema changes or clock disagreement can stop live play. Source resets, stale data and missing coverage never silently switch to simulation. The demo is clearly labeled, optional and independent.

Screenshots and automated browser engines do not establish physical-phone behavior, screen-reader usability, audible sound quality or complete WCAG conformance. Those unperformed checks are explicit limits, not claimed results.
