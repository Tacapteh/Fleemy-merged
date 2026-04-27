import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  updateDoc, deleteDoc, doc, writeBatch,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'

export interface AppNotification {
  id: string
  userId: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  read: boolean
  createdAt: string
  relatedResource?: { type: string; id: string }
}

function useNotificationsFirestore() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
    )
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as AppNotification))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50)
      setNotifications(list)
      setLoading(false)
    })
    return unsub
  }, [user])

  const markRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true })
  }

  const markAllRead = async () => {
    if (!user) return
    const unread = notifications.filter(n => !n.read)
    if (unread.length === 0) return
    const batch = writeBatch(db)
    for (const n of unread) {
      batch.update(doc(db, 'notifications', n.id), { read: true })
    }
    await batch.commit()
  }

  const dismiss = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id))
  }

  return { notifications, loading, markRead, markAllRead, dismiss }
}

const _MOCK = import.meta.env.VITE_MOCK_MODE === 'true'

function useNotificationsMock() {
  return {
    notifications: [] as AppNotification[],
    loading: false,
    markRead: async (_id: string) => {},
    markAllRead: async () => {},
    dismiss: async (_id: string) => {},
  }
}

export const useNotifications = _MOCK ? useNotificationsMock : useNotificationsFirestore
