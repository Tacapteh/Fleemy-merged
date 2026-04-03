import { useState, useMemo } from 'react'
import { Plus, X, Trash2, Search, Flag, CheckSquare, Square, StickyNote } from 'lucide-react'
import { useNotes } from '../hooks/useNotes'
import { useToast } from '../context/ToastContext'
import { EmptyState } from './ui/EmptyState'
import type { Note } from '../types'

type FilterType = 'all' | 'done' | 'pending'

const PRIORITY_LABEL: Record<number, string> = { 1: 'Haute', 2: 'Normale', 3: 'Faible' }
const PRIORITY_COLOR: Record<number, string> = {
  1: 'text-red-400',
  2: 'text-yellow-400',
  3: 'text-zinc-500',
}

export function Notes() {
  const { notes, addNote, updateNote, deleteNote } = useNotes()
  const { toast } = useToast()

  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 2 as 1 | 2 | 3,
    tags: '',
    isDone: false,
    date: new Date().toISOString().split('T')[0],
  })

  const openAdd = () => {
    setEditingId(null)
    setForm({ title: '', content: '', priority: 2, tags: '', isDone: false, date: new Date().toISOString().split('T')[0] })
    setShowForm(true)
  }

  const openEdit = (note: Note) => {
    setEditingId(note.id)
    setForm({
      title: note.title,
      content: note.content,
      priority: note.priority,
      tags: (note.tags ?? []).join(', '),
      isDone: note.isDone,
      date: note.date,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    const data: Omit<Note, 'id'> = {
      title: form.title,
      content: form.content,
      priority: form.priority,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      isDone: form.isDone,
      date: form.date,
    }
    if (editingId) {
      await updateNote(editingId, data)
      toast('Note mise à jour')
    } else {
      await addNote(data)
      toast('Note créée')
    }
    setShowForm(false)
  }

  const filtered = useMemo(() => {
    let list = notes
    if (filter === 'done') list = list.filter(n => n.isDone)
    if (filter === 'pending') list = list.filter(n => !n.isDone)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(s) ||
        n.content.toLowerCase().includes(s) ||
        (n.tags ?? []).some(t => t.toLowerCase().includes(s))
      )
    }
    return [...list].sort((a, b) => a.priority - b.priority)
  }, [notes, filter, search])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notes</h1>
          <p className="text-zinc-400 text-sm">
            {notes.filter(n => !n.isDone).length} note{notes.filter(n => !n.isDone).length !== 1 ? 's' : ''} en attente
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nouvelle note
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'pending', 'done'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f === 'all' ? 'Tout' : f === 'pending' ? 'En cours' : 'Terminé'}
            </button>
          ))}
        </div>
      </div>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<StickyNote size={32} />}
          title="Aucune note"
          description="Créez votre première note pour garder une trace de vos idées."
          action={
            <button onClick={openAdd} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
              Nouvelle note
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(note => (
            <div
              key={note.id}
              className={`bg-zinc-900 border rounded-xl p-4 group cursor-pointer transition-colors ${
                note.isDone ? 'border-zinc-800 opacity-60' : 'border-zinc-800 hover:border-zinc-700'
              }`}
              onClick={() => openEdit(note)}
            >
              <div className="flex items-start justify-between mb-2">
                <button
                  onClick={e => { e.stopPropagation(); updateNote(note.id, { isDone: !note.isDone }); toast(note.isDone ? 'Note réouverte' : 'Note terminée') }}
                  className="shrink-0 mr-2 text-zinc-500 hover:text-emerald-400 transition-colors"
                >
                  {note.isDone ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} />}
                </button>
                <h3 className={`flex-1 text-sm font-semibold min-w-0 truncate ${note.isDone ? 'line-through text-zinc-600' : 'text-white'}`}>
                  {note.title}
                </h3>
                <button
                  onClick={e => { e.stopPropagation(); if (window.confirm('Supprimer cette note ?')) { deleteNote(note.id); toast('Note supprimée') } }}
                  className="opacity-0 group-hover:opacity-100 ml-2 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {note.content && (
                <p className="text-xs text-zinc-500 line-clamp-3 mb-3 ml-6">{note.content}</p>
              )}

              <div className="flex items-center justify-between ml-6">
                <div className="flex flex-wrap gap-1">
                  {(note.tags ?? []).map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
                <span className={`text-xs flex items-center gap-1 shrink-0 ${PRIORITY_COLOR[note.priority]}`}>
                  <Flag size={10} /> {PRIORITY_LABEL[note.priority]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">
                {editingId ? 'Modifier la note' : 'Nouvelle note'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                placeholder="Titre *"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
              <textarea
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
                rows={4}
                placeholder="Contenu..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              />
              <select
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) as 1|2|3 }))}
              >
                <option value={1}>🔴 Haute priorité</option>
                <option value={2}>🟡 Priorité normale</option>
                <option value={3}>⚪ Faible priorité</option>
              </select>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                placeholder="Tags (séparés par des virgules)"
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-emerald-500"
                  checked={form.isDone}
                  onChange={e => setForm(f => ({ ...f, isDone: e.target.checked }))}
                />
                Marquer comme terminée
              </label>
              <button
                onClick={handleSave}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {editingId ? 'Mettre à jour' : 'Créer la note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
