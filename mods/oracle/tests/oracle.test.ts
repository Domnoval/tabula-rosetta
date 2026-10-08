import { describe, expect, mock, test } from 'claude-code/testing'

import { buildSense, clip, digest, dollars, markPicked, ordered, parseField, parseSense, renderField } from '../hooks/lib'

const path = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Title ${id}`,
  why: `Why ${id}`,
  firstMove: `Do the ${id} thing now.`,
  mode: 'collision',
  ring: 1,
  reachDays: 3,
  surprise: 3,
  money: 2,
  fuel: ['worlds'],
  tools: ['Shopify'],
  sources: [{ label: 'src', url: 'https://example.com' }],
  spends: '',
  isWildcard: false,
  isMoney: false,
  doubt: `Doubt ${id}`,
  status: 'open',
  round: 1,
  createdAt: '2026-10-08T00:00:00Z',
  ...over,
})

const FIELD = JSON.stringify({
  now: {
    headline: 'Money is blocked behind a draft product',
    situation: 'Floating, pivoting back to art that earns.',
    round: 1,
    convenedAt: '2026-10-08T00:00:00Z',
    council: ['collider', 'ledger'],
    trigger: 'asked',
    question: 'Has anyone ever paid you for a painting?',
  },
  paths: [
    path('a', { surprise: 2 }),
    path('b', { surprise: 5, mode: 'wrongtool' }),
    path('w', { isWildcard: true, ring: 3, surprise: 5, spends: '40 credits' }),
    path('s', { status: 'slop', surprise: 5 }),
  ],
})

describe('lib', () => {
  test('parseField keeps good paths, repairs numbers, drops the malformed', () => {
    const raw = JSON.stringify({
      now: { headline: 'h', round: 2 },
      paths: [
        path('ok', { ring: 9, money: 99, surprise: -4, status: 'weird' }),
        { id: 'no-move', title: 't', mode: 'collision' },
        { id: 'bad-mode', title: 't', firstMove: 'x', mode: 'nonsense' },
        'junk',
      ],
    })
    const field = parseField(raw)

    expect(field?.paths.map(p => p.id)).toEqual(['ok'])
    expect(field?.paths[0]).toMatchObject({ ring: 3, money: 3, surprise: 1, status: 'open' })
    expect(parseField('not json')).toBeNull()
    expect(parseField('{"paths":[]}')).toBeNull()
  })

  test('ordered puts the strangest first, the wildcard last, hides slop, keeps picks', () => {
    const field = parseField(FIELD)

    expect(field).not.toBeNull()
    expect(ordered(field!).map(p => p.id)).toEqual(['b', 'a', 'w'])

    const picked = { ...field!, paths: field!.paths.map(p => (p.id === 'b' ? { ...p, status: 'picked' as const } : p)) }

    expect(ordered(picked).map(p => p.id)).toEqual(['b', 'a', 'w'])
  })

  test('renderField shows the headline, wildcard, spend flag and first move', () => {
    const out = renderField(parseField(FIELD)!)

    expect(out).toContain('round 1 · Money is blocked behind a draft product')
    expect(out).toContain('✶ WILDCARD')
    expect(out).toContain('⚑ 40 credits')
    expect(out).toContain('→ Do the b thing now.')
    expect(out).toContain('/next convene')
    expect(out).toContain('? Doubt b')
    expect(out).toContain('The Oracle asks: Has anyone ever paid you for a painting?')
  })

  test('money shows only where it is the point', () => {
    expect(dollars(3)).toBe('$$$')
    expect(dollars(2)).toBe('$$')
    expect(dollars(1)).toBe('·')
    expect(dollars(0)).toBe('·')
  })

  test('parseField carries doubt, the money flag and the question', () => {
    const field = parseField(JSON.stringify({
      now: { headline: 'h', question: 'q?' },
      paths: [path('m', { isMoney: true, doubt: 'One sale proves one buyer.' })],
    }))

    expect(field?.now.question).toBe('q?')
    expect(field?.paths[0]).toMatchObject({ isMoney: true, doubt: 'One sale proves one buyer.' })
  })

  test('markPicked flips one status and leaves the rest', () => {
    const next = markPicked(FIELD, 'a')

    expect(next).not.toBeNull()

    const field = parseField(next!)

    expect(field?.paths.find(p => p.id === 'a')?.status).toBe('picked')
    expect(field?.paths.find(p => p.id === 'b')?.status).toBe('open')
    expect(markPicked(FIELD, 'missing')).toBeNull()
    expect(markPicked('nope', 'a')).toBeNull()
  })

  test('parseSense reads a verdict through chatter and refuses noise', () => {
    expect(parseSense('Sure: {"fork": true, "reason": "a piece just finished"}')).toEqual({
      isFork: true,
      reason: 'a piece just finished',
    })
    expect(parseSense('{"fork": false, "reason": ""}')?.isFork).toBe(false)
    expect(parseSense('{"fork": "yes"}')).toBeNull()
    expect(parseSense('no json')).toBeNull()
    expect(buildSense('PERSON: hi')).toContain('PERSON: hi')
  })

  test('digest keeps the newest rows when the budget bites', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `message ${i} ${'x'.repeat(300)}`,
      toolUses: [],
    }))
    const out = digest(rows, 700)

    expect(out).toContain('message 7')
    expect(out).not.toContain('message 0')
    expect(clip('a  b\n c', 20)).toBe('a b c')
  })
})

const PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 12,
  bodyColumns: 100,
  scroll: { bodyRows: 12, offset: 0, total: 4 },
  view: {},
} as never

const TURN = {
  answer: 'Finished the checkout flow and wired the webhook.',
  durationMs: 1000,
  isAborted: false,
  reason: 'answer',
} as const

// The world beneath the plugin: a repo with a field file, a clock, a store.
const world = (on: Parameters<typeof mock.clock>[0], writes: string[] = [], sent: string[] = []) => {
  mock.store(on)
  on('ui.status', () => ({ value: undefined }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_, e) => {
    sent.push(e.text)

    return { text: e.text }
  })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', () => ({ cwd: '/repo' }) as never)
  on('session.root', () => ({ value: '/repo' }) as never)
  on('session.messages', () => ({ value: [{ role: 'user', text: 'ship checkout', toolUses: [] }] }) as never)
  on('fs.read', (_, e) => {
    if (String(e.path).endsWith('oracle/page/URL')) {
      return { value: 'https://claude.ai/artifact/abc\n' } as never
    }

    return { value: writes.at(-1) ?? FIELD } as never
  })
  on('fs.write', (_, e) => {
    writes.push(e.text)

    return { value: undefined } as never
  })
}

describe('flow', () => {
  test('/next prints the council from the field file and loads a first move', async ($, on) => {
    const filled: string[] = []
    const writes: string[] = []

    world(on, writes)
    mock.clock(on)
    on('prompt.fill', (_, e) => {
      filled.push(e.text)

      return { isFilled: true } as never
    })

    await $.session.start({ cwd: '/repo' } as never)

    const shown = await $.command.run({ command: 'next', args: '' } as never)

    expect(shown.text).toContain('Money is blocked behind a draft product')

    const loaded = await $.command.run({ command: 'next', args: '1' } as never)

    expect(loaded.text).toContain('Title b')
    expect(filled).toEqual(['Do the b thing now.'])
    expect(parseField(writes.at(-1)!)?.paths.find(p => p.id === 'b')?.status).toBe('picked')
  })

  test('a fork gets nudged, shown in the band, and cleared by moving on', async ($, on) => {
    const clock = mock.clock(on)

    world(on)
    on('model.complete', () => ({ value: { isAnswered: true, text: '{"fork": true, "reason": "checkout just finished"}', usage: {} } }) as never)

    await $.session.start({ cwd: '/repo' } as never)
    await $.turn.complete({ ...TURN, turnId: 't1' } as never)
    await clock.advance(200)

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await ui.find({ key: 'convene' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /checkout just finished/ })).toBeDefined()
    await ui.unmount()

    await $.prompt.submit({ text: 'something else entirely', origin: { kind: 'composer' } } as never)

    const after = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await after.find({ key: 'convene' })).toBeUndefined()
    await after.unmount()
  })

  test('grind is not a fork, and a subagent turn is never judged', async ($, on) => {
    const clock = mock.clock(on)
    let asked = 0

    world(on)
    on('model.complete', () => {
      asked += 1

      return { value: { isAnswered: true, text: '{"fork": false, "reason": ""}', usage: {} } } as never
    })

    await $.session.start({ cwd: '/repo' } as never)
    await $.turn.complete({ ...TURN, turnId: 't2' } as never)
    await $.turn.complete({ ...TURN, turnId: 't3', agentId: 'sub-1' } as never)
    await clock.advance(200)

    expect(asked).toBe(1)

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await ui.find({ key: 'convene' })).toBeUndefined()
    await ui.unmount()
  })

  test('/next convene hands the council its brief', async ($, on) => {
    const sent: string[] = []

    world(on, [], sent)

    const clock = mock.clock(on)

    await $.session.start({ cwd: '/repo' } as never)

    const ran = await $.command.run({ command: 'next', args: 'convene' } as never)

    expect(ran.text).toContain('Convening')
    expect(sent).toEqual([])
    await clock.advance(100)
    expect(sent[0]).toContain('.claude/skills/oracle/SKILL.md')
  })

  test('/next 2 go sends the first move after the command returns', async ($, on) => {
    const sent: string[] = []

    world(on, [], sent)

    const clock = mock.clock(on)

    await $.session.start({ cwd: '/repo' } as never)
    await $.command.run({ command: 'next', args: '2 go' } as never)
    await clock.advance(100)
    expect(sent).toEqual(['Do the a thing now.'])
  })

  test('/next page prints the live page link', async ($, on) => {
    world(on)
    mock.clock(on)
    await $.session.start({ cwd: '/repo' } as never)

    const ran = await $.command.run({ command: 'next', args: 'page' } as never)

    expect(ran.text).toContain('https://claude.ai/artifact/abc')
  })

  test('the band lists the council paths with a hotkey each', async ($, on) => {
    world(on)
    mock.clock(on)
    await $.session.start({ cwd: '/repo' } as never)

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await ui.find({ key: 'pick-0' })).toBeDefined()
    expect(await ui.find({ key: 'pick-2' })).toBeDefined()
    expect(await ui.find({ key: 'pick-3' })).toBeUndefined()
    await ui.unmount()
  })
})
