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
    }
  }
}
