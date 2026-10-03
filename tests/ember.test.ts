import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
const START = 1_700_000_000_000

const BAND = {
  plugin: 'ember',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

const PANE = {
  plugin: 'ember',
  component: 'Pane',
  requestId: 'ember',
  props: {
    title: 'Ember',
    isFocused: false,
    bodyColumns: 30,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

/** The engine beneath the mod: a clock and a store in memory, and every other call it makes answered. */
const world = (on: On) => {
  const clock = mock.clock(on, { now: START })
  const played: string[] = []
  const toasts: string[] = []
  const judged: string[] = []
  const logs: string[] = []
  const spun: string[] = []
  const opened: string[] = []
  const surfaces: ('terminal' | 'desktop')[] = ['desktop']
  // The engine's own record of the session's subagents, as `$.agent.list()` answers it.
  const roster: { id: string; description: string; type: string; status: string }[] = []

  mock.store(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', (_$, e) => {
    opened.push(e.id)

    return { value: { isPlaced: true as const } }
  })
  on('session.surfaces', () => ({ value: surfaces }))
  on('agent.list', () => ({ value: roster }))
  on('agent.spawn', (_$, e) => {
    const agentId = `agent-${roster.length + 1}`
    roster.push({ id: agentId, description: e.description, type: e.subagentType, status: 'running' })

    return { model: 'haiku', agentId }
  })
  on('session.attach', (_$, e) => ({ clientId: e.clientId }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.log', (_$, e) => {
    logs.push(e.text)

    return { value: undefined }
  })
  on('audio.play', (_$, e) => {
    played.push(String(e.clip.asset))

    return { value: undefined }
  })
  // The judge's model: only a request about the settings page leaves the focus.
  on('model.complete', (_$, e) => {
    judged.push(e.prompt)

    return {
      value: {
        isAnswered: true as const,
        text: e.prompt.includes('settings page') ? 'DIFFERENT' : 'SAME',
        usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
    }
  })
  // What the engine draws where the mod passes: nothing. The spinner's word is kept as it arrived.
  on('ui.render', ($, e) => {
    if (e.component === 'Spinner') {
      spun.push(e.props.word)
    }

    return $.ui.resolve(e).Box({})
  })
  on('classic.PermissionRequest', () => ({}))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: 'ok' }))

  return { clock, played, toasts, judged, logs, spun, opened, surfaces, roster }
}

const begin = ($: Engine) => $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })

test('the band stays out of the way until there is something to anchor', async ($, on) => {
  world(on)
  await begin($)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text' })).toBeUndefined()
  await ui.unmount()
})

test('a turn is narrated on every surface that has a band, and ends as your move', async ($, on) => {
  const { clock, played } = world(on)
  await begin($)
  await $.prompt.submit({ text: 'fix the flaky login test', wait: false, origin: { kind: 'composer' } })
  await $.turn.start({ text: 'fix the flaky login test', turnId: 't1' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ text: /You asked: fix the flaky login test/ })).toBeDefined()
    // The desktop band says the step; the terminal's leaves it to the spinner line.
    expect(await ui.find({ text: surface === 'terminal' ? /● Working/ : /● Thinking/ })).toBeDefined()
    await ui.unmount()
  }

  const call = $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/src/auth/login.ts' })
  await clock.advance(3000)
  await call
  await clock.advance(28_000)

  await $.turn.complete({ answer: 'done', durationMs: 31_000, isAborted: false, turnId: 't1', reason: 'answer' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ text: /Your move/ })).toBeDefined()
  await ui.unmount()

  // Work long enough to have wandered off from gets the chime.
  expect(played).toEqual(['fx/chime.wav'])
})

test('the pane draws the creature the surface can draw, with a way to set the one thing', async ($, on) => {
  world(on)
  await begin($)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const creature = await ui.find({ type: surface === 'terminal' ? 'Text' : 'Svg' })
    expect(creature).toBeDefined()
    expect(await ui.find({ key: 'sound' })).toBeDefined()
    expect(await ui.find({ type: 'Input' }) !== undefined).toBe(surface !== 'mobile')
    await ui.unmount()
  }
})

