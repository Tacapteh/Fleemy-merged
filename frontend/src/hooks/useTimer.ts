import { useState, useEffect, useCallback } from 'react'

export interface TimerState {
  status: 'idle' | 'running' | 'paused'
  startedAt: number | null   // timestamp when current segment started
  accumulated: number        // ms before current segment
  title: string
  clientId: string
  clientName: string
  date: string               // ISO date when timer was started
}

const KEY = 'fleemy_timer'

const DEFAULT: TimerState = {
  status: 'idle', startedAt: null, accumulated: 0,
  title: '', clientId: '', clientName: '', date: '',
}

function load(): TimerState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
  } catch { return DEFAULT }
}

function save(s: TimerState) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function useTimer() {
  const [state, setState] = useState<TimerState>(load)
  const [tick, setTick] = useState(0)

  // Re-render every second when running
  useEffect(() => {
    if (state.status !== 'running') return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [state.status])

  const elapsed = state.status === 'running' && state.startedAt !== null
    ? state.accumulated + (Date.now() - state.startedAt)
    : state.accumulated

  const update = useCallback((next: TimerState) => {
    save(next)
    setState(next)
  }, [])

  const start = useCallback((title: string, clientId: string, clientName: string) => {
    const now = new Date()
    update({
      status: 'running',
      startedAt: Date.now(),
      accumulated: 0,
      title,
      clientId,
      clientName,
      date: now.toISOString().slice(0, 10),
    })
  }, [update])

  const pause = useCallback(() => {
    if (state.status !== 'running' || state.startedAt === null) return
    update({
      ...state,
      status: 'paused',
      accumulated: state.accumulated + (Date.now() - state.startedAt),
      startedAt: null,
    })
  }, [state, update])

  const resume = useCallback(() => {
    if (state.status !== 'paused') return
    update({ ...state, status: 'running', startedAt: Date.now() })
  }, [state, update])

  const stop = useCallback(() => {
    update(DEFAULT)
  }, [update])

  // Returns { startTime, endTime, date } for creating an event
  const getEventTimes = useCallback(() => {
    const totalMs = state.status === 'running' && state.startedAt !== null
      ? state.accumulated + (Date.now() - state.startedAt)
      : state.accumulated
    const now = new Date()
    const endH = now.getHours()
    const endM = now.getMinutes()
    const endTotalMin = endH * 60 + endM
    const startTotalMin = Math.max(0, endTotalMin - Math.round(totalMs / 60000))
    const fmt = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    return {
      date: state.date || now.toISOString().slice(0, 10),
      startTime: fmt(startTotalMin),
      endTime: fmt(endTotalMin),
    }
  }, [state])

  return { state, elapsed, start, pause, resume, stop, getEventTimes, tick }
}
