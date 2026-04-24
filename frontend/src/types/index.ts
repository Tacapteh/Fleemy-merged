// ── V2 types (ported from Fleemy-v2/types.ts) ────────────────────────────────

export type View = 'dashboard' | 'planning' | 'budget' | 'notes' | 'documents' | 'clients' | 'settings'

export interface Client {
  id: string
  name: string
  company: string
  email: string
  phone?: string
  address?: string
  status: 'active' | 'lead' | 'inactive'
  lastContact: string
  hourlyRate?: number
  notes?: string
}

export type Priority = 1 | 2 | 3 // 1 = High, 3 = Low
export type EventStatus = 'paid' | 'unpaid' | 'pending' | 'not-worked'
export type TaskStatus = 'todo' | 'in-progress' | 'done'

export interface CalendarItem {
  id: string
  date: string // ISO Date
  title: string
  type: 'event' | 'task' | 'recurring'
}

export interface EventItem extends CalendarItem {
  type: 'event'
  clientId?: string
  clientName?: string
  paymentStatus: EventStatus
  startTime: string // HH:mm
  endTime: string // HH:mm
  isBillable: boolean
  overridePrice?: number
  hourlyRate?: number // overrides client rate when set
}

export interface RecurringTaskTemplate {
  id: string
  title: string
  icon: string
  color: string
  defaultPrice?: number
  defaultDuration: number // minutes
  isBillable: boolean
}

export interface TaskItem extends CalendarItem {
  type: 'task'
  priority: Priority
  status: TaskStatus
  progress?: number
  description?: string
  dependencies?: string[]
  color?: string
  icon?: string
  price?: number
  startTime?: string
  endTime?: string
  taskKind?: 'standard' | 'deplacement' | 'evacuation'
  clientId?: string
  montantTache?: number
  prixKm?: number
  nbKm?: number
  prixFixeDeplacement?: number
  prixM3?: number
  nbM3?: number
  prixFixeEvacuation?: number
}

export interface Transaction {
  id: string
  date: string
  amount: number
  category: string
  type: 'income' | 'expense' | 'savings'
  description: string
  isRecurring?: boolean
  recurrenceInterval?: 'weekly' | 'monthly'
}

export interface BudgetGoal {
  id: string
  savingsGoal: number
  monthlyBudget: number
}

export interface Note {
  id: string
  title: string
  content: string
  isDone: boolean
  priority: Priority
  date: string
  tags?: string[]
}

export interface DocumentItem {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
}

export interface Document {
  id: string
  type: 'invoice' | 'quote'
  clientId: string
  clientName: string
  items: DocumentItem[]
  status: 'draft' | 'sent' | 'paid' | 'accepted' | 'rejected' | 'overdue'
  date: string
  dueDate?: string
  notes?: string
  totalAmount: number
}

export interface AppSettings {
  darkMode: boolean
  workDayStart: string // HH:mm
  workDayEnd: string // HH:mm
  showWeekends: boolean
  globalHourlyRate: number
  defaultSlotDuration: number // minutes
  clientRequired: boolean
  emailTemplates: {
    invoice: { subject: string; body: string }
    quote: { subject: string; body: string }
  }
}

// ── Team / User types (new in Fleemy-merged) ─────────────────────────────────

export interface TeamMember {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  role: 'owner' | 'member'
}

export interface Team {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  inviteCode: string
  createdAt: string
}

export interface AppUser {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  teamId?: string
  settings: AppSettings
}
