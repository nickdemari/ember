import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

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

const SPINNER = {
  plugin: 'ember',
  component: 'Spinner',
  props: { word: 'Pontificating', message: null, suffix: '…', mode: 'tool-use' },
} as const

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

/** The engine beneath the mod: a clock and a store in memory, and every other call it makes answered. */
const world = (on: On) => {
  const clock = mock.clock(on, { now: START })
  const played: string[] = []
  const logs: string[] = []
  const spun: string[] = []
  const opened: string[] = []
  // The engine's own record of the session's subagents, as `$.agent.list()` answers it.
  const roster: { id: string; description: string; type: string; status: string }[] = []

  mock.store(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', (_$, e) => {
    opened.push(e.id)

    return { value: { isPlaced: true as const } }
  })
  on('ui.log', (_$, e) => {
    logs.push(e.text)

    return { value: undefined }
  })
  on('audio.play', (_$, e) => {
    played.push(String(e.clip.asset))

    return { value: undefined }
  })
  on('agent.list', () => ({ value: roster }))
  on('agent.spawn', (_$, e) => {
    const agentId = `agent-${roster.length + 1}`
    roster.push({ id: agentId, description: e.description, type: e.subagentType, status: 'running' })

    return { model: 'haiku', agentId }
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

  return { clock, played, logs, spun, opened, roster }
}

const begin = ($: Engine) => $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
const typed = ($: Engine, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
const answered = ($: Engine, turnId: string) =>
  $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId, reason: 'answer' })

test('nothing to set up: before the first prompt the band is one dim word and no pane opens', async ($, on) => {
  const { opened } = world(on)
  await begin($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ text: '○ ember' })).toBeDefined()
    await ui.unmount()
  }

  expect(opened).toEqual([])
})

test('it follows a turn: the spinner says the step, the band says whose move, then what he asked', async ($, on) => {
  const { clock, played, spun } = world(on)
  await begin($)
  await typed($, 'fix the flaky login test')
  await $.turn.start({ text: 'fix the flaky login test', turnId: 't1' })

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinner = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  expect(await band.find({ text: '● Working' })).toBeDefined()
  // While Claude works the band does not repeat the prompt he typed a line above.
  expect(await band.find({ text: /You asked/ })).toBeUndefined()

  const call = $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/src/auth/login.ts' })
  await clock.settle()
  expect(spun.at(-1)).toBe('Reading login.ts')
  await call
  await clock.advance(31_000)

  await answered($, 't1')
  expect(await band.find({ text: '◆ Your move' })).toBeDefined()
  expect(await band.find({ text: 'You asked: fix the flaky login test' })).toBeDefined()
  // Work long enough to have wandered off from gets the chime.
  expect(played).toEqual(['fx/chime.wav'])

  await spinner.unmount()
  await band.unmount()
})

test('the desktop band says the step itself, since its spinner row is left alone', async ($, on) => {
  world(on)
  await begin($)
  await $.turn.start({ text: 'go', turnId: 't1' })

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ text: '● Thinking' })).toBeDefined()
  await band.unmount()
})

test('/ember answers in the chat; the pane is asked for by name and draws on every surface', async ($, on) => {
  const { opened } = world(on)
  await begin($)

  const run = (args: string) =>
    $.command.run({ command: 'ember', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 170 } })

  expect((await run('')).text).toMatch(/following this session/)
  expect(opened).toEqual([])
  expect((await run('mute')).text).toBe('Ember is muted.')

  await run('pane')
  expect(opened).toEqual(['ember'])

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: surface === 'terminal' ? 'Text' : 'Svg' })).toBeDefined()
    expect((await ui.find({ key: 'sound' }))?.props.label).toBe('Sound is off')
    await ui.unmount()
  }
})

test('a permission prompt turns it to him and chimes if it stands', async ($, on) => {
  const { clock, played } = world(on)
  await begin($)
  await $.turn.start({ text: 'go', turnId: 't1' })

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } })
  expect(await band.find({ text: '▲ Needs your OK: Bash' })).toBeDefined()

  await clock.advance(11_000)
  expect(played).toEqual(['fx/chime.wav'])

  // Nothing says when he answered: past the decay it stops insisting.
  await clock.advance(30_000)
  expect(await band.find({ text: /▲/ })).toBeUndefined()
  await band.unmount()
})

test('his move standing five minutes gets one nudge, then quiet', async ($, on) => {
  const { clock, played, logs } = world(on)
  await begin($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await answered($, 't1')

  await clock.advance(4 * 60_000)
  expect(played).toEqual([])

  await clock.advance(90_000)
  expect(played).toEqual(['fx/chime.wav'])
  expect(logs.some(line => line.startsWith('◆ Claude finished 5m ago.'))).toBe(true)

  await clock.advance(30 * 60_000)
  expect(played).toEqual(['fx/chime.wav'])
})

test('agents still at work are work, not his move; the chime waits for the last of it', async ($, on) => {
  const { clock, played, spun, roster } = world(on)
  await begin($)
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
