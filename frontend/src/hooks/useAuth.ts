import { useState, useEffect, useRef } from 'react'
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../services/firebase'

const MOCK = import.meta.env.VITE_MOCK_MODE === 'true'

const MOCK_USER = {
  uid: 'demo-user',
  email: 'demo@fleemy.app',
  displayName: 'Utilisateur Démo',
  photoURL: 'https://ui-avatars.com/api/?name=Demo+User&background=10b981&color=fff&size=64',
} as unknown as User

function useMockAuth() {
  return {
    user: MOCK_USER,
    authLoading: false,
    signingIn: false,
    error: null,
    signInWithGoogle: async () => {},
    logout: async () => {},
  }
}

function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (isMounted.current) { setUser(firebaseUser); setAuthLoading(false) }
      },
      () => {
        if (isMounted.current) {
          setAuthLoading(false)
          setError('Erreur de connexion Firebase. Vérifiez votre configuration.')
        }
      }
    )
    return () => { isMounted.current = false; unsubscribe() }
  }, [])

  const signInWithGoogle = async () => {
    setError(null); setSigningIn(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (isMounted.current) { setError('Connexion échouée. Réessayez.'); console.error(err) }
    } finally {
      if (isMounted.current) setSigningIn(false)
    }
  }

  const logout = async () => {
    setError(null)
    try { await signOut(auth) } catch (err) {
      console.error('Erreur lors de la déconnexion :', err)
      if (isMounted.current) setError('Déconnexion échouée. Réessayez.')
    }
  }

  return { user, authLoading, signingIn, error, signInWithGoogle, logout }
}

// Basculement build-time : Vite élimine le code inutilisé via tree-shaking
export const useAuth = MOCK ? useMockAuth : useFirebaseAuth
