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
    isMoney: r.isMoney === true,
    doubt: str(r.doubt, 220),
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

  const question = str(now.question, QUESTION_MAX)

  return {
    now: {
      headline: str(now.headline, 140),
      situation: str(now.situation, 500),
      round: num(now.round, 0, 100000, 1),
      convenedAt: str(now.convenedAt, 40),
      council: Array.isArray(now.council) ? now.council.filter((s): s is string => typeof s === 'string') : [],
      trigger: str(now.trigger, 20),
      question,
      // No question, nothing to answer: the id and the options mean nothing without one.
      questionId: question === '' ? '' : idOf(now.questionId, now.question),
      questionOptions: question === '' ? [] : parseOptions(now.questionOptions),
    },
    paths: paths.flatMap(p => parsePath(p) ?? []),
  }
}

// The answer contract the council, the page and this mod share (oracle/schema.md).
export const QUESTION_MAX = 200
export const OPTION_MAX = 60
export const OPTIONS_MAX = 4
export const TEXT_MAX = 500
export const LABEL_MAX = 120
export const LETTERS = ['a', 'b', 'c', 'd'] as const

// The question's stable id, or the question text itself when the council left it out.
function idOf(id: unknown, question: unknown): string {
  if (typeof id === 'string' && id.trim() !== '') {
    return id.trim()
  }

  return typeof question === 'string' ? question.trim() : ''
}

// Strings only, each trimmed and capped, empties and repeats dropped, at most four. The page
// cleans them the same way, so a letter here names the same option as that letter there.
export function parseOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .filter((s): s is string => typeof s === 'string')
    .map(s => s.trim().slice(0, OPTION_MAX).trimEnd())
    .filter((s, i, all) => s !== '' && all.indexOf(s) === i)
    .slice(0, OPTIONS_MAX)
}

// "a", "a-b", "a-c", "a-d": the letters a question with n options answers to.
export const letterSpan = (n: number) => (n <= 1 ? 'a' : `a-${LETTERS[Math.min(n, OPTIONS_MAX) - 1]}`)

export type Answer = { choice?: number; text?: string }

export const NO_WORDS = 'An empty answer says nothing. Try /next answer <your words>.'

// What `/next <args>` says as an answer: an option by letter (a-d, any case, trailing
// punctuation forgiven, more words after it become the why), free words after "answer",
// or a reason it cannot be one. Null when the args are not an answer at all (paths,
// convene, a bare /next).
export function parseAnswer(args: string, optionCount: number): Answer | { error: string } | null {
  const [head = '', ...rest] = args.trim().split(/\s+/)
  const word = head.toLowerCase()
  const more = clip(rest.join(' '), TEXT_MAX)

  if (/^answer[.:,;!?-]*$/.test(word)) {
    return more === '' ? { error: NO_WORDS } : { text: more }
  }

  const hit = /^\(?([a-z])[).:,;!?-]*$/.exec(word)

  if (hit === null) {
    return null
  }

  const letter = hit[1] as (typeof LETTERS)[number]
  const choice = LETTERS.indexOf(letter)

  // A letter past d is never an option, but it is plainly an attempt at one.
  if (choice === -1 && optionCount > 0) {
    return {
      error: `There is no option ${letter}): this question has ${letterSpan(optionCount)}. Or answer in words: /next answer <your words>.`,
    }
  }

  if (choice === -1) {
    return null
  }

  if (optionCount <= 0) {
    return { error: `This question has no options, so there is no ${letter}). Answer in words: /next answer <your words>.` }
  }

  if (choice >= optionCount) {
    return {
      error: `There is no option ${letter}): this question has ${letterSpan(optionCount)}. Or answer in words: /next answer <your words>.`,
    }
  }

  return more === '' ? { choice } : { choice, text: more }
}

// What the band and /next show for an answer: the option, the words, or both.
export function answerLabel(choice: string | undefined, text: string | undefined): string {
  const parts = [choice, text].filter((s): s is string => s !== undefined && s.trim() !== '')

  return clip(parts.join(' · '), LABEL_MAX)
}

// One line of oracle/inbox.jsonl, keys in contract order; an absent choice or text is left out.
export function answerLine(a: {
  questionId: string
  question: string
  choice?: string
  text?: string
  at: string
}): string {
  return JSON.stringify({
    type: 'answer',
    questionId: a.questionId,
    question: clip(a.question, QUESTION_MAX),
    choice: a.choice,
    text: a.text === undefined ? undefined : clip(a.text, TEXT_MAX),
    at: a.at,
    source: 'mod',
  })
}

