import type { EmberMood } from '../types'

/** What the creature is drawn from: its mood, how hot the streak runs (0-3), and whether the last prompt left the focus. */
export type Look = EmberMood & { heat: number; isDrifting?: boolean }

type Palette = readonly [top: string, mid: string, bottom: string]

const PALETTES: readonly [Palette, Palette, Palette, Palette] = [
  ['#FFC56B', '#F28A3C', '#D9532F'],
  ['#FFD77A', '#FF9238', '#EE4E2B'],
  ['#FFE89A', '#FF9E2E', '#F5482A'],
  ['#FFF6C8', '#FFB02E', '#FF4D2E'],
]
const SCALES = [0.86, 0.94, 1, 1.06] as const
const INK = '#40200F'
const ALERT = '#FF5D73'
const DOUBT = '#E8B931'
const EASE = '0.4 0 0.6 1'

// The flame and its core, each as three poses the tip sways between. Cubic
// segments only, the same in every pose, so the paths interpolate.
const FLAME = [
  'M100 28 C118 58 144 84 144 116 C144 140.3 124.3 160 100 160 C75.7 160 56 140.3 56 116 C56 84 82 58 100 28 Z',
  'M109 31 C123 60 144 86 144 116 C144 140.3 124.3 160 100 160 C75.7 160 56 140.3 56 116 C56 86 85 60 109 31 Z',
  'M91 31 C115 60 144 86 144 116 C144 140.3 124.3 160 100 160 C75.7 160 56 140.3 56 116 C56 86 77 60 91 31 Z',
] as const
const CORE = [
  'M100 68 C110 84 124 100 124 121 C124 134.3 113.3 145 100 145 C86.7 145 76 134.3 76 121 C76 100 90 84 100 68 Z',
  'M104 70 C112 85 124 101 124 121 C124 134.3 113.3 145 100 145 C86.7 145 76 134.3 76 121 C76 101 92 85 104 70 Z',
  'M96 70 C108 85 124 101 124 121 C124 134.3 113.3 145 100 145 C86.7 145 76 134.3 76 121 C76 101 88 85 96 70 Z',
] as const

/** Seconds per loop of the flicker, the breath and the halo, by phase. */
const TEMPO = {
  rest: { flicker: 5, breath: 5, halo: 5 },
  work: { flicker: 1.8, breath: 2.2, halo: 2.4 },
  blocked: { flicker: 0.8, breath: 0.9, halo: 0.7 },
  done: { flicker: 3.2, breath: 3.6, halo: 4 },
  cheer: { flicker: 0.6, breath: 0.55, halo: 0.5 },
} as const

const loop = (attribute: string, values: readonly string[], seconds: number, extra = '') =>
  `<animate attributeName="${attribute}" values="${values.join(';')}" dur="${seconds}s" repeatCount="indefinite" ${extra}/>`

const move = (type: 'translate' | 'scale' | 'rotate', values: readonly string[], seconds: number, extra = '') =>
  `<animateTransform attributeName="transform" type="${type}" values="${values.join(';')}" dur="${seconds}s" repeatCount="indefinite" ${extra}/>`

const eased = (steps: number) =>
  `calcMode="spline" keySplines="${Array.from({ length: steps }, () => EASE).join(';')}"`

const sway = (poses: readonly [string, string, string], seconds: number) =>
  loop('d', [poses[0], poses[1], poses[0], poses[2], poses[0]], seconds, eased(4))

const eye = (cx: number, { phase }: Look) => {
  if (phase === 'rest') {
    return `<path d="M${cx - 6} 117 Q${cx} 122 ${cx + 6} 117" stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none"/>`
  }

  if (phase === 'cheer') {
    return `<path d="M${cx - 6} 120 Q${cx} 110 ${cx + 6} 120" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`
  }

  const isWide = phase === 'blocked'
  const ry = isWide ? 8.5 : 7
  const blink = isWide
    ? ''
    : loop('ry', ['7', '7', '0.6', '7', '7'], 4.2, 'keyTimes="0;0.46;0.5;0.54;1"')

  return (
    `<ellipse cx="${cx}" cy="116" rx="${isWide ? 6 : 5}" ry="${ry}" fill="${INK}">${blink}</ellipse>` +
    `<circle cx="${cx - 1.6}" cy="113" r="1.7" fill="#fff" opacity="0.9"/>`
  )
}

