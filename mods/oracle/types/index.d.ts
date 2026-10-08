export type Lane = 'next' | 'sideways' | 'edge'

export type Card = {
  lane: Lane
  title: string
  why: string
  prompt: string
  spends: string
}

export type Deck = {
  phase: 'idle' | 'thinking' | 'ready'
  cards: Card[]
  turn: number
  note: string
  isPicked: boolean
}

declare module 'claude-code' {
  interface PluginState {
    oracle: { deck: Deck; isHidden: boolean }
  }
}