// $.fs has no append: the file's text with one more line, newline-terminated.
export function appendLine(before: string, line: string): string {
  return `${before}${before === '' || before.endsWith('\n') ? '' : '\n'}${line}\n`
}

// The answer recorded for a question, by own key only: an id such as "constructor" must not
// find Object.prototype's member.
export const answerFor = (answers: Record<string, string>, id: string): string | undefined =>
  Object.hasOwn(answers, id) ? answers[id] : undefined

// The latest answer label per questionId in oracle/inbox.jsonl. Blank, malformed and
// foreign lines are skipped; a later line wins unless its time says it is older.
export function answersFromInbox(text: string): Record<string, string> {
  const latest = new Map<string, { label: string; at: number }>()

  for (const line of text.split('\n')) {
    let raw: unknown

    try {
      raw = JSON.parse(line)
    } catch {
      continue
    }

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      continue
    }

    const r = raw as Record<string, unknown>
    const id = idOf(r.questionId, r.question)
    const choice = typeof r.choice === 'string' ? r.choice.trim() : ''
    const words = typeof r.text === 'string' ? r.text.trim() : ''

    if (r.type !== 'answer' || id === '' || id === '__proto__' || (choice === '' && words === '')) {
      continue
    }

    const at = typeof r.at === 'string' ? Date.parse(r.at) : Number.NaN
    const prev = latest.get(id)

    if (prev !== undefined && at < prev.at) {
      continue
    }

    latest.set(id, { label: answerLabel(choice, words), at })
  }

  const out: Record<string, string> = {}

  for (const [id, { label }] of latest) {
    out[id] = label
  }

  return out
}

// Live paths in display order: strongest first, the wildcard last. A pick stays listed so the
// numbers `/next N` and the band share do not shift under the artist.
export function ordered(field: Field): Path[] {
  const open = field.paths.filter(p => p.status === 'open' || p.status === 'picked')
  const rank = (a: Path, b: Path) => b.surprise - a.surprise || a.ring - b.ring || b.money - a.money

  return [...open.filter(p => !p.isWildcard).sort(rank), ...open.filter(p => p.isWildcard)]
}

// Money shows only where it is the point: 2 and up, which in practice is the one money path.
export const dollars = (money: number) => (money >= 2 ? '$'.repeat(Math.min(3, Math.round(money))) : '·')

// The question block of /next: the question, its options lettered, how to answer, and
// what was answered once it was.
export function renderAsk(now: Field['now'], answered: string | undefined): string[] {
  if (now.question === '') {
    return []
  }

  const options = now.questionOptions
  const how =
    options.length === 0
      ? '/next answer <your words>'
      : `/next ${letterSpan(options.length)} picks one (words after the letter say why) · /next answer <your words>`

  return [
    `◈ The Oracle asks: ${now.question}`,
    ...options.map((o, i) => `   ${LETTERS[i]}) ${o}`),
    ...(answered === undefined
      ? [`   answer: ${how}`]
      : [`   ✓ you answered: ${answered}`, `   to change it: ${how}`]),
  ]
}

export function renderField(field: Field, answers: Readonly<Record<string, string>> = {}): string {
  const rows = ordered(field).map((p, i) => {
    const flag = p.spends === '' ? '' : `  ⚑ ${p.spends}`
    const star = p.isWildcard ? '  ✶ WILDCARD' : ''
    const done = p.status === 'picked' ? '  ✓ picked' : ''

    return [
      `${i + 1}  ${RINGS[p.ring]} · ${MODES[p.mode].glyph} ${MODES[p.mode].label} · ${dollars(p.money)}${flag}${star}${done}`,
      `   ${p.title}`,
      `   ${p.why}`,
      `   → ${p.firstMove}`,
      ...(p.doubt === '' ? [] : [`   ? ${p.doubt}`]),
    ].join('\n')
  })

  return [
    `◈ ORACLE · round ${field.now.round}${field.now.headline === '' ? '' : ` · ${field.now.headline}`}`,
    // The ask comes first: it is the one thing on the table that waits on the artist.
    ...renderAsk(field.now, field.now.question === '' ? undefined : answerFor(answers, field.now.questionId)),
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
