import type { SessionMessage } from 'claude-code'

import type { Card, Deck, Lane } from '../types'

export const ORDER: readonly Lane[] = ['next', 'sideways', 'edge']

export const LANES: Record<Lane, { glyph: string; label: string; brief: string }> = {
  next: {
    glyph: '▲',
    label: 'NEXT',
    brief:
      'The move a sharp collaborator makes right now, given exactly what just happened. Name the file, the function, the artifact. Momentum, not maintenance.',
  },
  sideways: {
    glyph: '◇',
    label: 'SIDEWAYS',
    brief:
      'A lateral move: invert an assumption, or cross-wire two things that already exist here (a connected tool, a skill, a file, a metaphor) into something neither does alone.',
  },
  edge: {
    glyph: '☾',
    label: 'EDGE',
    brief:
      'What has not been seen yet. Darker, stranger, higher ceiling. Break the thing to learn what it is made of; let the collapse be the form. If it is speculation, the `why` says so.',
  },
}

const LEAN = {
  grounded: 'Keep SIDEWAYS and EDGE within a day of the current work: a stretch, not a leap.',
  sharp: 'SIDEWAYS should surprise. EDGE should feel slightly dangerous and still run in one prompt.',
  feral:
    'SIDEWAYS and EDGE should unsettle. The EDGE move is the one you would hesitate to suggest. Still doable in one prompt, still grounded in a real thing from this session.',
} as const

export type Wildness = keyof typeof LEAN

export type AskInput = {
  // The fast engine's model has not seen the session; the fork's has.
  isBlind: boolean
  wildness: Wildness
  voice: string
  persona: string
  digest: string
  repo: string
  tools: string
  seen: readonly string[]
  picked: readonly string[]
  skipped: readonly string[]
}

const SPENDS = /\b(deploy\w*|publish\w*|promote|rollback|migrat\w+|credits?|higgsfield|shopify|supabase|vercel|merge[ds]?|force[- ]push|reset --hard|purchase|buy|domain|dns|tiktok|upscale|generate (?:an? )?(?:image|video|audio|3d)\w*)\b/i

