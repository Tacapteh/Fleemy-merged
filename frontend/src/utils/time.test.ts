import { describe, it, expect } from 'vitest'
import { toMin, toPx, pxToMin, pxToMin30, toTimeStr, overlaps, HOUR_H, DAY_START, DAY_END } from './time'

describe('toMin', () => {
  it('converts HH:MM to minutes', () => {
    expect(toMin('00:00')).toBe(0)
    expect(toMin('09:00')).toBe(540)
    expect(toMin('09:30')).toBe(570)
    expect(toMin('17:45')).toBe(1065)
    expect(toMin('23:59')).toBe(1439)
  })
})

describe('toTimeStr', () => {
  it('converts minutes to HH:MM', () => {
    expect(toTimeStr(0)).toBe('00:00')
    expect(toTimeStr(540)).toBe('09:00')
    expect(toTimeStr(570)).toBe('09:30')
    expect(toTimeStr(1065)).toBe('17:45')
  })

  it('is the inverse of toMin', () => {
    const times = ['07:00', '09:30', '12:15', '17:45', '20:00']
    times.forEach(t => expect(toTimeStr(toMin(t))).toBe(t))
  })
})

describe('toPx', () => {
  it('returns 0 for DAY_START hour', () => {
    expect(toPx(DAY_START * 60)).toBe(0)
  })

  it('returns HOUR_H for one hour past DAY_START', () => {
    expect(toPx(DAY_START * 60 + 60)).toBe(HOUR_H)
  })

  it('returns correct px for arbitrary times', () => {
    expect(toPx(DAY_START * 60 + 30)).toBe(HOUR_H / 2)
  })
})

describe('pxToMin', () => {
  it('rounds to nearest hour', () => {
    expect(pxToMin(0)).toBe(DAY_START * 60)
    expect(pxToMin(HOUR_H)).toBe(DAY_START * 60 + 60)
    expect(pxToMin(HOUR_H * 2)).toBe(DAY_START * 60 + 120)
  })

  it('clamps to DAY_START', () => {
    expect(pxToMin(-100)).toBe(DAY_START * 60)
  })

  it('clamps to (DAY_END - 1)', () => {
    expect(pxToMin(999999)).toBe((DAY_END - 1) * 60)
  })

  it('rounds up at >30 min into the hour', () => {
    const px = HOUR_H * 0.6 // 36 min into first hour → rounds to 60
    expect(pxToMin(px)).toBe(DAY_START * 60 + 60)
  })
})

describe('pxToMin30', () => {
  it('rounds to nearest 30 minutes', () => {
    expect(pxToMin30(HOUR_H * 0.4)).toBe(DAY_START * 60 + 30) // 24 min → nearest 30 = 30
    expect(pxToMin30(HOUR_H * 0.9)).toBe(DAY_START * 60 + 60) // 54 min → nearest 30 = 60
  })

  it('clamps to DAY_START', () => {
    expect(pxToMin30(-100)).toBe(DAY_START * 60)
  })
})

describe('overlaps', () => {
  it('detects overlapping intervals', () => {
    expect(overlaps({ s: 60, e: 120 }, { s: 90, e: 150 })).toBe(true)
    expect(overlaps({ s: 60, e: 120 }, { s: 30, e: 90 })).toBe(true)
    expect(overlaps({ s: 60, e: 120 }, { s: 60, e: 120 })).toBe(true)
  })

  it('does not report adjacent intervals as overlapping', () => {
    expect(overlaps({ s: 60, e: 120 }, { s: 120, e: 180 })).toBe(false)
    expect(overlaps({ s: 60, e: 120 }, { s: 0, e: 60 })).toBe(false)
  })

  it('does not report non-overlapping intervals', () => {
    expect(overlaps({ s: 60, e: 90 }, { s: 120, e: 180 })).toBe(false)
  })
})
