import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, Play, Pause, Square, X, Check } from 'lucide-react'
import { useTimer } from '../hooks/useTimer'
import { useEvents } from '../hooks/useEvents'
import { useClients } from '../hooks/useClients'
import { useToast } from '../context/ToastContext'
import type { EventItem } from '../types'

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function TimerWidget() {
  const { state, elapsed, start, pause, resume, stop, getEventTimes } = useTimer()
  const { addEvent } = useEvents()
  const { clients } = useClients()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [confirming, setConfirming] = useState(false)

  const isActive = state.status !== 'idle'

  const handleStart = () => {
    if (!title.trim()) return
    const client = clients.find(c => c.id === clientId)
    start(title.trim(), clientId, client?.name ?? '')
    setOpen(false)
  }

  const handleStop = () => setConfirming(true)

  const handleConfirmSave = async () => {
    const times = getEventTimes()
    const ev: Omit<EventItem, 'id'> = {
      type: 'event',
      title: state.title,
      date: times.date,
      startTime: times.startTime,
      endTime: times.endTime,
      isBillable: true,
      paymentStatus: 'unpaid',
      ...(state.clientId ? { clientId: state.clientId, clientName: state.clientName } : {}),
    }
    await addEvent(ev)
    stop()
    setConfirming(false)
    toast(`Créneau "${state.title}" ajouté au planning`)
  }

  const handleConfirmDiscard = () => {
    stop()
    setConfirming(false)
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      <AnimatePresence>
        {/* Confirm save dialog */}
        {confirming && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 w-64 shadow-xl"
          >
            <p className="text-sm text-white font-medium mb-1">{state.title}</p>
            <p className="text-xs text-zinc-400 mb-3">
              Ajouter {fmtElapsed(elapsed)} au planning ?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmSave}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors"
              >
                <Check size={13} /> Créer le créneau
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Running/paused widget */}
        {isActive && !confirming && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl"
          >
            <div className="min-w-0">
              <p className="text-xs text-zinc-500 truncate max-w-[120px]">{state.title}</p>
              <p className={`text-lg font-mono font-semibold tabular-nums ${state.status === 'running' ? 'text-indigo-400' : 'text-zinc-400'}`}>
                {fmtElapsed(elapsed)}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {state.status === 'running' ? (
                <button onClick={pause} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
                  <Pause size={14} />
                </button>
              ) : (
                <button onClick={resume} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-indigo-400 transition-colors">
                  <Play size={14} />
                </button>
              )}
              <button onClick={handleStop} className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                <Square size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Start form */}
        {open && !isActive && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 w-64 shadow-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">Chronomètre</p>
              <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-400">
                <X size={14} />
              </button>
            </div>
            <input
              autoFocus
              placeholder="Titre…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 mb-2 transition-colors"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
            />
            <select
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 mb-3 transition-colors"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
            >
              <option value="">Aucun client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={handleStart}
              disabled={!title.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Play size={14} /> Démarrer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button — only show when idle */}
      {!isActive && (
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${open ? 'bg-indigo-600 text-white' : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'}`}
        >
          <Timer size={20} />
        </button>
      )}
    </div>
  )
}
