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

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'notes'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Note)))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addNote = async (note: Omit<Note, 'id'>) => {
    if (!user) return
    await addDoc(collection(db, 'notes'), { ...note, userId: user.uid, createdAt: serverTimestamp() })
  }

  const updateNote = async (id: string, updates: Partial<Note>) => {
    if (!user) return
    await updateDoc(doc(db, 'notes', id), updates as UpdateData<Note>)
  }

  const deleteNote = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, 'notes', id))
  }

  return { notes, loading, addNote, updateNote, deleteNote }
}

import { useMockNotes } from '../mocks/hooks'
const _MOCK = import.meta.env.VITE_MOCK_MODE === 'true'
export const useNotes = _MOCK ? useMockNotes : useNotesFirestore
