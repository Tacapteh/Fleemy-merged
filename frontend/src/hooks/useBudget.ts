import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Transaction } from '../types'

export function useBudget() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'transactions'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    if (!user) return
    await addDoc(collection(db, 'transactions'), { ...transaction, userId: user.uid, createdAt: serverTimestamp() })
  }

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!user) return
    await updateDoc(doc(db, 'transactions', id), updates as UpdateData<Transaction>)
  }

  const deleteTransaction = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, 'transactions', id))
  }

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction }
}
