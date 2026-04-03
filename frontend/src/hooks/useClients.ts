import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Client } from '../types'

export function useClients() {
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'clients'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client)))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addClient = async (client: Omit<Client, 'id'>) => {
    if (!user) return
    await addDoc(collection(db, 'clients'), { ...client, userId: user.uid, createdAt: serverTimestamp() })
  }

  const updateClient = async (id: string, updates: Partial<Client>) => {
    await updateDoc(doc(db, 'clients', id), updates as UpdateData<Client>)
  }

  const deleteClient = async (id: string) => {
    await deleteDoc(doc(db, 'clients', id))
  }

  return { clients, loading, addClient, updateClient, deleteClient }
}
