#!/usr/bin/env python3
"""Pause gate for Tabula Rosetta.

Runs before every MCP tool call and Bash command. When a call is on the pause
list it forces a confirmation prompt, even in Auto mode (a hook "ask" cannot be
approved silently by the auto-mode classifier).

The pause list is permissions.ask in .claude/settings.json, plus a few Bash
patterns checked against the full command text (git force-push, git reset
--hard, recursive delete), because prefix rules miss variants like
`git -C . push --force`. Connector tool names are normalized, so
mcp__claude_ai_Higgsfield__generate_image and mcp__Higgsfield__generate_image
are the same tool.

Every paused call is logged to .claude/pause-log.jsonl (tool name and input
keys only, never values). Self-test: python3 .claude/hooks/pause-gate.py selftest
"""
import json
import os
import re
import subprocess
import sys
import time

TEST_MARK = "PAUSE_GATE_TEST"   # a harmless way to prove the gate is live

DANGEROUS_BASH = [
    (re.compile(r"\bgit\b[^;&|]*\bpush\b[^;&|]*(\s--force\b|\s-f\b|--force-with-lease|\s\+\S)"), "git force-push"),
    (re.compile(r"\bgit\b[^;&|]*\breset\b[^;&|]*--hard\b"), "git reset --hard"),
    (re.compile(r"\brm\b[^;&|]*\s(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b"), "recursive delete"),
]


def project_root():
    return os.environ.get("CLAUDE_PROJECT_DIR") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def load_rules(root):
    with open(os.path.join(root, ".claude", "settings.json")) as f:
        ask = json.load(f).get("permissions", {}).get("ask", [])
    return [r for r in ask if isinstance(r, str)]


def norm(name):
    return re.sub(r"^mcp__claude_ai_", "mcp__", name).lower()


def segments(cmd):
    return [s.strip() for s in re.split(r"&&|\|\||;|\||\n", cmd) if s.strip()]


def match(rules, tool, tool_input):
    """Return a short label for the pause rule this call hits, or None."""
    if tool == "Bash":
        cmd = str(tool_input.get("command", ""))
        if TEST_MARK in cmd:
            return "test sentinel"
        for pattern, label in DANGEROUS_BASH:
            if pattern.search(cmd):
                return label
        for rule in rules:
            m = re.fullmatch(r"Bash\((.*?)(?::\*)?\)", rule)
            if m and any(seg.startswith(m.group(1)) for seg in segments(cmd)):
                return rule
        return None
    wanted = {norm(r) for r in rules if r.startswith("mcp__")}
    return "pause list" if norm(tool) in wanted else None


def log(root, tool, label, tool_input):
    if os.environ.get("PAUSE_GATE_NOLOG"):
        return
    try:
        entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": tool, "matched": label,
                 "input_keys": sorted(tool_input.keys()) if isinstance(tool_input, dict) else []}
        if tool == "Bash":
            entry["command_head"] = str(tool_input.get("command", ""))[:80]
        with open(os.path.join(root, ".claude", "pause-log.jsonl"), "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def ask(reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask",
                                              "permissionDecisionReason": reason}}))


def run_hook():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0                      # not a hook call
    tool = payload.get("tool_name", "")
    tool_input = payload.get("tool_input") or {}
    root = project_root()
    try:
        label = match(load_rules(root), tool, tool_input)
        if label:
            log(root, tool, label, tool_input)
            ask("Pause gate: " + tool + " is on the Tabula Rosetta pause list (" + label + "). Say what it will do and what it costs, then confirm.")
    except Exception as exc:          # a broken gate must not become an open gate
        ask("Pause gate hit an error (" + type(exc).__name__ + "). Asking to be safe.")
    return 0


def selftest():
    root = project_root()
    rules = load_rules(root)
    cases = [
        ("mcp__Higgsfield__generate_image", {}, True), ("mcp__claude_ai_Higgsfield__generate_image", {}, True),
        ("mcp__Shopify__graphql_mutation", {}, True), ("mcp__Vercel__request_promote", {}, True),
        ("mcp__Supabase__apply_migration", {}, True), ("mcp__github__merge_pull_request", {}, True),
        ("mcp__claude_ai_Google_Drive__share_file", {}, False),   # Drive is not in the default pause list
        ("mcp__Figma__whoami", {}, False), ("mcp__Higgsfield__balance", {}, False),
        ("Bash", {"command": "git push --force origin main"}, True), ("Bash", {"command": "git -C . push --force"}, True),
        ("Bash", {"command": "git push origin +main"}, True), ("Bash", {"command": "git reset --hard HEAD~3"}, True),
        ("Bash", {"command": "ls && rm -rf build"}, True), ("Bash", {"command": "rm -fr node_modules"}, True),
        ("Bash", {"command": "echo " + TEST_MARK}, True),
        ("Bash", {"command": "git status"}, False), ("Bash", {"command": "git push origin feature"}, False),
        ("Bash", {"command": "rm notes.txt"}, False), ("Read", {}, False),
    ]
    bad = 0
    print("pause rules loaded from settings.json: " + str(len(rules)))
    for tool, tin, want in cases:
        got = match(rules, tool, tin) is not None
        bad += 0 if got == want else 1
        print(("PASS " if got == want else "FAIL ") + tool + (" " + str(tin.get("command", "")) if tin else "") + "  -> " + ("paused" if got else "open"))
    env = dict(os.environ, CLAUDE_PROJECT_DIR=root, PAUSE_GATE_NOLOG="1")
    res = subprocess.run([sys.executable, os.path.abspath(__file__)], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": "echo " + TEST_MARK}}),
                         capture_output=True, text=True, env=env)
    try:
        decision = json.loads(res.stdout)["hookSpecificOutput"]["permissionDecision"]
    except Exception:
        decision = None
    bad += 0 if decision == "ask" else 1
    print(("PASS " if decision == "ask" else "FAIL ") + "hook entrypoint returns permissionDecision=ask  (got " + str(decision) + ")")
    broken = subprocess.run([sys.executable, os.path.abspath(__file__)], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": "ls"}}),
                            capture_output=True, text=True, env=dict(env, CLAUDE_PROJECT_DIR="/nonexistent"))
    ok = '"ask"' in broken.stdout
    bad += 0 if ok else 1
    print(("PASS " if ok else "FAIL ") + "unreadable settings fails to ask, not to open")
    print("ALL PASS" if not bad else str(bad) + " FAILED")
    return 1 if bad else 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "selftest":
        sys.exit(selftest())
    try:
        sys.exit(run_hook())
    except SystemExit:
        raise
    except BaseException:
        ask("Pause gate crashed. Asking to be safe.")
        sys.exit(0)
