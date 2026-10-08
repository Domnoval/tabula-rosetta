import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelCompleteResult, Register } from 'claude-code'

import type { Card, Deck } from '../types'
import { LANES, buildAsk, clip, digest, fit, parseCards, renderHand, summarizeTools } from './lib'
import type { Wildness } from './lib'

const EMPTY: Deck = { phase: 'idle', cards: [], turn: 0, note: '', isPicked: false }

const deck = atom({ plugin: 'oracle', key: 'deck' } as const, EMPTY)
const isHidden = atom({ plugin: 'oracle', key: 'isHidden' } as const, false)

type Why = 'turn' | 'start' | 'reroll'

// Notes the oracle keeps between sessions, in $.store.
const list = async ($: EngineInterface, key: string): Promise<string[]> => {
  const value = await $.store.get(key)

  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

const remember = async ($: EngineInterface, key: string, cards: readonly Card[], keep: number) => {
  const next = [...(await list($, key)), ...cards.map(c => `${c.lane}: ${c.title}`)]

  await $.store.set(key, next.slice(-keep))
}

// Module scope: a reload starts these over, which is what a reload should do.
type Config = { engine: 'fork' | 'fast'; wildness: Wildness; voice: string; fastModel: string }

const cfg: Config = { engine: 'fork', wildness: 'sharp', voice: 'direct, witty, dark', fastModel: 'haiku' }
const run: { gen: number; stop: AbortController | undefined; persona: string | undefined } = {
  gen: 0,
  stop: undefined,
  persona: undefined,
}

const ground = async ($: EngineInterface) => {
  const git = async (...args: string[]) => {
    try {
      const ran = await $.process.run(['git', ...args], { timeoutMs: 4000 })

      return ran.exitCode === 0 ? ran.stdout.trim() : ''
    } catch {
      return ''
    }
  }

  if (run.persona === undefined) {
    try {
      run.persona = (await $.fs.read(`${await $.session.root()}/CLAUDE.md`)).slice(0, 2600)
    } catch {
      run.persona = ''
    }
  }

  const [branch, status, log] = await Promise.all([
    git('branch', '--show-current'),
    git('status', '--short'),
    git('log', '--oneline', '-n', '8'),
  ])
  const tools = await $.tool.list().then(summarizeTools, () => '')

  const repo = [
    branch === '' ? '' : `branch: ${branch}`,
    status === '' ? 'working tree: clean' : `uncommitted:\n${status.split('\n').slice(0, 14).join('\n')}`,
    log === '' ? '' : `recent commits:\n${log}`,
  ]
    .filter(s => s !== '')
    .join('\n')

  return { persona: run.persona ?? '', repo, tools }
}


const conjure = async ($: EngineInterface, why: Why, mine: number) => {
  await update($, deck, (d): Deck => ({
    ...d,
    phase: 'thinking',
    note: '',
    isPicked: false,
    turn: why === 'turn' ? d.turn + 1 : d.turn,
  }))

  const fail = (note: string) =>
    mine === run.gen ? update($, deck, (d): Deck => ({ ...d, phase: 'idle', cards: [], note })) : undefined

  try {
    const [seen, picked, skipped, here] = await Promise.all([
      list($, 'seen'),
      list($, 'picked'),
      list($, 'skipped'),
      ground($),
    ])
    const base = { wildness: cfg.wildness, voice: cfg.voice, persona: here.persona, repo: here.repo, tools: here.tools, seen, picked, skipped }

    let reply: ModelCompleteResult | undefined

    // The fork reads the live transcript, so it needs no digest. Cold opens
    // and failures fall back to a small model fed the digest.
    if (cfg.engine === 'fork' && why !== 'start') {
      const forked = await $.model.fork({ prompt: buildAsk({ ...base, isBlind: false, digest: '' }) })

      if (forked.isAnswered) {
        reply = forked
      }
    }

    if (reply === undefined) {
      run.stop = new AbortController()

      const messages = await $.session.messages()
      const blind =
        digest(messages) || 'No conversation yet. This is a cold open: read the repo and deal the session its first three moves.'

      reply = await $.model.complete(
        {
          model: cfg.fastModel,
          prompt: buildAsk({ ...base, isBlind: true, digest: blind }),
          maxTokens: 1100,
          effort: 'medium',
          timeoutMs: 60000,
        },
        { signal: run.stop.signal },
      )
    }

    if (mine !== run.gen) {
      return
    }

    if (!reply.isAnswered) {
      await fail(`the oracle went quiet (${reply.reason})`)

      return
    }

    const cards = parseCards(reply.text)

    if (cards.length === 0) {
      await fail('the oracle mumbled. /next to deal again')

      return
    }

    await update($, deck, (d): Deck => ({ ...d, phase: 'ready', cards, note: '' }))
    $.ui.status(`◈ ${cards.length} moves ready · /next`)
    await $.store.set('seen', [...seen, ...cards.map(c => `${c.lane}: ${c.title}`)].slice(-60))
  } catch (error) {
    await fail(`the oracle tripped: ${clip(String(error), 80)}`)
  }
}


// Start a hand without making the caller wait on the model.
const deal = ($: EngineInterface, why: Why) => {
  run.gen += 1
  run.stop?.abort()

  const mine = run.gen

  $.clock.after(40, () => {
    void conjure($, why, mine).catch(() => {})
  })
}


// Clears the table; what was dealt and never touched counts as ignored.
const retire = async ($: EngineInterface) => {
  run.gen += 1
  run.stop?.abort()
  $.ui.status(undefined)

  let prev = EMPTY

  await update($, deck, d => {
    prev = d

    return { ...EMPTY, turn: d.turn }
  })

  if (prev.phase === 'ready' && !prev.isPicked) {
    await remember($, 'skipped', prev.cards, 10)
  }
}


const take = async ($: EngineInterface, card: Card, isSent: boolean) => {
  await update($, deck, d => ({ ...d, isPicked: true }))
  await remember($, 'picked', [card], 10)

  if (isSent) {
    await $.prompt.submit({ text: card.prompt, asUser: true })
  } else {
    await $.prompt.fill({ text: card.prompt, mode: 'replace' })
  }
}


export const register: Register = (on, options) => {
  cfg.engine = options.engine === 'fast' ? 'fast' : 'fork'
  cfg.wildness = options.wildness === 'grounded' || options.wildness === 'feral' ? options.wildness : 'sharp'
  cfg.voice = typeof options.voice === 'string' && options.voice !== '' ? options.voice : cfg.voice
  cfg.fastModel = typeof options.fastModel === 'string' && options.fastModel !== '' ? options.fastModel : cfg.fastModel
  const isAuto = options.auto !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'next',
      description: 'Oracle: show the dealt next moves, load one (/next 2), send it (/next 2 go), or deal anew (/next new)',
      argumentHint: '[1|2|3] [go] | new | hide | show | forget',
    })

    if (isAuto) {
      deal($, 'start')
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (isAuto && e.agentId === undefined && e.reason === 'answer' && e.answer.trim().length >= 12) {
      deal($, 'turn')
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // /next reads the table; clearing it first would eat its own card.
    if (!/^\/next(\s|$)/.test(e.text)) {
      await retire($)
    }

    return next(e)
  })

  on('command.run', { command: 'next' }, async ($, e) => {
    const [first = '', second = ''] = e.args.trim().toLowerCase().split(/\s+/)

    if (first === 'hide' || first === 'show') {
      await update($, isHidden, () => first === 'hide')

      return { text: first === 'hide' ? 'Oracle hidden. /next show wakes it.' : 'Oracle awake.' }
    }

    if (first === 'forget') {
      await Promise.all(['seen', 'picked', 'skipped'].map(key => $.store.delete(key)))

      return { text: 'The oracle forgot your taste and its own history.' }
    }

    const n = Number(first)

    if (Number.isInteger(n) && n >= 1 && n <= 3) {
      const { cards } = await read($, deck)
      const card = cards[n - 1]

      if (card === undefined) {
        return { text: 'Nothing dealt in that slot. /next deals a new hand.' }
      }

      const isSent = second === 'go'

      await take($, card, isSent)

      return { text: isSent ? `Sent: ${card.title}` : `Loaded into the prompt: ${card.title}` }
    }

    const d = await read($, deck)

    if (first === '' && d.phase === 'ready') {
      return { text: renderHand(d) }
    }

    if (first === '' && d.phase === 'thinking') {
      return { text: 'Still reading the room…' }
    }

    await update($, isHidden, () => false)
    await retire($)
    deal($, 'reroll')

    return { text: 'Reading the room…' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const d = await read($, deck)
    const isOff = await read($, isHidden)

    if (e.props.hasSurvey || e.props.isWorking || isOff || (d.phase === 'idle' && d.note === '')) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const width = e.props.bodyColumns

    if (d.phase !== 'ready') {
      return (
        <Box>
          <Text color="cyan">◈ </Text>
          <Text dimColor>{d.phase === 'thinking' ? 'oracle: reading the room…' : `oracle: ${d.note}`}</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="cyan">
            ◈ ORACLE{' '}
          </Text>
          <Text dimColor>
            {d.turn > 0 ? `after turn ${d.turn}` : 'cold open'} · ctrl+x tab, then 1 2 3 · /next new deals again{' '}
          </Text>
          <Button
            key="hide"
            plain
            dimColor
            label="hide"
            onPress={() => update($, isHidden, () => true)}
          />
        </Box>
        {d.cards.map((card, i) => {
          const lane = LANES[card.lane]
          const label = `${lane.glyph} ${lane.label.padEnd(8)} ${card.title}`
          const tag = card.spends === '' ? '' : ` ⚑ ${card.spends}`
          const room = Math.max(8, width - label.length - tag.length - 7)

          return (
            <Box key={`card-${i}`}>
              <Button
                key={`pick-${i}`}
                plain
                hotkey={String(i + 1)}
                label={label}
                onPress={() => take($, card, false)}
              />
              <Text dimColor> {fit(card.why, room)}</Text>
              {tag !== '' && <Text color="yellow">{tag}</Text>}
            </Box>
          )
        })}
      </Box>
    )
  })
}
