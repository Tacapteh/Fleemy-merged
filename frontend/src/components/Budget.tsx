import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Trash2, TrendingUp, TrendingDown, PiggyBank, Receipt } from 'lucide-react'
import { useBudget } from '../hooks/useBudget'
import { useToast } from '../context/ToastContext'
import { EmptyState } from './ui/EmptyState'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, startOfMonth, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Transaction } from '../types'

type TxType = 'income' | 'expense' | 'savings'

const TYPE_LABELS: Record<TxType, string> = {
  income: 'Revenu',
  expense: 'Dépense',
  savings: 'Épargne',
}

const TYPE_COLORS: Record<TxType, string> = {
  income: 'text-emerald-400',
  expense: 'text-red-400',
  savings: 'text-blue-400',
}

const CATEGORIES = ['Salaire', 'Freelance', 'Loyer', 'Alimentation', 'Transport', 'Abonnement', 'Santé', 'Loisirs', 'Épargne', 'Autre']

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      setValue(Math.round(target * progress))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export function Budget() {
  const { transactions, addTransaction, deleteTransaction } = useBudget()
  const { toast } = useToast()

  const [showForm, setShowForm] = useState(false)
  const [filterType, setFilterType] = useState<TxType | 'all'>('all')

  const [form, setForm] = useState<Omit<Transaction, 'id'>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: 0,
    category: 'Autre',
    type: 'income',
    description: '',
  })

  const today = new Date()
  const monthStart = startOfMonth(today)

  const stats = useMemo(() => {
    const monthTx = transactions.filter(t => parseISO(t.date) >= monthStart)
    const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const savings = monthTx.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0)
    return { income, expense, savings, balance: income - expense - savings }
  }, [transactions, monthStart])

  const animIncome  = useCountUp(stats.income)
  const animExpense = useCountUp(stats.expense)
  const animSavings = useCountUp(stats.savings)
  const animBalance = useCountUp(Math.abs(stats.balance))

  // Category breakdown for chart
  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    transactions
      .filter(t => t.type === 'expense' && parseISO(t.date) >= monthStart)
      .forEach(t => map.set(t.category, (map.get(t.category) ?? 0) + t.amount))
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [transactions, monthStart])

  const filtered = useMemo(() =>
    filterType === 'all' ? transactions : transactions.filter(t => t.type === filterType),
    [transactions, filterType]
  )

  useEffect(() => {
    if (!showForm) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showForm])

  const handleAdd = async () => {
    if (!form.description.trim() || form.amount <= 0) return
    await addTransaction(form)
    toast('Transaction ajoutée')
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), amount: 0, category: 'Autre', type: 'income', description: '' })
    setShowForm(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget</h1>
          <p className="text-zinc-400 text-sm">{format(today, 'MMMM yyyy', { locale: fr })}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Transaction
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenus',  value: animIncome,  icon: TrendingUp,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Dépenses', value: animExpense, icon: TrendingDown, color: 'text-red-400',     bg: 'bg-red-500/10' },
          { label: 'Épargne',  value: animSavings, icon: PiggyBank,    color: 'text-blue-400',    bg: 'bg-blue-500/10' },
          { label: 'Solde net', value: stats.balance >= 0 ? animBalance : -animBalance, icon: TrendingUp, color: stats.balance >= 0 ? 'text-emerald-400' : 'text-red-400', bg: stats.balance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className={`${bg} w-9 h-9 rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className={`text-xl font-bold ${color}`}>{value.toLocaleString('fr-FR')} €</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {categoryData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Dépenses par catégorie (ce mois)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={categoryData}>
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(v) => `${Number(v).toLocaleString('fr-FR')} €`}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} minPointSize={4}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={`hsl(${210 + i * 30}, 70%, 55%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transactions list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Transactions</h2>
          <div className="flex gap-1">
            {(['all', 'income', 'expense', 'savings'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  filterType === type ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {type === 'all' ? 'Tout' : TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-zinc-800 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Receipt size={28} />}
              title="Aucune transaction"
              description="Ajoutez votre première transaction pour suivre vos revenus et dépenses."
            />
          ) : (
            [...filtered].sort((a, b) => b.date.localeCompare(a.date)).map(t => (
              <div key={t.id} className="p-4 flex items-center gap-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{t.description}</span>
                    <span className="text-xs text-zinc-600 shrink-0">{t.category}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{t.date}</p>
                </div>
                <span className={`text-sm font-medium shrink-0 ${TYPE_COLORS[t.type]}`}>
                  {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString('fr-FR')} €
                </span>
                <button
                  onClick={() => { if (window.confirm('Supprimer cette transaction ?')) { deleteTransaction(t.id); toast('Transaction supprimée') } }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add transaction modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="budget-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              className="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6"
            >
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Nouvelle transaction</h3>
                <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-500"
                  placeholder="Description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none rounded-xl px-3 py-2 text-white text-sm"
                  placeholder="Montant (€)"
                  value={form.amount || ''}
                  onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                />
                <select
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none rounded-xl px-3 py-2 text-white text-sm"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as TxType }))}
                >
                  <option value="income">Revenu</option>
                  <option value="expense">Dépense</option>
                  <option value="savings">Épargne</option>
                </select>
                <select
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none rounded-xl px-3 py-2 text-white text-sm"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="date"
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none rounded-xl px-3 py-2 text-white text-sm"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
                <button
                  onClick={handleAdd}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
