import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Document as FleemyDocument } from '../types'

function useDocumentsFirestore() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<FleemyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'documents'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setDocuments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as FleemyDocument)))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('useDocuments: snapshot error', err)
        setError('Impossible de charger les documents.')
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user])

  const addDocument = async (document: Omit<FleemyDocument, 'id'>) => {
    if (!user) return
    try {
      await addDoc(collection(db, 'documents'), { ...document, userId: user.uid, createdAt: serverTimestamp() })
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de créer le document.')
    }
  }

  const updateDocument = async (id: string, updates: Partial<FleemyDocument>) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'documents', id), updates as UpdateData<FleemyDocument>)
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de modifier le document.')
    }
  }

  const deleteDocument = async (id: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'documents', id))
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de supprimer le document.')
    }
  }

  return { documents, loading, error, addDocument, updateDocument, deleteDocument }
}

import { useMockDocuments } from '../mocks/hooks'
const _MOCK = import.meta.env.VITE_MOCK_MODE === 'true'
export const useDocuments = _MOCK ? useMockDocuments : useDocumentsFirestore
