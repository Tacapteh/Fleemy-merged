import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp,
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
    const q = query(collection(db, 'historicalEvents'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistoricalEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HistoricalEventRecord)))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addHistoricalEvents = async (events: Omit<EventItem, 'id'>[]) => {
    if (!user) return
    const importedAt = new Date().toISOString()
    for (const ev of events) {
      await addDoc(collection(db, 'historicalEvents'), {
        ...ev,
        userId: user.uid,
        importedAt,
        createdAt: serverTimestamp(),
      })
    }
  }

  const deleteHistoricalEvent = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, 'historicalEvents', id))
  }

  const clearHistoricalEvents = async () => {
    if (!user) return
    for (const ev of historicalEvents) {
      await deleteDoc(doc(db, 'historicalEvents', ev.id))
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
