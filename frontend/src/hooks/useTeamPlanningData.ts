import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import type { EventItem, TaskItem, Team } from '../types'

export interface TeamEventItem extends EventItem { ownerName: string; ownerUid: string }
export interface TeamTaskItem extends TaskItem { ownerName: string; ownerUid: string }

const MOCK = import.meta.env.VITE_MOCK_MODE === 'true'

export function useTeamPlanningData(team: Team | null, myUid: string) {
  const [teamEvents, setTeamEvents] = useState<TeamEventItem[]>([])
  const [teamTasks, setTeamTasks] = useState<TeamTaskItem[]>([])

  useEffect(() => {
    if (MOCK || !team) { setTeamEvents([]); setTeamTasks([]); return }

    const teammateUids = team.members
      .filter(m => m.uid !== myUid)
      .map(m => m.uid)

    if (teammateUids.length === 0) { setTeamEvents([]); setTeamTasks([]); return }

    const getName = (uid: string) =>
      team.members.find(m => m.uid === uid)?.displayName ?? 'Coéquipier'

    const unsubEvents = onSnapshot(
      query(collection(db, 'events'), where('userId', 'in', teammateUids)),
      snap => setTeamEvents(snap.docs.map(d => ({
        id: d.id, ...d.data(), ownerName: getName(d.data().userId), ownerUid: d.data().userId,
      } as TeamEventItem)))
    )

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('userId', 'in', teammateUids)),
      snap => setTeamTasks(snap.docs.map(d => ({
        id: d.id, ...d.data(), ownerName: getName(d.data().userId), ownerUid: d.data().userId,
      } as TeamTaskItem)))
    )

    return () => { unsubEvents(); unsubTasks() }
  }, [team, myUid])

  return { teamEvents, teamTasks }
}
