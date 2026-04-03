// frontend/src/App.tsx
import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'

// Placeholders — seront remplacés en Phase 4
function PlaceholderPage({ name }: { name: string }) {
  return (
    <div className="p-8 text-zinc-400">
      <h1 className="text-xl font-semibold text-white mb-2">{name}</h1>
      <p>Ce module sera implémenté en Phase 4.</p>
    </div>
  )
}

type Tab = 'dashboard' | 'planning' | 'budget' | 'clients' | 'notes' | 'documents' | 'settings'

export function App() {
  const { user, authLoading, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Chargement...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'planning', label: 'Planning' },
    { id: 'budget', label: 'Budget' },
    { id: 'clients', label: 'Clients' },
    { id: 'notes', label: 'Notes' },
    { id: 'documents', label: 'Documents' },
    { id: 'settings', label: 'Paramètres' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Barre de nav temporaire */}
      <nav className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">{user.displayName ?? user.email}</span>
          <button
            onClick={logout}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </nav>
      <main className="p-6">
        <PlaceholderPage name={tabs.find(t => t.id === activeTab)?.label ?? ''} />
      </main>
    </div>
  )
}
