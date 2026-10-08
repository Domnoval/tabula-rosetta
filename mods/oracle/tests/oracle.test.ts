import { describe, expect, mock, test } from 'claude-code/testing'

import { buildAsk, clip, digest, flagSpend, parseCards, renderHand, summarizeTools } from '../hooks/lib'

const HAND = JSON.stringify([
  { lane: 'next', title: 'Wire sigil to audio', why: 'The lattice breathes with the beat.', prompt: 'Wire the sigil in lattice.ts to the audio analyser.', spends: '' },
  { lane: 'sideways', title: 'Render it as a bell', why: 'Geometry as resonance, not picture.', prompt: 'Render the lattice as a struck bell: strike points, decay rings.', spends: '' },
  { lane: 'edge', title: 'Let it eat itself', why: 'Speculation: collapse reveals the seed.', prompt: 'Add a mode where each frame is drawn from the previous frame\'s damage.', spends: '' },
])

describe('lib', () => {
  test('parseCards takes a fenced, chatty reply and orders the lanes', () => {
    const shuffled = JSON.stringify([...JSON.parse(HAND)].reverse())
    const cards = parseCards(`Here you go:\n\`\`\`json\n${shuffled}\n\`\`\`\nenjoy`)

    expect(cards.map(c => c.lane)).toEqual(['next', 'sideways', 'edge'])
  })

  test('parseCards keeps one card per lane and drops empties', () => {
    const raw = JSON.stringify([
      { lane: 'next', title: 'A', why: '', prompt: 'do a' },
      { lane: 'next', title: 'B', why: '', prompt: 'do b' },
      { lane: 'edge', title: '', why: '', prompt: 'no title' },
      { lane: 'sideways', title: 'C', why: '', prompt: 'do c' },
    ])

    expect(parseCards(raw).map(c => c.title)).toEqual(['A', 'C'])
  })

  test('parseCards calls a lone card or noise a mumble', () => {
    expect(parseCards('no json here')).toEqual([])
    expect(parseCards('[{"lane":"next","title":"A","prompt":"x"}]')).toEqual([])
    expect(parseCards('{"lane":"next"}')).toEqual([])
  })

  test('money, deploys and publishing get a flag even when the model forgot', () => {
    const card = { lane: 'edge' as const, title: 'Ship it', why: '', prompt: 'Deploy the site to Vercel', spends: '' }

    expect(flagSpend(card).spends).toBe('asks first')
    expect(flagSpend({ ...card, prompt: 'Rotate the sigil by phi', title: 'Spin' }).spends).toBe('')
    expect(flagSpend({ ...card, spends: '40 credits' }).spends).toBe('40 credits')
  })

  test('digest keeps the newest rows when the budget bites and names failed tools', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `message ${i} ${'x'.repeat(300)}`,
      toolUses: [],
    }))
    const out = digest(rows, 900)

    expect(out).toContain('message 9')
    expect(out).not.toContain('message 0')
    expect(clip('a  b\n c', 20)).toBe('a b c')
  })

  test('renderHand prints every card with its prompt and flags', () => {
    const cards = parseCards(HAND)
    const out = renderHand({ phase: 'ready', cards, turn: 3, note: '', isPicked: false })

    expect(out).toContain('after turn 3')
    expect(out).toContain('1  ▲ NEXT  Wire sigil to audio')
    expect(out).toContain('→ Render the lattice as a struck bell')
    expect(out).toContain('/next new deals again')
  })

  test('summarizeTools folds MCP tools by server', () => {
    const out = summarizeTools([
      { name: 'Bash', mcp: false },
      { name: 'mcp__Higgsfield__generate_image', mcp: true },
      { name: 'mcp__Higgsfield__generate_video', mcp: true },
      { name: 'mcp__Three_js_3D_Viewer__show_threejs_scene', mcp: true },
    ])

    expect(out).toContain('1 built-in tools')
    expect(out).toContain('Higgsfield (2): generate_image, generate_video')
    expect(out).toContain('Three_js_3D_Viewer (1)')
  })

  test('the ask carries the rubric, the lanes and what to avoid', () => {
    const ask = buildAsk({
      isBlind: true,
      wildness: 'feral',
      voice: 'dry',
      persona: 'I am an artist.',
      digest: 'PERSON: hi',
      repo: 'branch: main',
      tools: '3 built-in tools.',
      seen: ['next: Wire sigil to audio'],
      picked: ['edge: Let it eat itself'],
      skipped: [],
    })

    for (const needle of ['NEXT —', 'SIDEWAYS —', 'EDGE —', 'unsettle', 'Wire sigil to audio', 'PERSON: hi', 'ONLY a JSON array']) {
      expect(ask).toContain(needle)
    }

    expect(ask).not.toContain('Lean away')
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

describe('flow', () => {
  test('a finished turn deals a hand into the band, and a prompt clears it', async ($, on) => {
    const clock = mock.clock(on)

    mock.store(on)
    on('ui.status', () => ({ value: undefined }) as never)
    on('turn.complete', () => ({ text: '' }))
    on('prompt.submit', (_, e) => ({ text: e.text }))
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine'] }) as never)
    on('model.fork', () => ({ value: { isAnswered: true, text: HAND, usage: { input_tokens: 1, output_tokens: 1 } } }) as never)
    on('process.run', () => ({ value: { exitCode: 0, stdout: 'main', stderr: '' } }) as never)
    on('fs.read', () => ({ value: '# CLAUDE\nbe sharp' }) as never)
    on('session.root', () => ({ value: '/repo' }) as never)
    on('tool.list', () => ({ value: [] }) as never)

    await $.turn.complete({
      answer: 'Built the lattice renderer and wired the controls.',
      durationMs: 1000,
      isAborted: false,
      turnId: 't1',
      reason: 'answer',
    })
    await clock.advance(200)

    const ui = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await ui.find({ key: 'pick-0' })).toBeDefined()
    expect(await ui.find({ key: 'pick-2' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /after turn 1/ })).toBeDefined()
    await ui.unmount()

    await $.prompt.submit({ text: 'something of my own' } as never)

    const after = await $.ui.mount({ plugin: 'oracle', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

    expect(await after.find({ key: 'pick-0' })).toBeUndefined()
    await after.unmount()
  })

  test('a subagent turn deals nothing', async ($, on) => {
    const clock = mock.clock(on)
    let asked = 0

    mock.store(on)
    on('ui.status', () => ({ value: undefined }) as never)
    on('turn.complete', () => ({ text: '' }))
    on('model.fork', () => {
      asked += 1

      return { value: { isAnswered: false, reason: 'aborted', usage: {} } } as never
    })

    await $.turn.complete({
      answer: 'A subagent finished its long errand successfully.',
      durationMs: 1,
      isAborted: false,
      turnId: 't2',
      agentId: 'sub-1',
      reason: 'answer',
    })
    await clock.advance(200)

    expect(asked).toBe(0)
  })

  test('a silent fork falls back to the fast model', async ($, on) => {
    const clock = mock.clock(on)
    const models: string[] = []

    mock.store(on)
    on('ui.status', () => ({ value: undefined }) as never)
    on('turn.complete', () => ({ text: '' }))
    on('model.fork', () => ({ value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: {} } }) as never)
    on('model.complete', (_, e) => {
      models.push(e.model)

      return { value: { isAnswered: true, text: HAND, usage: { input_tokens: 1, output_tokens: 1 } } } as never
    })
    on('session.messages', () => ({ value: [{ role: 'user', text: 'make the lattice', toolUses: [] }] }) as never)
    on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'no git' } }) as never)
    on('fs.read', () => {
      throw new Error('no CLAUDE.md')
    })
    on('session.root', () => ({ value: '/repo' }) as never)
    on('tool.list', () => ({ value: [] }) as never)

    await $.turn.complete({
      answer: 'Built the lattice renderer and wired the controls.',
      durationMs: 1000,
      isAborted: false,
      turnId: 't3',
      reason: 'answer',
    })
    await clock.advance(200)

    expect(models).toEqual(['haiku'])
  })

  test('/next 2 loads the second card into the prompt', async ($, on) => {
    const clock = mock.clock(on)
    const filled: string[] = []

    mock.store(on)
    on('ui.status', () => ({ value: undefined }) as never)
    on('turn.complete', () => ({ text: '' }))
    on('model.fork', () => ({ value: { isAnswered: true, text: HAND, usage: { input_tokens: 1, output_tokens: 1 } } }) as never)
    on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }) as never)
    on('fs.read', () => ({ value: '' }) as never)
    on('session.root', () => ({ value: '/repo' }) as never)
    on('tool.list', () => ({ value: [] }) as never)
    on('prompt.fill', (_, e) => {
      filled.push(e.text)

      return { isFilled: true } as never
    })

    await $.turn.complete({
      answer: 'Built the lattice renderer and wired the controls.',
      durationMs: 1000,
      isAborted: false,
      turnId: 't4',
      reason: 'answer',
    })
    await clock.advance(200)

    const ran = await $.command.run({ command: 'next', args: '2' } as never)

    expect(ran.text).toContain('Render it as a bell')

    const shown = await $.command.run({ command: 'next', args: '' } as never)

    expect(shown.text).toContain('◈ ORACLE')
    expect(shown.text).toContain('Let it eat itself')
    expect(filled).toEqual(['Render the lattice as a struck bell: strike points, decay rings.'])
  })
})
