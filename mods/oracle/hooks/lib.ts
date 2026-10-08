import type { SessionMessage } from 'claude-code'

import type { Field, Mode, Path, Status } from '../types'

export const MODES: Record<Mode, { label: string; glyph: string }> = {
  collision: { label: 'COLLISION', glyph: '×' },
  inversion: { label: 'INVERSION', glyph: '▽' },
  escalation: { label: 'ESCALATION', glyph: '△' },
  wrongtool: { label: 'WRONG TOOL', glyph: '⌐' },
}

export const RINGS = { 1: 'THIS WEEK', 2: 'STRETCH', 3: 'OTHER PLANET' } as const

const MODE_KEYS = Object.keys(MODES) as Mode[]
const STATUSES: readonly Status[] = ['open', 'picked', 'slop', 'parked', 'done']

export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export const fit = clip

const str = (v: unknown, max: number) => (typeof v === 'string' ? clip(v, max) : '')

const num = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback

function argOf(input: Record<string, unknown>): string {
  for (const key of ['file_path', 'command', 'path', 'pattern', 'url', 'query', 'description', 'prompt', 'name']) {
    const value = input[key]

    if (typeof value === 'string' && value !== '') {
      return clip(value, 70)
    }
  }

  return ''
}

// The last stretch of the conversation, newest kept when the budget bites.
export function digest(messages: readonly SessionMessage[], budget = 3600): string {
  const rows: string[] = []

  for (const m of messages.slice(-8)) {
    const tools = m.toolUses
      .map(t => `${t.isError === true ? '✗' : '·'}${t.tool}(${argOf(t.input)})`)
      .join(' ')
    const text = clip(m.text, m.role === 'assistant' ? 600 : 360)

    if (text === '' && tools === '') {
      continue
    }

    rows.push(
      `${m.role === 'user' ? 'PERSON' : 'CLAUDE'}: ${text}${tools === '' ? '' : `\n  tools: ${clip(tools, 360)}`}`,
    )
  }

  let used = 0
  const kept: string[] = []

  for (const row of rows.reverse()) {
    used += row.length + 1

    if (used > budget && kept.length > 0) {
      break
    }

    kept.unshift(row)
  }

  return kept.join('\n')
}

export function parsePath(raw: unknown): Path | null {
  if (typeof raw !== 'object' || raw === null) {
    return null
  }

  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id : ''
  const title = str(r.title, 48)
  const firstMove = typeof r.firstMove === 'string' ? r.firstMove.trim().slice(0, 700) : ''
  const mode = MODE_KEYS.find(m => m === r.mode)

  if (id === '' || title === '' || firstMove === '' || mode === undefined) {
    return null
  }

  const ring = num(r.ring, 1, 3, 2)
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [])

  return {
    id,
    title,
    why: str(r.why, 140),
    firstMove,
    mode,
    ring: (ring === 1 || ring === 3 ? ring : 2) as 1 | 2 | 3,
    reachDays: num(r.reachDays, 0, 3650, 7),
    surprise: num(r.surprise, 1, 5, 3),
    money: num(r.money, 0, 3, 0),
    fuel: strings(r.fuel),
    tools: strings(r.tools),
    sources: Array.isArray(r.sources)
      ? r.sources.flatMap(s =>
          typeof s === 'object' && s !== null && typeof (s as { url?: unknown }).url === 'string'
            ? [{ label: str((s as { label?: unknown }).label, 80), url: (s as { url: string }).url }]
            : [],
        )
      : [],
    spends: str(r.spends, 60),
    isWildcard: r.isWildcard === true,
    status: STATUSES.find(s => s === r.status) ?? 'open',
    round: num(r.round, 0, 100000, 1),
    createdAt: str(r.createdAt, 40),
  }
}

export function parseField(text: string): Field | null {
  let raw: unknown

  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }

  if (typeof raw !== 'object' || raw === null) {
    return null
  }

  const { now, paths } = raw as { now?: Record<string, unknown>; paths?: unknown }

  if (typeof now !== 'object' || now === null || !Array.isArray(paths)) {
    return null
  }

  return {
    now: {
      headline: str(now.headline, 140),
      situation: str(now.situation, 500),
      round: num(now.round, 0, 100000, 1),
      convenedAt: str(now.convenedAt, 40),
      council: Array.isArray(now.council) ? now.council.filter((s): s is string => typeof s === 'string') : [],
      trigger: str(now.trigger, 20),
    },
    paths: paths.flatMap(p => parsePath(p) ?? []),
  }
}

// Live paths in display order: strangest first, the wildcard last. A pick stays listed so the
// numbers `/next N` and the band share do not shift under the artist.
export function ordered(field: Field): Path[] {
  const open = field.paths.filter(p => p.status === 'open' || p.status === 'picked')
  const rank = (a: Path, b: Path) => b.surprise - a.surprise || a.ring - b.ring || b.money - a.money

  return [...open.filter(p => !p.isWildcard).sort(rank), ...open.filter(p => p.isWildcard)]
}

export const dollars = (money: number) => (money <= 0 ? '·' : '$'.repeat(Math.min(3, Math.round(money))))

export function renderField(field: Field): string {
  const rows = ordered(field).map((p, i) => {
    const flag = p.spends === '' ? '' : `  ⚑ ${p.spends}`
    const star = p.isWildcard ? '  ✶ WILDCARD' : ''
    const done = p.status === 'picked' ? '  ✓ picked' : ''

    return [
      `${i + 1}  ${RINGS[p.ring]} · ${MODES[p.mode].glyph} ${MODES[p.mode].label} · ${dollars(p.money)}${flag}${star}${done}`,
      `   ${p.title}`,
      `   ${p.why}`,
      `   → ${p.firstMove}`,
    ].join('\n')
  })

  return [
    `◈ ORACLE · round ${field.now.round}${field.now.headline === '' ? '' : ` · ${field.now.headline}`}`,
    ...(rows.length === 0 ? ['No open paths. /next convene calls a council.'] : rows),
    '/next N loads a first move · /next N go sends it · /next convene calls a new council',
  ].join('\n')
}

// Records a pick in the field file's text, keeping everything else as written.
export function markPicked(text: string, id: string): string | null {
  let raw: { paths?: { id?: unknown; status?: unknown }[] }

  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }

  const hit = raw.paths?.find(p => p.id === id)

  if (hit === undefined) {
    return null
  }

  hit.status = 'picked'

  return `${JSON.stringify(raw, null, 2)}\n`
}

export function buildSense(recent: string): string {
  return `You watch a working session between an artist and Claude and decide whether this moment is a FORK in the road: a point where an outside view of what to do next would be worth more than carrying on.

A fork is one of:
- a piece or feature just finished and the next move is open,
- a new direction or a fresh project is starting,
- a stall: the same problem across several turns, or a loop,
- a decision between options is about to be made without an outside view,
- a long drift away from the work itself or from making money.

Routine progress in the middle of a task is NOT a fork. Fixing a small bug, answering a question, or reporting that tests pass is NOT a fork.

Session so far:
${recent}

Reply with ONLY JSON: {"fork": true or false, "reason": "at most 14 plain words naming what kind of fork"}`
}

export function parseSense(reply: string): { isFork: boolean; reason: string } | null {
  const open = reply.indexOf('{')
  const close = reply.lastIndexOf('}')

  if (open === -1 || close <= open) {
    return null
  }

  try {
    const raw = JSON.parse(reply.slice(open, close + 1)) as { fork?: unknown; reason?: unknown }

    return typeof raw.fork === 'boolean' ? { isFork: raw.fork, reason: str(raw.reason, 100) } : null
  } catch {
    return null
  }
}
