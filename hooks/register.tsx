import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement } from 'claude-code'

import type { EmberAgent, EmberFocus, EmberGesture, EmberLive, EmberMood, EmberPhase } from '../types'
import { caption, portrait } from './creature'
import { clip, narrate, span } from './narrate'

const PANE = 'ember'
const CHIME = 'fx/chime.wav'
const WIN = 'fx/win.wav'

const WORK = '#E8912D'
const YOU = '#FF5D73'
const READY = '#3FB68B'
const CHEER = '#E8B931'

// Work shorter than this ended while he was still looking at it: no chime.
const CHIME_AFTER_MS = 20_000
// How long a question or permission prompt may sit before the chime calls him back.
const KNOCK_AFTER_MS = 10_000
// The engine says when a permission prompt opens, never when it is answered:
// past this the creature stops insisting, so an approved long command is not
// drawn as waiting on him for its whole run.
const BLOCK_DECAY_MS = 40_000
const CHEER_MS = 4500
const PARKED_MAX = 50
// How long his move may stand before one chime asks whether he is still there.
const NUDGE_AFTER_MS = 5 * 60_000
// Nothing drawn counts seconds, so the clock the drawings read moves this often
// and no more: a row redrawn every second reads as blinking.
const HEARTBEAT_MS = 15_000
// The main loop takes an agent's report up within a moment of its end: wait this long
// before calling it his move, so a turn about to start is not chimed over.
const REPORT_MS = 2500
// He typed the prompt a line above the band: an echo longer than this is noise.
const ASK_SHOWN = 60
// A prompt shorter than this ("yes", "do it") is a reply, never a new task: not judged.
const JUDGE_MIN_CHARS = 24
const JUDGE = [
  'You judge whether a new request to a coding assistant still belongs to the task its author said they are focused on.',
  'Reply with one word.',
  'SAME: the request works toward the focus, follows up on it, asks about it, fixes or tests it, or could plausibly be part of it.',
  'DIFFERENT: it clearly starts unrelated work.',
  'When unsure, reply SAME.',
].join(' ')

// Prompts nobody typed: they start turns, but they are not what he asked for.
const MACHINE = new Set([
  'task-notification',
  'scheduled-trigger',
  'peer',
  'peer-send-message',
  'projects-relay',
  'channel',
  'coordinator',
  'observer',
  'observer-activity',
  'auto-continuation',
  'plugin',
])

// An agent the engine lists under one of these has stopped, however it ended.
const ENDED = new Set(['completed', 'failed', 'killed', 'stopped', 'cancelled'])

const feel = (phase: EmberPhase, gesture: EmberGesture): EmberMood => ({ phase, gesture })

const mood = atom({ plugin: 'ember', key: 'mood' } as const, feel('rest', 'think'))
const live = atom({ plugin: 'ember', key: 'live' } as const, { label: '', since: 0, tools: 0 })
const agents = atom({ plugin: 'ember', key: 'agents' } as const, [])
const focus = atom({ plugin: 'ember', key: 'focus' } as const, null)
const ask = atom({ plugin: 'ember', key: 'ask' } as const, '')
const parked = atom({ plugin: 'ember', key: 'parked' } as const, [])
const isMuted = atom({ plugin: 'ember', key: 'isMuted' } as const, false)
const isBusy = atom({ plugin: 'ember', key: 'isBusy' } as const, false)
const isDrifting = atom({ plugin: 'ember', key: 'isDrifting' } as const, false)
const now = atom({ plugin: 'ember', key: 'now' } as const, 0)

