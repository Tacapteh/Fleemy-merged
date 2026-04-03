// Données de démonstration pour VITE_MOCK_MODE=true
import type { TaskItem, EventItem, Client, Transaction, Note, Document as FleemyDocument } from '../types'

const today = new Date().toISOString().split('T')[0]
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

export const MOCK_TASKS: TaskItem[] = [
  { id: 't1', type: 'task', title: 'Refonte landing page', date: today, startTime: '09:00', endTime: '12:00', priority: 1, status: 'in-progress', progress: 40, description: 'Intégration Figma + animations' },
  { id: 't2', type: 'task', title: 'Rédiger devis Dupont', date: today, startTime: '14:00', endTime: '15:00', priority: 2, status: 'todo', progress: 0 },
  { id: 't3', type: 'task', title: 'Réunion kick-off projet', date: tomorrow, startTime: '10:00', endTime: '11:30', priority: 1, status: 'todo', progress: 0 },
  { id: 't4', type: 'task', title: 'Livraison maquettes v2', date: yesterday, startTime: '18:00', endTime: '19:00', priority: 2, status: 'done', progress: 100 },
  { id: 't5', type: 'task', title: 'Mise à jour portfolio', date: tomorrow, startTime: '16:00', endTime: '18:00', priority: 3, status: 'todo', progress: 0 },
]

export const MOCK_EVENTS: EventItem[] = [
  { id: 'e1', type: 'event', title: 'Appel client Martin', date: today, startTime: '11:00', endTime: '12:00', clientId: 'c1', clientName: 'Sophie Martin', paymentStatus: 'unpaid', isBillable: true },
  { id: 'e2', type: 'event', title: 'Session design sprint', date: yesterday, startTime: '09:00', endTime: '17:00', clientId: 'c2', clientName: 'Tech Innov', paymentStatus: 'paid', isBillable: true },
  { id: 'e3', type: 'event', title: 'Démo produit', date: tomorrow, startTime: '15:00', endTime: '16:00', clientId: 'c3', clientName: 'Startup ABC', paymentStatus: 'pending', isBillable: false },
]

export const MOCK_CLIENTS: Client[] = [
  { id: 'c1', name: 'Sophie Martin', company: 'Martin & Co', email: 'sophie@martin.fr', phone: '06 12 34 56 78', status: 'active', lastContact: yesterday, hourlyRate: 90 },
  { id: 'c2', name: 'Tech Innov', company: 'Tech Innov SAS', email: 'contact@techinov.fr', status: 'active', lastContact: today, hourlyRate: 120 },
  { id: 'c3', name: 'Startup ABC', company: 'ABC Labs', email: 'hello@abclabs.io', phone: '07 98 76 54 32', status: 'lead', lastContact: yesterday, hourlyRate: 75 },
  { id: 'c4', name: 'Jean Dupont', company: 'Dupont Design', email: 'jean@dupont.com', status: 'inactive', lastContact: '2025-01-10' },
]

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx1', date: today, amount: 2400, category: 'Freelance', type: 'income', description: 'Mission Tech Innov — design sprint' },
  { id: 'tx2', date: today, amount: 850, category: 'Loyer', type: 'expense', description: 'Loyer bureau partagé' },
  { id: 'tx3', date: yesterday, amount: 1200, category: 'Freelance', type: 'income', description: 'Facture #2025-03 Sophie Martin' },
  { id: 'tx4', date: yesterday, amount: 49, category: 'Abonnement', type: 'expense', description: 'Adobe Creative Cloud' },
  { id: 'tx5', date: yesterday, amount: 500, category: 'Épargne', type: 'savings', description: 'Virement compte épargne' },
  { id: 'tx6', date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], amount: 3200, category: 'Freelance', type: 'income', description: 'Projet refonte Startup ABC' },
  { id: 'tx7', date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0], amount: 120, category: 'Transport', type: 'expense', description: 'SNCF + Uber' },
]

export const MOCK_NOTES: Note[] = [
  { id: 'n1', title: 'Idées refonte portfolio', content: 'Animation hero section, section témoignages, dark mode toggle', priority: 1, isDone: false, date: today, tags: ['portfolio', 'design'] },
  { id: 'n2', title: 'Tarifs 2026', content: 'Augmenter le taux journalier de 15% minimum. Revoir les forfaits maintenance.', priority: 2, isDone: false, date: yesterday, tags: ['business', 'tarifs'] },
  { id: 'n3', title: 'Checklist prospection', content: '- LinkedIn Sales Navigator\n- Relancer anciens contacts\n- Réseaux freelance', priority: 2, isDone: true, date: yesterday, tags: ['prospection'] },
  { id: 'n4', title: 'Stack technique 2026', content: 'React 19 · Vite · TypeScript · Tailwind · Supabase ou Firebase', priority: 3, isDone: false, date: today, tags: ['tech'] },
]

export const MOCK_DOCUMENTS: FleemyDocument[] = [
  { id: 'd1', type: 'invoice', clientId: 'c2', clientName: 'Tech Innov', items: [{ description: 'Design sprint 2 jours', quantity: 2, unitPrice: 960, taxRate: 20 }], status: 'paid', date: yesterday, totalAmount: 2304 },
  { id: 'd2', type: 'quote', clientId: 'c1', clientName: 'Sophie Martin', items: [{ description: 'Refonte site web', quantity: 1, unitPrice: 3500, taxRate: 20 }, { description: 'SEO & optimisation', quantity: 1, unitPrice: 800, taxRate: 20 }], status: 'sent', date: today, dueDate: tomorrow, totalAmount: 5160 },
  { id: 'd3', type: 'invoice', clientId: 'c3', clientName: 'Startup ABC', items: [{ description: 'Mission UX Research', quantity: 5, unitPrice: 600, taxRate: 20 }], status: 'draft', date: today, totalAmount: 3600 },
]
