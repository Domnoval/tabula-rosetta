import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Field, Nudge, Path } from '../types'
import {
  answerFor,
  answerLabel,
  answerLine,
  answersFromInbox,
  appendLine,
  buildSense,
  digest,
  dollars,
  fit,
  LETTERS,
  letterSpan,
  markPicked,
  MODES,
  NO_WORDS,
  ordered,
  parseAnswer,
  parseField,
  parseSense,
  renderField,
  RINGS,
} from './lib'
import type { Answer } from './lib'

const field = atom({ plugin: 'oracle', key: 'field' } as const, null)
const nudge = atom({ plugin: 'oracle', key: 'nudge' } as const, null)
const isHidden = atom({ plugin: 'oracle', key: 'isHidden' } as const, false)
const turns = atom({ plugin: 'oracle', key: 'turns' } as const, 0)
const quietUntil = atom({ plugin: 'oracle', key: 'quietUntil' } as const, 0)
const answers = atom({ plugin: 'oracle', key: 'answers' } as const, {})

const FIELD_FILE = 'oracle/field.json'
const PAGE_FILE = 'oracle/page/URL'
// Answers given here wait in this file for the next council, which records and empties it.
const INBOX_FILE = 'oracle/inbox.jsonl'

const NO_QUESTION = 'No question is waiting. The council asks one each round: /next convene.'

// Module scope: a reload starts these over, which is what a reload should do.
const cfg: { cadence: 'forks' | 'every' | 'ask'; fastModel: string } = { cadence: 'forks', fastModel: 'haiku' }

const where = async ($: EngineInterface, file: string) => `${await $.session.root()}/${file}`

// The inbox is the record of what was answered and not yet heard: mirror it. A council that
// has read it empties it, which clears the answers here too, ready for its new question.
const loadAnswers = async ($: EngineInterface) => {
  let text = ''

  try {
    const file = await where($, INBOX_FILE)

    text = (await $.fs.exists(file)) ? await $.fs.read(file) : ''
  } catch {
    return // Unreadable is not empty: keep what is known.
  }

  const restored = answersFromInbox(text)

  await update($, answers, (): Record<string, string> => restored)
}

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

  await loadAnswers($)
}

// One answer to the Oracle's question, from /next or the band: a line appended to the
// inbox (read, append, write: $.fs has no append), then mirrored into state.
// Inbox writes are read-modify-write, so they run one at a time: two answers in flight at once
// must both land. The chain lives in module scope and starts over on a reload, like any timer.
let inboxTurn: Promise<unknown> = Promise.resolve()

const recordAnswer = ($: EngineInterface, answer: Answer): Promise<{ isRecorded: boolean; text: string }> => {
  const turn = inboxTurn.then(() => writeAnswer($, answer))

  inboxTurn = turn.catch(() => undefined)

  return turn
}

const writeAnswer = async ($: EngineInterface, answer: Answer): Promise<{ isRecorded: boolean; text: string }> => {
  const f = await read($, field)

  if (f === null || f.now.question === '') {
    return { isRecorded: false, text: NO_QUESTION }
  }

  const { question, questionId, questionOptions } = f.now
  const choice = answer.choice === undefined ? undefined : questionOptions[answer.choice]
  const text = answer.text === undefined || answer.text.trim() === '' ? undefined : answer.text

  if (answer.choice !== undefined && choice === undefined) {
    return { isRecorded: false, text: 'That option is not on the question any more. /next shows it as it stands.' }
  }

  if (choice === undefined && text === undefined) {
    return { isRecorded: false, text: NO_WORDS }
  }

  try {
    const file = await where($, INBOX_FILE)
    const before = (await $.fs.exists(file)) ? await $.fs.read(file) : ''
    const at = new Date(await $.clock.now()).toISOString()

    await $.fs.write(file, appendLine(before, answerLine({ questionId, question, choice, text, at })))
  } catch {
    return { isRecorded: false, text: `Could not write ${INBOX_FILE}, so nothing was recorded. Answer in chat instead.` }
  }

  const label = answerLabel(choice, text)

  await update($, answers, (a): Record<string, string> => ({ ...a, [questionId]: label }))

  const said = answer.choice === undefined ? label : `${LETTERS[answer.choice]}) ${label}`

  return { isRecorded: true, text: `Answer recorded for the next council: ${said}` }
}

