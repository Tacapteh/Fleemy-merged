import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type UpdateData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { TaskItem } from '../types'

function useTasksFirestore() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTasks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TaskItem)))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('useTasks: snapshot error', err)
        setError('Impossible de charger les tâches.')
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user])

  const addTask = async (task: Omit<TaskItem, 'id'>) => {
    if (!user) return
    try {
      await addDoc(collection(db, 'tasks'), { ...task, userId: user.uid, createdAt: serverTimestamp() })
    } catch (err) {
      console.error(err)
      throw new Error('Impossible d\'ajouter la tâche.')
    }
  }

  const updateTask = async (id: string, updates: Partial<TaskItem>) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'tasks', id), updates as UpdateData<TaskItem>)
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de modifier la tâche.')
    }
  }

  const deleteTask = async (id: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'tasks', id))
    } catch (err) {
      console.error(err)
      throw new Error('Impossible de supprimer la tâche.')
    }
  }

  return { tasks, loading, error, addTask, updateTask, deleteTask }
}

import { useMockTasks } from '../mocks/hooks'
import { IS_MOCK } from '../lib/mockMode'
export const useTasks = IS_MOCK ? useMockTasks : useTasksFirestore
