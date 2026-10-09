export type Mode = 'collision' | 'inversion' | 'escalation' | 'wrongtool'

export type Status = 'open' | 'picked' | 'slop' | 'parked' | 'done'

export type Path = {
  id: string
  title: string
  why: string
  firstMove: string
  mode: Mode
  ring: 1 | 2 | 3
  reachDays: number
  surprise: number
  money: number
  fuel: string[]
  tools: string[]
  sources: { label: string; url: string }[]
  spends: string
  isWildcard: boolean
  isMoney: boolean
  doubt: string
  status: Status
  round: number
  createdAt: string
}

export type Now = {
  headline: string
  situation: string
  round: number
  convenedAt: string
  council: string[]
  trigger: string
  // The one question the Oracle asks the artist this round; '' when none.
  question: string
  // Stable id for that question (e.g. "r2-paid"); falls back to the question text. '' when no question.
  questionId: string
  // 0 to 4 mutually exclusive answers, each at most 60 chars. Free text is always allowed too.
  questionOptions: string[]
}

export type Field = { now: Now; paths: Path[] }

export type Nudge = { reason: string; turn: number }

declare module 'claude-code' {
  interface PluginState {
    oracle: {
      field: Field | null
      nudge: Nudge | null
      isHidden: boolean
      turns: number
      quietUntil: number
      // questionId to a short label (at most 120 chars) of what the artist answered, mirrored from oracle/inbox.jsonl.
      answers: Record<string, string>
    }
  }
}
