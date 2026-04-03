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

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TaskItem)))
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addTask = async (task: Omit<TaskItem, 'id'>) => {
    if (!user) return
    await addDoc(collection(db, 'tasks'), { ...task, userId: user.uid, createdAt: serverTimestamp() })
  }

  const updateTask = async (id: string, updates: Partial<TaskItem>) => {
    if (!user) return
    await updateDoc(doc(db, 'tasks', id), updates as UpdateData<TaskItem>)
  }

  const deleteTask = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, 'tasks', id))
  }

  return { tasks, loading, addTask, updateTask, deleteTask }
}

import { useMockTasks } from '../mocks/hooks'
const _MOCK = import.meta.env.VITE_MOCK_MODE === 'true'
export const useTasks = _MOCK ? useMockTasks : useTasksFirestore
