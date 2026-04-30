// VITE_FIREBASE_VAPID_KEY must be set in Vercel env vars.
// Find it in Firebase Console > Project Settings > Cloud Messaging > Web Push certificates > Key pair.

import { useState, useCallback } from 'react'
import { getToken } from 'firebase/messaging'
import { messaging } from '../services/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

export function usePushNotifications(userId: string | undefined) {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    messaging !== null &&
    !!VAPID_KEY

  const [permissionGranted, setPermissionGranted] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  )

  const register = useCallback(async () => {
    if (!supported || !userId || !messaging) return

    try {
      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      })

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      setPermissionGranted(true)

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      })

      if (!token) return

      await fetch('/api/notifications/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId }),
      })
    } catch (err) {
      console.error('[FCM] register error', err)
    }
  }, [supported, userId])

  return { supported, permissionGranted, register }
}
