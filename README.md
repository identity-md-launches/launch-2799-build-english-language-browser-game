# Squeek Wheel Oracle

A playable, English-language community game built with React, TypeScript and Vite. Predict **UNDER** or **AT/OVER** a real hamster’s future wheel work, earn points, and defeat the Vacuum of the Void. The original prototype’s forest greens, lime accents and animated wheel are preserved with new, original SVG artwork.

`dist/` contains the complete production export for IMD hosting. Assets use relative URLs (`base: './'`); there is no backend, wallet, private key, transaction or paid reward.

## Install, run and rebuild

Use Node 22.12+ (validated with Node 24).

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

Serve `dist/` over HTTP(S), including at a subpath. Opening HTML directly with `file://` is not supported. Rebuild after changing source; IMD publishes the supplied export. Dependencies and browser binaries are development tools and must not enter the submission.

Optional browser validation:

```sh
npx playwright install --with-deps chromium webkit
npm run test:browser
```

This suite serves the real export under `/preview/`, uses explicitly mocked API responses and accelerated browser clocks, and writes disposable evidence under `test/scratch/interactions/`. Its fixtures are never included in the application bundle.

## Verified live source

Verified on 31 October 2026 against the [official API documentation](https://docs.squeekchain.com/developers/api/) and actual public responses:

- [`GET /v1/status`](https://api.squeekchain.com/v1/status): hardware provenance, counter epoch, cumulative work, health and observation times; schema `1`.
- [`GET /v1/measurement/runs?limit=100`](https://api.squeekchain.com/v1/measurement/runs?limit=100): chronological passage segments, absolute timestamps, continuity links and coverage; schema `measurement-runs.v1`.

One work unit is one accepted wheel-magnet passage. Distance is a daily counter, so this game uses work without converting it to metres. These API records describe device-key evidence, not Ethereum-certified work. No contract address is configured or required.

The documented status snapshot refreshes at most once per second; segments arrive with device uploads, without a guaranteed fixed cadence. The game polls status every 10 seconds and passage updates every 5 seconds, paginating at least 700 ms apart. It honors `Retry-After`. Both sources must be fresh within 120 seconds and consistent. CORS-enabled requests need no API key.

## Settlement and scoring

1. Read the metric, target, 60-second duration, source status and baseline. Choose a side and lock it. The immutable window starts three seconds later.
2. Reconstruct the cumulative count `C(t)` of accepted passages through timestamp `t`. Once all pages are read and source coverage reaches the end, work is `C(end) - C(start)`. The window is **(start, end]**. Source timestamps retain nanosecond precision. This count’s origin is the passage archive, not the device epoch counter.
3. Work **equal to** the target is AT/OVER. Correct: 100 points and 20 damage. Each additional consecutive win adds 10 points, capped at 50. Miss: zero points and streak reset. Five correct calls defeat each boss; the next starts at 100 HP.
4. Missing coverage, invalid evidence, counter changes or faults cannot award a result. A round without verifiable coverage within 120 seconds after its end is void; points, streak and health stay unchanged. Clock disagreement prevents live play. Closing the tab does not pause a live window.

The statistical baseline averages up to five recently completed windows of the same duration and metric, frozen before lock. It abstains without history. Targets cycle through 110%, 90%, 105% and 95% of the mean, rounded to at least 1 unit. The eight-second **DEMO** explicitly uses synthetic work, its own history and its own score. It never replaces a failed live feed automatically.

## Limits and actual checks

Initial synchronization reads the archive from its first page and can take a minute or more; reloads synchronize again. Only 30 minutes of passage timestamps remain in memory, with an exact cumulative anchor. Progress, pending rounds and the latest 100 results per mode persist in browser storage. Scores are editable and **not tamper-proof**. Export JSON for a portable record; this is not a shared leaderboard.

Historical `offsetNs` values sometimes disagreed with absolute passage times during research. Settlement uses the documented `at` timestamps directly, checking their order, segment counts and continuity. The browser trusts the official API and does not verify device signatures itself. API or schema changes can pause live play. There is no official affiliation or guaranteed Genesis eligibility.

Production build and typecheck passed; **34 unit tests passed**. Chromium and WebKit interaction checks passed for scoring, boss progression, reloads, keyboard controls, export, reflow, stale data, HTTP 503 and counter resets. A real, unmocked 60-second round also settled: 0 measured units against a target of 59, +100 points and 20 damage. The pinned design probe passed **16/16** checks. See [validation](artifacts/validation.md), [live-round evidence](artifacts/live-round.json), [source research](artifacts/source-research.md) and [DESIGN.md](DESIGN.md) for evidence and coverage limits.

Design review used the pinned Better Interface and Impeccable-derived documentation guidance. Attribution and retained licenses are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
