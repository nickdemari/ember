/** What Ember is doing: asleep, watching Claude work, waiting on you now, or your move. */
export type EmberPhase = 'rest' | 'work' | 'blocked' | 'done'

/** How it watches while Claude works. */
export type EmberGesture = 'think' | 'read' | 'write' | 'run'

/** What the companion pane draws from: changes only when the creature should. */
export type EmberMood = { phase: EmberPhase; gesture: EmberGesture }

/** What the band narrates: the current step, when the phase began, steps so far, and whether the idle nudge went out. */
export type EmberLive = { label: string; since: number; tools: number; isNudged?: boolean }

/** A subagent at work: its id, what it was sent to do, and the step it is on. */
export type EmberAgent = { id: string; name: string; label: string }

declare module 'claude-code' {
  interface PluginState {
    ember: {
      mood: EmberMood
      live: EmberLive
      agents: EmberAgent[]
      ask: string
      isMuted: boolean
      isBusy: boolean
      now: number
    }
  }
}