const gaze = ({ phase, gesture }: Look) => {
  if (phase !== 'work') {
    return ''
  }

  if (gesture === 'think') {
    return move('translate', ['0 0', '3 -4', '3 -4', '0 0', '0 0'], 4, `keyTimes="0;0.2;0.6;0.8;1" ${eased(4)}`)
  }

  if (gesture === 'read') {
    return move('translate', ['-4 1', '4 1', '-4 1'], 1.6, eased(2))
  }

  if (gesture === 'write') {
    return move('translate', ['0 3', '-2 3', '2 3', '0 3'], 1.2, eased(3))
  }

  return ''
}

const mouth = ({ phase }: Look) => {
  if (phase === 'blocked') {
    return `<circle cx="100" cy="134" r="3.6" fill="${INK}"/>`
  }

  if (phase === 'cheer') {
    return `<path d="M90 129 Q100 145 110 129 Z" fill="${INK}"/>`
  }

  const curve =
    phase === 'done' ? 'M92 130 Q100 138 108 130' : phase === 'rest' ? 'M96 132 Q100 134 104 132' : 'M95 131 Q100 135 105 131'

  return `<path d="${curve}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
}

const bubble = (glyph: string, fill: string, seconds: number) =>
  '<g>' +
  `<circle cx="160" cy="44" r="15" fill="${fill}"/>` +
  `<text x="160" y="51.5" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="21" font-weight="800" fill="#fff">${glyph}</text>` +
  move('translate', ['0 0', '0 -5', '0 0'], seconds, eased(2)) +
  '</g>'

/** Whether the creature is asking if this is still the one thing: only while awake and not otherwise occupied. */
const isDoubting = ({ phase, isDrifting }: Look) => isDrifting === true && (phase === 'work' || phase === 'done')

/** What floats around the creature: the one thing that tells the moods apart at a glance. */
const aura = (look: Look, [top, mid]: Palette) => {
  const { phase, gesture } = look

  if (phase === 'rest') {
    const z = (x: number, y: number, size: number, begin: number) =>
      `<text x="${x}" y="${y}" font-family="system-ui,-apple-system,sans-serif" font-size="${size}" font-weight="700" fill="${mid}" opacity="0">z` +
      loop('opacity', ['0', '0.9', '0'], 3.2, `begin="${begin}s"`) +
      move('translate', ['0 6', '5 -8'], 3.2, `begin="${begin}s"`) +
      '</text>'

    return z(138, 62, 15, 0) + z(152, 44, 20, 1.1)
  }

  if (phase === 'blocked') {
    return bubble('!', ALERT, 0.6)
  }

  if (isDoubting(look)) {
    return bubble('?', DOUBT, 1.8)
  }

  if (phase === 'done') {
    return (
      '<g transform="translate(158 46)"><g>' +
      `<path d="M0 -11 C1.5 -3 3 -1.5 11 0 C3 1.5 1.5 3 0 11 C-1.5 3 -3 1.5 -11 0 C-3 -1.5 -1.5 -3 0 -11 Z" fill="${top}"/>` +
      move('scale', ['0.5', '1', '0.5'], 2.4, eased(2)) +
      loop('opacity', ['0.35', '1', '0.35'], 2.4) +
      '</g></g>'
    )
  }

  if (phase === 'cheer') {
    return Array.from({ length: 10 }, (_, index) => {
      const angle = (index / 10) * Math.PI * 2
      const [x, y] = [100 + Math.cos(angle) * 88, 100 + Math.sin(angle) * 80]
      const begin = `begin="${(index % 2) * 0.18}s"`

      return (
        `<circle cx="100" cy="100" r="4.5" fill="${index % 3 === 0 ? '#fff3b0' : index % 3 === 1 ? top : mid}" opacity="0">` +
        loop('cx', ['100', x.toFixed(1)], 0.9, begin) +
        loop('cy', ['100', y.toFixed(1)], 0.9, begin) +
        loop('opacity', ['1', '0'], 0.9, begin) +
        loop('r', ['4.5', '1.5'], 0.9, begin) +
        '</circle>'
      )
    }).join('')
  }

  if (gesture === 'think') {
    const dot = (x: number, y: number, r: number, begin: number) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${mid}" opacity="0.15">${loop('opacity', ['0.15', '1', '0.15'], 1.5, `begin="${begin}s"`)}</circle>`

    return dot(136, 60, 3, 0) + dot(148, 46, 4.2, 0.25) + dot(163, 31, 5.5, 0.5)
  }

  if (gesture === 'write') {
    const spark = (x: number, begin: number) =>
      `<circle cx="${x}" cy="40" r="3" fill="${top}" opacity="0">` +
      loop('cy', ['40', '4'], 1.1, `begin="${begin}s"`) +
      loop('opacity', ['1', '0'], 1.1, `begin="${begin}s"`) +
      '</circle>'

    return spark(80, 0) + spark(104, 0.3) + spark(124, 0.6) + spark(92, 0.85)
  }

  if (gesture === 'run') {
    return (
      '<g transform="translate(100 112)">' +
      `<circle r="66" fill="none" stroke="${mid}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="18 34" opacity="0.75">` +
      move('rotate', ['0', '360'], 2.6) +
      '</circle></g>'
    )
  }

  return ''
}

