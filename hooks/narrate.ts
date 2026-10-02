import type { EmberGesture } from '../types'

/** One tool call in plain words, and how the creature watches it. */
export type Narration = { gesture: EmberGesture; label: string }

const LIMIT = 56

export const clip = (text: string, limit = LIMIT): string => {
  const line = text.replace(/\s+/g, ' ').trim()

  return line.length > limit ? `${line.slice(0, limit - 1).trimEnd()}…` : line
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const fileName = (value: unknown): string => text(value).split(/[\\/]/).pop() || 'a file'

const host = (value: unknown): string => {
  try {
    return new URL(text(value)).hostname.replace(/^www\./, '')
  } catch {
    return 'a page'
  }
}

/** `mcp__plugin_sentry_sentry__search_issues` reads as `sentry: search issues`. */
const mcp = (tool: string): string => {
  const [, server = '', name = ''] = tool.split('__')
  const short = server.replace(/^plugin_/, '').split('_').pop() ?? server

  return `${short}: ${name.replace(/[_-]+/g, ' ')}`
}

export const narrate = (tool: string, input: Readonly<Record<string, unknown>>): Narration => {
  if (tool === 'Read') {
    return { gesture: 'read', label: `Reading ${fileName(input.file_path)}` }
  }

  if (tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    return { gesture: 'write', label: `Editing ${fileName(input.file_path ?? input.notebook_path)}` }
  }

  if (tool === 'Write') {
    return { gesture: 'write', label: `Writing ${fileName(input.file_path)}` }
  }

  if (tool === 'Bash') {
    return { gesture: 'run', label: clip(text(input.description) || `Running ${text(input.command)}`) }
  }

  if (tool === 'Grep' || tool === 'Glob') {
    return { gesture: 'read', label: clip(`Searching for ${text(input.pattern)}`) }
  }

  if (tool === 'WebFetch') {
    return { gesture: 'read', label: `Reading ${host(input.url)}` }
  }

  if (tool === 'WebSearch') {
    return { gesture: 'read', label: clip(`Searching the web: ${text(input.query)}`) }
  }

  if (tool === 'Agent' || tool === 'Task') {
    return { gesture: 'run', label: clip(`Delegating: ${text(input.description) || 'a subtask'}`) }
  }

  if (tool === 'Skill') {
    return { gesture: 'read', label: clip(`Loading skill ${text(input.skill)}`) }
  }

  if (tool === 'AskUserQuestion') {
    return { gesture: 'think', label: 'Asking you a question' }
  }

  if (tool.startsWith('Todo') || tool.startsWith('Task') || tool.endsWith('PlanMode')) {
    return { gesture: 'think', label: 'Planning' }
  }

  if (tool.startsWith('mcp__')) {
    return { gesture: 'run', label: clip(mcp(tool)) }
  }

  return { gesture: 'run', label: `Using ${tool}` }
}

/** `0:41`, `12:05`: a running turn's clock. */
export const stopwatch = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000))

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** `under a minute`, `12m`, `1h 5m`: how long something has stood. */
export const span = (ms: number): string => {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)

  if (minutes < 1) {
    return 'under a minute'
  }

  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
