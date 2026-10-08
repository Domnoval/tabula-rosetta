# Field schema

The contract between the council (writes), the live page (reads, and writes signals) and the mod (reads `field.json`). Keep all three in step.

## Artifact database

### Collection `meta`

Doc `now`:

| Field | Type | Notes |
|---|---|---|
| `headline` | string, at most 120 chars | The Oracle's one-line read of the moment |
| `situation` | string, at most 500 chars | What is going on, in plain words |
| `round` | number | Council number, starts at 1 |
| `convenedAt` | ISO string | |
| `council` | string[] | Names of the seers that ran |
| `trigger` | `'fork' \| 'asked' \| 'interview'` | Why it spoke |
| `question` | string, at most 200 chars | The one thing the Oracle needs the artist to answer to judge better. Optional |

Doc `lens`: `{ center: string, worlds: string[], surprise: string[], slop: string[], distance: string }`. Read-only display of `oracle/lens.md`.

### Collection `paths`

One doc per path, doc id = slug.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Same as the doc id |
| `title` | string, at most 48 chars | |
| `why` | string, at most 140 chars | The payoff, not the process |
| `firstMove` | string, at most 600 chars | A complete prompt that can be sent as written |
| `mode` | `'collision' \| 'inversion' \| 'escalation' \| 'wrongtool'` | |
| `ring` | `1 \| 2 \| 3` | 1 visible result this week, 2 a stretch, 3 another planet |
| `reachDays` | number | Days to the first visible result |
| `surprise` | 1 to 5 | How unlikely the person was to think of it |
| `money` | 0 to 3 | 0 none, 3 direct revenue. Score honestly: the free paths are 0 or 1 |
| `fuel` | array of `'worlds' \| 'toolbox' \| 'outside' \| 'picks' \| 'ledger'` | What fed the idea |
| `tools` | string[] | Named tools and connectors the path uses |
| `sources` | `{ label: string, url: string }[]` | Real precedents, with links |
| `spends` | string, at most 60 chars | A short flag for what the first move costs or needs a yes for: credits, deploys, publishing, store writes. Empty if the first move is free |
| `isWildcard` | boolean | Exactly one per round |
| `isMoney` | boolean | Exactly one per round: the path that floats around money. Every other path is free of the money test |
| `doubt` | string, at most 200 chars | The strongest honest objection to this path. Required, and never a compliment in disguise |
| `status` | `'open' \| 'picked' \| 'slop' \| 'parked' \| 'done'` | |
| `round` | number | |
| `createdAt` | ISO string | |

### Collection `signals`

Written by the page, read by the council on its next run. Auto id.

| Field | Type | Notes |
|---|---|---|
| `type` | `'pick' \| 'slop' \| 'deeper' \| 'park' \| 'ask'` | |
| `pathId` | string, optional | The path acted on |
| `text` | string, optional | An `ask` question, or a slop reason |
| `at` | ISO string | |
| `handled` | boolean | The council sets true once read |

## Repo mirror: `oracle/field.json`

`{ "now": <meta/now>, "paths": [<path>, ...], "bench": [<bench>, ...] }`. Written by the council on every run so the mod and any surface without the page can show the same field.

`bench` holds the runner-ups the judge held back, so a good idea that lost this round is not lost: `{ title, seer, mode, why, held }` where `held` says in one line why it did not make the six. The page and the mod ignore it; the next council reads it and may promote an item. It is not written to the page database.

## Order

The mod and the page list live paths (open and picked) in the same order: surprise, highest first, then ring (nearer first), then money. The wildcard is always last. Money is shown (`$$`, `$$$`) only at 2 or more, which in practice is the one `isMoney` path.