test('setting, working on and finishing the one thing', async ($, on) => {
  const { clock, played, logs } = world(on)
  await begin($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.input({ key: 'one-thing', text: 'Ship the login fix' })
  expect(await ui.find({ text: 'Ship the login fix' })).toBeDefined()
  expect(await ui.find({ type: 'Input' })).toBeUndefined()

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ text: /▸ Ship the login fix/ })).toBeDefined()

  await ui.press({ key: 'done' })
  expect(await ui.find({ type: 'Input' })).toBeDefined()
  expect(played).toEqual(['fx/win.wav'])
  expect(logs.some(line => line.startsWith('★ Done: Ship the login fix'))).toBe(true)
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toMatch(/Done\. Nice\./)

  await clock.advance(5000)
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toMatch(/Your move/)
  await band.unmount()
  await ui.unmount()
})

test('a parked thought is kept, shown, and can become the focus', async ($, on) => {
  const { toasts } = world(on)
  await begin($)

  const parked = await $.command.run({
    command: 'park',
    args: 'rename the auth module',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })
  // The thought stays out of the row the model reads.
  expect(parked.text).toBe('Parked (1).')
  expect(toasts.some(toast => toast.includes('rename the auth module'))).toBe(true)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'parked-0' })
  expect(await ui.find({ text: 'rename the auth module' })).toBeDefined()
  expect(await ui.find({ key: 'parked-0' })).toBeUndefined()
  await ui.unmount()
})

test('a question for him turns the creature and chimes if it stands', async ($, on) => {
  const { clock, played } = world(on)
  await begin($)
  await $.turn.start({ text: 'go', turnId: 't1' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const asked = $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } })
  await asked
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toMatch(/waiting on you/)

  await clock.advance(11_000)
  expect(played).toEqual(['fx/chime.wav'])

  // Nothing says when he answered: past the decay it stops insisting.
  await clock.advance(30_000)
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toMatch(/Claude is/)
  await ui.unmount()
})

const typed = ($: Engine, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
const answered = ($: Engine, turnId: string) =>
  $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId, reason: 'answer' })

test('a prompt that leaves the focus is flagged, and does not feed the flame', async ($, on) => {
  const { clock, logs, judged } = world(on)
  await begin($)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.input({ key: 'one-thing', text: 'Ship the login fix' })

  // On the focus: judged, not flagged, and the turn counts.
  await typed($, 'add a test for the expired token case')
  await clock.advance(10)
  await $.turn.start({ text: 'add a test', turnId: 't1' })
  await answered($, 't1')
  expect(await pane.find({ text: '1 turn on it' })).toBeDefined()

  // A short reply is never sent to the judge.
  await typed($, 'yes, do it')
  await clock.advance(10)
  expect(judged).toHaveLength(1)

  // Off the focus: flagged in the band, on the creature and in a line of the chat; the turn does not count.
  await typed($, 'also redesign the settings page while you are in there')
  await clock.advance(10)
  await $.turn.start({ text: 'settings', turnId: 't2' })

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ text: /Side quest\?/ })).toBeDefined()
  expect((await pane.find({ type: 'Svg' }))?.props.alt).toMatch(/Side quest\?/)
  expect(logs.some(line => line.includes('Side quest?') && line.includes('Ship the login fix'))).toBe(true)

  await answered($, 't2')
  expect(await pane.find({ text: '1 turn on it' })).toBeDefined()

  // The next prompt on the focus clears it.
  await typed($, 'back to it: why does the refresh token fail?')
  await clock.advance(10)
  expect(await band.find({ text: /Side quest\?/ })).toBeUndefined()

  await band.unmount()
  await pane.unmount()
})

test('with no focus set nothing is judged', async ($, on) => {
  const { clock, judged } = world(on)
  await begin($)
  await typed($, 'also redesign the settings page while you are in there')
  await clock.advance(10)
  expect(judged).toHaveLength(0)
})

