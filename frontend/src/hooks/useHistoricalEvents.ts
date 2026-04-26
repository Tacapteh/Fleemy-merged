import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  writeBatch, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { EventItem } from '../types'

export interface HistoricalEventRecord extends EventItem {
  importedAt?: string
}

function useHistoricalEventsFirestore() {
  const { user } = useAuth()
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEventRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    // Query the shared events collection, filtering only imported events
    const q = query(
      collection(db, 'events'),
      where('userId', '==', user.uid),
      where('imported', '==', true),
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistoricalEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HistoricalEventRecord)))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addHistoricalEvents = async (events: Omit<EventItem, 'id'>[]) => {
    if (!user) return
    const importedAt = new Date().toISOString()
    // Firestore batch limit = 500 ops; chunk to stay safe
    const CHUNK = 400
    for (let i = 0; i < events.length; i += CHUNK) {
      const batch = writeBatch(db)
      for (const ev of events.slice(i, i + CHUNK)) {
        const ref = doc(collection(db, 'events'))
        batch.set(ref, {
          ...ev,
          userId: user.uid,
          importedAt,
          imported: true,
          createdAt: serverTimestamp(),
        })
      }
      await batch.commit()
    }
  }

  const deleteHistoricalEvent = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, 'events', id))
  }

  const clearHistoricalEvents = async () => {
    if (!user) return
    const CHUNK = 400
    for (let i = 0; i < historicalEvents.length; i += CHUNK) {
      const batch = writeBatch(db)
      for (const ev of historicalEvents.slice(i, i + CHUNK)) {
        batch.delete(doc(db, 'events', ev.id))
      }
      await batch.commit()
    }
  }

  return { historicalEvents, loading, addHistoricalEvents, deleteHistoricalEvent, clearHistoricalEvents }
}

// Mock fallback for VITE_MOCK_MODE
function useHistoricalEventsMock() {
  return {
    historicalEvents: [] as HistoricalEventRecord[],
    loading: false,
    addHistoricalEvents: async () => {},
    deleteHistoricalEvent: async (_id: string) => {},
    clearHistoricalEvents: async () => {},
  }
}

const _MOCK = import.meta.env.VITE_MOCK_MODE === 'true'
export const useHistoricalEvents = _MOCK ? useHistoricalEventsMock : useHistoricalEventsFirestore
