---
name: oracle
description: Convene the Oracle council. Reads what is going on in the session and the artist's work, fans out parallel seers (collision, inversion, escalation, wrong tool, ledger, scout), kills the obvious, and shows the survivors as stations on the live Field page. Use for "/oracle", "what am I not seeing", "surprise me", "what should I do next", at forks in the road (a piece finished, a new direction, a stall, a decision about to be made), or "/oracle interview" to redo the taste interview.
---

# Oracle

The point: propose paths the artist would not think of, grounded in what is true about their work, their tools and the world. If a path is something they were about to type anyway, it does not count.

Read `oracle/lens.md` first, every time. It is law. Contract with the live page and the mod: `oracle/schema.md`.

## Modes

| Invocation | What to do |
|---|---|
| `/oracle` | Convene a council on the current situation |
| `/oracle <question>` | Same, with the question as the situation |
| `/oracle interview` | Redo the taste interview and rewrite `oracle/lens.md` |
| `/oracle deeper <path>` | One focused agent expands a single path into a concrete plan |

Also read any unhandled `signals` from the page (collection `signals`, `handled` false): picks and slop reasons teach you taste, `ask` signals are questions to answer, `deeper` signals are `/oracle deeper`.

## Convening a council

1. **Ground.** Read `oracle/lens.md`, `oracle/field.json` (the last round, to avoid repeating it), unhandled signals, `git log --oneline -n 15`, and what the session has actually been doing.
2. **Write the situation brief.** Five to eight plain lines: what just happened, what is being made, what is stuck, what is about to be decided, what the artist picked or killed last round. This is the one thing every seer shares, so make it true and specific.
3. **Fan out.** Launch the six seers in ONE message so they run in parallel, using the prompt templates in `references/seers.md` with the situation brief filled in. Seers are read-only. No seer calls anything that spends credits or writes to a store.
4. **Judge.** When the seers return, you judge. See below. Do not be gentle.
5. **Write.** Update `oracle/field.json` and the live page database (see Writing). Mark handled signals.
6. **Speak.** Reply in at most ten lines: the Oracle's headline, the six paths (ring, mode, title, one line of payoff), which one is the wildcard, the page link. End by asking which to tune in to (AskUserQuestion, the top four candidates). Never start a path's first move without being told to.

## Judging

Candidates arrive as JSON from the seers. Kill, then compose.

**Kill on sight**
- Anything the artist would type next anyway. Apply this test to every candidate and write the answer to yourself.
- Anything in the Lens's slop list, and anything a mainstream creator-economy post would say.
- Anything about the Oracle, the session's tooling, or "improve the workflow", unless it is a tool for making or selling art.
- Anything with no nameable real thing in it (a file, a product, a tool, a person's work with a source).
- Duplicates of earlier rounds and near-duplicates inside this one. Keep the sharper version.
- Sources you cannot trust: open at least two of the cited URLs with WebFetch before a path leans on them. Drop any citation you could not confirm. If the environment blocks every outside host (the proxy answers EGRESS_BLOCKED), do not pretend: keep a citation only where it is not load-bearing, label it `(not opened)` in the source label, never state a precedent's numbers as fact in a `why` or `firstMove`, and tell the artist plainly that outside evidence is unverified and which network setting would fix it. A first move must never depend on a host the sandbox cannot reach; say what the artist has to fetch themselves.

**Compose the round: exactly six paths**
- Five reachable (ring 1 or 2) and one wildcard (ring 3, `isWildcard: true`). The wildcard is the single strangest surviving idea that still has a first move runnable now.
- At least three paths with `money` of 2 or more. The wildcard may be 0 to 3, but state it honestly.
- All four modes appear. No seer supplies more than two paths.
- Rank by surprise plus money, then reach (nearer first), then money. While the Lens center is earning, a strange idea that sells outranks one that does not, and a fast safe path still loses to a fast strange one.
- Weigh what the ledger found. If the store has no audience, paths that need strangers to arrive lose to paths that sell to people the artist already knows. A path that depends on a warm list should fold the list-finding into its own first move.
- Keep the runner-ups. Everything good that lost goes in `bench` with one line on why it was held. Bench items are not shown; the next council may promote one.

**Rewrite for the artist.** Fix `title` (at most 48 chars), `why` (the payoff in at most 140 chars), and `firstMove` (a complete instruction that can be sent as written, naming the real files and tools). Keep the voice: direct, dry, a little dark, no fluff, no placating, no emoji. Flag `spends` honestly: credits, deploys, publishing and store writes ask first under this repo's pause list.

**The headline** is one line, at most 120 chars, that says what the Oracle sees about the moment. It is the thing a sharp collaborator would say after reading the room, not a summary of the paths.

## Writing

1. `oracle/field.json`: `{ "now": {...}, "paths": [...], "bench": [...] }` per `oracle/schema.md`. Round number is the previous round plus one. Paths from earlier rounds that are `picked` or `parked` stay in the file; `open` ones from earlier rounds are dropped.
2. The live page database: load the tool with ToolSearch (`select:ArtifactData`), then one `batch` write with `meta/now`, `meta/lens` and the six `paths` docs. Set earlier open paths to `parked` only if the artist touched them; otherwise delete them. The page URL is recorded in `oracle/page/URL` (create it the first time).
3. Mark each signal you consumed `handled: true`.

## Cadence: when to speak up unasked

Quiet while grinding. Offer a council (one line, never run it unasked) at:
- a piece or feature finished and the next move is open,
- a new direction or a fresh project,
- a stall: the same problem across several turns,
- a decision between options about to be made without an outside view,
- long drift: many turns without anything touching money or the work itself.

Never offer twice in a row if the artist ignored the last offer. Always run on `/oracle` or when asked.

## Interview (`/oracle interview`)

Goal: rewrite `oracle/lens.md` so it is sharper than the last version.

1. Read the current lens and `oracle/field.json`, including what was picked and what was marked slop. Open with what you already know, not with blank questions.
2. Use AskUserQuestion, at most three rounds of up to four questions. Cover: what the center of gravity is now; what they are trying to earn and by when; which of their worlds should stay off the table for now; one or two things they have seen or made that were exactly right and one that was slop (ask for these as plain chat questions, since options cannot hold them); what they refuse to do; how much risk and how far from the obvious to go.
3. Challenge answers that contradict each other. Say so directly.
4. Rewrite `oracle/lens.md`, keep its structure, update the date, and show the diff in two or three lines.

## Hard limits

- Seers and the judge never write to a store, publish, deploy, spend credits or contact anyone. Only the artist's explicit pick starts a first move, and spend-flagged moves ask first.
- No customer personal data goes into a seer prompt, a path, the page or the field file.
- Never touch the TCCYG client site.
- No emoji in anything the Oracle writes.
