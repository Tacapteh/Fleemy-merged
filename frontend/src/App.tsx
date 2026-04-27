import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Planning } from './components/Planning'
import { Budget } from './components/Budget'
import { Clients } from './components/Clients'
import { Notes } from './components/Notes'
import { Documents } from './components/Documents'
import { Settings } from './components/Settings'
import { OnboardingModal, useOnboarding } from './components/OnboardingModal'
import { TimerWidget } from './components/TimerWidget'

type Tab = 'dashboard' | 'planning' | 'budget' | 'clients' | 'notes' | 'documents' | 'settings'

export function App() {
  const { user, authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { show: showOnboarding, complete: completeOnboarding } = useOnboarding()

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

  const navigate = (tab: string) => {
    setActiveTab(tab as Tab)
    setSidebarOpen(false)
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />
      case 'planning':  return <Planning />
      case 'budget':    return <Budget />
      case 'clients':   return <Clients />
      case 'notes':     return <Notes />
      case 'documents': return <Documents />
      case 'settings':  return <Settings />
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={tab => setActiveTab(tab)}
        onNavigate={navigate}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        user={user}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center h-14 px-4 lg:hidden border-b border-zinc-800 bg-zinc-950 shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
      {showOnboarding && <OnboardingModal onDone={completeOnboarding} />}
      <TimerWidget />
    </div>
  )
}
