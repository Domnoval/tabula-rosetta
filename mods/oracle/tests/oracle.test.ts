import { describe, expect, mock, test } from 'claude-code/testing'

import {
  answerFor,
  answerLine,
  answersFromInbox,
  appendLine,
  buildSense,
  clip,
  digest,
  dollars,
  markPicked,
  ordered,
  parseAnswer,
  parseField,
  parseSense,
  renderField,
} from '../hooks/lib'

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

const fieldText = (now: Record<string, unknown> = {}) =>
  JSON.stringify({
    now: {
      headline: 'Money is blocked behind a draft product',
      situation: 'Floating, pivoting back to art that earns.',
      round: 1,
      convenedAt: '2026-10-08T00:00:00Z',
      council: ['collider', 'ledger'],
      trigger: 'asked',
      question: 'Has anyone ever paid you for a painting?',
      ...now,
    },
    paths: [
      path('a', { surprise: 2 }),
      path('b', { surprise: 5, mode: 'wrongtool' }),
      path('w', { isWildcard: true, ring: 3, surprise: 5, spends: '40 credits' }),
      path('s', { status: 'slop', surprise: 5 }),
    ],
  })

// A question with no id and no options: free text only, the question text its id.
const FIELD = fieldText()

const OPTIONS = ['Yes, more than once', 'Once, a friend', 'Never, but people asked', 'Never']

// The same question as the contract has it: a stable id and four options.
const ASKING = fieldText({ questionId: 'r2-paid', questionOptions: OPTIONS })

