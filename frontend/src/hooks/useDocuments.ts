import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Document as FleemyDocument } from '../types'

export function useDocuments() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<FleemyDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'documents'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as FleemyDocument)))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addDocument = async (document: Omit<FleemyDocument, 'id'>) => {
    if (!user) return
    await addDoc(collection(db, 'documents'), { ...document, userId: user.uid, createdAt: serverTimestamp() })
  }

  const updateDocument = async (id: string, updates: Partial<FleemyDocument>) => {
    await updateDoc(doc(db, 'documents', id), updates as UpdateData<FleemyDocument>)
  }

  const deleteDocument = async (id: string) => {
    await deleteDoc(doc(db, 'documents', id))
  }

  return { documents, loading, addDocument, updateDocument, deleteDocument }
}
