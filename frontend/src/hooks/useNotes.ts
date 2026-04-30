import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Note } from '../types'

function useNotesFirestore() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'notes'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Note)))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('useNotes: snapshot error', err)
        setError('Impossible de charger les notes.')
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user])

  const addNote = async (note: Omit<Note, 'id'>) => {
    if (!user) return
    try {
      await addDoc(collection(db, 'notes'), { ...note, userId: user.uid, createdAt: serverTimestamp() })
    } catch (err) {
      console.error(err)
      throw new Error('Impossible d\'ajouter la note.')
    }
  }

  const updateNote = async (id: string, updates: Partial<Note>) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'notes', id), updates as UpdateData<Note>)
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de modifier la note.')
    }
  }

  const deleteNote = async (id: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'notes', id))
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de supprimer la note.')
    }
  }

  return { notes, loading, error, addNote, updateNote, deleteNote }
}

import { useMockNotes } from '../mocks/hooks'
const _MOCK = import.meta.env.VITE_MOCK_MODE === 'true'
export const useNotes = _MOCK ? useMockNotes : useNotesFirestore
