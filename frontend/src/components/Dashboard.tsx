import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Users, Calendar, CheckSquare, FileText, PiggyBank, Plus } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'
import { useClients } from '../hooks/useClients'
import { useBudget } from '../hooks/useBudget'
import { format, startOfMonth, isAfter, parseISO, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'

interface DashboardProps {
  onNavigate: (tab: string) => void
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { tasks } = useTasks()
  const { events } = useEvents()
  const { clients } = useClients()
  const { transactions } = useBudget()

  const today = new Date()
  const monthStart = startOfMonth(today)

  const stats = useMemo(() => {
    const monthlyIncome = transactions
      .filter(t => t.type === 'income' && isAfter(parseISO(t.date), monthStart))
      .reduce((sum, t) => sum + t.amount, 0)

    const monthlyExpense = transactions
      .filter(t => t.type === 'expense' && isAfter(parseISO(t.date), monthStart))
      .reduce((sum, t) => sum + t.amount, 0)

    const pendingTasks = tasks.filter(t => t.status !== 'done').length
    const todayEvents = events.filter(e => isToday(parseISO(e.date))).length
    const activeClients = clients.filter(c => c.status === 'active').length

    return { monthlyIncome, monthlyExpense, pendingTasks, todayEvents, activeClients }
  }, [transactions, tasks, events, clients, monthStart])

  // Revenue chart — last 6 months
  const chartData = useMemo(() => {
    const months: { name: string; revenu: number; dépenses: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const label = format(d, 'MMM', { locale: fr })
      const start = startOfMonth(d)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)

      const revenu = transactions
        .filter(t => t.type === 'income' && parseISO(t.date) >= start && parseISO(t.date) < end)
        .reduce((s, t) => s + t.amount, 0)

      const dépenses = transactions
        .filter(t => t.type === 'expense' && parseISO(t.date) >= start && parseISO(t.date) < end)
        .reduce((s, t) => s + t.amount, 0)

      months.push({ name: label, revenu, dépenses })
    }
    return months
  }, [transactions, today])

  const statCards = [
    {
      label: 'Revenu du mois',
      value: `${stats.monthlyIncome.toLocaleString('fr-FR')} €`,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Dépenses du mois',
      value: `${stats.monthlyExpense.toLocaleString('fr-FR')} €`,
      icon: TrendingDown,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Clients actifs',
      value: String(stats.activeClients),
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Tâches en cours',
      value: String(stats.pendingTasks),
      icon: CheckSquare,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ]

  const quickActions = [
    { label: 'Nouveau créneau', icon: Calendar, tab: 'planning' },
    { label: 'Ajouter client', icon: Plus, tab: 'clients' },
    { label: 'Facture rapide', icon: FileText, tab: 'documents' },
    { label: 'Épargne', icon: PiggyBank, tab: 'budget' },
  ]

  // Today's events
  const todayItems = events.filter(e => isToday(parseISO(e.date))).slice(0, 5)
  const urgentTasks = tasks.filter(t => t.status !== 'done' && t.priority === 1).slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Bonjour 👋
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          {format(today, "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className={`${bg} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Revenus vs Dépenses (6 mois)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDépenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#e4e4e7' }}
              />
              <Area type="monotone" dataKey="revenu" stroke="#10b981" fill="url(#colorRevenu)" strokeWidth={2} />
              <Area type="monotone" dataKey="dépenses" stroke="#f87171" fill="url(#colorDépenses)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Actions rapides</h2>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(({ label, icon: Icon, tab }) => (
              <button
                key={tab}
                onClick={() => onNavigate(tab)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-center"
              >
                <Icon size={20} className="text-emerald-400" />
                <span className="text-xs text-zinc-300">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Today's events + urgent tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
            <Calendar size={14} /> Créneaux aujourd'hui
          </h2>
          {todayItems.length === 0 ? (
            <p className="text-xs text-zinc-600">Aucun créneau aujourd'hui</p>
          ) : (
            <ul className="space-y-2">
              {todayItems.map(e => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-white truncate">{e.title}</span>
                  <span className="text-zinc-500 ml-2 shrink-0">{e.startTime}–{e.endTime}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
            <CheckSquare size={14} /> Tâches urgentes
          </h2>
          {urgentTasks.length === 0 ? (
            <p className="text-xs text-zinc-600">Aucune tâche urgente</p>
          ) : (
            <ul className="space-y-2">
              {urgentTasks.map(t => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'in-progress' ? 'bg-yellow-400' : 'bg-zinc-600'}`} />
                  <span className="text-white truncate">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
