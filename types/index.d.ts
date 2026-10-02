/** What Ember is doing: asleep, watching Claude work, waiting on you now, your move, or celebrating. */
export type EmberPhase = 'rest' | 'work' | 'blocked' | 'done' | 'cheer'

/** How it watches while Claude works. */
export type EmberGesture = 'think' | 'read' | 'write' | 'run'

/** What the companion pane draws from: changes only when the creature should. */
export type EmberMood = { phase: EmberPhase; gesture: EmberGesture }

/** What the band narrates: the current step, when the phase began, steps so far, and whether the idle nudge went out. */
export type EmberLive = { label: string; since: number; tools: number; isNudged?: boolean }

/** The one thing, when you set one. */
export type EmberFocus = { text: string; startedAt: number; turns: number }

declare module 'claude-code' {
  interface PluginState {
    ember: {
      mood: EmberMood
      live: EmberLive
      focus: EmberFocus | null
      ask: string
      parked: string[]
      isMuted: boolean
      isClosed: boolean
      isBusy: boolean
      isDrifting: boolean
      now: number
    }
  }
}
