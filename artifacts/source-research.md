# Source verification · 31 October 2026

The requester’s prototype was opened in Chromium. It identifies its old telemetry as synthetic. The new live adapter was researched independently using the official [API reference](https://docs.squeekchain.com/developers/api/), [WHEELY9000 description](https://docs.squeekchain.com/system/installation/), [SqueekCore reference](https://docs.squeekchain.com/developers/core/) and [event-indexing reference](https://docs.squeekchain.com/developers/index-events/).

## Actual endpoint observations

| Request | Observed result | Implementation decision |
| --- | --- | --- |
| `https://api.squeekchain.com/v1/status` | HTTP 200, schema 1, `provenance: hardware`, installation `stream-game-sepolia-test-20261025-01`, epoch `c011f01a-93ba-45ff-8579-619ddfdf40ec`, 120-second stale limit | Check hardware provenance, freshness, monotonic epoch work and device faults |
| `https://api.squeekchain.com/v1/measurement/runs?limit=100` | HTTP 200; `Access-Control-Allow-Origin: *`; `Cache-Control: no-store`; schema `measurement-runs.v1`; hardware segments; `certifiedCoreWork: false` | Read actual returned cursors until an empty page, then accept the coverage frontier |
| Full archive traversal around 21:36 UTC | 53 pages including the terminal empty page; 5,188 segments; 58,894 passages; no count/continuity-link mismatches | Confirmed that historical reconstruction is practical; no cursor was fabricated |
| Adapter validation around 21:46 UTC | 54 pages, 59,461 cumulative passages, 943 retained recent timestamps; coverage through 21:46:04.142 UTC | Real responses passed the final absolute-time/continuity checks |
| `https://api.squeekchain.com/v1/core` | Sepolia chain 11155111; live response identified core `0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44`, genesis 1793022600, round duration 600 seconds | Read for research only; no contract configuration or RPC is shipped |

The core address in the live response differed from the older address in documentation examples. It was not treated as a verified contract deployment. The game deliberately uses the verified official measurement API, permitted by the assignment, and does not claim on-chain settlement.

Distance was present but was a daily counter; work is preferable for this game. No work-to-distance conversion was introduced. Cadence is driven by uploads, not a promised number of seconds between measurements. During observation the hardware feed commonly advanced about every ten seconds. Polling, staleness checks and coverage rules tolerate variable arrival times.

## Absolute timestamps versus offsets

The stricter initial adapter found disagreements between `passages[].at - startAt` and `offsetNs` in historical records. For example, segment `cca0ac6b-c143-43d5-9b84-58b1a70d40ae` ended at `2026-10-28T00:47:07.843229Z`; its final offset differed by 5,707 ns from subtraction of the absolute timestamps. Other records differed by milliseconds.

The game uses the published absolute `at` timestamps as its time source. It does not reconstruct or adjust them using offsets. Unknown/unused fields are ignored; counts, endpoints, time ordering, continuity, hardware eligibility and full pagination remain mandatory. This is an explicit source limitation, not an invented conversion or tolerance applied to a round.

## Real future-window check

The actual round was locked at **21:50:21.860 UTC**, with a frozen target of **59 work units**. The measurement window was **(21:50:24.860, 21:51:24.860] UTC**. The cumulative passage count was **59,730 at both boundaries**, a valid idle result of zero. Full fresh source coverage arrived and the browser settled at **21:51:36.419 UTC**: UNDER correct, 100 points, 80 boss HP remaining. The statistical baseline used only earlier windows, with mean 53.8. See [the recorded round](live-round.json).

This check used ordinary elapsed time and the real API. Automated interaction tests use separately labeled fixtures and accelerated time; they are not evidence that the API produced their test outcomes.
