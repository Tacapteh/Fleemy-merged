import { useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Users, Calendar, CheckSquare, FileText,
  PiggyBank, Plus, AlertTriangle, Clock,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'
import { useClients } from '../hooks/useClients'
import { useBudget } from '../hooks/useBudget'
import { useDocuments } from '../hooks/useDocuments'
import {
  format, startOfMonth, endOfMonth, isAfter, isBefore, parseISO,
  isToday, addDays, isSameMonth,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Client } from '../types'

interface DashboardProps {
  onNavigate: (tab: string) => void
}

function eventRevenue(ev: { isBillable?: boolean; overridePrice?: number; startTime?: string; endTime?: string; hourlyRate?: number }, client?: Client) {
  if (!ev.isBillable) return 0
  if (ev.overridePrice !== undefined) return ev.overridePrice
  const rate = ev.hourlyRate ?? client?.hourlyRate ?? 0
  if (!rate || !ev.startTime || !ev.endTime) return 0
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  return rate * (toMin(ev.endTime) - toMin(ev.startTime)) / 60
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { tasks } = useTasks()
  const { events } = useEvents()
  const { clients } = useClients()
  const { transactions } = useBudget()
  const { documents } = useDocuments()

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const stats = useMemo(() => {
    const monthlyIncome = transactions
      .filter(t => t.type === 'income' && !isBefore(parseISO(t.date), monthStart) && !isAfter(parseISO(t.date), monthEnd))
      .reduce((s, t) => s + t.amount, 0)

    const monthlyExpense = transactions
      .filter(t => t.type === 'expense' && !isBefore(parseISO(t.date), monthStart) && !isAfter(parseISO(t.date), monthEnd))
      .reduce((s, t) => s + t.amount, 0)

    // Revenue from billable events this month (planning)
    const monthEvents = events.filter(e => {
      const d = parseISO(e.date)
      return !isBefore(d, monthStart) && !isAfter(d, monthEnd)
    })
    const plannedRevenue = monthEvents.reduce((s, e) => {
      const client = clients.find(c => c.id === e.clientId)
      return s + eventRevenue(e, client)
    }, 0)
    const billableHours = monthEvents
      .filter(e => e.isBillable)
      .reduce((s, e) => {
        if (!e.startTime || !e.endTime) return s
        const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
        return s + (toMin(e.endTime) - toMin(e.startTime)) / 60
      }, 0)

    const pendingTasks = tasks.filter(t => t.status !== 'done').length
    const todayEvents = events.filter(e => isToday(parseISO(e.date))).length
    const activeClients = clients.filter(c => c.status === 'active').length

    // Overdue documents
    const overdueOrSent = documents.filter(d => {
      if (d.status === 'paid' || d.status === 'accepted' || d.status === 'draft') return false
      if (d.status === 'overdue') return true
      if (d.status === 'sent' && d.dueDate && isBefore(parseISO(d.dueDate), today)) return true
      return false
    })

    return { monthlyIncome, monthlyExpense, plannedRevenue, billableHours, pendingTasks, todayEvents, activeClients, overdueOrSent }
  }, [transactions, tasks, events, clients, documents, monthStart, monthEnd])

  // Revenue chart — last 6 months (events + transactions combined)
  const chartData = useMemo(() => {
    const months: { name: string; planning: number; encaissé: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const label = format(d, 'MMM', { locale: fr })
      const start = startOfMonth(d)
      const end = endOfMonth(d)

      const encaissé = transactions
        .filter(t => t.type === 'income' && !isBefore(parseISO(t.date), start) && !isAfter(parseISO(t.date), end))
        .reduce((s, t) => s + t.amount, 0)

      const planning = events
        .filter(e => { const ed = parseISO(e.date); return !isBefore(ed, start) && !isAfter(ed, end) })
        .reduce((s, e) => {
          const client = clients.find(c => c.id === e.clientId)
          return s + eventRevenue(e, client)
        }, 0)

      months.push({ name: label, planning, encaissé })
    }
    return months
  }, [transactions, events, clients, today])

  // Next 7 days events (excluding today)
  const upcomingEvents = useMemo(() => {
    const next7 = addDays(today, 7)
    return events
      .filter(e => {
        const d = parseISO(e.date)
        return isAfter(d, today) && !isAfter(d, next7)
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, 5)
  }, [events, today])

  const statCards = [
    {
      label: 'Revenus planifiés (mois)',
      value: `${stats.plannedRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`,
      sub: `${stats.billableHours.toFixed(1)} h facturables`,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Encaissé (budget)',
      value: `${stats.monthlyIncome.toLocaleString('fr-FR')} €`,
      sub: `Dépenses : ${stats.monthlyExpense.toLocaleString('fr-FR')} €`,
      icon: PiggyBank,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
    },
    {
      label: 'Clients actifs',
      value: String(stats.activeClients),
      sub: `${clients.length} au total`,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Tâches en cours',
      value: String(stats.pendingTasks),
      sub: `${tasks.filter(t => t.status === 'done' && isSameMonth(parseISO(t.date), today)).length} terminées ce mois`,
      icon: CheckSquare,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ]

  const quickActions = [
    { label: 'Nouveau créneau', icon: Calendar, tab: 'planning' },
    { label: 'Ajouter client', icon: Plus, tab: 'clients' },
    { label: 'Facture rapide', icon: FileText, tab: 'documents' },
    { label: 'Budget', icon: TrendingDown, tab: 'budget' },
  ]

  const todayItems = events.filter(e => isToday(parseISO(e.date))).slice(0, 6)
  const urgentTasks = tasks.filter(t => t.status !== 'done' && t.priority === 1).slice(0, 5)

  const greeting = (() => {
    const h = today.getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  })()

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">{greeting} 👋</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {format(today, "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* Overdue alert */}
      {stats.overdueOrSent.length > 0 && (
        <div
          onClick={() => onNavigate('documents')}
          className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl cursor-pointer hover:bg-orange-500/15 transition-colors"
        >
          <AlertTriangle size={16} className="text-orange-400 shrink-0" />
          <p className="text-sm text-orange-300">
            {stats.overdueOrSent.length} facture{stats.overdueOrSent.length > 1 ? 's' : ''} en attente de règlement
            {' — '}
            <span className="font-semibold">
              {stats.overdueOrSent.reduce((s, d) => s + d.totalAmount, 0).toLocaleString('fr-FR')} €
            </span>
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className={`${bg} w-9 h-9 rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-xl font-bold text-white leading-tight">{value}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
            {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Chart + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">Revenus 6 mois</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gPlanning" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gEncaisse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#e4e4e7' }}
                formatter={(v: number) => [`${v.toLocaleString('fr-FR')} €`]}
              />
              <Area type="monotone" dataKey="planning" name="Planning" stroke="#6366f1" fill="url(#gPlanning)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="encaissé" name="Encaissé" stroke="#10b981" fill="url(#gEncaisse)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">Actions rapides</h2>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(({ label, icon: Icon, tab }) => (
              <button
                key={tab}
                onClick={() => onNavigate(tab)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 transition-colors text-center"
              >
                <Icon size={18} className="text-emerald-400" />
                <span className="text-xs text-zinc-300 leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Today + upcoming + urgent tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Calendar size={12} /> Aujourd'hui
          </h2>
          {todayItems.length === 0 ? (
            <p className="text-xs text-zinc-600">Journée libre</p>
          ) : (
            <ul className="space-y-2">
              {todayItems.map(e => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white truncate">{e.title}</span>
                  <span className="text-xs text-zinc-500 shrink-0 font-mono">{e.startTime}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock size={12} /> 7 prochains jours
          </h2>
          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-zinc-600">Rien de prévu</p>
          ) : (
            <ul className="space-y-2">
              {upcomingEvents.map(e => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{e.title}</p>
                    <p className="text-[11px] text-zinc-600">{format(parseISO(e.date), 'EEE d MMM', { locale: fr })}</p>
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0 font-mono">{e.startTime}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckSquare size={12} /> Tâches urgentes
          </h2>
          {urgentTasks.length === 0 ? (
            <p className="text-xs text-zinc-600">Aucune tâche urgente</p>
          ) : (
            <ul className="space-y-2">
              {urgentTasks.map(t => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === 'in-progress' ? 'bg-amber-400' : 'bg-red-500'}`} />
                  <span className="text-sm text-white truncate">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
