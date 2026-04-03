import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { EventItem } from '../types'

function useEventsFirestore() {
  const { user } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'events'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as EventItem)))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addEvent = async (event: Omit<EventItem, 'id'>) => {
    if (!user) return
    await addDoc(collection(db, 'events'), { ...event, userId: user.uid, createdAt: serverTimestamp() })
  }

  const updateEvent = async (id: string, updates: Partial<EventItem>) => {
    if (!user) return
    await updateDoc(doc(db, 'events', id), updates as UpdateData<EventItem>)
  }

  const deleteEvent = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, 'events', id))
  }

  return { events, loading, addEvent, updateEvent, deleteEvent }
}

import { useMockEvents } from '../mocks/hooks'
const _MOCK = import.meta.env.VITE_MOCK_MODE === 'true'
export const useEvents = _MOCK ? useMockEvents : useEventsFirestore