const NOON = '2026-10-08T12:00:00.000Z'

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

  test('parseField reads the question id and options, repairing what it can', () => {
    const field = parseField(
      fieldText({ questionId: '  r2-paid ', questionOptions: ['  Yes  ', '', '   ', 42, 'x'.repeat(80), 'No', 'Maybe', 'Fifth'] }),
    )

    expect(field?.now.questionId).toBe('r2-paid')
    expect(field?.now.questionOptions).toEqual(['Yes', 'x'.repeat(60), 'No', 'Maybe'])
    // Repeats drop out, as on the page, so b) here is B there.
    expect(parseField(fieldText({ questionOptions: ['Yes', ' Yes ', 'No', 'Maybe', 'Later'] }))?.now.questionOptions).toEqual([
      'Yes',
      'No',
      'Maybe',
      'Later',
    ])
    expect(parseField(FIELD)?.now).toMatchObject({
      questionId: 'Has anyone ever paid you for a painting?',
      questionOptions: [],
    })
    expect(parseField(fieldText({ questionOptions: 'Yes' }))?.now.questionOptions).toEqual([])
    expect(parseField(fieldText({ question: '', questionId: 'orphan', questionOptions: ['Yes'] }))?.now).toMatchObject({
      question: '',
      questionId: '',
      questionOptions: [],
    })
    expect(parseField(fieldText({ question: 'q'.repeat(300) }))?.now.question.length).toBe(200)
  })

  test('parseAnswer reads letters and words, and refuses what cannot be an answer', () => {
    const error = (r: ReturnType<typeof parseAnswer>) => (r !== null && 'error' in r ? r.error : '')

    expect(parseAnswer('B', 4)).toEqual({ choice: 1 })
    expect(parseAnswer('b.', 4)).toEqual({ choice: 1 })
    expect(parseAnswer('  (c)  ', 4)).toEqual({ choice: 2 })
    expect(parseAnswer('D!', 4)).toEqual({ choice: 3 })
    expect(parseAnswer('b because the pay page', 4)).toEqual({ choice: 1, text: 'because the pay page' })
    expect(parseAnswer('B. Because   the pay page', 4)).toEqual({ choice: 1, text: 'Because the pay page' })
    // Free words that happen to start with a letter go through "answer", whole.
    expect(parseAnswer('answer a few times a year', 4)).toEqual({ text: 'a few times a year' })
    expect(parseAnswer('Answer: A few times', 0)).toEqual({ text: 'A few times' })
    // Without "answer", a leading a is the letter a and the rest is the why.
    expect(parseAnswer('a few times', 4)).toEqual({ choice: 0, text: 'few times' })
    expect(error(parseAnswer('d', 2))).toContain('no option d)')
    expect(error(parseAnswer('d', 2))).toContain('a-b')
    expect(error(parseAnswer('b', 1))).toContain('this question has a.')
    expect(error(parseAnswer('a', 0))).toContain('no options')
    expect(error(parseAnswer('answer', 4))).toContain('empty answer')
    expect(error(parseAnswer('ANSWER    ', 4))).toContain('empty answer')
    expect((parseAnswer(`answer ${'w'.repeat(600)}`, 0) as { text: string }).text.length).toBe(500)
    expect(parseAnswer('', 4)).toBeNull()
    expect(parseAnswer('2 go', 4)).toBeNull()
    expect(parseAnswer('convene', 4)).toBeNull()
    // A letter past d is an attempt at an option, so it gets an error, not the listing.
    expect(parseAnswer('e', 4)).toEqual({ error: expect.stringContaining('There is no option e)') })
    expect(parseAnswer('ab', 4)).toBeNull()
  })

  test('a letter past the options says there is no such option', () => {
    expect(parseAnswer('e', 4)).toEqual({ error: expect.stringContaining('There is no option e)') })
    expect(parseAnswer('z.', 2)).toEqual({ error: expect.stringContaining('this question has a-b') })
    // With no options a lone letter is not an answer attempt to refuse here: the no-options error covers a-d.
    expect(parseAnswer('e', 0)).toBeNull()
    expect(parseAnswer('d', 4)).toEqual({ choice: 3 })
  })

  test('answerFor reads own keys only, never Object.prototype', () => {
    const heard = answersFromInbox('')

    expect(answerFor(heard, 'constructor')).toBeUndefined()
    expect(answerFor(heard, 'toString')).toBeUndefined()
    expect(answerFor({ 'r3-x': 'Three or more' }, 'r3-x')).toBe('Three or more')
  })

  test('answerLine keeps contract order and leaves out what is absent', () => {
    expect(answerLine({ questionId: 'r2-paid', question: 'Q?', choice: 'Never', at: NOON })).toBe(
      `{"type":"answer","questionId":"r2-paid","question":"Q?","choice":"Never","at":"${NOON}","source":"mod"}`,
    )
    expect(answerLine({ questionId: 'r2-paid', question: 'Q?', text: 'my aunt', at: NOON })).toBe(
      `{"type":"answer","questionId":"r2-paid","question":"Q?","text":"my aunt","at":"${NOON}","source":"mod"}`,
    )
    expect(appendLine('', 'x')).toBe('x\n')
    expect(appendLine('a', 'x')).toBe('a\nx\n')
    expect(appendLine('a\n', 'x')).toBe('a\nx\n')
  })

  test('answersFromInbox keeps the latest answer per question and skips the malformed', () => {
    const inbox = [
      '',
      'not json',
      '[1,2]',
      '"a string"',
      '{"type":"note","questionId":"r2-paid","text":"not an answer"}',
      answerLine({ questionId: 'r2-paid', question: 'Q?', choice: 'Never', at: '2026-10-08T12:00:00.000Z' }),
      '   ',
      answerLine({ questionId: 'r2-paid', question: 'Q?', choice: 'Once, a friend', text: 'my aunt', at: '2026-10-08T13:00:00.000Z' }),
      // Appended later but stamped earlier: the time says it is not the latest.
      '{"type":"answer","questionId":"r2-paid","choice":"Stale","at":"2026-10-08T11:00:00.000Z"}',
      '{"type":"answer","question":"No id here?","text":"the question is the id"}',
      '{"type":"answer","questionId":"empty"}',
      '{"type":"answer","questionId":"cut","text":"x"',
      '{"type":"answer","questionId":"__proto__","text":"x"}',
    ].join('\n')

    expect(answersFromInbox(inbox)).toEqual({
      'r2-paid': 'Once, a friend · my aunt',
      'No id here?': 'the question is the id',
    })
    expect(answersFromInbox('')).toEqual({})
    expect(answersFromInbox('\r\n\r\n')).toEqual({})
    expect(answersFromInbox(`{"type":"answer","questionId":"long","text":"${'w'.repeat(300)}"}`).long?.length).toBe(120)
  })

  test('renderField puts the question first, letters its options and shows the recorded answer', () => {
    const field = parseField(ASKING)!
    const open = renderField(field)

    expect(open).toContain('◈ The Oracle asks: Has anyone ever paid you for a painting?')
    expect(open).toContain('   a) Yes, more than once')
    expect(open).toContain('   b) Once, a friend')
    expect(open).toContain('   d) Never')
    expect(open).toContain('/next a-d picks one')
    expect(open).toContain('/next answer <your words>')
    expect(open).not.toContain('you answered')
    expect(open.indexOf('The Oracle asks')).toBeLessThan(open.indexOf('Title b'))

    const done = renderField(field, { 'r2-paid': 'Never · not yet' })

    expect(done).toContain('✓ you answered: Never · not yet')
    expect(done).toContain('to change it: /next a-d')
    expect(renderField(field, { 'other-question': 'x' })).not.toContain('you answered')
    expect(renderField(parseField(FIELD)!)).toContain('answer: /next answer <your words>')
    expect(renderField(parseField(FIELD)!)).not.toContain('a)')
    expect(renderField(parseField(fieldText({ question: '' }))!)).not.toContain('Oracle asks')
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

const FIELD_PATH = '/repo/oracle/field.json'
const INBOX_PATH = '/repo/oracle/inbox.jsonl'

// The world beneath the plugin: a repo of files by path (field file and page link to start,
// `disk` over them), a store. Returns the files, so a test can read what was written.
const world = (
  on: Parameters<typeof mock.clock>[0],
  writes: string[] = [],
  sent: string[] = [],
  disk: Record<string, string> = {},
) => {
  const files: Record<string, string> = {
    [FIELD_PATH]: FIELD,
    '/repo/oracle/page/URL': 'https://claude.ai/artifact/abc\n',
    ...disk,
  }

  mock.store(on)
  on('ui.status', () => ({ value: undefined }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_, e) => {
    sent.push(e.text)

    return { text: e.text }
  })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', () => ({ cwd: '/repo' }) as never)
  on('session.root', () => ({ value: '/repo' }) as never)
  on('session.messages', () => ({ value: [{ role: 'user', text: 'ship checkout', toolUses: [] }] }) as never)
  on('fs.exists', (_, e) => ({ value: files[String(e.path)] !== undefined }) as never)
  on('fs.read', (_, e) => {
    const text = files[String(e.path)]

    return (text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }) as never
  })
  on('fs.write', (_, e) => {
    files[String(e.path)] = e.text
    writes.push(e.text)

    return { value: undefined } as never
  })

  return files
}

// The band's props with some changed (a shorter terminal, say).
const band = (props: Record<string, unknown> = {}) => ({ ...(PROPS as object), ...props }) as never

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

  test('/next b because x writes the exact inbox line and says what it recorded', async ($, on) => {
    const files = world(on, [], [], { [FIELD_PATH]: ASKING })

    mock.clock(on, { now: Date.parse(NOON) })
    await $.session.start({ cwd: '/repo' } as never)

    const ran = await $.command.run({ command: 'next', args: 'b because x' } as never)

    expect(files[INBOX_PATH]).toBe(
      `{"type":"answer","questionId":"r2-paid","question":"Has anyone ever paid you for a painting?","choice":"Once, a friend","text":"because x","at":"${NOON}","source":"mod"}\n`,
    )
    expect(ran.text).toBe('Answer recorded for the next council: b) Once, a friend · because x')

    const shown = await $.command.run({ command: 'next', args: '' } as never)

    expect(shown.text).toContain('✓ you answered: Once, a friend · because x')
    // The field file is the council's; an answer never touches it.
    expect(files[FIELD_PATH]).toBe(ASKING)
  })

  test('/next answer appends free words to what the inbox already holds', async ($, on) => {
    const earlier = answerLine({ questionId: 'r1-old', question: 'Old?', text: 'old', at: '2026-10-01T00:00:00.000Z' })
    const files = world(on, [], [], { [FIELD_PATH]: ASKING, [INBOX_PATH]: earlier })

    mock.clock(on, { now: Date.parse(NOON) })
    await $.session.start({ cwd: '/repo' } as never)

    const ran = await $.command.run({ command: 'next', args: 'answer A few times, never for money' } as never)

    expect(files[INBOX_PATH]).toBe(
      `${earlier}\n{"type":"answer","questionId":"r2-paid","question":"Has anyone ever paid you for a painting?","text":"A few times, never for money","at":"${NOON}","source":"mod"}\n`,
    )
    expect(ran.text).toBe('Answer recorded for the next council: A few times, never for money')
  })

  test('an answer that cannot be recorded says why and writes nothing', async ($, on) => {
    const files = world(on, [], [], { [FIELD_PATH]: fieldText({ questionId: 'r2-two', questionOptions: ['Yes', 'No'] }) })
    const say = async (args: string) => (await $.command.run({ command: 'next', args } as never)).text

    mock.clock(on)
    await $.session.start({ cwd: '/repo' } as never)

    expect(await say('c')).toContain('There is no option c): this question has a-b.')
    expect(await say('answer')).toContain('empty answer')
    expect(await say('answer    ')).toContain('empty answer')

    files[FIELD_PATH] = FIELD
    expect(await say('refresh')).toContain('The Oracle asks')
    expect(await say('a')).toContain('no options')

    files[FIELD_PATH] = fieldText({ question: '' })
    await say('refresh')
    expect(await say('b')).toBe('No question is waiting. The council asks one each round: /next convene.')
    expect(await say('answer something')).toContain('No question is waiting')
    expect(files[INBOX_PATH]).toBeUndefined()
  })

  test('before any council, an answer has nothing to answer', async ($, on) => {
    const files = world(on)

    delete files[FIELD_PATH]
    mock.clock(on)
    await $.session.start({ cwd: '/repo' } as never)

    expect((await $.command.run({ command: 'next', args: 'a' } as never)).text).toContain('No question is waiting')
    expect((await $.command.run({ command: 'next', args: '' } as never)).text).toContain('No council has run yet')
  })

  test('the band asks with a button per option, records a press, then steps aside', async ($, on) => {
    const files = world(on, [], [], { [FIELD_PATH]: ASKING })

    mock.clock(on, { now: Date.parse(NOON) })
    await $.session.start({ cwd: '/repo' } as never)

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await ui.find({ type: 'Text', text: /^ASKS YOU: Has anyone ever paid you for a painting\?$/ })).toBeDefined()

    for (const [i, letter] of ['a', 'b', 'c', 'd'].entries()) {
      expect((await ui.find({ key: `ans-${i}` }))?.props).toMatchObject({ hotkey: letter, label: OPTIONS[i] })
    }

    expect(await ui.find({ key: 'ans-4' })).toBeUndefined()
    expect(await ui.find({ key: 'pick-0' })).toBeDefined()
    expect(await ui.find({ key: 'pick-2' })).toBeDefined()
    expect(await ui.find({ key: 'convene' })).toBeUndefined()

    await ui.press({ key: 'ans-3' })

    expect(files[INBOX_PATH]).toBe(
      `{"type":"answer","questionId":"r2-paid","question":"Has anyone ever paid you for a painting?","choice":"Never","at":"${NOON}","source":"mod"}\n`,
    )
    expect(await ui.find({ key: 'ans-0' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /ASKS YOU/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^you answered: Never$/ })).toBeDefined()
    expect(await ui.find({ key: 'pick-0' })).toBeDefined()
    await ui.unmount()
  })

  test('two answers in flight at once both land in the inbox', async ($, on) => {
    const files = world(on, [], [], { [FIELD_PATH]: ASKING })

    mock.clock(on, { now: Date.parse(NOON) })
    await $.session.start({ cwd: '/repo' } as never)

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    await Promise.all([ui.press({ key: 'ans-0' }), $.command.run({ command: 'next', args: 'answer actually twice' } as never)])

    const lines = (files[INBOX_PATH] ?? '').split('\n').filter(l => l !== '')

    expect(lines.length).toBe(2)
    await ui.unmount()
  })

  test('a question id that names an Object member is still asked', async ($, on) => {
    world(on, [], [], { [FIELD_PATH]: fieldText({ questionId: 'constructor', questionOptions: OPTIONS }) })
    mock.clock(on)
    await $.session.start({ cwd: '/repo' } as never)

    const shown = await $.command.run({ command: 'next', args: '' } as never)

    expect(shown.text).not.toContain('you answered')

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await ui.find({ key: 'ans-0' })).toBeDefined()
    await ui.unmount()
  })

  test('/next e on a four-option question says there is no such option', async ($, on) => {
    const files = world(on, [], [], { [FIELD_PATH]: ASKING })

    mock.clock(on)
    await $.session.start({ cwd: '/repo' } as never)

    const ran = await $.command.run({ command: 'next', args: 'e' } as never)

    expect(ran.text).toContain('There is no option e)')
    expect(files[INBOX_PATH]).toBeUndefined()
  })

  test('a narrow band drops the key hint before anything overflows', async ($, on) => {
    world(on, [], [], { [FIELD_PATH]: ASKING })
    mock.clock(on)
    await $.session.start({ cwd: '/repo' } as never)

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: band({ bodyColumns: 44 }) })

    expect(await ui.find({ type: 'Text', text: /ctrl\+x tab/ })).toBeUndefined()
    expect(await ui.find({ key: 'hide' })).toBeDefined()
    await ui.unmount()

    const wide = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await wide.find({ type: 'Text', text: /ctrl\+x tab/ })).toBeDefined()
    await wide.unmount()
  })

  test('a short band puts the options on one row and keeps to maxRows', async ($, on) => {
    world(on, [], [], { [FIELD_PATH]: ASKING })
    mock.clock(on)
    await $.session.start({ cwd: '/repo' } as never)

    const rowsOf = async (ui: { drawn: () => Promise<unknown> }) =>
      ((await ui.drawn()) as { children?: unknown[] }).children?.filter(c => typeof c === 'object' && c !== null).length

    // Room for all of it: header, question, a row per option, the three paths.
    const roomy = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await rowsOf(roomy)).toBe(1 + 1 + 4 + 3)
    expect(await roomy.find({ key: 'ans-row-3' })).toBeDefined()
    await roomy.unmount()

    // Short: header, question, one row of options, and as many paths as still fit.
    for (const [maxRows, paths] of [
      [7, 3],
      [5, 1],
    ] as const) {
      const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: band({ maxRows }) })

      expect(await rowsOf(ui)).toBe(maxRows - 1)
      expect(await ui.find({ key: 'ans-row' })).toBeDefined()
      expect(await ui.find({ key: 'ans-row-0' })).toBeUndefined()
      expect(await ui.find({ key: 'ans-0' })).toBeDefined()
      expect(await ui.find({ key: 'ans-3' })).toBeDefined()
      expect(await ui.find({ key: `pick-${paths - 1}` })).toBeDefined()
      expect(await ui.find({ key: `pick-${paths}` })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('a fork nudge keeps the band to itself, question and all', async ($, on) => {
    const clock = mock.clock(on)

    world(on, [], [], { [FIELD_PATH]: ASKING })
    on('model.complete', () => ({ value: { isAnswered: true, text: '{"fork": true, "reason": "a piece just finished"}', usage: {} } }) as never)

    await $.session.start({ cwd: '/repo' } as never)
    await $.turn.complete({ ...TURN, turnId: 't9' } as never)
    await clock.advance(200)

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await ui.find({ key: 'convene' })).toBeDefined()
    expect(await ui.find({ key: 'ans-0' })).toBeUndefined()
    await ui.unmount()

    await $.prompt.submit({ text: 'carry on', origin: { kind: 'composer' } } as never)

    const after = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await after.find({ key: 'ans-0' })).toBeDefined()
    await after.unmount()
  })

  test('answers come back from the inbox at session start, and clear when the council empties it', async ($, on) => {
    const line = answerLine({
      questionId: 'r2-paid',
      question: 'Has anyone ever paid you for a painting?',
      choice: 'Yes, more than once',
      text: 'twice, at a market',
      at: NOON,
    })
    const files = world(on, [], [], { [FIELD_PATH]: ASKING, [INBOX_PATH]: `${line}\n` })

    mock.clock(on)
    await $.session.start({ cwd: '/repo' } as never)

    const shown = await $.command.run({ command: 'next', args: '' } as never)

    expect(shown.text).toContain('✓ you answered: Yes, more than once · twice, at a market')

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await ui.find({ key: 'ans-0' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^you answered: Yes, more than once · twice, at a market$/ })).toBeDefined()
    await ui.unmount()

    // The council heard it, emptied the inbox and asked the next question.
    files[INBOX_PATH] = ''
    files[FIELD_PATH] = fieldText({ question: 'Which piece first?', questionId: 'r3-first', questionOptions: ['The sigil', 'The bell'] })
    await $.command.run({ command: 'next', args: 'refresh' } as never)

    const next = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await next.find({ type: 'Text', text: /^ASKS YOU: Which piece first\?$/ })).toBeDefined()
    expect(await next.find({ key: 'ans-1' })).toBeDefined()
    expect(await next.find({ key: 'ans-2' })).toBeUndefined()
    await next.unmount()
  })
})
