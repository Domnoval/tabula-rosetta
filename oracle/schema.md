# Field schema

The contract between the council (writes the field, reads the answers), the live page (reads the field, writes signals) and the mod (reads `field.json`, appends answers to `oracle/inbox.jsonl`). Keep all three in step.

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
| `question` | string, at most 200 chars | The one thing the Oracle needs the artist to answer to judge better. One question, never compound. The council writes it every round; a consumer that finds it empty or absent shows no ask |
| `questionId` | string slug | Stable for that question, of the form `r<round>-<slug>`, e.g. `r2-paid`. It belongs to the question, not the round: an unanswered question asked again later keeps its first id, and an answered one is not asked again. If absent, consumers fall back to the question text itself as the id |
| `questionOptions` | string[], 0 to 4 items, each at most 60 chars | Mutually exclusive answers that cover the likely ones, shown as one-tap choices. Free text is always allowed in addition, so there is never an "Other" option. Zero options means free text only. The council writes 2 to 4 |

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
| `type` | `'pick' \| 'slop' \| 'deeper' \| 'park' \| 'ask' \| 'answer'` | |
| `pathId` | string, optional | The path acted on. Not used by `answer` |
| `questionId` | string, `answer` only | The `now.questionId` being answered, or the question text when there was no id |
| `question` | string, at most 200 chars, `answer` only | A copy of the question text as it was asked |
| `choice` | string, `answer` only | The exact option string tapped. Omitted when none was tapped |
| `text` | string, optional | An `ask` question, a slop reason, or an answer's free words (at most 500 chars, omitted when none) |
| `at` | ISO string | |
| `handled` | boolean | Written `false`. The council sets it true once read; for an `answer`, only once it is recorded in `oracle/learned.md` |

An answer from the page: `{ type: "answer", questionId, question, choice?, text?, at, handled: false }`. At least one of `choice` or `text` is present.

**The latest answer wins, whole.** Each answer is complete in itself. When one `questionId` has several answers (from the page, the mod or chat), the one with the latest `at` is the current answer: its `choice` and its `text`, and nothing it leaves out is carried over from an earlier answer. Earlier answers are history. The page's display, the mod's display and the council's record all follow this one rule.

So the page sends each answer whole. A tap on an option sends at once, together with any words already typed in the field, as one answer that carries both (the same shape as the mod's `/next b <words>`). Send sends the typed words alone: an answer of its own, `text` only, which replaces an earlier choice. Changing an answer on a question with options starts from an empty field, so words written for an older option never stick to a newer one.

An `ask` signal whose words answer the Oracle's question is read by the council as an answer to it (recorded in `oracle/learned.md` with the source "page Ask box", then marked handled). The page itself still shows it only in the Ask box.

## Repo files

### `oracle/field.json`

`{ "now": <meta/now>, "paths": [<path>, ...], "bench": [<bench>, ...] }`. Written by the council on every run so the mod and any surface without the page can show the same field. `now` carries `question`, `questionId` and `questionOptions` exactly as `meta/now` does.

`bench` holds the runner-ups the judge held back, so a good idea that lost this round is not lost: `{ title, seer, mode, why, held }` where `held` says in one line why it did not make the six. The page and the mod ignore it; the next council reads it and may promote an item. It is not written to the page database.

### `oracle/inbox.jsonl`

Answers from the mod. One JSON object per line, appended, never rewritten by the mod. An illustrative line (an invented question, not a real answer):

```
{"type":"answer","questionId":"r3-hours","question":"How many hours a week can go to the work right now?","choice":"10 to 20","text":"more once the nights are long","at":"2026-10-08T12:00:00.000Z","source":"mod"}
```

Fields: `type` is always `"answer"`, `questionId`, `question` (at most 200 chars), `choice` (optional), `text` (optional, at most 500 chars), `at` (ISO), `source` is always `"mod"`. Same meanings as the page's answer signal: at least one of `choice` or `text` is present, and each line is a whole answer. The latest line per `questionId` (by `at`) is the current answer, whole, as in "The latest answer wins, whole" above. `/next b <words>` sends a tap and words as one answer in one line; `/next answer <words>` is an answer of its own, `text` only, and replaces an earlier choice. The mod's band and `/next` show that latest line. Each surface shows only its own answers: an answer given on the page or in chat does not show in the mod, and a mod answer does not show on the page, until the next council hears them all and asks its new question. There is no `handled` field: the council empties the file once every line is recorded in `oracle/learned.md`. On the mod's own checkout the file may be absent or empty; both mean no answers.

The file is local and never committed: it holds the artist's own words verbatim and this repository is treated as public, so it is listed in `.gitignore`. Only a council on the same checkout as the mod sees it: the same machine, or the same cloud session (the mod can run there too). A council anywhere else cannot read those answers; when the file is absent it says no mod answers were found on this checkout, instead of claiming there were none.

The mod commands that write it:

| Command | Writes |
|---|---|
| `/next a` to `/next d` | `choice` = option a to d of `now.questionOptions`. Any words after the letter become `text`: `/next b because the pay page` |
| `/next answer <your words>` | A free-text answer: `text` only |
| `/next` | Writes nothing. Prints the field, including the question, its options lettered a) to d), and the answer if one was given |

Path numbers (`/next 1` to `/next 9`) are unchanged.

### `oracle/learned.md`

The running log of what the Oracle learned from the artist, newest first. Written only by the council. Each entry is dated and holds the question (with its `questionId`), the answer, where it came from (page, page Ask box, mod or chat) and what it changes. A council writes one entry per `questionId`: the current answer (the latest, whole), with any earlier answers it heard for that question listed under it as history, each with its time and source. Page answer signals are marked handled and `oracle/inbox.jsonl` is emptied only after their answers are in this file.

This repository is treated as public, and this file is committed. The exact `choice` goes in word for word. The artist's `text` goes in word for word only when it holds no personal context; otherwise it is paraphrased at a distance (themes only: never people, their circumstances, causes or specifics) and labeled as a paraphrase. A line of the inbox that does not parse follows the same rule. No customer personal data.

At the top, under "Held questions", sit the questions a council kept for a later round (date, the question, why it was held). The next council reads them and may ask one; once asked or answered, it leaves that list.

## Order

The mod and the page list live paths (open and picked) in the same order: surprise, highest first, then ring (nearer first), then money. The wildcard is always last. Money is shown (`$$`, `$$$`) only at 2 or more, which in practice is the one `isMoney` path.