// A band press has no reply row, so only a failure needs saying.
const pressAnswer = async ($: EngineInterface, choice: number) => {
  const done = await recordAnswer($, { choice })

  if (!done.isRecorded) {
    $.ui.toast(done.text)
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
      description:
        "Oracle: show the paths and the question, answer it (/next b, /next answer <words>), load a path (/next 2), send it (/next 2 go), or convene a council",
      argumentHint: '[N] [go] | a-d [why] | answer <words> | convene | interview | page | refresh | hide | show',
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
    const answer = parseAnswer(e.args, f === null ? 0 : f.now.questionOptions.length)

    if (answer !== null) {
      if (f === null || f.now.question === '') {
        return { text: NO_QUESTION }
      }

      return { text: 'error' in answer ? answer.error : (await recordAnswer($, answer)).text }
    }

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

    return { text: renderField(f, await read($, answers)) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const [f, n, isOff, heard] = await Promise.all([
      read($, field),
      read($, nudge),
      read($, isHidden),
      read($, answers),
    ])

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

    if (f === null) {
      return next(e)
    }

    const { question, questionId, questionOptions } = f.now
    const answered = question === '' ? undefined : answerFor(heard, questionId)
    const isAsking = question !== '' && answered === undefined
    const options = isAsking ? questionOptions : []
    const paths = ordered(f)
    // Rows the tree may take and still show whole, beside the engine's own `n more` row. The
    // ask outranks the paths: its row and its options are placed first, the paths get the rest.
    const budget = e.props.maxRows - 1
    const askRows = question === '' ? 0 : 1
    const isStacked = 1 + askRows + options.length + Math.min(1, paths.length) <= budget
    const optionRows = options.length === 0 ? 0 : isStacked ? options.length : 1
    const rows = paths.slice(0, Math.min(9, Math.max(isAsking ? 0 : 1, budget - 1 - askRows - optionRows)))

    if (!isAsking && rows.length === 0) {
      return next(e)
    }

    const keys = [
      options.length === 0 ? '' : letterSpan(options.length),
      rows.length === 0 ? '' : rows.length === 1 ? '1' : `1-${rows.length}`,
    ].filter(k => k !== '')
    const fullHint = keys.length === 0 ? ' ' : ` · ctrl+x tab, then ${keys.join(' or ')} `
    // On a narrow band the key hint goes first: the headline and the hide control must fit.
    const hint = width - fullHint.length >= 36 ? fullHint : ' '
    const freeText = options.length === 0 && width >= 48 ? '  /next answer <your words>' : ''
    const each = Math.max(6, Math.floor((width - 2) / Math.max(1, options.length)) - 6)

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="cyan">
            ◈ ORACLE{' '}
          </Text>
          <Text dimColor>
            {fit(`round ${f.now.round} · ${f.now.headline}`, Math.max(12, width - hint.length - 16))}
            {hint}
          </Text>
          <Button key="hide" plain dimColor label="hide" onPress={() => update($, isHidden, () => true)} />
        </Box>
        {isAsking && (
          <Box key="ask">
            <Text bold color="magenta">
              {fit(`ASKS YOU: ${question}`, Math.max(12, width - freeText.length))}
            </Text>
            {freeText !== '' && <Text dimColor>{freeText}</Text>}
          </Box>
        )}
        {isStacked &&
          options.map((o, i) => (
            <Box key={`ans-row-${i}`}>
              <Text>{'  '}</Text>
              <Button
                key={`ans-${i}`}
                plain
                hotkey={LETTERS[i]}
                label={fit(o, Math.max(8, width - 6))}
                onPress={() => pressAnswer($, i)}
              />
            </Box>
          ))}
        {!isStacked && options.length > 0 && (
          <Box key="ans-row">
            <Text>{'  '}</Text>
            {options.flatMap((o, i) => [
              ...(i === 0 ? [] : [<Text key={`ans-sep-${i}`} dimColor>{' · '}</Text>]),
              <Button key={`ans-${i}`} plain hotkey={LETTERS[i]} label={fit(o, each)} onPress={() => pressAnswer($, i)} />,
            ])}
          </Box>
        )}
        {answered !== undefined && (
          <Text key="answered" dimColor>
            {fit(`you answered: ${answered}`, Math.max(12, width - 2))}
          </Text>
        )}
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