export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export const fit = clip

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
export function digest(messages: readonly SessionMessage[], budget = 5200): string {
  const rows: string[] = []

  for (const m of messages.slice(-10)) {
    const tools = m.toolUses
      .map(t => `${t.isError === true ? '✗' : '·'}${t.tool}(${argOf(t.input)})`)
      .join(' ')
    const text = clip(m.text, m.role === 'assistant' ? 700 : 420)

    if (text === '' && tools === '') {
      continue
    }

    rows.push(
      `${m.role === 'user' ? 'PERSON' : 'CLAUDE'}: ${text}${tools === '' ? '' : `\n  tools: ${clip(tools, 420)}`}`,
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

// mcp__Server__tool names, folded into one line per server.
export function summarizeTools(tools: readonly { name: string; mcp: boolean }[]): string {
  const servers = new Map<string, string[]>()
  let builtin = 0

  for (const t of tools) {
    const parts = t.name.split('__')

    if (!t.mcp || parts.length < 3 || parts[0] !== 'mcp') {
      builtin += 1
      continue
    }

    const server = parts[1] ?? '?'
    const list = servers.get(server) ?? []

    list.push(parts.slice(2).join('__'))
    servers.set(server, list)
  }

  const lines = [...servers.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 26)
    .map(([server, names]) => `${server} (${names.length}): ${names.slice(0, 4).join(', ')}`)

  return `${builtin} built-in tools.\n${lines.join('\n')}`.slice(0, 1900)
}

export function flagSpend(card: Card): Card {
  if (card.spends !== '' || !SPENDS.test(`${card.title} ${card.prompt}`)) {
    return card
  }

  return { ...card, spends: 'asks first' }
}

function stripFence(text: string): string {
  const open = text.indexOf('[')
  const close = text.lastIndexOf(']')

  return open === -1 || close <= open ? '' : text.slice(open, close + 1)
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? clip(v, max) : '')

// One card per lane, in lane order. Fewer than two usable cards is a mumble.
export function parseCards(reply: string): Card[] {
  let raw: unknown

  try {
    raw = JSON.parse(stripFence(reply))
  } catch {
    return []
  }

  if (!Array.isArray(raw)) {
    return []
  }

  const byLane = new Map<Lane, Card>()

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const row = item as Record<string, unknown>
    const lane = String(row.lane ?? row.kind ?? '').toLowerCase() as Lane
    const prompt = typeof row.prompt === 'string' ? row.prompt.trim().slice(0, 900) : ''
    const title = str(row.title, 44)

    if (!ORDER.includes(lane) || byLane.has(lane) || prompt === '' || title === '') {
      continue
    }

    byLane.set(lane, flagSpend({ lane, title, why: str(row.why, 120), prompt, spends: str(row.spends, 60) }))
  }

  const cards = ORDER.flatMap(lane => byLane.get(lane) ?? [])

  return cards.length >= 2 ? cards : []
}

export function buildAsk(a: AskInput): string {
  const lanes = ORDER.map(lane => `${LANES[lane].label} — ${LANES[lane].brief}`).join('\n')
  const part = (title: string, body: string) => (body.trim() === '' ? '' : `\n## ${title}\n${body.trim()}\n`)

  return [
    a.isBlind
      ? 'You are the Oracle: the part of a working session that sees one move ahead. Read the room below and deal the person three next moves.'
      : 'Step outside the turn above. You are now the Oracle: the part of this session that sees one move ahead. Deal the person three next moves, drawn from everything in this conversation.',
    part('Who they are (their standing instructions)', a.persona),
    part('The room (recent conversation)', a.isBlind ? a.digest : ''),
    part('The repo', a.repo),
    part('Tools and servers connected right now', a.tools),
    '\n## The three lanes, one card each\n' + lanes,
    `\n${LEAN[a.wildness]}`,
    `
## Rules
- Every card's \`prompt\` is a complete instruction the person could send as written: first person, at most 60 words, concrete nouns, verbs that end in an artifact (a file, a render, a page, a commit). It must be runnable now with the tools above.
- Ground each card in something that actually appeared in the room or the repo. If you cannot name the thing, do not suggest it.
- Banned unless the room screams for it: tests, docs, refactor, cleanup, explore, consider, review, improve, polish.
- Three lanes means three directions, never three flavors of one idea.
- If a move would spend credits, deploy, publish, merge, or write to a store or database, put what it costs in \`spends\` (at most 8 words). Otherwise \`spends\` is "".
- Voice: ${a.voice}. \`title\` at most 5 words. \`why\` at most 14 words and states the payoff, not the process.`,
    part('Never repeat or rephrase these', a.seen.slice(-40).join('\n')),
    part('Lean toward what they actually pick', a.picked.join('\n')),
    part('Lean away from what they ignore', a.skipped.join('\n')),
    '\nReply with ONLY a JSON array of three objects, in lane order, no prose, no fences:\n[{"lane":"next","title":"","why":"","prompt":"","spends":""},{"lane":"sideways",...},{"lane":"edge",...}]',
  ]
    .filter(s => s !== '')
    .join('\n')
}

// The hand as plain text: for surfaces that cannot draw the band, and for /next.
export function renderHand(d: Deck): string {
  const rows = d.cards.map((card, i) => {
    const lane = LANES[card.lane]
    const tag = card.spends === '' ? '' : `  ⚑ ${card.spends}`

    return `${i + 1}  ${lane.glyph} ${lane.label}  ${card.title}${tag}\n     ${card.why}\n     → ${card.prompt}`
  })

  return [
    `◈ ORACLE · ${d.turn > 0 ? `after turn ${d.turn}` : 'cold open'}`,
    ...rows,
    '/next 1 loads a card · /next 1 go sends it · /next new deals again',
  ].join('\n')
}
