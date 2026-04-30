import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Transaction } from '../types'

function useBudgetFirestore() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'transactions'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('useBudget: snapshot error', err)
        setError('Impossible de charger les transactions.')
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user])

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    if (!user) return
    try {
      await addDoc(collection(db, 'transactions'), { ...transaction, userId: user.uid, createdAt: serverTimestamp() })
    } catch (err) {
      console.error(err)
      throw new Error('Impossible d\'ajouter la transaction.')
    }
  }

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'transactions', id), updates as UpdateData<Transaction>)
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de modifier la transaction.')
    }
  }

  const deleteTransaction = async (id: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'transactions', id))
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de supprimer la transaction.')
    }
  }

  return { transactions, loading, error, addTransaction, updateTransaction, deleteTransaction }
}

import { useMockBudget } from '../mocks/hooks'
const _MOCK = import.meta.env.VITE_MOCK_MODE === 'true'
export const useBudget = _MOCK ? useMockBudget : useBudgetFirestore
