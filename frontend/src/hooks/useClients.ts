import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Client } from '../types'

function useClientsFirestore() {
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'clients'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setClients(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client)))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('useClients: snapshot error', err)
        setError('Impossible de charger les clients.')
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user])

  const addClient = async (client: Omit<Client, 'id'>) => {
    if (!user) return
    try {
      await addDoc(collection(db, 'clients'), { ...client, userId: user.uid, createdAt: serverTimestamp() })
    } catch (err) {
      console.error(err)
      throw new Error('Impossible d\'ajouter le client.')
    }
  }

  const updateClient = async (id: string, updates: Partial<Client>) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'clients', id), updates as UpdateData<Client>)
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de modifier le client.')
    }
  }

  const deleteClient = async (id: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'clients', id))
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de supprimer le client.')
    }
  }

  return { clients, loading, error, addClient, updateClient, deleteClient }
}

import { useMockClients } from '../mocks/hooks'
import { IS_MOCK } from '../lib/mockMode'
export const useClients = IS_MOCK ? useMockClients : useClientsFirestore
