/**
 * WCAG relative luminance and contrast, over sRGB.
 *
 * Alpha is composited source-over on gamma-encoded channels, which is what a
 * browser paints — the arithmetic a `/50` utility actually performs, rather than
 * an approximation of it.
 */
const CHANNEL_MAX = 255
const GAMMA = 2.4
const LOW_LIMIT = 0.03928
const LOW_SLOPE = 12.92
const OFFSET = 0.055
const SCALE = 1.055
const WEIGHTS = [0.2126, 0.7152, 0.0722] as const

/** The contrast ratio between two hex colours, the foreground possibly translucent. */
export function contrastOf(foreground: string, background: string, alpha: number): number {
  const front = luminance(composite(rgb(foreground), rgb(background), alpha))
  const back = luminance(rgb(background))

  return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05)
}

function composite(
  front: readonly number[],
  back: readonly number[],
  alpha: number,
): readonly number[] {
  return front.map((value, index) => value * alpha + (back[index] ?? 0) * (1 - alpha))
}

function luminance(channels: readonly number[]): number {
  let total = 0

  for (const [index, value] of channels.entries()) {
    const ratio = value / CHANNEL_MAX

    total +=
      (ratio <= LOW_LIMIT ? ratio / LOW_SLOPE : Math.pow((ratio + OFFSET) / SCALE, GAMMA)) *
      (WEIGHTS[index] ?? 0)
  }

  return total
}

/** Six-digit hex only: that is the one form these token files use. */
function rgb(hex: string): readonly number[] {
  const digits = hex.replace('#', '')

  return [0, 2, 4].map((start) => Number.parseInt(digits.slice(start, start + 2), 16))
}
