import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Trash2, Edit2, Mail, Phone, Building2, Search, Users } from 'lucide-react'
import { useClients } from '../hooks/useClients'
import { useToast } from '../context/ToastContext'
import { EmptyState } from './ui/EmptyState'
import type { Client } from '../types'

type StatusFilter = 'all' | 'active' | 'lead' | 'inactive'

const STATUS_LABELS: Record<string, string> = { active: 'Actif', lead: 'Prospect', inactive: 'Inactif' }
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  lead: 'bg-yellow-500/20 text-yellow-400',
  inactive: 'bg-zinc-700 text-zinc-400',
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  company: '',
  hourlyRate: 0,
  status: 'active' as 'active' | 'lead' | 'inactive',
  lastContact: new Date().toISOString().split('T')[0],
}

export function Clients() {
  const { clients, addClient, updateClient, deleteClient } = useClients()
  const { toast } = useToast()

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [form, setForm] = useState<Omit<Client, 'id'>>(EMPTY_FORM)

  const openAddModal = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEditModal = (client: Client) => {
    setEditingId(client.id)
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone ?? '',
      company: client.company,
      hourlyRate: client.hourlyRate ?? 0,
      status: client.status,
      lastContact: client.lastContact,
    })
    setShowModal(true)
  }

  useEffect(() => {
    if (!showModal) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showModal])

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    if (editingId) {
      await updateClient(editingId, form)
      toast('Client mis à jour')
    } else {
      await addClient(form)
      toast('Client ajouté')
    }
    setShowModal(false)
  }

  const filtered = clients
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .filter(c =>
      search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-zinc-400 text-sm">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nouveau client
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            placeholder="Rechercher un client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'active', 'lead', 'inactive'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Client cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title="Aucun client"
          description={search ? 'Aucun résultat pour cette recherche.' : 'Ajoutez votre premier client pour commencer.'}
          action={!search ? (
            <button onClick={openAddModal} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
              Nouveau client
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => (
            <div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{client.name}</h3>
                  <p className="text-xs text-zinc-500 truncate">{client.company}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[client.status]}`}>
                    {STATUS_LABELS[client.status]}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Mail size={12} className="shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Phone size={12} className="shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.company && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Building2 size={12} className="shrink-0" />
                    <span className="truncate">{client.company}</span>
                  </div>
                )}
              </div>

              {client.hourlyRate && client.hourlyRate > 0 ? (
                <p className="text-xs text-emerald-400 mb-3">{client.hourlyRate} €/h</p>
              ) : null}

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEditModal(client)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors"
                >
                  <Edit2 size={12} /> Modifier
                </button>
                <button
                  onClick={() => { if (window.confirm(`Supprimer ${client.name} ?`)) { deleteClient(client.id); toast('Client supprimé') } }}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="clients-modal"
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
              className="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">
                  {editingId ? 'Modifier le client' : 'Nouveau client'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-500 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Nom *"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                <input
                  type="email"
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-500 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Email *"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
                <input
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-500 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Entreprise"
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                />
                <input
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-500 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Téléphone"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
                <input
                  type="number"
                  min={0}
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-500 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Taux horaire (€/h)"
                  value={form.hourlyRate || ''}
                  onChange={e => setForm(f => ({ ...f, hourlyRate: Number(e.target.value) }))}
                />
                <select
                  className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 rounded-xl px-3 py-2 text-white text-sm focus:ring-indigo-500 focus:outline-none"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'lead' | 'inactive' }))}
                >
                  <option value="active">Actif</option>
                  <option value="lead">Prospect</option>
                  <option value="inactive">Inactif</option>
                </select>
                <button
                  onClick={handleSave}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {editingId ? 'Mettre à jour' : 'Créer le client'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
