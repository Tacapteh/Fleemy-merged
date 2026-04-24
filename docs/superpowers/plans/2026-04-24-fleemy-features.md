# Fleemy — 3 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complex task types with billing, full mobile responsiveness, and XLSX historical planning import to Fleemy.

**Architecture:** Three independent subsystems share the existing hook/type layer. Feature 1 extends `TaskItem` with optional billing fields and updates Planning + Documents. Feature 2 applies responsive Tailwind classes and converts modals to bottom-sheets on mobile. Feature 3 adds a `src/utils/importPlanning.ts` parser, a `useHistoricalEvents` hook, a new Settings tab, and minimal Planning indicators.

**Tech Stack:** React 18, TypeScript strict, Tailwind CSS 3, Framer Motion, Firebase Firestore, SheetJS (`xlsx` — needs install), date-fns, lucide-react

---

## FILE MAP

### Feature 1 — Complex Tasks
- **Modify:** `frontend/src/types/index.ts` — add fields to `TaskItem`
- **Modify:** `frontend/src/mocks/data.ts` — ensure MOCK_TASKS still valid
- **Modify:** `frontend/src/components/Planning.tsx` — modal UI + pill display + finance panel
- **Modify:** `frontend/src/components/Documents.tsx` — "Import depuis tâches" button + modal

### Feature 2 — Mobile Responsive
- **Modify:** `frontend/src/components/Sidebar.tsx` — Framer Motion slide animation
- **Modify:** `frontend/src/App.tsx` — sidebar overlay backdrop
- **Modify:** `frontend/src/components/Budget.tsx` — 2-col mobile stats
- **Modify:** `frontend/src/components/Clients.tsx` — bottom-sheet modal + responsive grid
- **Modify:** `frontend/src/components/Notes.tsx` — bottom-sheet modal
- **Modify:** `frontend/src/components/Documents.tsx` — bottom-sheet modals
- **Modify:** `frontend/src/components/Planning.tsx` — bottom-sheet modal + week scroll

### Feature 3 — XLSX Import
- **Install:** `xlsx` package
- **Create:** `frontend/src/utils/importPlanning.ts` — parser
- **Create:** `frontend/src/hooks/useHistoricalEvents.ts` — Firestore hook
- **Modify:** `frontend/src/mocks/hooks.ts` — add `useMockHistoricalEvents`
- **Modify:** `frontend/src/components/Settings.tsx` — new "Import" tab
- **Modify:** `frontend/src/components/Planning.tsx` — show historical indicators in month view + finance panel section

---

## ══════════════════════════════════════
## FEATURE 1 — TÂCHES COMPLEXES
## ══════════════════════════════════════

### Task 1: Extend TaskItem type

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Add optional fields to TaskItem**

In `frontend/src/types/index.ts`, replace the `TaskItem` interface:

```typescript
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
  // ── Complex task fields ──────────────────────
  taskKind?: 'standard' | 'deplacement' | 'evacuation'
  clientId?: string          // client rattaché
  montantTache?: number      // montant final (négatif = coût)
  // Déplacement
  prixKm?: number
  nbKm?: number
  prixFixeDeplacement?: number
  // Évacuation
  prixM3?: number
  nbM3?: number
  prixFixeEvacuation?: number
}
```

