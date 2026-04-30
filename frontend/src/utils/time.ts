export const HOUR_H = 64
export const DAY_START = 7
export const DAY_END = 21

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function toPx(min: number): number {
  return ((min - DAY_START * 60) / 60) * HOUR_H
}

export function pxToMin(px: number): number {
  const raw = (px / HOUR_H) * 60 + DAY_START * 60
  return Math.max(DAY_START * 60, Math.min((DAY_END - 1) * 60, Math.round(raw / 60) * 60))
}

export function pxToMin30(px: number): number {
  const raw = (px / HOUR_H) * 60 + DAY_START * 60
  return Math.max(DAY_START * 60, Math.min((DAY_END - 1) * 60, Math.round(raw / 30) * 30))
}

export function toTimeStr(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

export function overlaps(a: { s: number; e: number }, b: { s: number; e: number }): boolean {
  return a.s < b.e && a.e > b.s
}
