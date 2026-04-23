import { useState, useMemo, useRef, useCallback } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, X, Check,
  AlertCircle, AlertTriangle, CheckCircle2,
  Briefcase, Code2, Phone, Mail, Star, Target, Zap, Users, FileText,
  Pencil, Home, BookOpen, Calendar, Sun, ShoppingBag, Layers,
  type LucideIcon,
} from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'
import { useClients } from '../hooks/useClients'
import { useToast } from '../context/ToastContext'
import {
  format, addDays, addWeeks, addMonths,
  startOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isSameMonth,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { TaskItem, EventItem } from '../types'

type ViewMode = 'day' | 'week' | 'month'

// ─── Time grid constants ─────────────────────────────────────────────────────
const HOUR_H = 64
const DAY_START = 7
const DAY_END = 21
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => i + DAY_START)

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function toPx(min: number) { return ((min - DAY_START * 60) / 60) * HOUR_H }
function pxToMin(px: number) {
  const raw = (px / HOUR_H) * 60 + DAY_START * 60
  return Math.max(DAY_START * 60, Math.min((DAY_END - 1) * 60, Math.round(raw / 60) * 60))
}
function toTimeStr(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function overlaps(a: { s: number; e: number }, b: { s: number; e: number }) {
  return a.s < b.e && a.e > b.s
}

// ─── Icon & color sets ───────────────────────────────────────────────────────
interface IconDef { key: string; Icon: LucideIcon }
export const TASK_ICONS: IconDef[] = [
  { key: 'briefcase', Icon: Briefcase }, { key: 'code', Icon: Code2 },
  { key: 'phone', Icon: Phone },         { key: 'mail', Icon: Mail },
  { key: 'star', Icon: Star },           { key: 'target', Icon: Target },
  { key: 'zap', Icon: Zap },             { key: 'users', Icon: Users },
  { key: 'file', Icon: FileText },       { key: 'pen', Icon: Pencil },
  { key: 'home', Icon: Home },           { key: 'book', Icon: BookOpen },
  { key: 'shop', Icon: ShoppingBag },    { key: 'layers', Icon: Layers },
]
const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(TASK_ICONS.map(({ key, Icon }) => [key, Icon]))

export const TASK_COLORS = [
  '#10b981', '#6366f1', '#f43f5e', '#f59e0b',
  '#06b6d4', '#a855f7', '#f97316', '#0ea5e9',
]

const PRIORITY_ICON: Record<number, JSX.Element> = {
  1: <AlertCircle size={9} className="text-red-400 shrink-0" />,
  2: <AlertTriangle size={9} className="text-amber-400 shrink-0" />,
  3: <CheckCircle2 size={9} className="text-emerald-400 shrink-0" />,
}

const PAYMENT_STYLE: Record<string, { border: string; bg: string; title: string; sub: string }> = {
  paid:        { border: '#10b981', bg: 'linear-gradient(160deg,#022c22,#064e3b)', title: '#6ee7b7', sub: '#34d399' },
  unpaid:      { border: '#ef4444', bg: 'linear-gradient(160deg,#1c0707,#450a0a)', title: '#fca5a5', sub: '#f87171' },
  pending:     { border: '#f59e0b', bg: 'linear-gradient(160deg,#1c1007,#451a03)', title: '#fcd34d', sub: '#fbbf24' },
  'not-worked':{ border: '#3f3f46', bg: 'rgba(63,63,70,0.12)',                    title: '#a1a1aa', sub: '#71717a' },
}

// ─── Drag state ──────────────────────────────────────────────────────────────
interface DragInfo { id: string; kind: 'task' | 'event'; offsetMin: number; durationMin: number }

// ─── TimeGrid ────────────────────────────────────────────────────────────────
interface GridProps {
  days: Date[]
  tasks: TaskItem[]
  events: EventItem[]
  nowPx: number
  showNow: boolean
  onDayClick: (day: Date, minutes: number) => void
  onDeleteTask: (id: string) => void
  onCompleteTask: (id: string) => void
  onDeleteEvent: (id: string) => void
  onDragStart: (e: React.DragEvent, item: TaskItem | EventItem) => void
  onDrop: (e: React.DragEvent, day: Date) => void
  onEditTask: (task: TaskItem) => void
  onEditEvent: (ev: EventItem) => void
}

function TimeGrid({ days, tasks, events, nowPx, showNow, onDayClick, onDeleteTask, onCompleteTask, onDeleteEvent, onDragStart, onDrop, onEditTask, onEditEvent }: GridProps) {
  const totalH = HOURS.length * HOUR_H
  const isToday = (d: Date) => isSameDay(d, new Date())

  return (
    <div className="flex" style={{ minHeight: totalH + 48 }}>
      {/* Hour labels */}
      <div className="w-14 shrink-0 select-none" style={{ paddingTop: 48 }}>
        {HOURS.map(h => (
          <div key={h} style={{ height: HOUR_H }} className="flex items-start justify-end pr-3">
            <span className="text-[10px] text-zinc-700 font-mono -translate-y-2">
              {String(h).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto">
        {/* Day headers */}
        <div className="grid sticky top-0 z-20 border-b border-[#1a1a1f]"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, background: '#0a0a0d' }}>
          {days.map((day, i) => (
            <div key={i} className={`flex flex-col items-center justify-center py-2.5 border-r border-[#1a1a1f] last:border-r-0 ${isToday(day) ? 'bg-emerald-500/5' : ''}`}>
              <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                {format(day, 'EEE', { locale: fr })}
              </span>
              <span className={`text-base font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-emerald-500 text-white' : 'text-zinc-300'}`}>
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="grid relative" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, height: totalH }}>
          {days.map((day, di) => {
            const ds = format(day, 'yyyy-MM-dd')
            const dayTasks = tasks.filter(t => t.date === ds)
            const dayEvents = events.filter(e => e.date === ds)

            return (
              <div key={di}
                className={`relative border-r border-[#1a1a1f] last:border-r-0 cursor-crosshair ${isToday(day) ? 'bg-emerald-500/[0.015]' : ''}`}
                style={{ height: totalH }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDrop={e => onDrop(e, day)}
                onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); onDayClick(day, pxToMin(e.clientY - rect.top)) }}
              >
                {/* Grid lines */}
                {HOURS.map(h => (
                  <div key={h}>
                    <div className="absolute w-full border-t border-[#1a1a1f]" style={{ top: (h - DAY_START) * HOUR_H }} />
                    <div className="absolute w-full border-t border-[#141418]" style={{ top: (h - DAY_START) * HOUR_H + HOUR_H / 2 }} />
                  </div>
                ))}

                {/* Now indicator */}
                {isToday(day) && showNow && (
                  <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: nowPx }}>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] -ml-1 shrink-0" />
                    <div className="flex-1 h-px bg-emerald-400/50" />
                  </div>
                )}

                {/* Event pills */}
                {dayEvents.map(ev => {
                  const ps = PAYMENT_STYLE[ev.paymentStatus] ?? PAYMENT_STYLE['not-worked']
                  const top = toPx(toMin(ev.startTime ?? '09:00'))
                  const h = Math.max(22, toPx(toMin(ev.endTime ?? '10:00')) - top)
                  const evRange = { s: toMin(ev.startTime ?? '09:00'), e: toMin(ev.endTime ?? '10:00') }
                  const overlapTasks = dayTasks.filter(t =>
                    t.status !== 'done' && overlaps(evRange, { s: toMin(t.startTime ?? '09:00'), e: toMin(t.endTime ?? '10:00') })
                  ).slice(0, 3)

                  return (
                    <div key={ev.id} draggable
                      onDragStart={e => { e.stopPropagation(); onDragStart(e, ev) }}
                      onClick={e => { e.stopPropagation(); onEditEvent(ev) }}
                      className="absolute left-1 right-1 rounded-lg overflow-hidden cursor-pointer group select-none z-10"
                      style={{ top: top + 1, height: h - 2, background: ps.bg, borderLeft: `3px solid ${ps.border}`, boxShadow: `0 1px 8px ${ps.border}30` }}
                    >
                      <div className="px-2 py-1 h-full relative">
                        <p className="text-[11px] font-semibold truncate leading-tight" style={{ color: ps.title }}>{ev.title}</p>
                        {h > 32 && <p className="text-[9px] mt-0.5" style={{ color: ps.sub }}>{ev.startTime}–{ev.endTime}</p>}

                        {/* Overlapping task icons */}
                        {overlapTasks.length > 0 && h > 28 && (
                          <div className="absolute bottom-1 right-1 flex gap-0.5">
                            {overlapTasks.map(t => {
                              const TaskIconCmp = t.icon ? ICON_MAP[t.icon] : null
                              const ic = t.color || '#6366f1'
                              return (
                                <div key={t.id} className="w-4 h-4 rounded flex items-center justify-center" style={{ background: ic + '30', border: `1px solid ${ic}60` }}>
                                  {TaskIconCmp ? <TaskIconCmp size={8} style={{ color: ic }} /> : <Layers size={8} style={{ color: ic }} />}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        <button onClick={e => { e.stopPropagation(); onDeleteEvent(ev.id) }}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-4 h-4 rounded bg-black/40 flex items-center justify-center transition-opacity"
                          style={{ color: ps.title }}>
                          <X size={8} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Task pills */}
                {dayTasks.map(task => {
                  const top = toPx(toMin(task.startTime ?? '09:00'))
                  const h = Math.max(22, toPx(toMin(task.endTime ?? '10:00')) - top)
                  const done = task.status === 'done'
                  const taskColor = task.color || (task.priority === 1 ? '#ef4444' : task.priority === 2 ? '#f59e0b' : '#10b981')
                  const TaskIconCmp = task.icon ? ICON_MAP[task.icon] : null

                  return (
                    <div key={task.id} draggable={!done}
                      onDragStart={e => { e.stopPropagation(); if (!done) onDragStart(e, task) }}
                      onClick={e => { e.stopPropagation(); if (!done) onEditTask(task) }}
                      className={`absolute left-1 right-1 rounded-lg overflow-hidden select-none z-10 group flex ${done ? 'opacity-40' : 'cursor-pointer'}`}
                      style={{ top: top + 1, height: h - 2, background: taskColor + '12', borderLeft: `3px solid ${taskColor}` }}
                    >
                      {/* Icon strip */}
                      <div className="flex items-start pt-1 pl-1 shrink-0">
                        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: taskColor + '25' }}>
                          {TaskIconCmp
                            ? <TaskIconCmp size={10} style={{ color: taskColor }} />
                            : <div className="w-1.5 h-1.5 rounded-full" style={{ background: taskColor }} />
                          }
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 px-1.5 py-1 min-w-0">
                        <p className={`text-[11px] font-semibold truncate leading-tight ${done ? 'line-through text-zinc-600' : 'text-zinc-100'}`}>
                          {task.title}
                        </p>
                        {h > 32 && <p className="text-[9px] text-zinc-600 mt-0.5">{task.startTime}–{task.endTime}</p>}
                      </div>

                      {/* Priority indicator */}
                      <div className="absolute top-1 right-1 flex items-center gap-0.5">
                        <span className="opacity-0 group-hover:opacity-0">{/* spacer */}</span>
                        {!done && PRIORITY_ICON[task.priority ?? 3]}
                      </div>

                      {/* Hover actions */}
                      <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!done && (
                          <button onClick={e => { e.stopPropagation(); onCompleteTask(task.id) }}
                            className="w-4 h-4 rounded bg-emerald-500/30 flex items-center justify-center text-emerald-300">
                            <Check size={7} />
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); onDeleteTask(task.id) }}
                          className="w-4 h-4 rounded bg-black/40 flex items-center justify-center text-zinc-400">
                          <X size={7} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── MonthView ────────────────────────────────────────────────────────────────
interface MonthProps {
  days: Date[]
  refDate: Date
  tasks: TaskItem[]
  events: EventItem[]
  onEditTask: (task: TaskItem) => void
  onEditEvent: (ev: EventItem) => void
  onNavigateWeek: (day: Date) => void
  onNavigateDay: (day: Date) => void
  onCreateEvent: (day: Date) => void
}

function MonthView({ days, refDate, tasks, events, onEditTask, onEditEvent, onNavigateWeek, onNavigateDay, onCreateEvent }: MonthProps) {
  const today = new Date()
  const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const [menuDay, setMenuDay] = useState<string | null>(null)

  return (
    <div className="p-4 select-none" onClick={() => setMenuDay(null)}>
      <div className="grid grid-cols-7 mb-2">
        {DOW.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-zinc-700 uppercase tracking-widest py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const ds = format(day, 'yyyy-MM-dd')
          const dt = tasks.filter(t => t.date === ds)
          const de = events.filter(e => e.date === ds)
          const isNow = isSameDay(day, today)
          const inMonth = isSameMonth(day, refDate)
          const total = dt.length + de.length
          const isMenuOpen = menuDay === ds

          return (
            <div key={i} className="relative">
              <div
                onClick={e => { e.stopPropagation(); setMenuDay(isMenuOpen ? null : ds) }}
                className={`relative min-h-[86px] rounded-xl p-2 cursor-pointer transition-all border group ${
                  isNow ? 'border-emerald-500/50 bg-emerald-950/40' : 'border-[#1a1a1f] bg-[#0e0e11] hover:bg-[#121216] hover:border-[#252530]'
                } ${!inMonth ? 'opacity-25' : ''}`}
              >
                <span className={`text-sm font-bold block mb-1.5 ${isNow ? 'text-emerald-400' : 'text-zinc-400'}`}>
                  {format(day, 'd')}
                </span>
                <div className="space-y-0.5">
                  {de.slice(0, 1).map(ev => {
                    const ps = PAYMENT_STYLE[ev.paymentStatus] ?? PAYMENT_STYLE['not-worked']
                    return (
                      <div key={ev.id}
                        onClick={e => { e.stopPropagation(); onEditEvent(ev) }}
                        className="text-[9px] px-1.5 py-0.5 rounded-md truncate border cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ background: ps.border + '20', color: ps.title, borderColor: ps.border + '40' }}>
                        {ev.title}
                      </div>
                    )
                  })}
                  {dt.slice(0, de.length > 0 ? 1 : 2).map(t => {
                    const tc = t.color || (t.priority === 1 ? '#ef4444' : t.priority === 2 ? '#f59e0b' : '#10b981')
                    const TIcon = t.icon ? ICON_MAP[t.icon] : null
                    return (
                      <div key={t.id}
                        onClick={e => { e.stopPropagation(); onEditTask(t) }}
                        className="text-[9px] px-1.5 py-0.5 rounded-md truncate border cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                        style={{ background: tc + '18', color: tc, borderColor: tc + '35' }}>
                        {TIcon && <TIcon size={7} />}
                        {t.title}
                      </div>
                    )
                  })}
                  {total > 2 && <div className="text-[9px] text-zinc-600 px-1.5">+{total - 2} autres</div>}
                </div>
                {total === 0 && inMonth && (
                  <Plus size={12} className="absolute bottom-2 right-2 text-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>

              {/* Day context menu */}
              {isMenuOpen && inMonth && (
                <div
                  onClick={e => e.stopPropagation()}
                  className="absolute top-full left-0 mt-1 z-50 rounded-xl shadow-2xl border border-[#252530] overflow-hidden min-w-[160px]"
                  style={{ background: '#0e0e11' }}
                >
                  <button onClick={() => { onCreateEvent(day); setMenuDay(null) }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-[#1a1a1f] flex items-center gap-2 transition-colors">
                    <Plus size={11} className="text-indigo-400" /> Nouveau créneau
                  </button>
                  <div className="border-t border-[#1a1a1f]" />
                  <button onClick={() => { onNavigateWeek(day); setMenuDay(null) }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-400 hover:bg-[#1a1a1f] flex items-center gap-2 transition-colors">
                    <Calendar size={11} className="text-zinc-500" /> Voir la semaine
                  </button>
                  <button onClick={() => { onNavigateDay(day); setMenuDay(null) }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-400 hover:bg-[#1a1a1f] flex items-center gap-2 transition-colors">
                    <Sun size={11} className="text-zinc-500" /> Voir le jour
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function Planning() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks()
  const { events, addEvent, updateEvent, deleteEvent } = useEvents()
  const { clients } = useClients()
  const { toast } = useToast()

  const [view, setView] = useState<ViewMode>('week')
  const [current, setCurrent] = useState(new Date())
  const [modal, setModal] = useState(false)
  const [mType, setMType] = useState<'task' | 'event'>('event')
  const [editingId, setEditingId] = useState<string | null>(null)
  const dragRef = useRef<DragInfo | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const [titleError, setTitleError] = useState(false)

  const [tForm, setTForm] = useState({
    title: '', date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00', endTime: '10:00',
    priority: 2 as 1 | 2 | 3,
    status: 'todo' as TaskItem['status'],
    description: '', icon: '', color: '',
  })
  const [eForm, setEForm] = useState({
    title: '', date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00', endTime: '10:00',
    clientId: '', isBillable: true,
    paymentStatus: 'unpaid' as EventItem['paymentStatus'],
  })

  const resetTForm = () => setTForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '10:00', priority: 2, status: 'todo', description: '', icon: '', color: '' })
  const resetEForm = () => setEForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '10:00', clientId: '', isBillable: true, paymentStatus: 'unpaid' })

  const days = useMemo(() => {
    if (view === 'day') return [current]
    if (view === 'week') { const s = startOfWeek(current, { weekStartsOn: 1 }); return Array.from({ length: 7 }, (_, i) => addDays(s, i)) }
    const s = startOfWeek(startOfMonth(current), { weekStartsOn: 1 })
    return eachDayOfInterval({ start: s, end: addDays(startOfWeek(endOfMonth(current), { weekStartsOn: 1 }), 6) })
  }, [view, current])

  const nav = (dir: -1 | 1) => {
    if (view === 'day') setCurrent(d => addDays(d, dir))
    else if (view === 'week') setCurrent(d => addWeeks(d, dir))
    else setCurrent(d => addMonths(d, dir))
  }

  const openModal = (type: 'task' | 'event', date?: string, startMin?: number) => {
    const d = date ?? format(new Date(), 'yyyy-MM-dd')
    const st = startMin ? toTimeStr(startMin) : '09:00'
    const et = startMin ? toTimeStr(Math.min(startMin + 60, (DAY_END - 1) * 60)) : '10:00'
    setEditingId(null); setMType(type)
    if (type === 'task') setTForm(f => ({ ...f, date: d, startTime: st, endTime: et, title: '', description: '', icon: '', color: '' }))
    else setEForm(f => ({ ...f, date: d, startTime: st, endTime: et, title: '' }))
    setModal(true)
  }

  const openEditTask = (task: TaskItem) => {
    setEditingId(task.id); setMType('task')
    setTForm({ title: task.title, date: task.date, startTime: task.startTime ?? '09:00', endTime: task.endTime ?? '10:00', priority: (task.priority ?? 2) as 1 | 2 | 3, status: task.status, description: task.description ?? '', icon: task.icon ?? '', color: task.color ?? '' })
    setModal(true)
  }

  const openEditEvent = (ev: EventItem) => {
    setEditingId(ev.id); setMType('event')
    setEForm({ title: ev.title, date: ev.date, startTime: ev.startTime ?? '09:00', endTime: ev.endTime ?? '10:00', clientId: ev.clientId ?? '', isBillable: ev.isBillable ?? true, paymentStatus: ev.paymentStatus })
    setModal(true)
  }

  const closeModal = () => { setModal(false); setEditingId(null) }

  useEffect(() => {
    if (!modal) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modal])

  const saveTask = async () => {
    if (!tForm.title.trim()) { setTitleError(true); setTimeout(() => setTitleError(false), 600); return }
    const data = { ...tForm, ...(tForm.icon ? {} : { icon: undefined }), ...(tForm.color ? {} : { color: undefined }) }
    if (editingId) { await updateTask(editingId, data); toast('Tâche modifiée') }
    else { await addTask({ ...data, type: 'task', progress: 0, tags: [] } as Omit<TaskItem, 'id'>); toast('Tâche créée') }
    closeModal(); resetTForm()
  }

  const saveEvent = async () => {
    if (!eForm.title.trim()) { setTitleError(true); setTimeout(() => setTitleError(false), 600); return }
    if (editingId) { await updateEvent(editingId, eForm); toast('Créneau modifié') }
    else {
      const client = clients.find(c => c.id === eForm.clientId)
      const extra = client?.name ? { clientName: client.name } : {}
      await addEvent({ ...eForm, type: 'event', ...extra } as Omit<EventItem, 'id'>); toast('Créneau créé')
    }
    closeModal(); resetEForm()
  }

  const handleDragStart = useCallback((e: React.DragEvent, item: TaskItem | EventItem) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragRef.current = { id: item.id, kind: item.type as 'task' | 'event', offsetMin: Math.round(((e.clientY - rect.top) / HOUR_H) * 60), durationMin: toMin(item.endTime ?? '10:00') - toMin(item.startTime ?? '09:00') }
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, day: Date) => {
    e.preventDefault()
    const info = dragRef.current; if (!info) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const newStart = Math.max(DAY_START * 60, pxToMin(e.clientY - rect.top) - info.offsetMin)
    const newEnd = Math.min(DAY_END * 60, newStart + info.durationMin)
    const upd = { date: format(day, 'yyyy-MM-dd'), startTime: toTimeStr(newStart), endTime: toTimeStr(newEnd) }
    if (info.kind === 'task') updateTask(info.id, upd); else updateEvent(info.id, upd)
    dragRef.current = null; toast('Déplacé')
  }, [updateTask, updateEvent, toast])

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowPx = toPx(nowMin)
  const showNow = nowMin >= DAY_START * 60 && nowMin < DAY_END * 60

  const title = useMemo(() => {
    if (view === 'day') return format(current, 'EEEE d MMMM yyyy', { locale: fr })
    if (view === 'week') { const s = startOfWeek(current, { weekStartsOn: 1 }); return `${format(s, 'd MMM', { locale: fr })} — ${format(addDays(s, 6), 'd MMM yyyy', { locale: fr })}` }
    return format(current, 'MMMM yyyy', { locale: fr })
  }, [view, current])

  // Payment status label
  const PAYMENT_LABELS: Record<string, string> = { paid: 'Payé', unpaid: 'Impayé', pending: 'En attente', 'not-worked': 'Non travaillé' }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0d]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="shrink-0 flex flex-col gap-2 px-4 py-3 border-b border-[#1a1a1f] sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5 sm:gap-0">
        <div className="flex items-center justify-between sm:gap-4">
          <h1 className="text-[15px] font-bold text-zinc-100 capitalize tracking-tight truncate max-w-[180px] sm:max-w-none" style={{ fontFamily: "'Syne', sans-serif" }}>{title}</h1>
          <div className="flex bg-[#111114] rounded-lg p-0.5 border border-[#1a1a1f]">
            {(['day', 'week', 'month'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === v ? 'bg-[#1e1e24] text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}>
                {v === 'day' ? 'Jour' : v === 'week' ? 'Sem.' : 'Mois'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-[#1a1a1f] text-zinc-600 hover:text-zinc-300 transition-colors"><ChevronLeft size={15} /></button>
          <button onClick={() => setCurrent(new Date())} className="px-2.5 py-1 text-xs bg-[#111114] hover:bg-[#1a1a1f] border border-[#1a1a1f] text-zinc-400 rounded-lg transition-colors">Aujourd'hui</button>
          <button onClick={() => nav(1)} className="p-1.5 rounded-lg hover:bg-[#1a1a1f] text-zinc-600 hover:text-zinc-300 transition-colors"><ChevronRight size={15} /></button>
          <div className="w-px h-4 bg-[#1a1a1f] mx-1 hidden sm:block" />
          <button onClick={() => openModal('task')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e0e11] hover:bg-[#1a1a1f] border border-[#1a1a1f] text-zinc-300 rounded-lg text-xs font-semibold transition-colors">
            <Plus size={13} /> Tâche
          </button>
          <button onClick={() => openModal('event')} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-[0_0_12px_rgba(99,102,241,0.25)]">
            <Plus size={13} /> Créneau
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        {view === 'month' ? (
          <MonthView days={days} refDate={current} tasks={tasks} events={events}
            onEditTask={openEditTask} onEditEvent={openEditEvent}
            onCreateEvent={d => openModal('event', format(d, 'yyyy-MM-dd'))}
            onNavigateWeek={d => { setCurrent(d); setView('week') }}
            onNavigateDay={d => { setCurrent(d); setView('day') }}
          />
        ) : (
          <TimeGrid days={days} tasks={tasks} events={events}
            nowPx={nowPx} showNow={showNow}
            onDayClick={(day, min) => openModal('event', format(day, 'yyyy-MM-dd'), min)}
            onDeleteTask={id => { deleteTask(id); toast('Tâche supprimée') }}
            onCompleteTask={id => { updateTask(id, { status: 'done' }); toast('Terminée ✓') }}
            onDeleteEvent={id => { deleteEvent(id); toast('Créneau supprimé') }}
            onDragStart={handleDragStart} onDrop={handleDrop}
            onEditTask={openEditTask} onEditEvent={openEditEvent}
          />
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={closeModal}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: '#0e0e11', border: '1px solid #1e1e24' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              {editingId ? (
                <span className="text-sm font-semibold text-zinc-300">
                  {mType === 'task' ? 'Modifier la tâche' : 'Modifier le créneau'}
                </span>
              ) : (
                <div className="flex bg-[#0a0a0d] rounded-xl p-0.5 border border-[#1a1a1f]">
                  <button onClick={() => setMType('task')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${mType === 'task' ? 'bg-[#1e1e24] text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'}`}>Tâche</button>
                  <button onClick={() => setMType('event')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${mType === 'event' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>Créneau</button>
                </div>
              )}
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-[#1a1a1f] text-zinc-600 hover:text-zinc-300 transition-colors"><X size={15} /></button>
            </div>

            {mType === 'task' ? (
              <div className="space-y-3">
                <input autoFocus placeholder="Titre de la tâche…"
                  className={`w-full bg-[#0a0a0d] border rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none transition-all ${titleError ? 'border-red-500 animate-[shake_0.3s_ease]' : 'border-[#1e1e24] focus:border-zinc-600'}`}
                  value={tForm.title} onChange={e => { setTitleError(false); setTForm(f => ({ ...f, title: e.target.value })) }}
                  onKeyDown={e => e.key === 'Enter' && saveTask()} />

                {/* Icon picker */}
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Icône</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TASK_ICONS.map(({ key, Icon }) => {
                      const active = tForm.icon === key
                      const c = tForm.color || '#a1a1aa'
                      return (
                        <button key={key} onClick={() => setTForm(f => ({ ...f, icon: active ? '' : key }))}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                          style={{ background: active ? c + '25' : '#111114', border: `1px solid ${active ? c : '#1e1e24'}` }}>
                          <Icon size={13} style={{ color: active ? c : '#52525b' }} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Couleur</p>
                  <div className="flex gap-2 flex-wrap">
                    {TASK_COLORS.map(c => (
                      <button key={c} onClick={() => setTForm(f => ({ ...f, color: f.color === c ? '' : c }))}
                        className="w-6 h-6 rounded-full transition-all"
                        style={{ background: c, boxShadow: tForm.color === c ? `0 0 0 2px #0e0e11, 0 0 0 4px ${c}` : 'none' }} />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600 transition-all [color-scheme:dark]"
                    value={tForm.date} onChange={e => setTForm(f => ({ ...f, date: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input type="time" className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-2 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600 transition-all [color-scheme:dark]"
                      value={tForm.startTime} onChange={e => setTForm(f => ({ ...f, startTime: e.target.value }))} />
                    <input type="time" className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-2 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600 transition-all [color-scheme:dark]"
                      value={tForm.endTime} onChange={e => setTForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                </div>

                {/* Priority */}
                <div className="grid grid-cols-3 gap-1.5">
                  {([1, 2, 3] as const).map(p => {
                    const [label, icon, cls] = p === 1
                      ? ['Urgent', <AlertCircle size={11} />, tForm.priority === p ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'border-[#1e1e24] text-zinc-700 hover:text-zinc-500']
                      : p === 2
                      ? ['Moyen', <AlertTriangle size={11} />, tForm.priority === p ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'border-[#1e1e24] text-zinc-700 hover:text-zinc-500']
                      : ['Faible', <CheckCircle2 size={11} />, tForm.priority === p ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'border-[#1e1e24] text-zinc-700 hover:text-zinc-500']
                    return (
                      <button key={p} onClick={() => setTForm(f => ({ ...f, priority: p }))}
                        className={`py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${cls}`}>
                        {icon} {label}
                      </button>
                    )
                  })}
                </div>

                <textarea rows={2} placeholder="Description (optionnel)"
                  className="w-full bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-all resize-none"
                  value={tForm.description} onChange={e => setTForm(f => ({ ...f, description: e.target.value }))} />

                <button onClick={saveTask}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: tForm.color || '#3f3f46', color: 'white', boxShadow: tForm.color ? `0 2px 12px ${tForm.color}40` : 'none' }}>
                  {editingId ? 'Modifier la tâche' : 'Créer la tâche'}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <input autoFocus placeholder="Titre du créneau…"
                  className={`w-full bg-[#0a0a0d] border rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none transition-all ${titleError ? 'border-red-500 animate-[shake_0.3s_ease]' : 'border-[#1e1e24] focus:border-indigo-500/40'}`}
                  value={eForm.title} onChange={e => { setTitleError(false); setEForm(f => ({ ...f, title: e.target.value })) }}
                  onKeyDown={e => e.key === 'Enter' && saveEvent()} />

                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-all [color-scheme:dark]"
                    value={eForm.date} onChange={e => setEForm(f => ({ ...f, date: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input type="time" className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-2 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-all [color-scheme:dark]"
                      value={eForm.startTime} onChange={e => setEForm(f => ({ ...f, startTime: e.target.value }))} />
                    <input type="time" className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-2 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-all [color-scheme:dark]"
                      value={eForm.endTime} onChange={e => setEForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                </div>

                {/* Payment status */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(['paid', 'pending', 'unpaid'] as const).map(s => {
                    const ps = PAYMENT_STYLE[s]
                    const active = eForm.paymentStatus === s
                    return (
                      <button key={s} onClick={() => setEForm(f => ({ ...f, paymentStatus: s }))}
                        className="py-2 rounded-xl text-xs font-medium border transition-all"
                        style={{ background: active ? ps.border + '20' : 'transparent', borderColor: active ? ps.border + '60' : '#1e1e24', color: active ? ps.title : '#52525b' }}>
                        {PAYMENT_LABELS[s]}
                      </button>
                    )
                  })}
                </div>

                <select className="w-full bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-all"
                  value={eForm.clientId} onChange={e => setEForm(f => ({ ...f, clientId: e.target.value }))}>
                  <option value="">Aucun client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <button type="button" onClick={() => setEForm(f => ({ ...f, isBillable: !f.isBillable }))}
                    className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${eForm.isBillable ? 'bg-indigo-500' : 'bg-[#1e1e24]'}`}>
                    <div className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${eForm.isBillable ? 'translate-x-5' : 'translate-x-[3px]'}`} />
                  </button>
                  <span className="text-sm text-zinc-300">Facturable</span>
                </label>

                <button onClick={saveEvent}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-[0_2px_12px_rgba(99,102,241,0.25)]">
                  {editingId ? 'Modifier le créneau' : 'Créer le créneau'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
