import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { useNotifications, type AppNotification } from '../hooks/useNotifications'

const TYPE_ICON: Record<AppNotification['type'], JSX.Element> = {
  info:    <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />,
  success: <CheckCircle size={13} className="text-emerald-400 shrink-0 mt-0.5" />,
  error:   <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />,
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffH = diffMs / 3600000
    if (diffH < 1) return `${Math.max(1, Math.round(diffMs / 60000))} min`
    if (diffH < 24) return `${Math.round(diffH)}h`
    const diffD = Math.round(diffH / 24)
    return `${diffD}j`
  } catch { return '' }
}

export function NotificationBell() {
  const { notifications, markRead, markAllRead, dismiss } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    setOpen(o => !o)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-zinc-400 hover:text-white hover:bg-zinc-800"
      >
        <Bell size={18} />
        <span>Notifications</span>
        {unread > 0 && (
          <span className="ml-auto w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{ maxHeight: 380 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <p className="text-sm font-semibold text-white">Notifications</p>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <CheckCheck size={12} /> Tout lire
                </button>
              )}
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 310 }}>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell size={24} className="text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-600">Aucune notification</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 last:border-0 ${!n.read ? 'bg-zinc-800/20' : ''}`}
                  >
                    {TYPE_ICON[n.type] ?? TYPE_ICON.info}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium leading-snug ${n.read ? 'text-zinc-400' : 'text-white'}`}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                    </div>
                    <div className="flex items-start gap-1.5 shrink-0">
                      <span className="text-[10px] text-zinc-600">{fmtDate(n.createdAt)}</span>
                      <button
                        onClick={e => { e.stopPropagation(); dismiss(n.id) }}
                        className="text-zinc-700 hover:text-zinc-400 transition-colors mt-0.5"
                      >
                        <X size={11} />
                      </button>
                    </div>
                    {!n.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
