import { useState, useMemo } from 'react'
import { Plus, X, ChevronLeft, ChevronRight, Trash2, Clock, Flag, Calendar } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'
import { useClients } from '../hooks/useClients'
import { useToast } from '../context/ToastContext'
import { EmptyState } from './ui/EmptyState'
import { format, addDays, startOfWeek, parseISO, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { TaskItem, EventItem } from '../types'

type ViewMode = 'week' | 'month'

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-500/20 border-red-500/50 text-red-300',
  2: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
  3: 'bg-zinc-700/50 border-zinc-600 text-zinc-300',
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  'in-progress': 'En cours',
  done: 'Terminé',
}

export function Planning() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks()
  const { events, addEvent, deleteEvent } = useEvents()
  const { clients } = useClients()
  const { toast } = useToast()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('week')
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'task' | 'event'>('task')
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

  const [taskForm, setTaskForm] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    priority: 2 as 1 | 2 | 3,
    status: 'todo' as 'todo' | 'in-progress' | 'done',
    description: '',
  })

  const [eventForm, setEventForm] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    clientId: '',
    isBillable: true,
    paymentStatus: 'unpaid' as 'paid' | 'unpaid' | 'pending' | 'not-worked',
  })

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { locale: fr })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [currentDate])

  const weekTasks = useMemo(() =>
    tasks.filter(t => weekDays.some(d => isSameDay(parseISO(t.date), d))),
    [tasks, weekDays]
  )

  const weekEvents = useMemo(() =>
    events.filter(e => weekDays.some(d => isSameDay(parseISO(e.date), d))),
    [events, weekDays]
  )

  const openModal = (type: 'task' | 'event', date?: string) => {
    const d = date ?? format(new Date(), 'yyyy-MM-dd')
    setModalType(type)
    setSelectedDate(d)
    if (type === 'task') setTaskForm(f => ({ ...f, date: d }))
    else setEventForm(f => ({ ...f, date: d }))
    setShowModal(true)
  }

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) return
    await addTask({
      ...taskForm,
      type: 'task',
      progress: 0,
      tags: [],
    } as Omit<TaskItem, 'id'>)
    toast('Tâche créée')
    setShowModal(false)
    setTaskForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '10:00', priority: 2, status: 'todo', description: '' })
  }

  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) return
    const client = clients.find(c => c.id === eventForm.clientId)
    await addEvent({
      ...eventForm,
      type: 'event',
      clientName: client?.name,
    } as Omit<EventItem, 'id'>)
    toast('Créneau créé')
    setShowModal(false)
    setEventForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '10:00', clientId: '', isBillable: true, paymentStatus: 'unpaid' })
  }

  const prevWeek = () => setCurrentDate(d => addDays(d, -7))
  const nextWeek = () => setCurrentDate(d => addDays(d, 7))

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planning</h1>
          <p className="text-zinc-400 text-sm">
            Semaine du {format(weekDays[0], 'd MMM', { locale: fr })} au {format(weekDays[6], 'd MMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
            Aujourd'hui
          </button>
          <button onClick={nextWeek} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => openModal('task')}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Tâche
          </button>
          <button
            onClick={() => openModal('event')}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Créneau
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const dayTasks = weekTasks.filter(t => isSameDay(parseISO(t.date), day))
          const dayEvents = weekEvents.filter(e => isSameDay(parseISO(e.date), day))
          const isToday = isSameDay(day, new Date())

          return (
            <div key={dateStr} className="min-h-40">
              <div className={`text-center py-2 rounded-t-lg text-xs font-medium ${isToday ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500'}`}>
                <div>{format(day, 'EEE', { locale: fr }).toUpperCase()}</div>
                <div className={`text-lg font-bold mt-0.5 ${isToday ? 'text-emerald-400' : 'text-white'}`}>
                  {format(day, 'd')}
                </div>
              </div>
              <div
                className="min-h-32 bg-zinc-900 border border-zinc-800 rounded-b-lg p-2 space-y-1 cursor-pointer hover:border-zinc-700 transition-colors"
                onClick={() => openModal('task', dateStr)}
              >
                {dayEvents.map(e => (
                  <div
                    key={e.id}
                    onClick={ev => { ev.stopPropagation(); }}
                    className="px-2 py-1 rounded text-xs bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-between group"
                  >
                    <span className="truncate">{e.startTime} {e.title}</span>
                    <button
                      onClick={ev => { ev.stopPropagation(); deleteEvent(e.id); toast('Créneau supprimé') }}
                      className="opacity-0 group-hover:opacity-100 ml-1 shrink-0"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {dayTasks.map(t => (
                  <div
                    key={t.id}
                    onClick={ev => ev.stopPropagation()}
                    className={`px-2 py-1 rounded text-xs border flex items-center justify-between group ${PRIORITY_COLORS[t.priority]}`}
                  >
                    <span className="truncate">{t.title}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 ml-1">
                      {t.status !== 'done' && (
                        <button onClick={() => { updateTask(t.id, { status: 'done' }); toast('Tâche terminée') }} title="Marquer terminé">
                          ✓
                        </button>
                      )}
                      <button onClick={() => { deleteTask(t.id); toast('Tâche supprimée') }}>
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Task list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Toutes les tâches</h2>
          <span className="text-xs text-zinc-500">{tasks.filter(t => t.status !== 'done').length} en attente</span>
        </div>
        <div className="divide-y divide-zinc-800">
          {tasks.length === 0 ? (
            <EmptyState
              icon={<Calendar size={32} />}
              title="Aucune tâche"
              description="Cliquez sur une case du calendrier ou sur « Tâche » pour commencer."
            />
          ) : (
            tasks.map(t => (
              <div key={t.id} className="p-4 flex items-center gap-3 group">
                <button
                  onClick={() => { const next = t.status === 'done' ? 'todo' : 'done'; updateTask(t.id, { status: next }); if (next === 'done') toast('Tâche terminée') }}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    t.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-600 hover:border-emerald-500'
                  }`}
                >
                  {t.status === 'done' && <span className="text-xs">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${t.status === 'done' ? 'line-through text-zinc-600' : 'text-white'}`}>
                    {t.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock size={10} /> {t.date}
                    </span>
                    <span className={`text-xs flex items-center gap-1 ${
                      t.priority === 1 ? 'text-red-400' : t.priority === 2 ? 'text-yellow-400' : 'text-zinc-500'
                    }`}>
                      <Flag size={10} /> {t.priority === 1 ? 'Urgent' : t.priority === 2 ? 'Normal' : 'Faible'}
                    </span>
                    <span className="text-xs text-zinc-600">{STATUS_LABELS[t.status]}</span>
                  </div>
                </div>
                <button
                  onClick={() => { deleteTask(t.id); toast('Tâche supprimée') }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setModalType('task')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${modalType === 'task' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
                >
                  Tâche
                </button>
                <button
                  onClick={() => setModalType('event')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${modalType === 'event' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-white'}`}
                >
                  Créneau
                </button>
              </div>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {modalType === 'task' ? (
              <div className="space-y-3">
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  placeholder="Titre de la tâche"
                  value={taskForm.title}
                  onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                />
                <input type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  value={taskForm.date} onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                    value={taskForm.startTime} onChange={e => setTaskForm(f => ({ ...f, startTime: e.target.value }))} />
                  <input type="time" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                    value={taskForm.endTime} onChange={e => setTaskForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
                <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: Number(e.target.value) as 1|2|3 }))}>
                  <option value={1}>🔴 Urgent</option>
                  <option value={2}>🟡 Normal</option>
                  <option value={3}>⚪ Faible</option>
                </select>
                <textarea className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
                  rows={2} placeholder="Description (optionnel)"
                  value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
                <button onClick={handleSaveTask}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Créer la tâche
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  placeholder="Titre du créneau"
                  value={eventForm.title}
                  onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                />
                <input type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    value={eventForm.startTime} onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))} />
                  <input type="time" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    value={eventForm.endTime} onChange={e => setEventForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
                <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={eventForm.clientId} onChange={e => setEventForm(f => ({ ...f, clientId: e.target.value }))}>
                  <option value="">Aucun client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" className="accent-blue-500" checked={eventForm.isBillable}
                    onChange={e => setEventForm(f => ({ ...f, isBillable: e.target.checked }))} />
                  Facturable
                </label>
                <button onClick={handleSaveEvent}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Créer le créneau
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
