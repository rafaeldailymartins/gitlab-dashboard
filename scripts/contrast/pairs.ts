export type Mode = 'dark' | 'light'

/**
 * Every colour pair in this interface that has to stay legible, and the floor it
 * answers to.
 *
 * Thresholds, and why each one: 4.5 for body text; 3 for a control's own surface
 * or boundary, which is what WCAG 1.4.11 asks of a component's visual
 * information; 2 for the light end of an ordinal ramp, so the lowest band is a
 * mark and not a smudge; and a stated house floor below that for recessive
 * furniture and for "a little" against "nothing", where the requirement is
 * perceptibility rather than readability.
 *
 * Both schemes carry the same pairs, because a value chosen for one ground says
 * nothing about the other.
 */
export interface Pair {
  /** Alpha applied to the foreground before compositing, as a browser would. */
  readonly alpha?: number
  readonly background: string
  readonly foreground: string
  readonly minimum: number
  readonly mode: Mode
  readonly what: string
}

/** `[foreground, background, minimum, what]`, in every scheme. */
type Row = readonly [string, string, number, string]

const INTERFACE: readonly Row[] = [
  ['foreground', 'background', 4.5, 'body text on the ground'],
  ['card-foreground', 'card', 4.5, 'body text on a card'],
  ['muted-foreground', 'background', 4.5, 'secondary text on the ground'],
  ['muted-foreground', 'card', 4.5, 'secondary text on a card'],
  ['muted-foreground', 'muted', 4.5, 'secondary text on a muted fill'],
  ['primary-foreground', 'primary', 4.5, 'the label on a solid button'],
  ['primary', 'background', 3, 'a solid button against the ground'],
  ['primary', 'card', 3, 'a solid button against a card'],
  ['primary-hover', 'background', 3, 'a solid button hovered, against the ground'],
  ['primary-hover', 'card', 3, 'a solid button hovered, against a card'],
  ['primary-foreground', 'primary-hover', 4.5, 'the label on a hovered solid button'],
  ['accent', 'card', 1.15, 'a hovered quiet control against a card'],
  ['accent-foreground', 'accent', 4.5, 'text on a hovered quiet control'],
  ['destructive', 'card', 4.5, 'error text on a card'],
  ['input', 'card', 3, 'a field boundary on a card'],
  ['input', 'background', 3, 'a field boundary on the ground'],
  ['seal', 'card', 4.5, 'a met target on a card'],
]

/** The focus ring is painted at half opacity, which is what caps it. */
const RINGS: readonly Row[] = [
  ['ring', 'background', 3, 'the focus ring on the ground'],
  ['ring', 'card', 3, 'the focus ring on a card'],
]

const CHARTS: readonly Row[] = [
  ['chart-bar', 'card', 3, 'a bar on a card'],
  ['chart-bar', 'chart-empty', 3, 'a bar inside its track'],
  ['chart-target', 'card', 3, 'the target line on a card'],
  ['chart-target', 'chart-empty', 3, 'the target ring on an empty working day'],
  ['chart-scale-1', 'card', 2, 'the lowest heatmap band on a card'],
  ['chart-scale-1', 'chart-empty', 1.5, 'a little against nothing'],
  ['chart-empty', 'card', 1.15, 'an empty working day against a card'],
  ...[1, 2, 3, 4, 5, 6].flatMap((slot): readonly Row[] => [
    [`chart-series-${String(slot)}`, 'card', 3, `series ${String(slot)} on a card`],
    [`chart-series-${String(slot)}`, 'chart-empty', 3, `series ${String(slot)} inside its track`],
  ]),
]

const RING_ALPHA = 0.5

export const PAIRS: readonly Pair[] = (['light', 'dark'] as const).flatMap((mode) => [
  ...[...INTERFACE, ...CHARTS].map((row) => pairOf(row, mode)),
  ...RINGS.map((row) => ({ ...pairOf(row, mode), alpha: RING_ALPHA })),
])

function pairOf([foreground, background, minimum, what]: Row, mode: Mode): Pair {
  return { background, foreground, minimum, mode, what }
}
