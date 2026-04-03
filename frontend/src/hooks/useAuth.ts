import { useState, useEffect, useRef } from 'react'
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../services/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  // authLoading = vérification de session initiale Firebase
  const [authLoading, setAuthLoading] = useState(true)
  // signingIn = clic sur "Continuer avec Google" en cours
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (isMounted.current) {
          setUser(firebaseUser)
          setAuthLoading(false)
        }
      },
      (_err) => {
        if (isMounted.current) {
          setAuthLoading(false)
          setError('Erreur de connexion Firebase. Vérifiez votre configuration.')
        }
      }
    )
    return () => {
      isMounted.current = false
      unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    setSigningIn(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (isMounted.current) {
        setError('Connexion échouée. Réessayez.')
        console.error(err)
      }
    } finally {
      if (isMounted.current) setSigningIn(false)
    }
  }

  const logout = async () => {
    setError(null)
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Erreur lors de la déconnexion :', err)
      if (isMounted.current) {
        setError('Déconnexion échouée. Réessayez.')
      }
    }
  }

  return { user, authLoading, signingIn, error, signInWithGoogle, logout }
}
