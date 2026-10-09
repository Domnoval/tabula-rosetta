# Bridge: the Oracle thread

Handoff from the session that built the Oracle (https://claude.ai/code/session_01N7paMZd61pbgeGbRZ9xyKa, 2026-10-08 to 2026-10-09) to the next one. Anything newer on the branch than this file's last commit came after it; an answer the artist gave after that lands in `oracle/learned.md`.

**Treat this repository as public, whatever its visibility.** Personal context about the artist never goes into it: not in this file, `lens.md`, `learned.md`, `field.json` or a commit message. When a judgment needs specifics, ask the artist in chat.

## Paste this to start the new thread

```
The Oracle work is on branch claude/trusting-ritchie-u01uv3 of Domnoval/tabula-rosetta
(draft PR #3, not merged into main). Run git branch --show-current. If it is not that
branch, even if this session was told to use another branch name, run:
  git remote set-branches --add origin claude/trusting-ritchie-u01uv3
  git fetch origin claude/trusting-ritchie-u01uv3
  git checkout claude/trusting-ritchie-u01uv3
Work and push only on that branch, so PR #3 keeps the whole Oracle, and pull with
--rebase before every push, in case another session pushed to it.
Then read oracle/BRIDGE.md, oracle/lens.md, oracle/learned.md and oracle/field.json,
and tell me in five lines where the Oracle stands and what you would do first.
Ask me anything you need with options I can tap.
```

## What the Oracle is

A council that reads the work and the session and proposes paths, aiming for ones the artist would not reach alone. Round 1 missed that bar, so treat it as the target, not a given. There are three parts:

| Part | Where | What it does |
|---|---|---|
| The council | `.claude/skills/oracle/SKILL.md`, seer templates in `.claude/skills/oracle/references/seers.md`, the heavier pipeline in `.claude/skills/oracle/references/council-workflow.js` | Six read-only seers in parallel (collider, inverter, escalator, wrongtool, ledger, scout). A judge kills the obvious and composes six paths: five reachable and one wildcard, exactly one about money, each with a `doubt`, plus one question for the artist with options. `/oracle` runs the one-judge council in `SKILL.md`; the pipeline adds critics, three judges and a rules audit and runs through the Workflow tool with `args`. Tell the artist which one ran. |
| The Field page | Private artifact https://claude.ai/artifact/7HRN9HuAdjnNQXP988PmVe (link also in `oracle/page/URL`), source `oracle/page/index.html` | A UHF tuner dial: paths are stations, rings are distance, the wildcard bleeds in from outside the band. Its database holds `meta/now`, `meta/lens`, `paths/*` and `signals/*`. Its buttons write `signals` docs: Tune in = `pick`, Static = `slop`, Deeper = `deeper`, Park = `park`, the Ask box = `ask`, and the question card = `answer`. |
| The mod | `mods/oracle` (v0.3.0) | A sentinel inside Claude Code: it senses forks in the road, nudges once, shows the council's paths and question above the prompt, and handles `/next`, `/next a` to `/next d`, `/next answer` and `/next convene`. It makes no suggestions of its own. In a cloud session nothing it draws shows (no band, no nudge line); `/next` prints as text there. See Conventions for loading it. |

Data and rules: `oracle/lens.md` (taste and ground rules, treated as law), `oracle/schema.md` (the contract between council, page and mod), `oracle/field.json` (the current round, mirrored into the page database) and `oracle/learned.md` (every answer the artist gave and what it changed, newest first).

## What the artist said (the reasons the rules exist)

- **Round 1 failed.** The first mod dealt cheap per-turn hands from the same thread, so it suggested only what was about to be typed anyway. The verdict was that it was "wrong as fuck". It was rebuilt as the council, the page and the sentinel.
- **The interview's answers are the Lens.** Read them in `oracle/lens.md`.
- **"Let one thing float around money, not everything."** Money gets one seat per round, and the rest are free of the money test.
- **"Placation, or saying something is a good idea just because, is not fine."** Every path carries a `doubt`, the strongest honest objection to it.
- **"Questions and clarification are always fine."** And then: **"If there is an ask I should be able to easily answer it."** Every question to the artist comes with tappable options and room for their own words: in chat (AskUserQuestion), on the page (the question card) and in the mod (`/next a` to `/next d`, `/next answer`).
- **"Let's just learn together as we go."**
- **"Take your time, do it correctly: a solid foundation, done right the first time."** Verify before shipping, fix root causes, and never present half-built work as done.

## Context (abstract on purpose)

All of this is already folded into `oracle/lens.md` ("Returning, not starting over" and ground rules 8 and 9) and logged in `oracle/learned.md`.

- **Returning, not starting over.** There were buyers before a long pause from the work, and the artist now has most days for it again.
- **Past sales happened off Shopify.** Shopify shows no orders ever, so the money went through the artist's own payment page or directly. That buyer list has gone cold, but it exists, and it never goes into the repo.
- **Personal history is material only at a distance.** Themes like absence and return are allowed. People, their circumstances and specifics are not.
- **A just-finished painting is spoken for.** It is not inventory. Never sell it, build a path on it or contact anyone about it. Its details stay out of the repo, so ask the artist in chat if a session needs them.

## Never

- Name or describe the people behind the pause, or their circumstances. Themes only.
- Sell, write about or contact anyone about the painting that is spoken for.
- Write personal context into this repo.
- Touch the TCCYG client site.
- Start a path's first move without the artist's explicit pick, or let a seer write, publish, spend or contact anyone.
- Offer a path without its `doubt`, or ask the artist a question without tappable options.

## State of the rounds

- **Round 1 (24 candidates, 6 paths):** money-heavy by mistake.
- **Round 2 (re-judged from the same pool under the new rules):** retired. Its paths were deleted from the page database on 2026-10-09; its survivors sit on round 3's bench.
- **Round 3 (current, convened 2026-10-08T19:40Z on the heavier pipeline):** in `oracle/field.json` and the page database.
  - **Pendants: paint the answer to a work that sold.** The money seat, ring 1.
  - **A painting your rods finish in the dark.** Ring 2.
  - **Let the sun draw the turn of the year.** Ring 2.
  - **No Such Number: the post office signs the sigil.** Ring 2.
  - **A Pink TV station that airs only in flight.** Ring 2.
  - **Bounce a sigil off the Moon, keep the return.** The wildcard, ring 3.
  - **The question:** `r3-buyer-reach`, "Without digging, how many past buyers of your paintings or commissions could you still reach?", with the options None, One or two, Three or more. It was asked in chat at the end of the old session.
    - **If `oracle/learned.md` has an `r3-buyer-reach` entry,** it is answered: build on it and do not ask again.
    - **If it has none,** first read the page's unhandled `signals` (answer signals, and any `ask` that answers it) as `SKILL.md` "Hearing the answers" says, and record what you find. If there is nothing, ask it once with AskUserQuestion, word for word, with those three options in that order and the id kept as `r3-buyer-reach`. Record the answer (source: chat), then commit and push before anything else.
    - **What the answer moves:** "None" removes Pendants' premise (its first move needs a buyer the artist can still reach), the way Stop Me's premise went in round 2. "Three or more" is the bench's cue to revive Split tallies.
  - **The bench:** 23 runners-up in `field.json`, each with why it was held. Split tallies waits on the answer (revive at three or more); Hibutsu and Buy a painting back also hinge on a buyer in reach.
  - **No page signal was unhandled** when this was written. Check again anyway: the question card can hold a tapped answer by now.

## What landed (2026-10-09)

Nothing is in flight. Everything below is pushed or live.

- **Easy answers, one contract for page, mod and rules.** `oracle/schema.md` and `mods/oracle/README.md` are the source of truth.
  - **The question:** `now` (in `field.json` and the page's `meta/now`) carries `question`, `questionId` (a stable slug of the form `r<round>-<slug>`) and `questionOptions` (the council writes 2 to 4, each at most 60 chars).
  - **An answer from the page** is a `signals` doc: `{ type: "answer", questionId, question, choice?, text?, at, handled: false }`. Per `questionId` the latest answer wins whole.
  - **An answer from the mod** is one JSON line in `oracle/inbox.jsonl` (gitignored): the same fields except `handled`, plus `"source": "mod"`.
  - **The rules:** answers are recorded in `oracle/learned.md` and pushed before any page signal is marked handled or the inbox is emptied.
- **The mod, v0.3.0:** 34 tests pass, `claude plugin validate` passes, `tsc` is clean.
- **The page:** its third publish carries the question card, and the page database holds round 3 (`meta/now` at version 3, `meta/lens` at version 2, six `paths` docs).

To check it yourself: `git show origin/claude/trusting-ritchie-u01uv3:oracle/field.json` has `now.round` 3; an ArtifactData `get` of `meta/now` on the page agrees; the live page (Artifact tool, read action) matches `oracle/page/index.html` apart from the viewer's wrapper; and `claude plugin test mods/oracle` passes.

## Open items

- **[PR #3](https://github.com/Domnoval/tabula-rosetta/pull/3) is a draft and unmerged.** GitGuardian is its only check. Merging is on the pause list.
- **A cleanup of the repository's history is pending.** Ask the artist in chat for its status before merging PR #3 or changing the repo's visibility. Its details stay out of the repo.
- **Only the artist can check the page in the real viewer.** It was verified in a local headless harness (dark, light, phone width, keyboard, screen-reader states, failed writes) that is gone with the old session; in the viewer only the Ask box write is confirmed. Ask the artist to open the link on a phone and a desktop and look at the dial, a live update and the question card. A tap on the card writes a real `r3-buyer-reach` answer: read it with ArtifactData and record it per `SKILL.md`.
- **Accepted gaps:**
  - Each surface shows only its own answers: an answer given on the page or in chat does not show in the mod, and a mod answer does not show on the page, until the next council hears them all (see `oracle/schema.md`).
  - At window widths from 1200 to 1499px, opening a path's drawer hides the left column with the question card. Closing the drawer brings it back.
- **Outside research is blind.** This environment's network policy blocked every outside site tried, so the council's precedents are search snippets labeled "(not opened)". Widening Network access in the cloud environment settings would fix it.
- **The wildcard's first move is untested.** It needs `pysstv` and `sstv`, which were missing from the old container.
- **The Channel 37 claim is unverified.** "Channel 37: a dome show on the dark frequency" is on the bench. It says US TV channel 37 has been kept free of TV stations since 1963 for radio astronomy, from memory. Check it before promoting that item.
- **The store has unexplained gaps:**
  - Carts started but none completed, with payment setup unverified.
  - Signed prints sit in archived listings while the live variants show 0.
  - The originals collection is empty.

  Re-pull the figures from Shopify, read-only, rather than trusting old numbers.

## Conventions the old session learned the hard way

- **Mod:**
  - **Helpers that take `$` go at the top level.** Declare them at the top of `register.tsx`, never inside `register()`, or `claude plugin validate` refuses the file.
  - **A command can't call `$.prompt.submit` itself.** Use the `queue()` helper.
  - **Inbox writes are read-modify-write.** They run one at a time through `recordAnswer`'s chain; keep it that way.
  - **Tests need bottom hooks:** `{ value }` for `$` nouns, `{ text }` for `prompt.submit`, `{ cwd }` for `session.start`.
  - **Checks:** `claude plugin validate mods/oracle` and `claude plugin test mods/oracle`.
  - **`tsc` needs a tsconfig.** It needs one that extends `./.claude-plugin/types/tsconfig.json`, which the engine lays out only when the mod loads from a folder you own. Recreate it in `mods/oracle` when you need `tsc`.
- **Loading the mod:**
  - **A cloud session** does not load it on its own. Load the plugin-authoring skill, turn on hot reloading when it asks, and copy `mods/oracle` into the session's mods folder (the skill names it). There it runs `/next` as text only: nothing it draws shows in a cloud session. That copy is private to the session and does not carry over, so `mods/oracle` in the repo stays the source; copy changes back.
  - **A terminal on a checkout of the branch:** `claude --plugin-dir mods/oracle`.
  - **After PR #3 merges:** `/plugin install oracle --marketplace Domnoval/tabula-rosetta`. That form comes from this build's plugin docs; the equivalent two-step form is `/plugin marketplace add Domnoval/tabula-rosetta`, then `/plugin install oracle@tabula-rosetta`. `.claude-plugin/marketplace.json` exists only on this branch until the merge.
- **The page:**
  - **Data and code are separate.** The database holds the data and the HTML holds the code, so a new round needs no republish.
  - **To republish from a new session:** read the live artifact in full with the Artifact tool's read action, merge, then publish with `url`.
  - **ArtifactData writes:** pin a write to an existing doc with `if_version` from your last read. Omit it only when creating a doc, such as a new round's `paths/<slug>`. Follow `SKILL.md` for the order: answer signals are marked handled while hearing the answers, after `learned.md` is pushed; the round itself is one batch (`meta/now`, `meta/lens`, the old paths deleted, the new paths created); then the other signals the council consumed are marked handled.
- **Paths that keep work local:** some first moves (Pendants, No Such Number) keep their files on an unpushed local branch so nothing private reaches the repo. That assumes the artist's own machine. In a cloud session, hand the files to the artist instead (as a file or in chat), never push them, and say that the container's copy will not last.
- **Ask first:**
  - **The pause gate:** `.claude/hooks/pause-gate.py` pauses exactly the tools named in `permissions.ask` in `.claude/settings.json`, plus force-push, hard reset and recursive delete in any Bash form. That list covers CLAUDE.md's pause list:
    - GitHub merges, file deletes, workflow runs, new repos and auto-merge.
    - Vercel deploys, promotes, rollbacks, domains, DNS, firewall and pausing projects.
    - Supabase SQL, migrations, edge function deploys, branch merges, resets and deletes, and creating, pausing or restoring projects.
    - Higgsfield generations, edits, voices, presets, ads and shorts runs, app runs, video analyses, site deploys, publishing, contests and trial cancellation.
    - Shopify product, collection, discount, inventory and digital-product writes, catalog imports, raw GraphQL mutations and store switches.
  - **Anything the gate does not name** that spends credits, publishes or writes to a store still gets asked in chat first, by hand. A tool that is new since the list was written is not on it.
  - **The Oracle's own rules add:** ask before any outbound message (email, DM, post), before contacting anyone, and before publishing anything public.
  - **The council and its seers are read-only.** Only the artist's pick starts a first move.
