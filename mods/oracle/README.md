# Oracle (mod)

The mod half of the Oracle: a sentinel inside Claude Code. The thinking lives in the council (`.claude/skills/oracle/`), the taste in `oracle/lens.md`, the data contract in `oracle/schema.md`. This mod does five things:

1. **Senses forks.** After a turn, a small model decides whether this is a fork in the road: a finished piece, a new direction, a stall, a decision about to be made, a long drift. Routine progress is not a fork.
2. **Nudges, once, quietly.** On a fork it raises a one-line band and a status line. It backs off for three turns after a nudge, and for three more if the nudge was ignored.
3. **Shows the council's paths.** It reads `oracle/field.json` and lists the open paths above the prompt, one hotkey each, strangest first. Picking one loads its first move into the prompt and records the pick in the file. `/next` also prints each path's `doubt` (the honest objection).
4. **Asks you the council's one question, and takes the answer.** Each round the council asks one question (`question`, `questionId`, up to four `questionOptions`). The band shows it as `ASKS YOU: ...` with a button per option (`a` to `d`); `/next` prints it with the options lettered. An answer, from the band or from `/next`, is appended as one JSON line to `oracle/inbox.jsonl`, which the next council reads, records in `oracle/learned.md`, and empties. Once answered, the band shrinks the question to one dim line. Answers survive restarts: the mod rebuilds them from the inbox. It knows only the answers given here: one given on the live page or in chat does not show in the band until the next council has heard it and asks its new question.
5. **Convenes the council on demand.** `/next convene`.

It deliberately generates no suggestions of its own. Money gets one seat per round: exactly one path floats around earning, the other five are judged on strangeness alone, and `$` shows only on the money path. Cheap per-turn hands read the same thread you were already in, so they could only tell you what you were about to type.

## Commands

| | |
|---|---|
| `/next` | Print the council's question (options lettered a to d, and your answer if you gave one) and its paths (works on every surface) |
| `/next b` | Answer the question with option b (`a` to `d`; case and a trailing `.` or `)` do not matter) |
| `/next b because the pay page` | Option b, plus your reasons in words |
| `/next answer <your words>` | Answer in your own words. Always allowed; the only way when the question has no options |
| `/next 2` · `/next 2 go` | Load path 2's first move into the prompt · send it |
| `/next convene` | Call a council now |
| `/next interview` | Redo the taste interview |
| `/next page` | Print the live Field page link |
| `/next refresh` · `hide` · `show` | Re-read the field file · hide or wake the band |

Band: `ctrl+x tab`, then `a` to `d` to answer the question, the number to load a path (or, while a fork nudge is up, `c` to convene, `x` for "not now"). Free-text answers go through `/next answer`.

An answer line in `oracle/inbox.jsonl` (one per line, keys in this order, `choice` or `text` left out when absent):

```
{"type":"answer","questionId":"r2-paid","question":"Has anyone ever paid you for your art, outside the Shopify store?","choice":"A few times","text":"through the pay page","at":"2026-10-08T12:00:00.000Z","source":"mod"}
```

## Config

| Option | Default | |
|---|---|---|
| `cadence` | `forks` | `forks` nudges only at forks. `every` nudges after each turn. `ask` never nudges |
| `fastModel` | `haiku` | Model that decides whether a turn is a fork |

## Surfaces

The band is a drawn mod: terminal and the desktop app's Code tab. In a cloud session nothing draws, so the live Field page and `/next` text are the display there.

## Develop

```
claude plugin validate mods/oracle
claude plugin test mods/oracle
claude --plugin-dir mods/oracle
```

## Install

```
/plugin install oracle --marketplace domnoval/tabula-rosetta
```