/** The flame grows the longer he stays on the one thing. */
const heatOf = (current: EmberMood, held: EmberFocus | null): number => {
  if (current.phase === 'rest') {
    return 0
  }

  if (held === null || held.turns < 2) {
    return 1
  }

  return held.turns < 5 ? 2 : 3
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

/** What is being done right now, in words: the main loop's own step, else what its agents are on. */
const saying = (step: EmberLive, crew: readonly EmberAgent[], isTurn: boolean): string => {
  if (isTurn && step.label !== '' && step.label !== 'Thinking') {
    return step.label
  }

  const last = crew.at(-1)

  if (last !== undefined) {
    return clip(`${crew.length === 1 ? 'Agent' : `${crew.length} agents`}: ${last.label}`, 72)
  }

  return isTurn ? 'Thinking' : ''
}

/** The state in a glyph and a few words, its color, and the detail beside it: one voice for the band and the pane. */
const statusOf = (
  current: EmberMood,
  step: EmberLive,
  crew: readonly EmberAgent[],
  at: number,
  isTurn: boolean,
  isNarrated: boolean,
): { color: string; head: string; tail: string } => {
  const waited = Math.max(0, at - step.since)
  const steps = step.tools > 0 ? plural(step.tools, 'step') : ''
  const crewed = crew.length > 0 ? `${plural(crew.length, 'agent')} working` : 'Working'

  if (current.phase === 'work') {
    // Where the spinner line narrates the step, the band only says who is working.
    return { color: WORK, head: `● ${isNarrated ? crewed : saying(step, crew, isTurn) || crewed}`, tail: steps }
  }

  if (current.phase === 'blocked') {
    return { color: YOU, head: `▲ ${step.label || 'Claude needs you'}`, tail: '' }
  }

  if (current.phase === 'done') {
    return { color: READY, head: '◆ Your move', tail: waited >= 60_000 ? span(waited) : '' }
  }

  if (current.phase === 'cheer') {
    return { color: CHEER, head: '★ Done. Nice.', tail: '' }
  }

  return { color: READY, head: '○ Ready', tail: '' }
}

const sound = async ($: EngineInterface, asset: string): Promise<void> => {
  if (await read($, isMuted)) {
    return
  }

  await $.audio.play({ asset }, { gain: 0.6 }).catch(() => undefined)
}

const toggleSound = async ($: EngineInterface, to?: boolean): Promise<boolean> => {
  const muted = await update($, isMuted, was => to ?? !was)
  await $.store.set('isMuted', muted)

  return muted
}

const keepParked = async ($: EngineInterface, change: (list: string[]) => string[]): Promise<string[]> => {
  const list = await update($, parked, change)
  await $.store.set('parked', list)

  return list
}

const setFocus = async ($: EngineInterface, text: string): Promise<void> => {
  const thing = clip(text, 120)

  if (thing === '') {
    return
  }

  const at = await $.clock.now()
  await update($, now, () => at)
  await update($, focus, () => ({ text: thing, startedAt: at, turns: 0 }))
  await update($, isDrifting, () => false)

  // Setting a focus wakes it: from asleep to looking at him. No turn ended, so there is nothing to nudge about.
  if ((await read($, mood)).phase === 'rest') {
    await update($, live, held => ({ ...held, label: '', since: at, isNudged: true }))
    await update($, mood, () => feel('done', 'think'))
  }
}

const finishFocus = async ($: EngineInterface, isSaid = true): Promise<string> => {
  const held = await read($, focus)

  if (held === null) {
    return 'No focus set. `/ember <the one thing>` sets one.'
  }

  const at = await $.clock.now()
  const line = `Done: ${held.text} (${span(at - held.startedAt)}, ${plural(held.turns, 'turn')})`

  await update($, focus, () => null)
  await update($, isDrifting, () => false)
  await update($, mood, was => feel('cheer', was.gesture))
  void sound($, WIN)

  // A command's own output row says it; a button has none, so the chat is told.
  if (isSaid) {
    $.ui.log(`★ ${line}`)
  }

  $.clock.after(CHEER_MS, () => {
    void (async () => {
      const isWorking = (await read($, isBusy)) || (await read($, agents)).length > 0
      await update($, mood, was => (was.phase === 'cheer' ? feel(isWorking ? 'work' : 'done', 'think') : was))
    })()
  })

  return line
}

const promote = async ($: EngineInterface, thought: string): Promise<void> => {
  await keepParked($, list => list.filter(one => one !== thought))
  await setFocus($, thought)
}

// Main-loop tool calls in flight, and which wait on him is the newest. A
// reload starts both over, which a turn's start and end do too.
let running = 0
let waits = 0
// Which typed prompt is the newest: a verdict on an older one is dropped.
let asks = 0
// Loops that call tools under an id the engine lists no agent for (a fork, a
// compaction): not his agents, and asked about once.
const strangers = new Set<string>()

/** One small model call per typed prompt while a focus is set: is this still the one thing? */
const judge = async ($: EngineInterface, asked: string, id: number): Promise<void> => {
  const held = await read($, focus)

  if (held === null) {
    return
  }

  const reply = await $.model
    .complete({
      model: 'haiku',
      system: JUDGE,
      prompt: `FOCUS: ${held.text}\nREQUEST: ${clip(asked, 600)}`,
      maxTokens: 8,
      effort: 'low',
      timeoutMs: 8000,
    })
    .catch(() => undefined)
  const isOff = reply?.isAnswered === true && /^\W*different/i.test(reply.text)

  // No verdict is no doubt: a failed or slow call never flags a prompt.
  if (!isOff || id !== asks) {
    return
  }

  await update($, isDrifting, () => true)
  // A line in the chat, where he just typed, and one the model never reads.
  $.ui.log(`Side quest? Still on: ${held.text}. /park it for later.`)
}

/** His move has stood a while: one chime, once, then quiet until the next turn ends. */
const nudge = async ($: EngineInterface, at: number): Promise<void> => {
  const step = await read($, live)

  if (step.isNudged === true || at - step.since < NUDGE_AFTER_MS) {
    return
  }

  await update($, live, held => ({ ...held, isNudged: true }))

  const held = await read($, focus)
  const waited = `Claude finished ${span(at - step.since)} ago.`

  // Said in the chat, so it is still there when he comes back.
  $.ui.log(held === null ? `◆ ${waited} Your move.` : `◆ Still on: ${held.text}? ${waited}`)
  void sound($, CHIME)
}

/** Claude cannot go on without him: say so now, chime if it stands. */
const block = async ($: EngineInterface, label: string, isDecaying: boolean): Promise<void> => {
  if (!(await read($, isBusy))) {
    return
  }

  waits += 1
  const wait = waits
  const isStanding = async () => wait === waits && (await read($, mood)).phase === 'blocked'

  await update($, live, held => ({ ...held, label }))
  await update($, mood, was => (was.phase === 'cheer' ? was : feel('blocked', was.gesture)))

  $.clock.after(KNOCK_AFTER_MS, () => {
    void (async () => {
      if (await isStanding()) {
        await sound($, CHIME)
      }
    })()
  })

  if (isDecaying) {
    $.clock.after(BLOCK_DECAY_MS, () => {
      void (async () => {
        if (await isStanding()) {
          await update($, mood, was => feel('work', was.gesture))
        }
      })()
    })
  }
}

/** A call came back: he answered whatever it waited on, and with none left Claude is thinking. */
const settle = async ($: EngineInterface): Promise<void> => {
  const isIdle = running === 0
  const was = await read($, mood)

  if (was.phase !== 'work' && was.phase !== 'blocked') {
    return
  }

  if (was.phase === 'blocked' || (isIdle && was.gesture !== 'think')) {
    await update($, mood, held => feel('work', isIdle ? 'think' : held.gesture))
  }

  // The agents' steps are kept apart from this label, so clearing it never hides what they are on.
  if (isIdle) {
    await update($, live, held => ({ ...held, label: 'Thinking' }))
  }
}

/** Drops the agents the engine no longer runs: one that was killed, or whose end the mod never heard. */
const reconcile = async ($: EngineInterface): Promise<EmberAgent[]> => {
  const crew = await read($, agents)

  if (crew.length === 0) {
    return crew
  }

  const listed = await $.agent.list().catch(() => undefined)

  // No list is no news: keep what is known.
  if (listed === undefined) {
    return crew
  }

  const alive = new Set(listed.filter(one => !ENDED.has(one.status)).map(one => one.id))
  const kept = crew.filter(one => alive.has(one.id))

  return kept.length === crew.length ? crew : update($, agents, list => list.filter(one => alive.has(one.id)))
}

/** Notes an agent's step and answers whether the loop is one of his agents at all. */
const track = async ($: EngineInterface, id: string, label: string): Promise<boolean> => {
  let name = (await read($, agents)).find(one => one.id === id)?.name

  if (name === undefined) {
    if (strangers.has(id)) {
      return false
    }

    const listed = (await $.agent.list().catch(() => [])).find(one => one.id === id && !ENDED.has(one.status))

    if (listed === undefined) {
      strangers.add(id)

      return false
    }

    name = clip(listed.description, 40)
  }

  const known = name
  // The agent with the newest step goes last: it is the one the narration quotes.
  await update($, agents, list => [...list.filter(one => one.id !== id), { id, name: known, label }])

  return true
}

/** Agents are at work with the main loop idle: that is work, not his move. */
const carryOn = async ($: EngineInterface, at: number): Promise<void> => {
  const was = await read($, mood)

  if (was.phase === 'done' || was.phase === 'rest') {
    await update($, live, held => ({ ...held, label: '', since: at }))
  }

  await update($, mood, held => (held.phase === 'cheer' || held.phase === 'blocked' ? held : feel('work', 'run')))
}

/** Everything is finished: his move, and a chime if he has had time to wander off. */
const handOver = async ($: EngineInterface, at: number, isQuiet: boolean): Promise<void> => {
  const step = await read($, live)

  await update($, now, () => at)
  await update($, live, held => ({ ...held, label: '', since: at, isNudged: false }))
  await update($, mood, was => (was.phase === 'cheer' ? was : feel('done', 'think')))

  if (!isQuiet && at - step.since >= CHIME_AFTER_MS) {
    void sound($, CHIME)
  }
}

/** With the main loop idle and no agent left at work, the work is over. */
const wrapUp = async ($: EngineInterface): Promise<void> => {
  const isOver =
    (await read($, mood)).phase === 'work' && !(await read($, isBusy)) && (await reconcile($)).length === 0

  if (isOver) {
    await handOver($, await $.clock.now(), false)
  }
}

const tick = async ($: EngineInterface): Promise<void> => {
  const at = await $.clock.now()
  await update($, now, () => at)

  if ((await read($, mood)).phase === 'done') {
    await nudge($, at)

    return
  }

  // An agent whose end the mod never heard would leave it working forever.
  await wrapUp($)
}

const open = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Ember' })

/** Where things stand, as /ember says it in the chat: the focus, what is parked, the sound, and what to type. */
const standing = async ($: EngineInterface): Promise<string> => {
  const held = await read($, focus)
  const lot = await read($, parked)
  const muted = await read($, isMuted)
  const at = await $.clock.now()
  const kept = `${lot.length === 0 ? 'nothing parked' : `${lot.length} parked`} · sound ${muted ? 'off' : 'on'}`

  if (held === null) {
    return [
      `No focus set · ${kept}`,
      '`/ember <the one thing>` sets a focus · `/park <thought>` saves a stray one',
    ].join('\n')
  }

  return [
    `▸ **${held.text}** · ${span(at - held.startedAt)} · ${plural(held.turns, 'turn')} · ${kept}`,
    `\`/ember done\` finishes it · \`/ember drop\` clears it · \`/ember ${muted ? 'unmute' : 'mute'}\` · \`/park\` lists what is parked`,
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command
      .register({
        name: 'ember',
        description: 'Set the one thing you are doing, or see where your focus stands',
        argumentHint: '[the one thing | done | drop | mute | pane]',
        immediate: true,
      })
      .catch(() => $.ui.log('could not register /ember', { to: 'debug' }))
    await $.command
      .register({
        name: 'park',
        description: 'Park a stray thought for later without derailing the work',
        argumentHint: '[thought | clear]',
        immediate: true,
      })
      .catch(() => $.ui.log('could not register /park', { to: 'debug' }))

    const kept = await $.store.get('parked')
    const wasMuted = (await $.store.get('isMuted')) === true

    if (Array.isArray(kept)) {
      await update($, parked, () => kept.filter((one): one is string => typeof one === 'string'))
    }

    await update($, isMuted, () => wasMuted)
    // A reload drops the timer that ends a cheer.
    await update($, mood, was => (was.phase === 'cheer' ? feel('done', 'think') : was))

    // Nothing opens by itself: the mod lives in the chat (the band, the spinner line, lines
    // of the transcript), and the pane waits for /ember pane. A pane found open at a load was left
    // by an earlier version that opened one unasked, in a session still running: close it.
    if ((await $.ui.panes()).some(pane => pane.id === PANE)) {
      await $.ui.close({ id: PANE }).catch(() => undefined)
    }

    $.clock.every(HEARTBEAT_MS, () => {
      void tick($)
    })

    return next(e)
  })

  on('command.run', { command: 'ember' }, async ($, e) => {
    const args = e.args.trim()
    const word = args.toLowerCase()

    if (word === 'done') {
      return { text: `★ ${await finishFocus($, false)}` }
    }

    if (word === 'drop') {
      await update($, focus, () => null)
      await update($, isDrifting, () => false)

      return { text: 'Focus dropped.' }
    }

    if (word === 'mute' || word === 'unmute') {
      const muted = await toggleSound($, word === 'mute')

      return { text: muted ? 'Ember is muted.' : 'Ember chimes when it is your move.' }
    }

    // The pane is asked for by name: on its own, /ember answers in the chat.
    if (word === 'pane') {
      await open($)

      return { text: 'Pane opened. Close it with its ✕.' }
    }

    if (args !== '') {
      await setFocus($, args)

      return { text: `▸ Locked in: ${clip(args, 120)}` }
    }

    return { text: await standing($) }
  })

  on('command.run', { command: 'park' }, async ($, e) => {
    const thought = e.args.trim()

    if (thought === '') {
      const list = await read($, parked)

      return {
        text:
          list.length === 0
            ? 'Nothing parked. `/park <thought>` saves one for later.'
            : list.map((one, index) => `${index + 1}. ${one}`).join('\n'),
      }
    }

    if (thought.toLowerCase() === 'clear') {
      await keepParked($, () => [])

      return { text: 'Parking lot cleared.' }
    }

    const list = await keepParked($, held => [...held, clip(thought, 200)].slice(-PARKED_MAX))
    $.ui.toast(`Parked: ${clip(thought, 60)}. Back to it.`)

    // The thought itself stays out of the row the model reads: parking it must not start it.
    return { text: `Parked (${list.length}).` }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!MACHINE.has(e.origin.kind) && !e.text.startsWith('/')) {
      const { text } = e
      asks += 1
      const id = asks

      await update($, ask, () => clip(text, 160))

      // Each typed prompt is judged afresh, off the dispatch so the prompt never waits on it.
      if (await read($, isDrifting)) {
        await update($, isDrifting, () => false)
      }

      if (text.trim().length >= JUDGE_MIN_CHARS && (await read($, focus)) !== null) {
        $.clock.after(1, () => {
          void judge($, text, id)
        })
      }
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const at = await $.clock.now()
    running = 0
    waits += 1

    // A turn that starts while work is under way (an agent reported in) carries the same stretch on.
    const isOngoing = (await read($, mood)).phase === 'work'
    await reconcile($)

    await update($, isBusy, () => true)
    await update($, now, () => at)
    await update($, live, held => (isOngoing ? { ...held, label: 'Thinking' } : { label: 'Thinking', since: at, tools: 0 }))
    await update($, mood, was => (was.phase === 'cheer' ? was : feel('work', 'think')))

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)

    if (started.agentId !== undefined) {
      const id = started.agentId
      await update($, agents, list => [...list.filter(one => one.id !== id), { id, name: clip(e.description, 40), label: 'Starting' }])

      if (!(await read($, isBusy))) {
        await carryOn($, await $.clock.now())
      }
    }

    return started
  })

  on('tool.call', async ($, e, next) => {
    const said = narrate(e.tool, e as unknown as Readonly<Record<string, unknown>>)

    // An agent's step is kept under the agent: the main loop's own label is not its to write.
    if (e.agentId !== undefined) {
      if (await track($, e.agentId, said.label)) {
        await update($, live, held => ({ ...held, tools: held.tools + 1 }))

        if (!(await read($, isBusy))) {
          await carryOn($, await $.clock.now())
        }
      }

      try {
        return await next(e)
      } finally {
        // Its call came back, so nothing of its waits on him.
        if ((await read($, mood)).phase === 'blocked') {
          await update($, mood, was => (was.phase === 'blocked' ? feel('work', was.gesture) : was))
        }
      }
    }

    running += 1

    if (await read($, isBusy)) {
      await update($, live, held => ({ ...held, label: said.label, tools: held.tools + 1 }))
      await update($, mood, was => (was.phase === 'cheer' ? was : feel('work', said.gesture)))
    }

    if (e.tool === 'AskUserQuestion') {
      await block($, 'Claude has a question for you', false)
    }

    try {
      return await next(e)
    } finally {
      running = Math.max(0, running - 1)
      await settle($)
    }
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const answered = await next(e)

    // A settings hook that decided it leaves no dialog for him to answer.
    if (answered.decision === undefined) {
      await block($, clip(`Needs your OK: ${e.tool_name}`), true)
    }

    return answered
  })

  on('turn.complete', async ($, e, next) => {
    // An agent's turn ended. It may run another (it waits on a shell, then goes on), so the
    // engine's list says whether it is over; with the main loop idle and none left, the work is.
    if (e.agentId !== undefined) {
      const ended = await next(e)
      await reconcile($)
      $.clock.after(REPORT_MS, () => {
        void wrapUp($)
      })

      return ended
    }

    const at = await $.clock.now()
    running = 0
    waits += 1

    // A side quest does not feed the flame.
    if (e.reason === 'answer' && !(await read($, isDrifting))) {
      await update($, focus, held => (held === null ? held : { ...held, turns: held.turns + 1 }))
    }

    await update($, isBusy, () => false)

    // The main loop stopped with agents still at work: not his move yet.
    if ((await reconcile($)).length > 0) {
      await update($, now, () => at)
      await update($, live, held => ({ ...held, label: '' }))
      await carryOn($, at)
    } else {
      await handOver($, at, e.isAborted)
    }

    return next(e)
  })

  // On the terminal the spinner line says what Claude is doing right now, in plain
  // words, where the engine would say "Pontificating".
  on('ui.render', { component: 'Spinner', surface: 'terminal' }, async ($, e, next) => {
    // A message is the engine's own to say.
    if (e.props.message !== null) {
      return next(e)
    }

    const crew = await read($, agents)
    const own = crew.find(one => one.id === e.requestId)

    // An agent's own spinner says that agent's step.
    if (own !== undefined) {
      return next({ ...e, props: { ...e.props, word: own.label } })
    }

    // A turn the mod did not see start is not its to narrate.
    if (!(await read($, isBusy))) {
      return next(e)
    }

    const said = saying(await read($, live), crew, true)
    const word = said === 'Thinking' && e.props.mode === 'responding' ? 'Answering' : said

    return next({ ...e, props: { ...e.props, word } })
  })

  // The anchor: whose move it is, and what he is doing.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, mood)
    const held = await read($, focus)
    // Only the terminal's spinner line narrates the step; elsewhere the band says it.
    const isNarrated = e.surface === 'terminal'

    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    // Before the first prompt this line is how he knows it is there.
    if (current.phase === 'rest' && held === null) {
      return <Text dimColor>ember · /ember &lt;the one thing&gt; sets a focus</Text>
    }

    const step = await read($, live)
    const crew = await read($, agents)
    const at = await read($, now)
    const lot = await read($, parked)
    const asked = await read($, ask)
    const isOff = held !== null && current.phase !== 'cheer' && (await read($, isDrifting))
    const status = statusOf(current, step, crew, at, await read($, isBusy), isNarrated)
    const onIt = held !== null && at - held.startedAt >= 60_000 ? span(at - held.startedAt) : ''
    const goal = held === null ? (asked === '' ? '' : `You asked: ${clip(asked, ASK_SHOWN)}`) : `▸ ${held.text}`

    // The state comes first and never shrinks; the goal takes what is left and is cut there.
    return (
      <Box flexDirection="row" columnGap={2}>
        <Box flexShrink={0}>
          <Text color={status.color} bold>
            {status.head}
          </Text>
        </Box>
        {status.tail !== '' && (
          <Box flexShrink={0}>
            <Text dimColor>{status.tail}</Text>
          </Box>
        )}
        {isOff && (
          <Box flexShrink={0}>
            <Text color={YOU} bold>
              Side quest?
            </Text>
          </Box>
        )}
        {goal !== '' && (
          <Box flexShrink={1} minWidth={0}>
            <Text bold={held !== null} dimColor={held === null} wrap="truncate-end">
              {goal}
            </Text>
          </Box>
        )}
        {onIt !== '' && (
          <Box flexShrink={0}>
            <Text dimColor>{onIt}</Text>
          </Box>
        )}
        {lot.length > 0 && (
          <Box flexShrink={0}>
            <Text dimColor>{lot.length} parked</Text>
          </Box>
        )}
      </Box>
    )
  })

  // The companion, opened by /ember pane. It reads the mood and never the clock, and its flame is drawn
  // from the phase alone, so the animation restarts when the phase changes and at no other time.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const current = await read($, mood)
    const held = await read($, focus)
    const lot = await read($, parked)
    const muted = await read($, isMuted)
    const crew = await read($, agents)
    const look = { ...current, heat: heatOf(current, held), isDrifting: held !== null && (await read($, isDrifting)) }
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(120, Math.min(220, e.props.bodyColumns * 7))

    let creature: RenderElement
    let entry: RenderElement

    if (e.surface === 'terminal') {
      const status = statusOf(current, await read($, live), crew, 0, await read($, isBusy), false)
      creature = (
        <Text color={status.color} bold>
          {current.phase === 'rest' ? '○ Resting' : status.head}
        </Text>
      )
    } else {
      const { Svg } = $.ui.resolve(e)
      creature = (
        <Svg
          source={portrait({ ...look, gesture: 'write' }, width)}
          alt={`Ember, a small flame. ${caption(look)}`}
          width={width}
          height={Math.round(width * 0.9)}
          isInteractive
        />
      )
    }

    if (e.surface === 'mobile') {
      entry = <Text dimColor>/ember &lt;the one thing&gt; sets your focus</Text>
    } else {
      const { Input } = $.ui.resolve(e)
      entry = (
        <Input
          key="one-thing"
          placeholder="What's the one thing?"
          submitLabel="lock in"
          onSubmit={value => setFocus($, value)}
        />
      )
    }

    return (
      <Box flexDirection="column" alignItems="center" rowGap={1} paddingX={1}>
        {creature}
        <Text dimColor>{crew.length > 0 && current.phase === 'work' ? `${plural(crew.length, 'agent')} at work.` : caption(look)}</Text>
        {held === null ? (
          entry
        ) : (
          <Box flexDirection="column" alignItems="center">
            <Text bold wrap="wrap">
              {held.text}
            </Text>
            <Text dimColor>{held.turns === 0 ? 'just lit' : `${plural(held.turns, 'turn')} on it`}</Text>
            <Button key="done" variant="primary" label="Done" onPress={() => finishFocus($, true)} />
          </Box>
        )}
        {lot.length > 0 && (
          <Box flexDirection="column" alignItems="center">
            <Text dimColor>Parked. Press one to make it the focus.</Text>
            {lot.slice(-4).map((thought, index) => (
              <Button key={`parked-${index}`} label={clip(thought, 40)} dimColor onPress={() => promote($, thought)} />
            ))}
          </Box>
        )}
        <Button
          key="sound"
          label={muted ? 'Sound is off' : 'Sound is on'}
          dimColor
          onPress={() => toggleSound($)}
        />
      </Box>
    )
  })
}
