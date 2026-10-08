import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Field, Nudge, Path } from '../types'
import {
  MODES,
  RINGS,
  buildSense,
  digest,
  dollars,
  fit,
  markPicked,
  ordered,
  parseField,
  parseSense,
  renderField,
} from './lib'

const field = atom({ plugin: 'oracle', key: 'field' } as const, null)
const nudge = atom({ plugin: 'oracle', key: 'nudge' } as const, null)
const isHidden = atom({ plugin: 'oracle', key: 'isHidden' } as const, false)
const turns = atom({ plugin: 'oracle', key: 'turns' } as const, 0)
const quietUntil = atom({ plugin: 'oracle', key: 'quietUntil' } as const, 0)

const FIELD_FILE = 'oracle/field.json'
const PAGE_FILE = 'oracle/page/URL'

// Module scope: a reload starts these over, which is what a reload should do.
const cfg: { cadence: 'forks' | 'every' | 'ask'; fastModel: string } = { cadence: 'forks', fastModel: 'haiku' }

const where = async ($: EngineInterface, file: string) => `${await $.session.root()}/${file}`

// The council writes oracle/field.json; this reads it into session state.
const loadField = async ($: EngineInterface) => {
  try {
    const parsed = parseField(await $.fs.read(await where($, FIELD_FILE)))

    if (parsed !== null) {
      await update($, field, () => parsed)
    }
  } catch {
    // No council has run yet.
  }
}

const clearNudge = async ($: EngineInterface, isIgnored: boolean) => {
  let had = false

  $.ui.status(undefined)
  await update($, nudge, n => {
    had = n !== null

    return null
  })

  if (had && isIgnored) {
    await update($, quietUntil, q => q + 3)
  }
}

// Is this turn a fork in the road? A small model decides; the cadence decides what to do about it.
const sense = async ($: EngineInterface, turn: number) => {
  let reason = 'a fresh outside view is available'

  if (cfg.cadence === 'forks') {
    if (turn < (await read($, quietUntil))) {
      return
    }

    const messages = await $.session.messages()
    const reply = await $.model.complete({
      model: cfg.fastModel,
      prompt: buildSense(digest(messages)),
      maxTokens: 160,
      effort: 'low',
      timeoutMs: 20000,
    })
    const verdict = reply.isAnswered ? parseSense(reply.text) : null

    if (verdict === null || !verdict.isFork) {
      return
    }

    reason = verdict.reason === '' ? reason : verdict.reason
  }

  const raised: Nudge = { reason, turn }

  await update($, nudge, () => raised)
  await update($, quietUntil, () => turn + 3)
  $.ui.status(`◈ fork: ${fit(reason, 60)} · /next convene`)
}

// A command cannot submit a prompt from inside itself (it would wait on its own turn), so
// every submission is queued for just after the calling event returns.
const queue = ($: EngineInterface, text: string) => {
  $.clock.after(50, () => {
    void $.prompt.submit({ text, asUser: true }).catch(() => {})
  })
}

const convene = async ($: EngineInterface, trigger: string) => {
  await clearNudge($, false)
  queue(
    $,
    `Convene the Oracle council now. Follow .claude/skills/oracle/SKILL.md (the oracle skill). Trigger: ${trigger}.`,
  )
}

const take = async ($: EngineInterface, path: Path, isSent: boolean) => {
  await update($, field, (f): Field | null =>
    f === null ? f : { ...f, paths: f.paths.map((p): Path => (p.id === path.id ? { ...p, status: 'picked' } : p)) },
  )

  try {
    const file = await where($, FIELD_FILE)
    const next = markPicked(await $.fs.read(file), path.id)

    if (next !== null) {
      await $.fs.write(file, next)
    }
  } catch {
    // The page still has the pick; the mirror is best effort.
  }

  if (isSent) {
    queue($, path.firstMove)
  } else {
    await $.prompt.fill({ text: path.firstMove, mode: 'replace' })
  }
}