- [ ] **Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: extend TaskItem with complex task billing fields"
```

---

### Task 2: Planning.tsx — modal "Type de tâche" selector + calcul montant

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

This task adds UI in the task form modal for `taskKind`, deplacement/evacuation sub-fields, client selector, and `montantTache` computation. The rest of Planning.tsx (TimeGrid, MonthView, FinancePanelInner) is untouched in this task.

- [ ] **Add taskKind + related fields to tForm state**

In `Planning()`, find:
```typescript
const [tForm, setTForm] = useState({
  title: '', date: format(new Date(), 'yyyy-MM-dd'),
  startTime: '09:00', endTime: '10:00',
  priority: 2 as 1 | 2 | 3,
  status: 'todo' as TaskItem['status'],
  description: '', icon: '', color: '',
})
```

Replace with:
```typescript
const [tForm, setTForm] = useState({
  title: '', date: format(new Date(), 'yyyy-MM-dd'),
  startTime: '09:00', endTime: '10:00',
  priority: 2 as 1 | 2 | 3,
  status: 'todo' as TaskItem['status'],
  description: '', icon: '', color: '',
  taskKind: 'standard' as 'standard' | 'deplacement' | 'evacuation',
  clientId: '',
  montantTache: '' as number | '',
  prixKm: '' as number | '',
  nbKm: '' as number | '',
  prixFixeDeplacement: '' as number | '',
  prixM3: '' as number | '',
  nbM3: '' as number | '',
  prixFixeEvacuation: '' as number | '',
  deplacementMode: 'km' as 'km' | 'fixe',
  evacuationMode: 'volume' as 'volume' | 'fixe',
})
```

- [ ] **Update resetTForm to include new fields**

```typescript
const resetTForm = () => setTForm({
  title: '', date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '10:00',
  priority: 2, status: 'todo', description: '', icon: '', color: '',
  taskKind: 'standard', clientId: '', montantTache: '',
  prixKm: '', nbKm: '', prixFixeDeplacement: '',
  prixM3: '', nbM3: '', prixFixeEvacuation: '',
  deplacementMode: 'km', evacuationMode: 'volume',
})
```

- [ ] **Update openEditTask to populate new fields**

```typescript
const openEditTask = (task: TaskItem) => {
  setEditingId(task.id); setMType('task')
  setTForm({
    title: task.title, date: task.date,
    startTime: task.startTime ?? '09:00', endTime: task.endTime ?? '10:00',
    priority: (task.priority ?? 2) as 1 | 2 | 3,
    status: task.status, description: task.description ?? '',
    icon: task.icon ?? '', color: task.color ?? '',
    taskKind: task.taskKind ?? 'standard',
    clientId: task.clientId ?? '',
    montantTache: task.montantTache ?? '',
    prixKm: task.prixKm ?? '',
    nbKm: task.nbKm ?? '',
    prixFixeDeplacement: task.prixFixeDeplacement ?? '',
    prixM3: task.prixM3 ?? '',
    nbM3: task.nbM3 ?? '',
    prixFixeEvacuation: task.prixFixeEvacuation ?? '',
    deplacementMode: task.prixFixeDeplacement !== undefined ? 'fixe' : 'km',
    evacuationMode: task.prixFixeEvacuation !== undefined ? 'fixe' : 'volume',
  })
  setModal(true)
}
```

- [ ] **Add calcMontantTache helper (inside Planning() before return)**

```typescript
const calcMontantTache = () => {
  const kind = tForm.taskKind
  if (kind === 'deplacement') {
    if (tForm.deplacementMode === 'km') {
      const p = Number(tForm.prixKm), k = Number(tForm.nbKm)
      return isNaN(p) || isNaN(k) ? undefined : p * k
    }
    const f = Number(tForm.prixFixeDeplacement)
    return isNaN(f) ? undefined : f
  }
  if (kind === 'evacuation') {
    if (tForm.evacuationMode === 'volume') {
      const p = Number(tForm.prixM3), v = Number(tForm.nbM3)
      return isNaN(p) || isNaN(v) ? undefined : p * v
    }
    const f = Number(tForm.prixFixeEvacuation)
    return isNaN(f) ? undefined : f
  }
  // standard
  const m = Number(tForm.montantTache)
  return tForm.montantTache === '' ? undefined : isNaN(m) ? undefined : m
}
```

- [ ] **Update saveTask to persist new fields**

Replace the `saveTask` function body:
```typescript
const saveTask = async () => {
  if (!tForm.title.trim()) { setTitleError(true); setTimeout(() => setTitleError(false), 600); return }
  const montantTache = calcMontantTache()
  const data: Omit<TaskItem, 'id'> = {
    type: 'task',
    title: tForm.title, date: tForm.date,
    startTime: tForm.startTime, endTime: tForm.endTime,
    priority: tForm.priority, status: tForm.status,
    description: tForm.description || undefined,
    icon: tForm.icon || undefined,
    color: tForm.color || undefined,
    progress: 0, tags: [],
    taskKind: tForm.taskKind,
    clientId: tForm.clientId || undefined,
    montantTache,
    ...(tForm.taskKind === 'deplacement' && tForm.deplacementMode === 'km' ? {
      prixKm: Number(tForm.prixKm) || undefined,
      nbKm: Number(tForm.nbKm) || undefined,
    } : {}),
    ...(tForm.taskKind === 'deplacement' && tForm.deplacementMode === 'fixe' ? {
      prixFixeDeplacement: Number(tForm.prixFixeDeplacement) || undefined,
    } : {}),
    ...(tForm.taskKind === 'evacuation' && tForm.evacuationMode === 'volume' ? {
      prixM3: Number(tForm.prixM3) || undefined,
      nbM3: Number(tForm.nbM3) || undefined,
    } : {}),
    ...(tForm.taskKind === 'evacuation' && tForm.evacuationMode === 'fixe' ? {
      prixFixeEvacuation: Number(tForm.prixFixeEvacuation) || undefined,
    } : {}),
  }
  if (editingId) { await updateTask(editingId, data); toast('Tâche modifiée') }
  else { await addTask(data); toast('Tâche créée') }
  closeModal(); resetTForm()
}
```

- [ ] **Add task kind UI in the modal — after the textarea "Description", before the save button**

In the task form JSX (`{mType === 'task' ? (`), add after the textarea and before the save button:

```tsx
{/* Task kind selector */}
<div>
  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Type de tâche</p>
  <div className="grid grid-cols-3 gap-1.5">
    {([
      { v: 'standard', label: 'Standard', emoji: '📋' },
      { v: 'deplacement', label: 'Déplacement', emoji: '🚗' },
      { v: 'evacuation', label: 'Évacuation', emoji: '🗑️' },
    ] as const).map(({ v, label, emoji }) => (
      <button key={v} type="button"
        onClick={() => setTForm(f => ({ ...f, taskKind: v }))}
        className={`py-2 rounded-xl text-xs font-medium border transition-all ${
          tForm.taskKind === v
            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
            : 'border-[#1e1e24] text-zinc-600 hover:text-zinc-400'
        }`}>
        {emoji} {label}
      </button>
    ))}
  </div>
</div>

{/* Déplacement sub-fields */}
{tForm.taskKind === 'deplacement' && (
  <div className="space-y-2">
    <div className="flex gap-2">
      {(['km', 'fixe'] as const).map(m => (
        <button key={m} type="button"
          onClick={() => setTForm(f => ({ ...f, deplacementMode: m }))}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            tForm.deplacementMode === m
              ? 'bg-zinc-700 border-zinc-600 text-white'
              : 'border-[#1e1e24] text-zinc-600 hover:text-zinc-400'
          }`}>
          {m === 'km' ? 'Par km' : 'Prix fixe'}
        </button>
      ))}
    </div>
    {tForm.deplacementMode === 'km' ? (
      <div className="grid grid-cols-2 gap-2">
        <input type="number" step="0.01" placeholder="Prix/km (€)"
          className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-all"
          value={tForm.prixKm}
          onChange={e => setTForm(f => ({ ...f, prixKm: e.target.value === '' ? '' : Number(e.target.value) }))} />
        <input type="number" step="0.1" placeholder="Nb de km"
          className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-all"
          value={tForm.nbKm}
          onChange={e => setTForm(f => ({ ...f, nbKm: e.target.value === '' ? '' : Number(e.target.value) }))} />
      </div>
    ) : (
      <input type="number" step="0.01" placeholder="Montant fixe (€, négatif = coût)"
        className="w-full bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-all"
        value={tForm.prixFixeDeplacement}
        onChange={e => setTForm(f => ({ ...f, prixFixeDeplacement: e.target.value === '' ? '' : Number(e.target.value) }))} />
    )}
    {/* Live preview */}
    {calcMontantTache() !== undefined && (
      <p className={`text-xs font-bold ${(calcMontantTache() ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        = {(calcMontantTache() ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </p>
    )}
  </div>
)}

{/* Évacuation sub-fields */}
{tForm.taskKind === 'evacuation' && (
  <div className="space-y-2">
    <div className="flex gap-2">
      {(['volume', 'fixe'] as const).map(m => (
        <button key={m} type="button"
          onClick={() => setTForm(f => ({ ...f, evacuationMode: m }))}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            tForm.evacuationMode === m
              ? 'bg-zinc-700 border-zinc-600 text-white'
              : 'border-[#1e1e24] text-zinc-600 hover:text-zinc-400'
          }`}>
          {m === 'volume' ? 'Par m³' : 'Prix fixe'}
        </button>
      ))}
    </div>
    {tForm.evacuationMode === 'volume' ? (
      <div className="grid grid-cols-2 gap-2">
        <input type="number" step="0.01" placeholder="Prix/m³ (€)"
          className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-all"
          value={tForm.prixM3}
          onChange={e => setTForm(f => ({ ...f, prixM3: e.target.value === '' ? '' : Number(e.target.value) }))} />
        <input type="number" step="0.1" placeholder="Volume (m³)"
          className="bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-all"
          value={tForm.nbM3}
          onChange={e => setTForm(f => ({ ...f, nbM3: e.target.value === '' ? '' : Number(e.target.value) }))} />
      </div>
    ) : (
      <input type="number" step="0.01" placeholder="Montant fixe (€, négatif = coût)"
        className="w-full bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-all"
        value={tForm.prixFixeEvacuation}
        onChange={e => setTForm(f => ({ ...f, prixFixeEvacuation: e.target.value === '' ? '' : Number(e.target.value) }))} />
    )}
    {calcMontantTache() !== undefined && (
      <p className={`text-xs font-bold ${(calcMontantTache() ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        = {(calcMontantTache() ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </p>
    )}
  </div>
)}

{/* Standard: montant libre */}
{tForm.taskKind === 'standard' && (
  <input type="number" step="0.01" placeholder="Montant (€, optionnel, négatif = coût)"
    className="w-full bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-all"
    value={tForm.montantTache}
    onChange={e => setTForm(f => ({ ...f, montantTache: e.target.value === '' ? '' : Number(e.target.value) }))} />
)}

{/* Client associé */}
<select
  className="w-full bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600 transition-all"
  value={tForm.clientId}
  onChange={e => setTForm(f => ({ ...f, clientId: e.target.value }))}>
  <option value="">Aucun client</option>
  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
</select>
```

- [ ] **Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Commit**

```bash
git add frontend/src/components/Planning.tsx
git commit -m "feat: complex task modal — type selector, billing fields, client"
```

---

### Task 3: Planning.tsx — task pill badges + Finance Panel task revenue

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

- [ ] **Update task pill in TimeGrid to show emoji + amount badge**

In `TimeGrid`, find the task pill render. After the existing "Content" div (which shows title + time), add a small badge for `taskKind` icon and `montantTache`:

Find (inside the task pill `<div key={task.id} ...>`):
```tsx
{/* Content */}
<div className="flex-1 px-1.5 py-1 min-w-0">
  <p className={`text-[11px] font-semibold truncate leading-tight ${done ? 'line-through text-zinc-600' : 'text-zinc-100'}`}>
    {task.title}
  </p>
  {h > 32 && <p className="text-[9px] text-zinc-600 mt-0.5">{task.startTime}–{task.endTime}</p>}
</div>
```

Replace with:
```tsx
{/* Content */}
<div className="flex-1 px-1.5 py-1 min-w-0">
  <div className="flex items-center gap-0.5">
    {task.taskKind === 'deplacement' && <span className="text-[9px]">🚗</span>}
    {task.taskKind === 'evacuation' && <span className="text-[9px]">🗑️</span>}
    <p className={`text-[11px] font-semibold truncate leading-tight ${done ? 'line-through text-zinc-600' : 'text-zinc-100'}`}>
      {task.title}
    </p>
  </div>
  {h > 32 && <p className="text-[9px] text-zinc-600 mt-0.5">{task.startTime}–{task.endTime}</p>}
  {h > 44 && task.clientId && (() => {
    const c = clients.find(cl => cl.id === task.clientId)
    return c ? <p className="text-[9px] text-zinc-500 truncate">{c.name}</p> : null
  })()}
  {task.montantTache !== undefined && h > 28 && (
    <p className={`text-[9px] font-bold ${task.montantTache >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {task.montantTache.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
    </p>
  )}
</div>
```

Note: `clients` is already available in `TimeGrid` via the `clients` prop added in the previous session.

- [ ] **Update FinancePanelInner to include task revenue section**

`FinancePanelInner` receives `stats` for event revenue. We need to add task revenue. Update the props interface and the component:

Find:
```typescript
interface FinancePanelProps {
  stats: { paid: number; pending: number; unpaid: number; total: number }
  tasksDone: number
  tasksTotal: number
  open: boolean
  onToggle: () => void
}
```

Replace with:
```typescript
interface FinancePanelProps {
  stats: { paid: number; pending: number; unpaid: number; total: number }
  tasksDone: number
  tasksTotal: number
  taskRevenue: number   // sum of montantTache > 0
  taskCosts: number     // sum of montantTache < 0 (negative value)
  open: boolean
  onToggle: () => void
}
```

Update `FinancePanelInner` destructuring:
```typescript
function FinancePanelInner({ stats, tasksDone, tasksTotal, taskRevenue, taskCosts, open, onToggle }: FinancePanelProps) {
```

In the desktop panel content (`{open && (`), after the tasks progress bar section, add:
```tsx
{(taskRevenue > 0 || taskCosts < 0) && (
  <div className="border-t border-[#1a1a1f] pt-2 space-y-1.5">
    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Tâches</p>
    {taskRevenue > 0 && (
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">Revenus</span>
        <span className="text-[11px] font-semibold text-emerald-400">
          {taskRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </span>
      </div>
    )}
    {taskCosts < 0 && (
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">Coûts</span>
        <span className="text-[11px] font-semibold text-red-400">
          {taskCosts.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </span>
      </div>
    )}
    <div className="flex items-center justify-between border-t border-[#1a1a1f] pt-1">
      <span className="text-[10px] text-zinc-500">Net tâches</span>
      <span className={`text-[11px] font-bold ${(taskRevenue + taskCosts) >= 0 ? 'text-white' : 'text-red-400'}`}>
        {(taskRevenue + taskCosts).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </span>
    </div>
  </div>
)}
```

Do the same for the mobile panel (inside `{open && (` of the mobile section) — add a 4th column or row below the 3 finance cards:
```tsx
{(taskRevenue > 0 || taskCosts < 0) && (
  <div className="px-4 pb-2 flex gap-2">
    {taskRevenue > 0 && (
      <div className="flex-1 rounded-xl p-2" style={{ background: '#10b98112', border: '1px solid #10b98130' }}>
        <p className="text-[9px] text-zinc-500 mb-0.5">Rev. tâches</p>
        <p className="text-xs font-bold text-emerald-400">{taskRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
      </div>
    )}
    {taskCosts < 0 && (
      <div className="flex-1 rounded-xl p-2" style={{ background: '#ef444412', border: '1px solid #ef444430' }}>
        <p className="text-[9px] text-zinc-500 mb-0.5">Coûts tâches</p>
        <p className="text-xs font-bold text-red-400">{taskCosts.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
      </div>
    )}
  </div>
)}
```

- [ ] **Compute taskRevenue and taskCosts in Planning() and pass to FinancePanelInner**

After the existing `financeStats` useMemo, add:
```typescript
const taskRevenue = useMemo(() =>
  tasks.reduce((s, t) => t.montantTache !== undefined && t.montantTache > 0 ? s + t.montantTache : s, 0),
  [tasks]
)
const taskCosts = useMemo(() =>
  tasks.reduce((s, t) => t.montantTache !== undefined && t.montantTache < 0 ? s + t.montantTache : s, 0),
  [tasks]
)
```

Update the `<FinancePanelInner ...>` JSX call:
```tsx
<FinancePanelInner
  stats={financeStats}
  tasksDone={tasksDone}
  tasksTotal={tasks.length}
  taskRevenue={taskRevenue}
  taskCosts={taskCosts}
  open={panelOpen}
  onToggle={() => setPanelOpen(o => !o)}
/>
```

- [ ] **TypeScript check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/Planning.tsx
git commit -m "feat: task pills show kind/amount, finance panel shows task revenue"
```

---

### Task 4: Documents.tsx — "Importer depuis les tâches" button

**Files:**
- Modify: `frontend/src/components/Documents.tsx`

- [ ] **Add useTasks import**

At the top of `Documents.tsx`, add:
```typescript
import { useTasks } from '../hooks/useTasks'
```

- [ ] **Add hook and import modal state inside Documents()**

```typescript
const { tasks } = useTasks()
const [showTaskImport, setShowTaskImport] = useState(false)
```

- [ ] **Add the "Importer depuis les tâches" button in the form**

In the document create/edit modal, after `handleAddItem` button ("+ Ajouter une ligne"), add:
```tsx
<button
  type="button"
  onClick={() => setShowTaskImport(true)}
  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
>
  <Plus size={11} /> Importer depuis les tâches
</button>
```

- [ ] **Add the task import modal component inline**

After the existing modals (still inside `Documents()`'s return), add:
```tsx
<AnimatePresence>
  {showTaskImport && (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 z-[60] flex items-end sm:items-center justify-center p-4"
      onClick={() => setShowTaskImport(false)}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }}
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Importer depuis les tâches</h3>
          <button onClick={() => setShowTaskImport(false)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <TaskImportList
          tasks={tasks}
          clients={clients}
          onImport={(items) => {
            setForm(f => ({ ...f, items: [...f.items.filter(i => i.description || i.unitPrice), ...items] }))
            setShowTaskImport(false)
            toast('Lignes importées')
          }}
        />
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Add TaskImportList component (above Documents function)**

```tsx
interface TaskImportListProps {
  tasks: import('../types').TaskItem[]
  clients: import('../types').Client[]
  onImport: (items: import('../types').DocumentItem[]) => void
}

function TaskImportList({ tasks, clients, onImport }: TaskImportListProps) {
  const withAmount = tasks.filter(t => t.montantTache !== undefined)

  // Group by title
  const grouped = withAmount.reduce<Record<string, typeof tasks>>((acc, t) => {
    const key = t.title
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (key: string) => setSelected(s => {
    const next = new Set(s)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const handleConfirm = () => {
    const items: import('../types').DocumentItem[] = []
    for (const key of selected) {
      const group = grouped[key]
      if (!group) continue
      const qty = group.length
      const total = group.reduce((s, t) => s + (t.montantTache ?? 0), 0)
      const unitPrice = qty === 1 ? total : total / qty
      const clientName = group[0].clientId
        ? clients.find(c => c.id === group[0].clientId)?.name
        : undefined
      items.push({
        description: clientName ? `${key} (Client : ${clientName})` : key,
        quantity: qty,
        unitPrice: Math.abs(unitPrice),
        taxRate: 0,
      })
    }
    onImport(items)
  }

  if (withAmount.length === 0) {
    return <p className="text-sm text-zinc-500 text-center py-4">Aucune tâche avec montant trouvée.</p>
  }

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([key, group]) => {
        const qty = group.length
        const total = group.reduce((s, t) => s + (t.montantTache ?? 0), 0)
        const clientName = group[0].clientId
          ? clients.find(c => c.id === group[0].clientId)?.name
          : undefined
        return (
          <button key={key} type="button"
            onClick={() => toggle(key)}
            className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
              selected.has(key)
                ? 'bg-indigo-500/10 border-indigo-500/40'
                : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              selected.has(key) ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600'
            }`}>
              {selected.has(key) && <span className="text-white text-[10px]">✓</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{key}</p>
              {clientName && <p className="text-xs text-zinc-500">{clientName}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-zinc-400">×{qty}</p>
              <p className={`text-sm font-bold ${total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          </button>
        )
      })}
      <button
        onClick={handleConfirm}
        disabled={selected.size === 0}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors mt-2"
      >
        Importer {selected.size > 0 ? `(${selected.size})` : ''} ligne{selected.size > 1 ? 's' : ''}
      </button>
    </div>
  )
}
```

Note: `useState` is already imported in Documents.tsx. `TaskImportList` uses its own local `useState` for selection.

- [ ] **TypeScript check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/Documents.tsx
git commit -m "feat: documents — import lines from tasks with grouping by title"
```

---

## ══════════════════════════════════════
## FEATURE 2 — MOBILE RESPONSIVE UI
## ══════════════════════════════════════

### Task 5: Sidebar — Framer Motion slide animation

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Add motion import and animate the sidebar**

Current sidebar uses CSS `transform transition`. Replace with Framer Motion `motion.aside`.

Replace the `<aside ...>` element and its wrapper:
```tsx
import { motion, AnimatePresence } from 'framer-motion'

// In the return:
<>
  {/* Mobile overlay */}
  <AnimatePresence>
    {isOpen && (
      <motion.div
        key="sidebar-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
        onClick={onToggle}
      />
    )}
  </AnimatePresence>

  {/* Sidebar — desktop: always visible; mobile: animated */}
  <motion.aside
    initial={false}
    animate={{ x: isOpen ? 0 : '-100%' }}
    transition={{ type: 'tween', duration: 0.22, ease: 'easeInOut' }}
    className="fixed lg:static inset-y-0 left-0 z-30 w-[280px] lg:w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col lg:translate-x-0"
    style={{ translateX: undefined }} // let motion handle it on mobile; on lg CSS overrides
  >
    {/* ... existing content unchanged ... */}
  </motion.aside>
</>
```

For desktop the sidebar must always be visible. Use a media-query approach: on `lg`, override by removing the animation effect. The simplest approach is to conditionally apply the `animate` prop:

```tsx
<motion.aside
  initial={false}
  animate={window.innerWidth >= 1024 ? { x: 0 } : { x: isOpen ? 0 : '-100%' }}
  transition={{ type: 'tween', duration: 0.22, ease: 'easeInOut' }}
  className="fixed lg:static inset-y-0 left-0 z-30 w-[280px] lg:w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col"
>
```

- [ ] **TypeScript check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: sidebar Framer Motion slide animation on mobile"
```

---

### Task 6: Mobile modals — bottom sheet pattern

All modals (Budget, Clients, Notes, Documents) get a bottom-sheet layout on mobile. The pattern: `fixed inset-x-0 bottom-0 rounded-t-3xl` on small screens, centered on `sm+`.

**Files:**
- Modify: `frontend/src/components/Budget.tsx`
- Modify: `frontend/src/components/Clients.tsx`
- Modify: `frontend/src/components/Notes.tsx`
- Modify: `frontend/src/components/Documents.tsx`

The modal wrapper class changes from:
```
"fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
```
to:
```
"fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4"
```

The modal panel class changes from:
```
"bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6"
```
to:
```
"bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto"
```

Add a drag handle bar at the top of each modal panel (inside the motion.div, before the header div):
```tsx
{/* Mobile drag handle */}
<div className="flex justify-center mb-4 sm:hidden">
  <div className="w-10 h-1 rounded-full bg-zinc-700" />
</div>
```

Apply this to: Budget modal, Clients modal, Notes modal, both Documents modals (create + view/edit).

Also update `motion.div` initial/animate for bottom sheet feel:
```tsx
// Backdrop motion stays the same
// Panel motion:
initial={{ y: '100%', opacity: 0 }}  // was: scale: 0.95
animate={{ y: 0, opacity: 1 }}
exit={{ y: '100%', opacity: 0 }}
// On sm+ keep scale animation — but since we can't branch in JSX easily,
// just use y translation which works for both (barely visible on centered modals)
```

- [ ] **Apply to Budget.tsx**
- [ ] **Apply to Clients.tsx**
- [ ] **Apply to Notes.tsx**
- [ ] **Apply to Documents.tsx (both modals)**

- [ ] **TypeScript check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/Budget.tsx frontend/src/components/Clients.tsx \
        frontend/src/components/Notes.tsx frontend/src/components/Documents.tsx
git commit -m "feat: mobile bottom-sheet modals for Budget, Clients, Notes, Documents"
```

---

### Task 7: Budget, Clients, Notes, Documents — responsive grids + filters

**Files:**
- Modify: all 4 components

- [ ] **Budget: 2-col stats grid on mobile**

Change:
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
```
(already `grid-cols-2` on mobile — verify it is, if `grid-cols-4` exists change to `grid-cols-2 lg:grid-cols-4`)

- [ ] **Clients, Notes, Documents: responsive card grid**

Change any `grid sm:grid-cols-2 lg:grid-cols-3` to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.

- [ ] **All: filters flex-wrap on mobile**

Find filter button rows and add `flex-wrap`:
```tsx
// Change:
<div className="flex gap-1">
// To:
<div className="flex gap-1 flex-wrap">
```

- [ ] **Search bar full-width on mobile**

The search bar is already `flex-1` inside a `flex flex-col sm:flex-row` — verify this is correct in all components.

- [ ] **Commit**

```bash
git add frontend/src/components/Budget.tsx frontend/src/components/Clients.tsx \
        frontend/src/components/Notes.tsx frontend/src/components/Documents.tsx
git commit -m "feat: responsive grid + filter flex-wrap on mobile"
```

---

### Task 8: Planning.tsx — mobile week scroll + modal bottom sheet

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

- [ ] **Week/Day view: horizontal scroll with min column width**

In `TimeGrid`, the columns div:
```tsx
<div className="flex-1 overflow-x-auto">
```
is already there. Ensure each column has a minimum width for touch targets. In the grid body:
```tsx
// Change:
style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, height: totalH }}
// To:
style={{ gridTemplateColumns: `repeat(${days.length}, minmax(80px, 1fr))`, height: totalH }}
```

Apply the same `minmax(80px, 1fr)` to the header grid.

- [ ] **Event/task pills: min height 40px for touch**

Change `Math.max(22, ...)` to `Math.max(40, ...)`:
```typescript
const h = Math.max(40, toPx(toMin(ev.endTime ?? '10:00')) - top)
// and
const h = Math.max(40, toPx(toMin(task.endTime ?? '10:00')) - top)
```

- [ ] **Planning modal: bottom sheet on mobile**

The Planning modal backdrop:
```tsx
// Change:
className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
// To:
className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm"
```

The modal panel:
```tsx
// Change:
className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
// To:
className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
```

Add drag handle at top of modal panel (before the header div):
```tsx
<div className="flex justify-center mb-3 sm:hidden">
  <div className="w-10 h-1 rounded-full bg-zinc-700" />
</div>
```

- [ ] **View toggle: compact on mobile**

The view selector buttons show `Jour`, `Sem.`, `Mois`. On very small screens these might overflow. Add `text-[10px] sm:text-xs`:
```tsx
className={`px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-all ...`}
```

- [ ] **TypeScript check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/Planning.tsx
git commit -m "feat: Planning mobile — week scroll, touch pill height, bottom-sheet modal"
```

---

## ══════════════════════════════════════
## FEATURE 3 — IMPORT GOOGLE SHEETS / XLSX
## ══════════════════════════════════════

### Task 9: Install xlsx + create importPlanning utility

**Files:**
- Install: `xlsx`
- Create: `frontend/src/utils/importPlanning.ts`

- [ ] **Install xlsx**

```bash
cd frontend && npm install xlsx
```

Expected: `xlsx` added to `node_modules` and `package.json`

- [ ] **Create `frontend/src/utils/importPlanning.ts`**

```typescript
import * as XLSX from 'xlsx'

export interface ImportedEvent {
  clientName: string
  date: string        // ISO YYYY-MM-DD
  hours: number       // can be negative
  amount: number      // hours × 15
  month: string       // name of the sheet/month
  year: number
  isSpecial: boolean  // true for Repas, déchetterie, etc.
}

const SPECIAL_ROWS = ['repas', 'déchetterie', 'dechetterie', 'total']
const HOURLY_RATE = 15

// French month names → month number (1-indexed)
const MONTH_MAP: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4,
  mai: 5, juin: 6, juillet: 7, août: 8, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
}

function guessYearFromWorkbook(wb: XLSX.WorkBook): number {
  // Try to find a year in the sheet names or default to current year
  for (const name of wb.SheetNames) {
    const match = name.match(/20\d{2}/)
    if (match) return parseInt(match[0])
  }
  return new Date().getFullYear()
}

function parseMonthName(sheetName: string): number {
  const lower = sheetName.toLowerCase().trim()
  for (const [key, val] of Object.entries(MONTH_MAP)) {
    if (lower.includes(key)) return val
  }
  return 0
}

export function parseHistoricalPlanning(file: File): Promise<ImportedEvent[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const year = guessYearFromWorkbook(wb)
        const results: ImportedEvent[] = []

        for (const sheetName of wb.SheetNames) {
          if (sheetName.toLowerCase() === 'template') continue
          const monthNum = parseMonthName(sheetName)
          if (monthNum === 0) continue

          const ws = wb.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
            header: 1,
            defval: null,
          }) as (string | number | null)[][]

          if (rows.length < 2) continue

          // Row 0 = header: [clientName, 1, 2, ..., 31, "T H", "T €", "dep", "TDep"]
          const headerRow = rows[0]
          // Find which column indices correspond to day numbers 1-31
          const dayColumns: { colIdx: number; day: number }[] = []
          for (let ci = 1; ci < headerRow.length; ci++) {
            const cell = headerRow[ci]
            const dayNum = typeof cell === 'number' ? cell : parseInt(String(cell ?? ''))
            if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
              dayColumns.push({ colIdx: ci, day: dayNum })
            }
          }

          // Data rows
          for (let ri = 1; ri < rows.length; ri++) {
            const row = rows[ri]
            const clientName = String(row[0] ?? '').trim()
            if (!clientName) continue

            const isSpecial = SPECIAL_ROWS.some(s =>
              clientName.toLowerCase().includes(s)
            )

            for (const { colIdx, day } of dayColumns) {
              const cell = row[colIdx]
              if (cell === null || cell === undefined || cell === '') continue
              const hours = typeof cell === 'number' ? cell : parseFloat(String(cell))
              if (isNaN(hours)) continue

              // Build ISO date
              const mm = String(monthNum).padStart(2, '0')
              const dd = String(day).padStart(2, '0')
              // Validate the date is real (e.g. Feb 30 doesn't exist)
              const dateObj = new Date(year, monthNum - 1, day)
              if (dateObj.getMonth() !== monthNum - 1) continue

              results.push({
                clientName,
                date: `${year}-${mm}-${dd}`,
                hours,
                amount: hours * HOURLY_RATE,
                month: sheetName,
                year,
                isSpecial,
              })
            }
          }
        }

        resolve(results)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
```

- [ ] **TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add frontend/src/utils/importPlanning.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: xlsx import utility — parseHistoricalPlanning"
```

---

### Task 10: useHistoricalEvents hook

**Files:**
- Create: `frontend/src/hooks/useHistoricalEvents.ts`
- Modify: `frontend/src/mocks/hooks.ts`

- [ ] **Create the hook**

```typescript
// frontend/src/hooks/useHistoricalEvents.ts
import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, serverTimestamp, type QuerySnapshot, type DocumentData,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { ImportedEvent } from '../utils/importPlanning'

export interface HistoricalEvent extends ImportedEvent {
  id: string
  clientId?: string   // matched after import
  imported: true
  source: 'xlsx'
}

function useHistoricalEventsFirestore() {
  const { user } = useAuth()
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = query(
      collection(db, 'users', user.uid, 'historicalEvents'),
      where('source', '==', 'xlsx')
    )
    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      setHistoricalEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoricalEvent)))
      setLoading(false)
    })
    return unsub
  }, [user])

  const importEvents = async (events: ImportedEvent[], clients: { id: string; name: string }[]) => {
    if (!user) return
    const col = collection(db, 'users', user.uid, 'historicalEvents')
    for (const ev of events) {
      // Match client by name (case-insensitive, accent-normalized)
      const normalize = (s: string) =>
        s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim()
      const matched = clients.find(c => normalize(c.name) === normalize(ev.clientName))
      await addDoc(col, {
        ...ev,
        clientId: matched?.id ?? null,
        imported: true,
        source: 'xlsx',
        createdAt: serverTimestamp(),
      })
    }
  }

  return { historicalEvents, loading, importEvents }
}

function useMockHistoricalEventsImpl() {
  return { historicalEvents: [] as HistoricalEvent[], loading: false, importEvents: async () => {} }
}

const _MOCK = import.meta.env.VITE_MOCK_MODE === 'true'
export const useHistoricalEvents = _MOCK ? useMockHistoricalEventsImpl : useHistoricalEventsFirestore
```

- [ ] **TypeScript check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/hooks/useHistoricalEvents.ts
git commit -m "feat: useHistoricalEvents hook with Firestore + client matching"
```

---

### Task 11: Settings.tsx — Import tab UI

**Files:**
- Modify: `frontend/src/components/Settings.tsx`

- [ ] **Add imports and new tab**

Add to the import block:
```typescript
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { parseHistoricalPlanning, type ImportedEvent } from '../utils/importPlanning'
import { useHistoricalEvents } from '../hooks/useHistoricalEvents'
import { useClients } from '../hooks/useClients'
```

Change `Tab` type to include `'import'`:
```typescript
type Tab = 'general' | 'billing' | 'email' | 'team' | 'import'
```

Add to `tabs` array:
```typescript
{ id: 'import' as Tab, label: 'Import', icon: <Upload size={15} /> },
```

- [ ] **Add state variables inside Settings()**

```typescript
const { clients } = useClients()
const { importEvents } = useHistoricalEvents()
const [preview, setPreview] = useState<ImportedEvent[] | null>(null)
const [importing, setImporting] = useState(false)
const [importError, setImportError] = useState<string | null>(null)
```

- [ ] **Add file handler**

```typescript
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  setImportError(null)
  try {
    const events = await parseHistoricalPlanning(file)
    setPreview(events)
  } catch {
    setImportError('Erreur lors de la lecture du fichier. Vérifiez le format.')
  }
  e.target.value = '' // reset input
}

const handleConfirmImport = async () => {
  if (!preview) return
  setImporting(true)
  await importEvents(preview, clients)
  setPreview(null)
  setImporting(false)
  toast(`${preview.length} événements importés`)
}
```

- [ ] **Add import tab content (inside the content div, after the team block)**

```tsx
{activeTab === 'import' && (
  <div>
    <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Import de planning</h2>
    <p className="text-sm text-zinc-600 mb-6">Importez votre historique depuis un fichier Excel</p>

    <div className="bg-[#0e0e11] border border-[#1a1a1f] rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15">
        <FileSpreadsheet size={16} className="text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-indigo-300">Format attendu</p>
          <p className="text-xs text-zinc-500 mt-0.5">Un onglet par mois (MARS, AVRIL…), une ligne par client, colonnes = jours 1→31. Taux appliqué : 15 €/h.</p>
        </div>
      </div>

      <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-[#1e1e24] rounded-2xl cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">
        <Upload size={24} className="text-zinc-600" />
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">Importer un fichier Excel (.xlsx)</p>
          <p className="text-xs text-zinc-600 mt-0.5">Cliquez pour sélectionner</p>
        </div>
        <input type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
      </label>

      {importError && (
        <div className="flex items-center gap-2 text-red-400 text-xs p-3 bg-red-500/10 rounded-xl border border-red-500/20">
          <AlertCircle size={14} /> {importError}
        </div>
      )}

      {preview && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-zinc-300">{preview.length} événements à importer</p>
            <button onClick={() => setPreview(null)} className="text-xs text-zinc-600 hover:text-zinc-400">Annuler</button>
          </div>

          {/* Preview table */}
          <div className="rounded-xl border border-[#1a1a1f] overflow-hidden mb-3 max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0a0a0d] sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-zinc-500 font-medium">Client</th>
                  <th className="px-3 py-2 text-left text-zinc-500 font-medium">Date</th>
                  <th className="px-3 py-2 text-right text-zinc-500 font-medium">Heures</th>
                  <th className="px-3 py-2 text-right text-zinc-500 font-medium">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1f]">
                {preview.slice(0, 50).map((ev, i) => (
                  <tr key={i} className={ev.isSpecial ? 'opacity-50' : ''}>
                    <td className="px-3 py-1.5 text-zinc-300 truncate max-w-[120px]">{ev.clientName}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{ev.date}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${ev.hours < 0 ? 'text-red-400' : 'text-zinc-300'}`}>{ev.hours}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${ev.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {ev.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="text-center text-xs text-zinc-600 py-2">… et {preview.length - 50} autres</p>
            )}
          </div>

          <button
            onClick={handleConfirmImport}
            disabled={importing}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {importing ? 'Importation…' : `Confirmer l'import (${preview.length} événements)`}
          </button>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **TypeScript check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/Settings.tsx
git commit -m "feat: Settings import tab — xlsx historical planning upload + preview"
```

---

### Task 12: Planning.tsx — historical indicators in Month view + Finance Panel

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

- [ ] **Import and use useHistoricalEvents in Planning()**

Add import at the top:
```typescript
import { useHistoricalEvents } from '../hooks/useHistoricalEvents'
```

Inside `Planning()`:
```typescript
const { historicalEvents } = useHistoricalEvents()
```

- [ ] **Add historical revenue to financeStats (pass as separate prop)**

After `financeStats` useMemo:
```typescript
const historicalByMonth = useMemo(() => {
  const map = new Map<string, number>()
  historicalEvents.forEach(ev => {
    const key = `${ev.year}-${String(new Date(ev.date).getMonth() + 1).padStart(2,'0')}`
    map.set(key, (map.get(key) ?? 0) + ev.amount)
  })
  return map
}, [historicalEvents])
```

- [ ] **Show historical indicator in MonthView day cells**

Pass `historicalEvents` as a prop to `MonthView` (add `historicalEvents` to `MonthProps` interface and function params).

In the MonthView day cell, after the existing dots:
```tsx
{(() => {
  const hasHistory = historicalEvents.some(h => h.date === ds)
  return hasHistory ? (
    <div className="absolute top-1.5 right-1.5">
      <span className="text-[8px]">📋</span>
    </div>
  ) : null
})()}
```

Update `MonthProps`:
```typescript
interface MonthProps {
  // ... existing
  historicalEvents: import('../hooks/useHistoricalEvents').HistoricalEvent[]
}
```

Update `MonthView` function signature to include `historicalEvents`.

Update the JSX call of `MonthView` to pass `historicalEvents={historicalEvents}`.

- [ ] **Add historical section to FinancePanelInner**

Update `FinancePanelProps`:
```typescript
historicalTotal: number  // total amount from historicalEvents for current period
```

In `FinancePanelInner` desktop panel, add after the task section:
```tsx
{historicalTotal !== 0 && (
  <div className="border-t border-[#1a1a1f] pt-2">
    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Historique importé</p>
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-zinc-500">Total</span>
      <span className={`text-[11px] font-bold ${historicalTotal >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
        {historicalTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </span>
    </div>
  </div>
)}
```

Compute `historicalTotal` in `Planning()`:
```typescript
const historicalTotal = useMemo(() =>
  historicalEvents.reduce((s, ev) => s + ev.amount, 0),
  [historicalEvents]
)
```

Pass `historicalTotal={historicalTotal}` to `<FinancePanelInner>`.

- [ ] **TypeScript check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/Planning.tsx
git commit -m "feat: Planning shows historical import indicators + finance panel section"
```

---

## FINAL VERIFICATION

- [ ] **Full build**

```bash
cd frontend && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Git push**

```bash
git push
```

Vercel auto-deploys. Render auto-deploys backend (no change needed).
