import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Calendar, Users, StickyNote, FileText, X } from 'lucide-react'
import { useEvents } from '../hooks/useEvents'
import { useClients } from '../hooks/useClients'
import { useNotes } from '../hooks/useNotes'
import { useDocuments } from '../hooks/useDocuments'

type ResultKind = 'event' | 'client' | 'note' | 'document'
interface SearchResult {
  id: string
  kind: ResultKind
  title: string
  sub?: string
  tab: string
}

const KIND_ICON: Record<ResultKind, JSX.Element> = {
  event:    <Calendar size={13} className="text-indigo-400 shrink-0" />,
  client:   <Users size={13} className="text-blue-400 shrink-0" />,
  note:     <StickyNote size={13} className="text-amber-400 shrink-0" />,
  document: <FileText size={13} className="text-emerald-400 shrink-0" />,
}

function norm(s: string) { return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') }
function matches(query: string, ...fields: (string | undefined)[]) {
  const q = norm(query)
  return fields.some(f => f && norm(f).includes(q))
}

interface Props {
  onNavigate: (tab: string) => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
const KB_LABEL = isMac ? '⌘K' : 'Ctrl+K'

export function GlobalSearch({ onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { events } = useEvents()
  const { clients } = useClients()
  const { notes } = useNotes()
  const { documents } = useDocuments()

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const results = useMemo((): SearchResult[] => {
    if (!query.trim() || query.length < 2) return []
    const out: SearchResult[] = []

    events
      .filter(e => matches(query, e.title, e.clientName, e.date))
      .slice(0, 4)
      .forEach(e => out.push({
        id: e.id, kind: 'event', title: e.title,
        sub: `${e.date} · ${e.startTime}–${e.endTime}${e.clientName ? ' · ' + e.clientName : ''}`,
        tab: 'planning',
      }))

    clients
      .filter(c => matches(query, c.name, c.company, c.email))
      .slice(0, 3)
      .forEach(c => out.push({
        id: c.id, kind: 'client', title: c.name,
        sub: c.company || c.email || undefined,
        tab: 'clients',
      }))

    notes
      .filter(n => matches(query, n.title, n.content))
      .slice(0, 3)
      .forEach(n => out.push({
        id: n.id, kind: 'note', title: n.title,
        sub: n.content?.slice(0, 60) || undefined,
        tab: 'notes',
      }))

    documents
      .filter(d => matches(query, d.clientName, d.type))
      .slice(0, 3)
      .forEach(d => out.push({
        id: d.id, kind: 'document',
        title: `${d.type === 'invoice' ? 'Facture' : 'Devis'} — ${d.clientName}`,
        sub: `${d.date} · ${d.totalAmount.toLocaleString('fr-FR')} €`,
        tab: 'documents',
      }))

    return out
  }, [query, events, clients, notes, documents])

  const pick = (r: SearchResult) => {
    onNavigate(r.tab)
    setOpen(false)
  }

  return (
    <>
      {/* Trigger button in sidebar */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all duration-150 group"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-600 group-hover:bg-zinc-700 border border-zinc-700 font-mono">
          {KB_LABEL}
        </kbd>
      </button>

      {/* Modal overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] px-4"
          >
            <motion.div
              ref={containerRef}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
                <Search size={16} className="text-zinc-500 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Rechercher un créneau, client, note, document…"
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-zinc-600 hover:text-zinc-400">
                    <X size={14} />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-600 border border-zinc-700 font-mono">
                  Esc
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {query.length >= 2 && results.length === 0 && (
                  <p className="text-center text-xs text-zinc-600 py-8">Aucun résultat pour « {query} »</p>
                )}
                {query.length < 2 && (
                  <p className="text-center text-xs text-zinc-700 py-8">Saisissez au moins 2 caractères</p>
                )}
                {results.map(r => (
                  <button
                    key={r.id + r.kind}
                    onClick={() => pick(r)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/60 transition-colors text-left border-b border-zinc-800/40 last:border-0"
                  >
                    <span className="mt-0.5">{KIND_ICON[r.kind]}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{r.title}</p>
                      {r.sub && <p className="text-xs text-zinc-500 truncate mt-0.5">{r.sub}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