export const register: Register = (on, options) => {
  cfg.cadence = options.cadence === 'every' || options.cadence === 'ask' ? options.cadence : 'forks'
  cfg.fastModel = typeof options.fastModel === 'string' && options.fastModel !== '' ? options.fastModel : 'haiku'

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'next',
      description: 'Oracle: show the paths, load one (/next 2), send it (/next 2 go), or convene a council',
      argumentHint: '[N] [go] | convene | interview | page | refresh | hide | show',
    })
    await loadField($)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer' && e.answer.trim().length >= 12) {
      const turn = await update($, turns, n => n + 1)

      await loadField($)

      if (cfg.cadence !== 'ask') {
        $.clock.after(40, () => {
          void sense($, turn).catch(() => {})
        })
      }
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // /next reads the table, and the Oracle's own prompts are not the artist moving on.
    if (!/^\/next(\s|$)/.test(e.text) && e.origin.kind !== 'plugin') {
      await clearNudge($, true)
    }

    return next(e)
  })

  on('command.run', { command: 'next' }, async ($, e) => {
    const [first = '', second = ''] = e.args.trim().toLowerCase().split(/\s+/)

    if (first === 'hide' || first === 'show') {
      await update($, isHidden, () => first === 'hide')

      return { text: first === 'hide' ? 'Oracle hidden. /next show wakes it.' : 'Oracle awake.' }
    }

    if (first === 'convene') {
      await convene($, 'asked')

      return { text: 'Convening the council…' }
    }

    if (first === 'interview') {
      queue($, 'Run the Oracle taste interview. Follow .claude/skills/oracle/SKILL.md, interview mode.')

      return { text: 'Starting the interview…' }
    }

    if (first === 'page') {
      try {
        return { text: `Live field: ${(await $.fs.read(await where($, PAGE_FILE))).trim()}` }
      } catch {
        return { text: 'No live page recorded yet. A council publishes it.' }
      }
    }

    if (first === 'refresh') {
      await loadField($)
    }

    const f = await read($, field)

    if (f === null) {
      return { text: 'No council has run yet. /next convene calls the first one.' }
    }

    const n = Number(first)

    if (Number.isInteger(n) && n >= 1) {
      const path = ordered(f)[n - 1]

      if (path === undefined) {
        return { text: `No path ${n}. /next lists them.` }
      }

      const isSent = second === 'go'

      await take($, path, isSent)

      return { text: isSent ? `Sent: ${path.title}` : `Loaded into the prompt: ${path.title}` }
    }

    return { text: renderField(f) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const [f, n, isOff] = await Promise.all([read($, field), read($, nudge), read($, isHidden)])

    if (e.props.hasSurvey || e.props.isWorking || isOff) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const width = e.props.bodyColumns

    if (n !== null) {
      return (
        <Box>
          <Text bold color="cyan">
            ◈ ORACLE{' '}
          </Text>
          <Text dimColor>fork: {fit(n.reason, Math.max(12, width - 36))} </Text>
          <Button key="convene" plain hotkey="c" label="convene" onPress={() => convene($, n.reason)} />
          <Text dimColor> · </Text>
          <Button key="dismiss" plain dimColor hotkey="x" label="not now" onPress={() => clearNudge($, true)} />
        </Box>
      )
    }

    const rows = f === null ? [] : ordered(f).slice(0, Math.max(2, Math.min(9, e.props.maxRows - 2)))

    if (f === null || rows.length === 0) {
      return next(e)
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="cyan">
            ◈ ORACLE{' '}
          </Text>
          <Text dimColor>
            {fit(`round ${f.now.round} · ${f.now.headline}`, Math.max(12, width - 24))} · ctrl+x tab, then 1-9{' '}
          </Text>
          <Button key="hide" plain dimColor label="hide" onPress={() => update($, isHidden, () => true)} />
        </Box>
        {rows.map((p, i) => {
          const label = `${p.isWildcard ? '✶' : MODES[p.mode].glyph} ${p.title}`
          const meta = `${RINGS[p.ring]} · ${dollars(p.money)} · `
          const tag = p.status === 'picked' ? ' ✓ picked' : p.spends === '' ? '' : ` ⚑ ${p.spends}`
          const room = Math.max(8, width - label.length - meta.length - tag.length - 7)

          return (
            <Box key={`row-${p.id}`}>
              <Button
                key={`pick-${i}`}
                plain
                hotkey={String(i + 1)}
                label={label}
                onPress={() => take($, p, false)}
              />
              <Text dimColor>
                {' '}
                {meta}
                {fit(p.why, room)}
              </Text>
              {tag !== '' && <Text color={p.status === 'picked' ? 'green' : 'yellow'}>{tag}</Text>}
            </Box>
          )
        })}
      </Box>
    )
  })
}
