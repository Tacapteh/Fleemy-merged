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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'events'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setEvents(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as EventItem)))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('useEvents: snapshot error', err)
        setError('Impossible de charger les événements.')
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user])

  const addEvent = async (event: Omit<EventItem, 'id'>) => {
    if (!user) return
    try {
      await addDoc(collection(db, 'events'), { ...event, userId: user.uid, createdAt: serverTimestamp() })
    } catch (err) {
      console.error(err)
      throw new Error('Impossible d\'ajouter l\'événement.')
    }
  }

  const updateEvent = async (id: string, updates: Partial<EventItem>) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'events', id), updates as UpdateData<EventItem>)
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de modifier l\'événement.')
    }
  }

  const deleteEvent = async (id: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'events', id))
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de supprimer l\'événement.')
    }
  }

  return { events, loading, error, addEvent, updateEvent, deleteEvent }
}

import { useMockEvents } from '../mocks/hooks'
import { IS_MOCK } from '../lib/mockMode'
export const useEvents = IS_MOCK ? useMockEvents : useEventsFirestore