const clampHeat = (heat: number) => Math.max(0, Math.min(3, Math.round(heat)))

/**
 * The creature as one SVG document, animated with SMIL alone (no script, no
 * stylesheet): the same look is the same string, so a redraw that changes
 * nothing leaves the running animation alone.
 */
export const portrait = (look: Look, width: number): string => {
  const heat = clampHeat(look.heat)
  const palette = PALETTES[heat] ?? PALETTES[0]
  const scale = SCALES[heat] ?? 1
  const [top, mid, bottom] = palette
  const tempo = TEMPO[look.phase]
  const isBouncing = look.phase === 'blocked' || look.phase === 'cheer'
  // The run ring circles the body, so it is the one aura drawn behind it.
  const isRinged = look.phase === 'work' && look.gesture === 'run' && !isDoubting(look)
  const glow = look.phase === 'blocked' ? ALERT : mid
  const halo =
    look.phase === 'rest'
      ? ['0.2', '0.32', '0.2']
      : look.phase === 'work'
        ? ['0.4', '0.7', '0.4']
        : look.phase === 'done'
          ? ['0.55', '0.75', '0.55']
          : ['0.45', '1', '0.45']
  const bounce =
    look.phase === 'blocked'
      ? move('translate', ['0 0', '0 -16', '0 0', '0 -5', '0 0'], 0.9, `keyTimes="0;0.3;0.6;0.8;1" ${eased(4)}`)
      : look.phase === 'cheer'
        ? move('translate', ['0 0', '0 -22', '0 0'], 0.55, eased(2))
        : ''
  const breath =
    look.phase === 'blocked' ? ['1 1', '0.96 1.05', '1 1'] : look.phase === 'rest' ? ['1 1', '1.02 0.975', '1 1'] : ['1 1', '1.035 0.968', '1 1']

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="${width}" height="${Math.round(width * 0.9)}" style="background:transparent;color-scheme:light dark">` +
    '<defs>' +
    `<linearGradient id="flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="0.5" stop-color="${mid}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>` +
    `<radialGradient id="halo"><stop offset="0" stop-color="${glow}" stop-opacity="0.6"/><stop offset="0.6" stop-color="${glow}" stop-opacity="0.16"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>` +
    '</defs>' +
    `<circle cx="100" cy="108" r="86" fill="url(#halo)">${loop('opacity', halo, tempo.halo, eased(2))}</circle>` +
    `<ellipse cx="100" cy="168" rx="38" ry="5" fill="#000" opacity="0.14">${isBouncing ? loop('rx', ['38', '26', '38'], look.phase === 'cheer' ? 0.55 : 0.9) : ''}</ellipse>` +
    (isRinged ? aura(look, palette) : '') +
    `<g>${bounce}` +
    `<g transform="translate(100 160)"><g transform="scale(${scale})"><g>${move('scale', breath, tempo.breath, eased(2))}<g transform="translate(-100 -160)" opacity="${look.phase === 'rest' ? 0.82 : 1}">` +
    `<path d="${FLAME[0]}" fill="url(#flame)">${sway(FLAME, tempo.flicker)}</path>` +
    `<path d="${CORE[0]}" fill="#FFF4C2" opacity="${0.5 + heat * 0.12}">${sway(CORE, tempo.flicker * 0.8)}</path>` +
    '<circle cx="77" cy="128" r="6.5" fill="#FF6B6B" opacity="0.3"/><circle cx="123" cy="128" r="6.5" fill="#FF6B6B" opacity="0.3"/>' +
    `<g>${gaze(look)}${eye(86, look)}${eye(114, look)}</g>` +
    mouth(look) +
    '</g></g></g></g></g>' +
    (isRinged ? '' : aura(look, palette)) +
    '</svg>'
  )
}

// The creature where no surface draws an SVG: a few cells of text, in frames a
// second apart. Every frame is padded to one width, so nothing beside it moves.
const FACE_WIDTH = 7
const FACES = {
  rest: { color: '#D9532F', frames: ['(˘ᵕ˘) z'] },
  think: { color: '#F28A3C', frames: ['(•ᴗ•)', '(•ᴗ•)∙', '(•ᴗ•)∙∙'] },
  read: { color: '#F28A3C', frames: ['(◐ᴗ◐) ▤', '(◑ᴗ◑) ▤'] },
  write: { color: '#F28A3C', frames: ['(•ᴗ•)✎', '(•ᴗ•) ✎'] },
  run: { color: '#F28A3C', frames: ['(•ᴗ•)⟳', '(•ᴗ•)⟲'] },
  blocked: { color: ALERT, frames: ['(°o°)!', '(°O°)!!'] },
  doubt: { color: DOUBT, frames: ['(•ᴗ•)?'] },
  done: { color: '#3FB68B', frames: ['(•ᴗ•)/'] },
  cheer: { color: '#E8B931', frames: ['\\(^▽^)/'] },
} as const

/** The creature as text and its color; `beat` picks the frame, so a caller that counts seconds animates it. */
export const face = (look: Look, beat = 0): { text: string; color: string } => {
  const { phase, gesture } = look
  const mood = isDoubting(look) ? 'doubt' : phase === 'work' ? gesture : phase
  const { color, frames } = FACES[mood]
  const frame = frames[Math.abs(Math.floor(beat)) % frames.length] ?? frames[0]

  return { text: frame.padEnd(FACE_WIDTH), color }
}

/** One line under the creature, and what a reader that cannot see it is told. */
export const caption = (look: Look): string => {
  const { phase, gesture } = look

  if (isDoubting(look)) {
    return 'Side quest? Your focus is waiting.'
  }

  if (phase === 'rest') {
    return 'Resting. Ready when you are.'
  }

  if (phase === 'blocked') {
    return 'Claude is waiting on you.'
  }

  if (phase === 'done') {
    return 'Your move.'
  }

  if (phase === 'cheer') {
    return 'Done. Nice.'
  }

  const work = {
    think: 'Claude is thinking.',
    read: 'Claude is reading.',
    write: 'Claude is writing.',
    run: 'Claude is running things.',
  } as const

  return work[gesture]
}
