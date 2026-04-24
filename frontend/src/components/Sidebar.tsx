import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  Users,
  StickyNote,
  FileText,
  Settings,
  Zap,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { User } from 'firebase/auth'
import { useAuth } from '../hooks/useAuth'

type Tab = 'dashboard' | 'planning' | 'budget' | 'clients' | 'notes' | 'documents' | 'settings'

interface SidebarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  isOpen: boolean
  onToggle: () => void
  user: User
}

const navItems: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'planning', label: 'Planning', icon: Calendar },
  { id: 'budget', label: 'Budget', icon: DollarSign },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'settings', label: 'Paramètres', icon: Settings },
]

export function Sidebar({ activeTab, onTabChange, isOpen, onToggle, user }: SidebarProps) {
  const { logout } = useAuth()
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — always visible on lg+, slide in/out on mobile */}
      <motion.aside
        className="fixed lg:static inset-y-0 left-0 z-30 w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col"
        initial={false}
        animate={{ x: isDesktop ? 0 : (isOpen ? 0 : -256) }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-2 border-b border-zinc-800">
          <Zap className="text-emerald-400" size={22} />
          <span className="text-lg font-bold text-white">Fleemy</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { onTabChange(id); if (isOpen) onToggle() }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${activeTab === id
                  ? 'bg-indigo-500/20 text-indigo-400 border-l-2 border-indigo-400 pl-[10px]'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }
              `}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* User profile */}
        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
                {(user.displayName ?? user.email ?? 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.displayName ?? user.email}
              </p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </motion.aside>
    </>
  )
}
