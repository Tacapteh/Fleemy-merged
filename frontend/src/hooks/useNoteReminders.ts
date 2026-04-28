import { useEffect, useRef } from 'react'
import type { Note } from '../types'

export function useNoteReminders(notes: Note[], updateNote: (id: string, data: Partial<Note>) => Promise<void>) {
  const firedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const check = () => {
      const now = new Date()
      for (const note of notes) {
        if (!note.reminderAt || note.reminderFired || firedRef.current.has(note.id)) continue
        const reminderDate = new Date(note.reminderAt)
        if (reminderDate <= now) {
          firedRef.current.add(note.id)
          updateNote(note.id, { reminderFired: true })
          if (Notification.permission === 'granted') {
            new Notification(`Rappel : ${note.title}`, {
              body: note.content || 'Note Fleemy',
              icon: '/favicon.ico',
            })
          }
        }
      }
    }

    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [notes, updateNote])
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}
