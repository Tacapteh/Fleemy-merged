import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { nanoid } from 'nanoid'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Team, TeamMember } from '../types'

export function useTeam() {
  const { user } = useAuth()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    loadUserTeam()
  }, [user])

  const loadUserTeam = async () => {
    if (!user) return
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const teamId = userDoc.data()?.teamId
      if (teamId) {
        const teamDoc = await getDoc(doc(db, 'teams', teamId))
        if (teamDoc.exists()) {
          setTeam({ id: teamDoc.id, ...teamDoc.data() } as Team)
        }
      }
    } catch (err) {
      console.error('Failed to load team:', err)
    }
    setLoading(false)
  }

  const createTeam = async (name: string) => {
    if (!user) return
    setError(null)
    try {
      const teamId = nanoid()
      const newTeam: Omit<Team, 'id'> = {
        name,
        ownerId: user.uid,
        members: [{
          uid: user.uid,
          email: user.email!,
          displayName: user.displayName ?? user.email!,
          photoURL: user.photoURL ?? undefined,
          role: 'owner',
        }],
        inviteCode: nanoid(8).toUpperCase(),
        createdAt: new Date().toISOString(),
      }
      await setDoc(doc(db, 'teams', teamId), newTeam)
      await setDoc(doc(db, 'users', user.uid), { teamId }, { merge: true })
      setTeam({ id: teamId, ...newTeam })
    } catch (err) {
      setError('Impossible de créer l\'équipe.')
      console.error(err)
    }
  }

  const joinTeam = async (inviteCode: string) => {
    if (!user) return
    setError(null)
    try {
      // Search team by inviteCode — limited scan (no index on inviteCode for simplicity)
      // In production, use a Firestore query with index
      const { getDocs, collection, query, where } = await import('firebase/firestore')
      const q = query(collection(db, 'teams'), where('inviteCode', '==', inviteCode.toUpperCase()))
      const snap = await getDocs(q)
      if (snap.empty) {
        setError('Code d\'invitation invalide.')
        return
      }
      const teamDoc = snap.docs[0]
      const member: TeamMember = {
        uid: user.uid,
        email: user.email!,
        displayName: user.displayName ?? user.email!,
        photoURL: user.photoURL ?? undefined,
        role: 'member',
      }
      await updateDoc(doc(db, 'teams', teamDoc.id), { members: arrayUnion(member) })
      await setDoc(doc(db, 'users', user.uid), { teamId: teamDoc.id }, { merge: true })
      setTeam({ id: teamDoc.id, ...teamDoc.data() } as Team)
    } catch (err) {
      setError('Impossible de rejoindre l\'équipe.')
      console.error(err)
    }
  }

  const leaveTeam = async () => {
    if (!user || !team) return
    try {
      await setDoc(doc(db, 'users', user.uid), { teamId: null }, { merge: true })
      setTeam(null)
    } catch (err) {
      console.error(err)
    }
  }

  return { team, loading, error, createTeam, joinTeam, leaveTeam }
}
