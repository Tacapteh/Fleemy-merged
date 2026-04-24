import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Trash2, FileText, Download, Send, ListChecks } from 'lucide-react'
import { useDocuments } from '../hooks/useDocuments'
import { useClients } from '../hooks/useClients'
import { useTasks } from '../hooks/useTasks'
import { useToast } from '../context/ToastContext'
import { EmptyState } from './ui/EmptyState'
import { apiClient } from '../services/api'
import type { Document as FleemyDocument, DocumentItem } from '../types'

type DocStatus = FleemyDocument['status']
type DocType = FleemyDocument['type']

const STATUS_COLORS: Record<DocStatus, string> = {
  draft: 'bg-zinc-700 text-zinc-300',
  sent: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-emerald-500/20 text-emerald-400',
  accepted: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
  overdue: 'bg-orange-500/20 text-orange-400',
}

const STATUS_LABELS: Record<DocStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  paid: 'Payé',
  accepted: 'Accepté',
  rejected: 'Refusé',
  overdue: 'En retard',
}

const EMPTY_ITEM: DocumentItem = { description: '', quantity: 1, unitPrice: 0, taxRate: 20 }

export function Documents() {
  const { documents, addDocument, updateDocument, deleteDocument } = useDocuments()
  const { clients } = useClients()
  const { tasks } = useTasks()
  const { toast } = useToast()

  const [showModal, setShowModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState<FleemyDocument | null>(null)
  const [filterType, setFilterType] = useState<DocType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<DocStatus | 'all'>('all')

  // Import from tasks modal state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importDocType, setImportDocType] = useState<DocType>('invoice')
  const [importClientId, setImportClientId] = useState('')
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set())

  const billableTaskGroups = useMemo(() => {
    const map = new Map<string, { title: string; count: number; totalAmount: number }>()
    for (const t of tasks) {
      if (t.montantTache === undefined || t.montantTache <= 0) continue
      const existing = map.get(t.title)
      if (existing) {
        existing.count++
        existing.totalAmount += t.montantTache
      } else {
        map.set(t.title, { title: t.title, count: 1, totalAmount: t.montantTache })
      }
    }
    return Array.from(map.values())
  }, [tasks])

  const handleImportCreate = async () => {
    if (!importClientId || importSelected.size === 0) return
    const client = clients.find(c => c.id === importClientId)
    const items: DocumentItem[] = billableTaskGroups
      .filter(g => importSelected.has(g.title))
      .map(g => ({
        description: g.title,
        quantity: g.count,
        unitPrice: parseFloat((g.totalAmount / g.count).toFixed(2)),
        taxRate: 20,
      }))
    const totalAmount = items.reduce((s, it) => s + it.quantity * it.unitPrice * (1 + it.taxRate / 100), 0)
    await addDocument({
      type: importDocType,
      clientId: importClientId,
      clientName: client?.name ?? '',
      items,
      status: 'draft',
      date: new Date().toISOString().split('T')[0],
      totalAmount,
    })
    toast('Document importé depuis les tâches')
    setShowImportModal(false)
    setImportSelected(new Set())
    setImportClientId('')
  }

  const [form, setForm] = useState<{
    type: DocType
    clientId: string
    date: string
    dueDate: string
    notes: string
    items: DocumentItem[]
  }>({
    type: 'invoice',
    clientId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    items: [{ ...EMPTY_ITEM }],
  })

  const totalAmount = useMemo(() =>
    form.items.reduce((sum, item) => {
      const ht = item.quantity * item.unitPrice
      const ttc = ht * (1 + item.taxRate / 100)
      return sum + ttc
    }, 0),
    [form.items]
  )

  const handleAddItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))
  const handleRemoveItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  const handleItemChange = (i: number, field: keyof DocumentItem, value: string | number) =>
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item) }))

  useEffect(() => {
    const open = showModal || !!editingDoc
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowModal(false); setEditingDoc(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showModal, editingDoc])

  const handleSave = async () => {
    if (!form.clientId || form.items.length === 0) return
    const client = clients.find(c => c.id === form.clientId)
    await addDocument({
      type: form.type,
      clientId: form.clientId,
      clientName: client?.name ?? '',
      items: form.items,
      status: 'draft',
      date: form.date,
      dueDate: form.dueDate || undefined,
      notes: form.notes || undefined,
      totalAmount,
    })
    toast('Document créé')
    setShowModal(false)
    setForm({ type: 'invoice', clientId: '', date: new Date().toISOString().split('T')[0], dueDate: '', notes: '', items: [{ ...EMPTY_ITEM }] })
  }

  const downloadPdf = async (doc: FleemyDocument) => {
    try {
      const response = await apiClient.post(`/documents/${doc.id}/pdf`, {}, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.type}-${doc.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast('PDF téléchargé')
    } catch {
      toast('Backend non disponible — PDF impossible', 'error')
    }
  }

  const sendByEmail = async (doc: FleemyDocument) => {
    try {
      await apiClient.post(`/documents/${doc.id}/send-email`)
      await updateDocument(doc.id, { status: 'sent' })
      toast('Email envoyé')
    } catch {
      toast('Backend non disponible — email impossible', 'error')
    }
  }

  const filtered = useMemo(() => {
    let list = documents
    if (filterType !== 'all') list = list.filter(d => d.type === filterType)
    if (filterStatus !== 'all') list = list.filter(d => d.status === filterStatus)
    return [...list].sort((a, b) => b.date.localeCompare(a.date))
  }, [documents, filterType, filterStatus])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-zinc-400 text-sm">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nouveau
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(['all', 'invoice', 'quote'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {t === 'all' ? 'Tout' : t === 'invoice' ? 'Factures' : 'Devis'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {s === 'all' ? 'Tous statuts' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Documents list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText size={32} />}
          title="Aucun document"
          description="Créez votre première facture ou votre premier devis."
          action={
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
              Nouveau document
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div key={doc.id} onClick={() => setEditingDoc(doc)} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 group cursor-pointer hover:border-zinc-700 transition-colors">
              <FileText size={18} className="text-zinc-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">
                    {doc.type === 'invoice' ? 'Facture' : 'Devis'} — {doc.clientName}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[doc.status]}`}>
                    {STATUS_LABELS[doc.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-zinc-500">{doc.date}</span>
                  <span className="text-xs font-medium text-emerald-400">{doc.totalAmount.toLocaleString('fr-FR')} €</span>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={() => downloadPdf(doc)} title="Télécharger PDF"
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                  <Download size={14} />
                </button>
                <button onClick={() => sendByEmail(doc)} title="Envoyer par email"
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                  <Send size={14} />
                </button>
                <select
                  className="bg-zinc-800 ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none rounded-xl px-2 py-1 text-xs text-zinc-300"
                  value={doc.status}
                  onChange={e => { updateDocument(doc.id, { status: e.target.value as DocStatus }); toast('Statut mis à jour') }}
                >
                  {(Object.keys(STATUS_LABELS) as DocStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (window.confirm('Supprimer ce document définitivement ?')) { deleteDocument(doc.id); toast('Document supprimé') } }}
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
            key="docs-create-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Nouveau document</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Type</label>
                  <select className="w-full bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-3 py-2 text-white text-sm focus:ring-indigo-500 focus:outline-none"
                    value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DocType }))}>
                    <option value="invoice">Facture</option>
                    <option value="quote">Devis</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Client *</label>
                  <select className="w-full bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-3 py-2 text-white text-sm focus:ring-indigo-500 focus:outline-none"
                    value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                    <option value="">Sélectionner un client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Date</label>
                  <input type="date" className="w-full bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-3 py-2 text-white text-sm focus:ring-indigo-500 focus:outline-none"
                    value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Échéance</label>
                  <input type="date" className="w-full bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-3 py-2 text-white text-sm focus:ring-indigo-500 focus:outline-none"
                    value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-500">Lignes</label>
                  <button onClick={handleAddItem} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                    <Plus size={12} /> Ajouter une ligne
                  </button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input className="col-span-4 bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-2 py-1.5 text-white text-xs focus:ring-indigo-500 focus:outline-none"
                        placeholder="Description" value={item.description}
                        onChange={e => handleItemChange(i, 'description', e.target.value)} />
                      <input type="number" min={1} className="col-span-2 bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-2 py-1.5 text-white text-xs focus:ring-indigo-500 focus:outline-none"
                        placeholder="Qté" value={item.quantity}
                        onChange={e => handleItemChange(i, 'quantity', Number(e.target.value))} />
                      <input type="number" min={0} className="col-span-3 bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-2 py-1.5 text-white text-xs focus:ring-indigo-500 focus:outline-none"
                        placeholder="PU HT (€)" value={item.unitPrice || ''}
                        onChange={e => handleItemChange(i, 'unitPrice', Number(e.target.value))} />
                      <input type="number" min={0} max={100} className="col-span-2 bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-2 py-1.5 text-white text-xs focus:ring-indigo-500 focus:outline-none"
                        placeholder="TVA%" value={item.taxRate}
                        onChange={e => handleItemChange(i, 'taxRate', Number(e.target.value))} />
                      <button onClick={() => handleRemoveItem(i)} className="col-span-1 flex justify-center text-zinc-600 hover:text-red-400 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-2">
                  <span className="text-sm font-medium text-emerald-400">Total TTC : {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
              </div>

              <textarea className="w-full bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-3 py-2 text-white text-sm placeholder-zinc-500 focus:ring-indigo-500 focus:outline-none resize-none"
                rows={2} placeholder="Notes (optionnel)"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

              <button onClick={handleSave}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors">
                Créer le document
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Edit / view modal */}
      <AnimatePresence>
        {editingDoc && (
          <motion.div
            key="docs-edit-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setEditingDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">
                {editingDoc.type === 'invoice' ? 'Facture' : 'Devis'} — {editingDoc.clientName}
              </h3>
              <button onClick={() => setEditingDoc(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Montant TTC</span>
                <span className="font-semibold text-emerald-400">{editingDoc.totalAmount.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Date</span>
                <span className="text-white">{editingDoc.date}</span>
              </div>
              {editingDoc.dueDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Échéance</span>
                  <span className="text-white">{editingDoc.dueDate}</span>
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Statut</label>
                <select
                  className="w-full bg-zinc-800 rounded-xl ring-2 ring-zinc-700/50 px-3 py-2 text-white text-sm focus:ring-indigo-500 focus:outline-none"
                  value={editingDoc.status}
                  onChange={e => {
                    const s = e.target.value as DocStatus
                    updateDocument(editingDoc.id, { status: s })
                    setEditingDoc({ ...editingDoc, status: s })
                    toast('Statut mis à jour')
                  }}
                >
                  {(Object.keys(STATUS_LABELS) as DocStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              {editingDoc.notes && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Notes</p>
                  <p className="text-sm text-zinc-300 bg-zinc-800 rounded-lg px-3 py-2">{editingDoc.notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { downloadPdf(editingDoc); setEditingDoc(null) }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors">
                  <Download size={14} /> PDF
                </button>
                <button onClick={() => { sendByEmail(editingDoc); setEditingDoc(null) }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors">
                  <Send size={14} /> Email
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
