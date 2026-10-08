# Oracle

A Claude Code mod that deals three next moves after every turn. Not "add tests". Moves that name the file, the tool, the thing that just happened, and one that goes past where you were looking.

```
◈ ORACLE after turn 7 · ctrl+x tab, then 1 2 3 · /next new deals again   hide
1: ▲ NEXT      Pipe the lattice into the shader   Your sigil is static; the shader already owns the beat.
2: ◇ SIDEWAYS  Render it as a struck bell         Geometry as resonance, not picture.
3: ☾ EDGE      Let it eat itself                  Speculation: collapse shows what the seed was.   ⚑ asks first
```

## The three lanes

| Lane | What it is |
|---|---|
| `▲ NEXT` | What a sharp collaborator does right now, given exactly what just happened |
| `◇ SIDEWAYS` | Invert an assumption, or cross-wire two things that already exist here |
| `☾ EDGE` | What hasn't been seen yet. Darker, stranger, higher ceiling. Speculation is labeled |

Each card carries a complete prompt you can send as written. `⚑` marks a move that would spend credits, deploy, publish or write to a store, so it matches the repo's pause list before you press it.

## Why the suggestions are relevant

- **The fork engine** asks the session's own model over the live transcript, served from the prompt cache. It has read everything you have, so nothing is summarized away.
- **Repo grounding**: branch, uncommitted files, recent commits, your `CLAUDE.md`.
- **Toolbox grounding**: the MCP servers connected right now, folded by server, so it proposes moves your tools can actually run.
- **Taste memory** (`$.store`, across sessions): what you pick leans the next hand toward it, what you ignore leans away, and it never repeats a title it has dealt.
- **A rubric with teeth**: banned filler (tests, docs, refactor, "explore"), a requirement to name something real from the room, three genuinely different directions.

## Use

| | |
|---|---|
| `ctrl+x tab`, then `1` `2` `3` | Load that card into the prompt. Enter sends it |
| `/next` | Print the current hand as text (works on every surface) |
| `/next 2` · `/next 2 go` | Load card 2 into the prompt · send it now |
| `/next new` | Deal a fresh hand |
| `/next hide` · `/next show` | Hide or wake the band |
| `/next forget` | Wipe taste memory and dealt history |

## Config

Set in `/config` or `pluginConfigs.oracle.options`.

| Option | Default | |
|---|---|---|
| `engine` | `fork` | `fork` reads the live transcript. `fast` feeds a digest to a small model |
| `wildness` | `sharp` | `grounded`, `sharp` or `feral`: how far SIDEWAYS and EDGE may lean |
| `voice` | direct, witty, a little dark, zero cheerleading | How the cards talk |
| `fastModel` | `haiku` | Model for the fast engine, cold opens and fork fallback |
| `auto` | `true` | Deal after every turn and at session start. Off: only `/next` deals |

## Surfaces

The band is a drawn mod: it renders in the terminal and the desktop app's Code tab. In a cloud session nothing draws, so `/next` prints the hand and a status line says when one is ready.

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
