// Hooks mock pour VITE_MOCK_MODE=true — remplacent les hooks Firestore
import { useState } from 'react'
import type { User } from 'firebase/auth'
import {
  MOCK_TASKS, MOCK_EVENTS, MOCK_CLIENTS,
  MOCK_TRANSACTIONS, MOCK_NOTES, MOCK_DOCUMENTS,
} from './data'
import type {
  TaskItem, EventItem, Client, Transaction, Note, Document as FleemyDocument
} from '../types'

const DEMO_USER = {
  uid: 'demo-user',
  email: 'demo@fleemy.app',
  displayName: 'Utilisateur Démo',
  photoURL: null,
} as unknown as User

export function useMockAuth() {
  const [user] = useState<User>(DEMO_USER)
  return {
    user,
    authLoading: false,
    signingIn: false,
    error: null,
    signInWithGoogle: async () => {},
    logout: async () => {},
  }
}

function makeMockHook<T extends { id: string }>(initial: T[]) {
  return function useMockHook() {
    const [items, setItems] = useState<T[]>(initial)
    const add = async (item: Omit<T, 'id'>) => {
      setItems(prev => [...prev, { ...item, id: Math.random().toString(36).slice(2) } as T])
    }
    const update = async (id: string, updates: Partial<T>) => {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    }
    const remove = async (id: string) => {
      setItems(prev => prev.filter(i => i.id !== id))
    }
    return { items, loading: false, add, update, remove }
  }
}

const useMockTasksBase = makeMockHook<TaskItem>(MOCK_TASKS)
export function useMockTasks() {
  const { items, loading, add, update, remove } = useMockTasksBase()
  return { tasks: items, loading, addTask: add, updateTask: update, deleteTask: remove }
}

const useMockEventsBase = makeMockHook<EventItem>(MOCK_EVENTS)
export function useMockEvents() {
  const { items, loading, add, update, remove } = useMockEventsBase()
  return { events: items, loading, addEvent: add, updateEvent: update, deleteEvent: remove }
}

const useMockClientsBase = makeMockHook<Client>(MOCK_CLIENTS)
export function useMockClients() {
  const { items, loading, add, update, remove } = useMockClientsBase()
  return { clients: items, loading, addClient: add, updateClient: (id: string, u: Partial<Client>) => update(id, u), deleteClient: remove }
}

const useMockBudgetBase = makeMockHook<Transaction>(MOCK_TRANSACTIONS)
export function useMockBudget() {
  const { items, loading, add, update, remove } = useMockBudgetBase()
  return { transactions: items, loading, addTransaction: add, updateTransaction: update, deleteTransaction: remove }
}

const useMockNotesBase = makeMockHook<Note>(MOCK_NOTES)
export function useMockNotes() {
  const { items, loading, add, update, remove } = useMockNotesBase()
  return { notes: items, loading, addNote: add, updateNote: update, deleteNote: remove }
}

const useMockDocumentsBase = makeMockHook<FleemyDocument>(MOCK_DOCUMENTS)
export function useMockDocuments() {
  const { items, loading, add, update, remove } = useMockDocumentsBase()
  return { documents: items, loading, addDocument: add, updateDocument: update, deleteDocument: remove }
}
