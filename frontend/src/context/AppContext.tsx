import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  Client, EventItem, Transaction, Document as FleemyDocument, Note, AppSettings,
  RecurringTaskTemplate, View, TaskItem,
} from '../types'
import { useAuth } from '../hooks/useAuth'

export interface Toast {
  message: string
  type: 'success' | 'error'
}

interface AppContextType {
  currentUser: User | null
  clients: Client[]
  events: EventItem[]
  tasks: TaskItem[]
  transactions: Transaction[]
  documents: FleemyDocument[]
  notes: Note[]
  settings: AppSettings
  recurringTemplates: RecurringTaskTemplate[]
  currentView: View
  toast: Toast | null
  setCurrentView: (view: View) => void
  addClient: (client: Client) => void
  updateClient: (client: Client) => void
  addEvent: (event: EventItem) => void
  updateEvent: (event: EventItem) => void
  addTask: (task: TaskItem) => void
  updateTask: (task: TaskItem) => void
  deleteEvent: (id: string) => void
  deleteTask: (id: string) => void
  addTransaction: (transaction: Transaction) => void
  addDocument: (doc: FleemyDocument) => void
  updateSettings: (settings: AppSettings) => void
  showToast: (message: string, type?: 'success' | 'error') => void
}

const defaultSettings: AppSettings = {
  darkMode: false,
  workDayStart: '09:00',
  workDayEnd: '18:00',
  showWeekends: false,
  globalHourlyRate: 0,
  defaultSlotDuration: 60,
  clientRequired: false,
  emailTemplates: {
    invoice: { subject: '', body: '' },
    quote: { subject: '', body: '' },
  },
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth()

  const [clients, setClients] = useState<Client[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [documents, setDocuments] = useState<FleemyDocument[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [recurringTemplates] = useState<RecurringTaskTemplate[]>([])
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [toast, setToast] = useState<Toast | null>(null)

  // Suppress unused warning — notes state is exposed via context for Phase 4
  void setNotes

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const addClient = (client: Client) => setClients((prev) => [...prev, client])
  const updateClient = (client: Client) =>
    setClients((prev) => prev.map((c) => (c.id === client.id ? client : c)))
  const addEvent = (event: EventItem) => setEvents((prev) => [...prev, event])
  const updateEvent = (event: EventItem) =>
    setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)))
  const deleteEvent = (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id))
  const addTask = (task: TaskItem) => setTasks((prev) => [...prev, task])
  const updateTask = (task: TaskItem) =>
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
  const deleteTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id))
  const addTransaction = (t: Transaction) => setTransactions((prev) => [...prev, t])
  const addDocument = (d: FleemyDocument) => setDocuments((prev) => [...prev, d])
  const updateSettings = (s: AppSettings) => setSettings(s)

  return (
    <AppContext.Provider
      value={{
        currentUser: user,
        clients,
        events,
        tasks,
        transactions,
        documents,
        notes,
        settings,
        recurringTemplates,
        currentView,
        toast,
        setCurrentView,
        addClient,
        updateClient,
        addEvent,
        updateEvent,
        deleteEvent,
        addTask,
        updateTask,
        deleteTask,
        addTransaction,
        addDocument,
        updateSettings,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within an AppProvider')
  return context
}