test('his move standing five minutes gets one nudge, then quiet', async ($, on) => {
  const { clock, played, logs } = world(on)
  await begin($)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.input({ key: 'one-thing', text: 'Ship the login fix' })

  // A focus set with no turn behind it is nothing to nudge about.
  await clock.advance(6 * 60_000)
  expect(played).toEqual([])

  await $.turn.start({ text: 'go', turnId: 't1' })
  await answered($, 't1')

  await clock.advance(4 * 60_000)
  expect(played).toEqual([])

  await clock.advance(90_000)
  expect(played).toEqual(['fx/chime.wav'])
  expect(logs.some(line => line.startsWith('◆ Still on: Ship the login fix?'))).toBe(true)

  await clock.advance(30 * 60_000)
  expect(played).toEqual(['fx/chime.wav'])
  await pane.unmount()
})

const SPINNER = {
  plugin: 'ember',
  component: 'Spinner',
  props: { word: 'Pontificating', message: null, suffix: '…', mode: 'tool-use' },
} as const

test('on the terminal the creature lives in the chat: no pane unasked, the spinner says the step', async ($, on) => {
  const { clock, spun, opened, surfaces } = world(on)
  surfaces.splice(0, surfaces.length, 'terminal')
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  expect(opened).toEqual([])

  // At rest the band is all there is of it, so it says how to set a focus.
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ text: /\/ember <the one thing> sets a focus/ })).toBeDefined()

  // The engine's own word stands until a turn the mod saw start is running.
  const spinner = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  expect(spun.at(-1)).toBe('Pontificating')

  await $.turn.start({ text: 'go', turnId: 't1' })
  const call = $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/src/auth/login.ts' })
  await clock.settle()
  expect(spun.at(-1)).toBe('Reading login.ts')
  await call

  // Asking for the pane still opens it.
  await $.command.run({
    command: 'ember',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 170 },
  })
  expect(opened).toEqual(['ember'])

  await spinner.unmount()
  await band.unmount()
})

test('a desktop that attaches gets the flame pane without asking', async ($, on) => {
  const { opened, surfaces } = world(on)
  surfaces.splice(0, surfaces.length)
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: false })
  expect(opened).toEqual([])

  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  expect(opened).toEqual(['ember'])
})

const SPAWN = {
  tool_use_id: 'spawn-1',
  prompt: 'Find where the session token is refreshed.',
  description: 'Trace the token refresh',
  subagentType: 'general-purpose',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'haiku',
  background: true,
  fork: false,
} as const

test('agents still at work are work, not his move; the chime waits for the last of it', async ($, on) => {
  const { clock, played, spun, surfaces, roster } = world(on)
  surfaces.splice(0, surfaces.length, 'terminal')
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'look into the token refresh', turnId: 't1' })
  await $.agent.spawn(SPAWN)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinner = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  expect(await band.find({ text: '● 1 agent working' })).toBeDefined()

  // With the main loop only thinking, the spinner line says what its agent is on.
  expect(spun.at(-1)).toBe('Agent: Starting')

  // The main loop stops while the agent works on: still work, and no chime.
  await clock.advance(30_000)
  await $.turn.complete({ answer: 'launched', durationMs: 30_000, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(await band.find({ text: '● 1 agent working' })).toBeDefined()
  expect(played).toEqual([])

  // The agent ends and nothing takes its report up: now it is his move, once.
  const [agent] = roster
  if (agent !== undefined) {
    agent.status = 'completed'
  }
  await $.turn.complete({ answer: 'found it', durationMs: 5000, isAborted: false, turnId: 'a1', reason: 'answer', agentId: 'agent-1' })
  await clock.advance(3000)
  expect(await band.find({ text: '◆ Your move' })).toBeDefined()
  expect(played).toEqual(['fx/chime.wav'])

  await spinner.unmount()
  await band.unmount()
})
