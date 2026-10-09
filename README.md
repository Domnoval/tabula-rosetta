# Tabula Rosetta

A clean-slate Claude workspace. No gates, a curated toolbox, and a pause line on anything irreversible or outward-facing.

| File | What it does |
|---|---|
| `CLAUDE.md` | Who I am, how to work with me, and what to pause on |
| `.claude/settings.json` | Allow and ask rules: open servers allowed whole, gated servers allowed whole with the risky calls forced back to ask |
| `environment/setup.sh` | Paste into the cloud environment's Setup script field |
| `connectors.md` | Connector policy table |
| `mods/oracle/` | The Oracle's sentinel: senses forks, nudges once, shows the council's paths and question above the prompt, takes one-tap answers. It makes no suggestions of its own. See its README and `oracle/BRIDGE.md` |
| `.claude-plugin/marketplace.json` | Makes this repo a marketplace: `/plugin install oracle --marketplace domnoval/tabula-rosetta` |

Generated from the Tabula Rosetta blueprint with its default dials: Auto mode, Full network, seven connectors, no gstack.

Draft: the allow and ask rule syntax is verified on the first session in this repo.

## Pause gate

The pause list lives in `.claude/settings.json` under `permissions.ask`. `.claude/hooks/pause-gate.py` runs before every MCP tool call and Bash command and forces a confirmation prompt for anything on that list. A hook "ask" cannot be approved silently by the Auto-mode classifier, so the gate holds in Auto. It is a plain project hook, so it runs in cloud sessions (single-repo sessions), the terminal and the desktop app, and it does not depend on mods.

What it adds on top of the ask rules:

- Dangerous shell commands are matched against the full command text, so `git -C . push --force` is caught along with `git push --force`. This covers force-push, `git reset --hard` and recursive delete.
- Connector names are normalized, so `mcp__claude_ai_Higgsfield__generate_image` and `mcp__Higgsfield__generate_image` are the same tool.
- A broken settings file makes it ask on everything instead of opening the gate.
- Paused calls are logged to `.claude/pause-log.jsonl` (tool name and input keys only, never values).

Check it:

1. `python3 .claude/hooks/pause-gate.py selftest` runs 22 checks and prints `ALL PASS`.
2. In a live session, ask Claude to run `echo PAUSE_GATE_TEST`. It is harmless and always paused. If it runs without a prompt, the session is not reading this repo's settings. Cloud sessions only read them when the repo is the only one attached.

Notes:

- An unanswered prompt can expire an idle cloud session, so answer paused calls promptly.
- To change what is paused, edit `permissions.ask`.
- Drawn mods (status bands, panes, glyphs) do not render in cloud sessions. They work in the terminal and the desktop app's Code tab.
