# Fleemy UI Refonte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte UI "Rounded Modern" avec Plus Jakarta Sans, Finance Panel collapsible dans Planning, tooltips hover, badges financiers par jour, et animations Framer Motion.

**Architecture:** Cascade depuis les fondations (typo, config Tailwind) → composants isolés (Sidebar, Budget, Clients, Notes, Documents, Toast) → Planning.tsx en dernier (le plus complexe, reste un seul fichier avec composants internes FinancePanelInner et PlanningTooltip définis avant l'export principal).

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, Framer Motion (déjà installé), Firebase Firestore, Recharts, Lucide React

---

## File Map

| Fichier | Changements |
|---|---|
| `frontend/src/index.css` | Remplace DM Sans par Plus Jakarta Sans, retire règle h1/h2/h3 Syne |
| `frontend/tailwind.config.js` | Met à jour fontFamily.sans |
| `frontend/src/components/Sidebar.tsx` | Active state → indigo rounded-xl border-l-2 |
| `frontend/src/components/Budget.tsx` | Rounds, ring inputs, useCountUp, motion modal |
| `frontend/src/components/Clients.tsx` | Rounds, ring inputs, motion modal |
| `frontend/src/components/Notes.tsx` | Rounds, ring inputs, motion modal |
| `frontend/src/components/Documents.tsx` | Rounds, ring inputs, motion modal |
| `frontend/src/context/ToastContext.tsx` | AnimatePresence slide depuis droite |
| `frontend/src/components/Planning.tsx` | FinancePanelInner, PlanningTooltip, day badges, view transitions, modal motion |

---

## Task 1: Typographie — Plus Jakarta Sans

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/tailwind.config.js`

- [ ] **Step 1: Mettre à jour index.css**

Remplacer le contenu complet de `frontend/src/index.css` par :

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  @apply bg-zinc-950 text-zinc-50;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
```

(Syne reste disponible pour Planning via `style={{ fontFamily: "'Syne', sans-serif" }}`)

- [ ] **Step 2: Mettre à jour tailwind.config.js**

Remplacer la valeur de `fontFamily.sans` :

```js
fontFamily: {
  sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
},
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Attendu : aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/tailwind.config.js
git commit -m "feat: replace DM Sans with Plus Jakarta Sans"
```

---

## Task 2: Sidebar — Active state indigo

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Remplacer le style des items actifs**

Dans `Sidebar.tsx`, remplacer la className du bouton nav (lignes ~81-88) :

```tsx
className={`
  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
  ${activeTab === id
    ? 'bg-indigo-500/20 text-indigo-400 border-l-2 border-indigo-400 pl-[10px]'
    : 'text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl'
  }
`}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: sidebar active state indigo with left border"
```

---

## Task 3: Budget — Rounds, ring inputs, useCountUp, motion modal

**Files:**
- Modify: `frontend/src/components/Budget.tsx`

- [ ] **Step 1: Ajouter les imports manquants**

Au début de `Budget.tsx`, la ligne d'import React doit inclure `useEffect` (déjà présent) et ajouter `motion, AnimatePresence` :

```tsx
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Trash2, TrendingUp, TrendingDown, PiggyBank, Receipt } from 'lucide-react'
```

- [ ] **Step 2: Ajouter le hook useCountUp**

Juste avant `export function Budget()`, ajouter :

```tsx
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
```

- [ ] **Step 3: Utiliser useCountUp dans les stats**

Dans `Budget()`, juste après `const stats = useMemo(...)`, ajouter :

```tsx
const animIncome  = useCountUp(stats.income)
const animExpense = useCountUp(stats.expense)
const animSavings = useCountUp(stats.savings)
const animBalance = useCountUp(Math.abs(stats.balance))
```

Et dans le tableau des stats cards (ligne ~96), remplacer les valeurs `value` par les valeurs animées :

```tsx
{ label: 'Revenus',  value: animIncome,  icon: TrendingUp,   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
{ label: 'Dépenses', value: animExpense, icon: TrendingDown,  color: 'text-red-400',     bg: 'bg-red-500/10' },
{ label: 'Épargne',  value: animSavings, icon: PiggyBank,     color: 'text-blue-400',    bg: 'bg-blue-500/10' },
{ label: 'Solde net',value: stats.balance >= 0 ? animBalance : -animBalance, icon: TrendingUp, color: stats.balance >= 0 ? 'text-emerald-400' : 'text-red-400', bg: stats.balance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
```

- [ ] **Step 4: Mettre à jour les styles — cards**

Cards stats (`bg-zinc-900 border border-zinc-800 rounded-xl`) → `rounded-2xl` :

```tsx
<div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
```

Card chart et card transactions : même remplacement `rounded-xl` → `rounded-2xl`.

- [ ] **Step 5: Mettre à jour les inputs/selects (ring)**

Remplacer sur **tous** les inputs et selects du modal de transaction la classe :
`rounded-lg border border-zinc-700 ... focus:outline-none focus:border-emerald-500`
par :
`rounded-xl ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none border-0`

Exemple pour l'input description :
```tsx
className="w-full bg-zinc-800 ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-500"
```

Appliquer le même pattern aux 4 autres champs (montant, type, catégorie, date) et au bouton primaire `rounded-lg` → `rounded-xl`.

- [ ] **Step 6: Animer le modal avec Framer Motion**

Remplacer la condition `{showForm && (...)}` par :

```tsx
<AnimatePresence>
  {showForm && (
    <motion.div
      key="budget-modal"
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
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6"
      >
        {/* contenu du modal inchangé */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Nouvelle transaction</h3>
          <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>
        {/* ... reste du contenu ... */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 7: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/Budget.tsx
git commit -m "feat: budget rounded modern + animated counters + motion modal"
```

---

## Task 4: Clients — Rounds, ring inputs, motion modal

**Files:**
- Modify: `frontend/src/components/Clients.tsx`

- [ ] **Step 1: Ajouter import Framer Motion**

```tsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
```

- [ ] **Step 2: Cards clients `rounded-xl` → `rounded-2xl`**

```tsx
<div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 group">
```

- [ ] **Step 3: Inputs/selects → ring-2 rounded-xl**

Remplacer sur les 6 champs du modal :
`rounded-lg border border-zinc-700 ... focus:border-emerald-500`
→ `rounded-xl ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none border-0`

Et bouton "Créer le client" / "Mettre à jour" : `rounded-lg` → `rounded-xl`.

- [ ] **Step 4: Animer le modal**

Remplacer `{showModal && (...)}` par le même pattern AnimatePresence que Budget (Task 3, Step 6), avec `rounded-3xl` sur le dialog et `key="clients-modal"`.

- [ ] **Step 5: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Clients.tsx
git commit -m "feat: clients rounded modern + motion modal"
```

---

## Task 5: Notes — Rounds, ring inputs, motion modal

**Files:**
- Modify: `frontend/src/components/Notes.tsx`

- [ ] **Step 1: Ajouter import Framer Motion**

```tsx
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
```

- [ ] **Step 2: Cards notes `rounded-xl` → `rounded-2xl`**

```tsx
className={`bg-zinc-900 border rounded-2xl p-4 group cursor-pointer transition-colors ${...}`}
```

- [ ] **Step 3: Inputs/textarea/select → ring-2 rounded-xl**

Dans le modal, tous les champs :
`rounded-lg border border-zinc-700 ... focus:border-emerald-500`
→ `rounded-xl ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none border-0`

Et bouton principal : `rounded-lg` → `rounded-xl`.

- [ ] **Step 4: Animer le modal**

```tsx
<AnimatePresence>
  {showForm && (
    <motion.div
      key="notes-modal"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog" aria-modal="true"
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6"
      >
        {/* contenu inchangé */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 5: Vérifier TypeScript + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/Notes.tsx
git commit -m "feat: notes rounded modern + motion modal"
```

---

## Task 6: Documents — Rounds, ring inputs, motion modals

**Files:**
- Modify: `frontend/src/components/Documents.tsx`

- [ ] **Step 1: Ajouter import Framer Motion**

```tsx
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
```

- [ ] **Step 2: Rows documents hover**

```tsx
<div key={doc.id} onClick={() => setEditingDoc(doc)}
  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 group cursor-pointer hover:border-zinc-700 transition-colors">
```

- [ ] **Step 3: Inputs/selects du form → ring-2 rounded-xl**

Dans le modal création (tous les `<input>`, `<select>`, `<textarea>`) :
`rounded-lg border border-zinc-700 ... focus:border-emerald-500`
→ `rounded-xl ring-2 ring-zinc-700/50 focus:ring-indigo-500 focus:outline-none border-0`

Et bouton "Créer le document" : `rounded-lg` → `rounded-xl`.

- [ ] **Step 4: Animer les deux modals (création + détail)**

Les deux `{showModal && ...}` et `{editingDoc && ...}` enveloppés dans leur propre `AnimatePresence`, même pattern que Task 3 Step 6, avec `rounded-3xl` et les `key` respectifs `"docs-create-modal"` et `"docs-edit-modal"`.

- [ ] **Step 5: Vérifier TypeScript + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/Documents.tsx
git commit -m "feat: documents rounded modern + motion modals"
```

---

## Task 7: Toast — Animation slide Framer Motion

**Files:**
- Modify: `frontend/src/context/ToastContext.tsx`

Le toast actuel utilise `animate-in slide-in-from-right-4` (plugin Tailwind non installé → inactif). On remplace par Framer Motion.

- [ ] **Step 1: Mettre à jour ToastContext.tsx**

Remplacer le contenu complet par :

```tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error'
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 64, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 64, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto
                ${t.type === 'success'
                  ? 'bg-emerald-900 border border-emerald-700 text-emerald-100'
                  : 'bg-red-900 border border-red-700 text-red-100'}
              `}
            >
              {t.type === 'success'
                ? <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                : <XCircle size={16} className="text-red-400 shrink-0" />
              }
              <span>{t.message}</span>
              <button onClick={() => remove(t.id)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity pointer-events-auto">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
```

- [ ] **Step 2: Vérifier TypeScript + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/context/ToastContext.tsx
git commit -m "feat: toast slide animation with Framer Motion AnimatePresence"
```

---

## Task 8: Planning — Imports, types, nouveaux états

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

Cette tâche prépare le fichier pour les tâches 9–14 en ajoutant les imports et états nécessaires, sans toucher encore au JSX.

- [ ] **Step 1: Mettre à jour les imports en tête de fichier**

Remplacer la ligne d'import React existante :
```tsx
import { useState, useMemo, useRef, useCallback } from 'react'
```
par :
```tsx
import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
```

Mettre à jour l'import de types pour ajouter `Client` :
```tsx
import type { TaskItem, EventItem, Client } from '../types'
```

- [ ] **Step 2: Ajouter l'état panelOpen et tooltip dans Planning()**

Dans le corps de `export function Planning()`, après les états existants (`modal`, `mType`, `editingId`, `dragRef`, `gridRef`), ajouter :

```tsx
const [panelOpen, setPanelOpen] = useState<boolean>(() => {
  try { return localStorage.getItem('fleemy:planning:panel') !== 'false' }
  catch { return true }
})
const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
const [tooltip, setTooltip] = useState<{
  id: string; kind: 'task' | 'event'; x: number; y: number; data: TaskItem | EventItem
} | null>(null)
```

- [ ] **Step 3: Persister panelOpen dans localStorage**

Après les états, ajouter :
```tsx
useEffect(() => {
  try { localStorage.setItem('fleemy:planning:panel', String(panelOpen)) }
  catch {}
}, [panelOpen])
```

- [ ] **Step 4: Ajouter les handlers tooltip**

Après les fonctions existantes (`openModal`, `closeModal`, `saveTask`, `saveEvent`), ajouter :

```tsx
const showTooltip = useCallback((
  e: React.MouseEvent, item: TaskItem | EventItem, kind: 'task' | 'event'
) => {
  if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  tooltipTimer.current = setTimeout(() => {
    setTooltip({ id: item.id, kind, x: rect.right + 8, y: rect.top, data: item })
  }, 400)
}, [])

const hideTooltip = useCallback(() => {
  if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
  setTooltip(null)
}, [])
```

- [ ] **Step 5: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Planning.tsx
git commit -m "feat: planning setup imports, panelOpen state, tooltip handlers"
```

---

## Task 9: Planning — FinancePanelInner et calcFinance

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

- [ ] **Step 1: Ajouter calcFinance et FinancePanelInner avant export function Planning()**

Juste avant la ligne `export function Planning()`, insérer :

```tsx
// ─── Finance helpers ──────────────────────────────────────────────────────────
interface FinanceStats {
  paid: number; pending: number; unpaid: number; total: number
  tasksDone: number; tasksTotal: number
}

function calcFinance(days: Date[], events: EventItem[], tasks: TaskItem[], clients: Client[]): FinanceStats {
  const daySet = new Set(days.map(d => format(d, 'yyyy-MM-dd')))
  const clientMap = new Map(clients.map(c => [c.id, c]))
  let paid = 0, pending = 0, unpaid = 0
  for (const ev of events.filter(e => daySet.has(e.date) && e.isBillable)) {
    const rate = ev.clientId ? (clientMap.get(ev.clientId)?.hourlyRate ?? 0) : 0
    if (rate === 0) continue
    const durationH = (toMin(ev.endTime ?? '10:00') - toMin(ev.startTime ?? '09:00')) / 60
    const amount = Math.max(0, durationH) * rate
    if (ev.paymentStatus === 'paid') paid += amount
    else if (ev.paymentStatus === 'pending') pending += amount
    else if (ev.paymentStatus === 'unpaid') unpaid += amount
  }
  const visibleTasks = tasks.filter(t => daySet.has(t.date))
  return { paid, pending, unpaid, total: paid + pending + unpaid, tasksDone: visibleTasks.filter(t => t.status === 'done').length, tasksTotal: visibleTasks.length }
}

function FinancePanelInner({ stats, isOpen, onToggle }: { stats: FinanceStats; isOpen: boolean; onToggle: () => void }) {
  const fmt = (v: number) => v > 0 ? `${Math.round(v).toLocaleString('fr-FR')} €` : '—'
  const progress = stats.tasksTotal > 0 ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0

  return (
    <div className={`shrink-0 flex flex-col bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl overflow-hidden transition-all duration-200 ${isOpen ? 'w-56' : 'w-10'}`}>
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors"
        title={isOpen ? 'Réduire' : 'Finances'}
      >
        {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
      {isOpen && (
        <div className="px-3 pb-4 space-y-4 text-xs overflow-hidden">
          {/* Créneaux */}
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2">Créneaux</p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-emerald-400 flex items-center gap-1">✓ Payé</span>
                <span className="text-zinc-200 font-semibold">{fmt(stats.paid)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-amber-400">⏳ Attente</span>
                <span className="text-zinc-200 font-semibold">{fmt(stats.pending)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-400">✗ Impayé</span>
                <span className="text-zinc-200 font-semibold">{fmt(stats.unpaid)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-zinc-800 pt-1.5 mt-1">
                <span className="text-zinc-400">Total période</span>
                <span className="text-white font-bold">{fmt(stats.total)}</span>
              </div>
            </div>
          </div>
          {/* Tâches */}
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2">Tâches</p>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-zinc-400">{stats.tasksDone}/{stats.tasksTotal}</span>
              <span className="text-indigo-400 font-semibold">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Calculer les stats dans Planning() via useMemo**

Dans `Planning()`, après le calcul de `days`, ajouter :

```tsx
const financeStats = useMemo(
  () => calcFinance(days, events, tasks, clients),
  [days, events, tasks, clients]
)
```

- [ ] **Step 3: Modifier le layout du body pour inclure le panneau**

Actuellement le body est :
```tsx
<div className="flex-1 overflow-auto" ref={gridRef}>
  {view === 'month' ? ... : ...}
</div>
```

Le remplacer par :
```tsx
<div className="flex flex-1 overflow-hidden gap-2 p-2">
  {/* Grid */}
  <div className="flex-1 overflow-auto" ref={gridRef}>
    {view === 'month' ? (
      <MonthView ... />
    ) : (
      <TimeGrid ... />
    )}
  </div>
  {/* Finance Panel — masqué sur mobile en mode horizontal */}
  <div className="hidden lg:flex">
    <FinancePanelInner
      stats={financeStats}
      isOpen={panelOpen}
      onToggle={() => setPanelOpen(o => !o)}
    />
  </div>
</div>
```

- [ ] **Step 4: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Planning.tsx
git commit -m "feat: planning finance panel with calcFinance + FinancePanelInner"
```

---

## Task 10: Planning — EventItem/TaskItem styling + amount badge

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

Cette tâche modifie le rendu des pills dans `TimeGrid`. Elle nécessite aussi de passer `clients` en prop à `TimeGrid`.

- [ ] **Step 1: Ajouter clients à GridProps et TimeGrid**

Dans l'interface `GridProps`, ajouter :
```tsx
clients: Client[]
onShowTooltip: (e: React.MouseEvent, item: TaskItem | EventItem, kind: 'task' | 'event') => void
onHideTooltip: () => void
```

Dans la signature de `TimeGrid`, ajouter `clients, onShowTooltip, onHideTooltip` aux destructurés.

- [ ] **Step 2: EventItem — rounded-xl, hover scale, amount badge, tooltip**

Dans le render de chaque EventItem dans `TimeGrid`, mettre à jour la div principale :

```tsx
<div key={ev.id} draggable
  onDragStart={e => { e.stopPropagation(); onDragStart(e, ev) }}
  onClick={e => { e.stopPropagation(); onEditEvent(ev) }}
  onMouseEnter={e => onShowTooltip(e, ev, 'event')}
  onMouseLeave={onHideTooltip}
  className="absolute left-1 right-1 rounded-xl overflow-hidden cursor-pointer group select-none z-10 hover:scale-[1.02] hover:shadow-xl transition-all duration-200"
  style={{ top: top + 1, height: h - 2, background: ps.bg, borderLeft: `3px solid ${ps.border}`, boxShadow: `0 1px 8px ${ps.border}30` }}
>
```

Ajouter le badge montant à l'intérieur du pill (après les overlapping task icons) :

```tsx
{/* Amount badge */}
{(() => {
  const clientObj = ev.clientId ? clients.find(c => c.id === ev.clientId) : undefined
  const rate = clientObj?.hourlyRate ?? 0
  if (rate === 0 || !ev.isBillable) return null
  const dH = Math.max(0, (toMin(ev.endTime ?? '10:00') - toMin(ev.startTime ?? '09:00')) / 60)
  const amount = Math.round(dH * rate)
  return h > 36 ? (
    <span className="absolute bottom-1 left-2 text-[8px] font-semibold opacity-80" style={{ color: ps.sub }}>
      {amount} €
    </span>
  ) : null
})()}
```

- [ ] **Step 3: TaskItem — rounded-xl, hover scale, tooltip**

Dans le render TaskItem, mettre à jour :

```tsx
<div key={task.id} draggable={!done}
  onDragStart={e => { e.stopPropagation(); if (!done) onDragStart(e, task) }}
  onClick={e => { e.stopPropagation(); if (!done) onEditTask(task) }}
  onMouseEnter={e => { if (!done) onShowTooltip(e, task, 'task') }}
  onMouseLeave={onHideTooltip}
  className={`absolute left-1 right-1 rounded-xl overflow-hidden select-none z-10 group flex transition-all duration-200 ${done ? 'opacity-40' : 'cursor-pointer hover:scale-[1.02] hover:shadow-xl'}`}
  style={{ top: top + 1, height: h - 2, background: taskColor + '12', borderLeft: `3px solid ${taskColor}` }}
>
```

- [ ] **Step 4: Passer clients, onShowTooltip, onHideTooltip dans le JSX de Planning**

Trouver l'appel `<TimeGrid ...>` dans le JSX de `Planning` et ajouter les props :
```tsx
<TimeGrid
  days={days} tasks={tasks} events={events}
  nowPx={nowPx} showNow={showNow}
  clients={clients}
  onShowTooltip={showTooltip}
  onHideTooltip={hideTooltip}
  onDayClick={(day, min) => openModal('event', format(day, 'yyyy-MM-dd'), min)}
  onDeleteTask={id => { deleteTask(id); toast('Tâche supprimée') }}
  onCompleteTask={id => { updateTask(id, { status: 'done' }); toast('Terminée ✓') }}
  onDeleteEvent={id => { deleteEvent(id); toast('Créneau supprimé') }}
  onDragStart={handleDragStart} onDrop={handleDrop}
  onEditTask={openEditTask} onEditEvent={openEditEvent}
/>
```

- [ ] **Step 5: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Planning.tsx
git commit -m "feat: planning EventItem/TaskItem rounded hover scale + amount badge + tooltip wires"
```

---

## Task 11: Planning — Day badges (TimeGrid + MonthView)

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

- [ ] **Step 1: Ajouter clients à MonthProps**

Dans l'interface `MonthProps`, ajouter :
```tsx
clients: Client[]
```

Dans la signature `MonthView(...)`, ajouter `clients` aux destructurés.

- [ ] **Step 2: Ajouter la fonction dayRevenue dans TimeGrid**

Dans le corps de `TimeGrid` (après les déclarations existantes), ajouter :

```tsx
const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients])

const dayRevenue = (ds: string) => {
  let paid = 0, other = 0
  for (const ev of events.filter(e => e.date === ds && e.isBillable)) {
    const rate = ev.clientId ? (clientMap.get(ev.clientId)?.hourlyRate ?? 0) : 0
    if (rate === 0) continue
    const dH = Math.max(0, (toMin(ev.endTime ?? '10:00') - toMin(ev.startTime ?? '09:00')) / 60)
    const amt = Math.round(dH * rate)
    if (ev.paymentStatus === 'paid') paid += amt; else other += amt
  }
  return { paid, other }
}
```

(Attention: `useMemo` dans un composant fonction est valide ici car `TimeGrid` est un composant React.)

- [ ] **Step 3: Afficher le badge dans le header de chaque colonne**

Dans le header des jours de `TimeGrid` (la div avec `gridTemplateColumns`), sous le span du numéro de jour, ajouter :

```tsx
{(() => {
  const ds = format(day, 'yyyy-MM-dd')
  const { paid, other } = dayRevenue(ds)
  const total = paid + other
  if (total === 0) return null
  const color = paid > 0 ? '#10b981' : '#f59e0b'
  return (
    <span className="text-[8px] font-semibold mt-0.5" style={{ color }}>
      {total.toLocaleString('fr-FR')} €
    </span>
  )
})()}
```

- [ ] **Step 4: Dot coloré dans MonthView**

Dans le corps de `MonthView`, ajouter la même logique de clientMap et dayRevenue (copier — l'implémenteur est dans le même fichier, mais ces sont deux composants distincts) :

```tsx
const clientMapM = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients])

const dayRevenueM = (ds: string) => {
  let paid = 0, other = 0
  for (const ev of events.filter(e => e.date === ds && e.isBillable)) {
    const rate = ev.clientId ? (clientMapM.get(ev.clientId)?.hourlyRate ?? 0) : 0
    if (rate === 0) continue
    const dH = Math.max(0, (toMin(ev.endTime ?? '10:00') - toMin(ev.startTime ?? '09:00')) / 60)
    const amt = Math.round(dH * rate)
    if (ev.paymentStatus === 'paid') paid += amt; else other += amt
  }
  return { paid, other }
}
```

Dans chaque cellule de la grille mois, avant la fermeture de la div de cellule, ajouter :
```tsx
{(() => {
  const { paid, other } = dayRevenueM(ds)
  const color = paid > 0 ? '#10b981' : other > 0 ? '#f59e0b' : null
  return color ? <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: color }} /> : null
})()}
```

- [ ] **Step 5: Passer clients à MonthView dans le JSX Planning**

```tsx
<MonthView
  days={days} refDate={current} tasks={tasks} events={events}
  clients={clients}
  onEditTask={openEditTask} onEditEvent={openEditEvent}
  onCreateEvent={d => openModal('event', format(d, 'yyyy-MM-dd'))}
  onNavigateWeek={d => { setCurrent(d); setView('week') }}
  onNavigateDay={d => { setCurrent(d); setView('day') }}
/>
```

- [ ] **Step 6: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Planning.tsx
git commit -m "feat: planning day revenue badges in week headers + month dots"
```

---

## Task 12: Planning — PlanningTooltip component

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

- [ ] **Step 1: Définir PlanningTooltip avant export function Planning()**

Juste avant `export function Planning()` (après `FinancePanelInner`), ajouter :

```tsx
// ─── Tooltip ─────────────────────────────────────────────────────────────────
const PAYMENT_LABELS_TT: Record<string, string> = {
  paid: 'Payé', unpaid: 'Impayé', pending: 'En attente', 'not-worked': 'Non travaillé'
}
const PRIORITY_LABELS_TT: Record<number, string> = { 1: 'Urgent', 2: 'Moyen', 3: 'Faible' }

function PlanningTooltip({ tooltip, clients }: {
  tooltip: { id: string; kind: 'task' | 'event'; x: number; y: number; data: TaskItem | EventItem }
  clients: Client[]
}) {
  const clientMap = new Map(clients.map(c => [c.id, c]))
  const safeX = Math.min(tooltip.x, window.innerWidth - 224)
  const safeY = Math.max(8, Math.min(tooltip.y, window.innerHeight - 200))

  if (tooltip.kind === 'event') {
    const ev = tooltip.data as EventItem
    const client = ev.clientId ? clientMap.get(ev.clientId) : undefined
    const dH = Math.max(0, (toMin(ev.endTime ?? '10:00') - toMin(ev.startTime ?? '09:00')) / 60)
    const amount = client?.hourlyRate ? Math.round(dH * client.hourlyRate) : null
    return (
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl p-3 text-sm w-52 pointer-events-none"
        style={{ position: 'fixed', left: safeX, top: safeY, zIndex: 200 }}
      >
        <p className="text-white font-semibold truncate mb-1">{ev.title}</p>
        {client && <p className="text-zinc-400 text-xs mb-0.5">{client.name}</p>}
        <p className="text-zinc-500 text-xs">{ev.startTime} – {ev.endTime} ({dH.toFixed(1)}h)</p>
        {amount !== null && (
          <p className="text-emerald-400 text-xs font-medium mt-0.5">{amount.toLocaleString('fr-FR')} €</p>
        )}
        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] bg-zinc-700 text-zinc-300">
          {PAYMENT_LABELS_TT[ev.paymentStatus] ?? ev.paymentStatus}
        </span>
      </div>
    )
  }

  const task = tooltip.data as TaskItem
  return (
    <div
      className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl p-3 text-sm w-52 pointer-events-none"
      style={{ position: 'fixed', left: safeX, top: safeY, zIndex: 200 }}
    >
      <p className="text-white font-semibold truncate mb-1">{task.title}</p>
      {task.description && (
        <p className="text-zinc-400 text-xs line-clamp-2 mb-0.5">{task.description}</p>
      )}
      <p className="text-zinc-500 text-xs">{task.startTime} – {task.endTime}</p>
      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] bg-zinc-700 text-zinc-300">
        {PRIORITY_LABELS_TT[task.priority ?? 2]}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Rendre PlanningTooltip à la fin du JSX Planning**

Dans le JSX de `Planning`, juste avant la fermeture `</div>` principale du return, ajouter :

```tsx
{/* Tooltip */}
{tooltip && <PlanningTooltip tooltip={tooltip} clients={clients} />}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Planning.tsx
git commit -m "feat: planning tooltip on hover EventItem + TaskItem"
```

---

## Task 13: Planning — View transitions (AnimatePresence)

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

- [ ] **Step 1: Wrapper le contenu de la grille avec AnimatePresence**

Dans le JSX de `Planning`, le body actuellement est (après Task 9) :
```tsx
<div className="flex flex-1 overflow-hidden gap-2 p-2">
  <div className="flex-1 overflow-auto" ref={gridRef}>
    {view === 'month' ? <MonthView .../> : <TimeGrid .../>}
  </div>
  <div className="hidden lg:flex">
    <FinancePanelInner .../>
  </div>
</div>
```

Remplacer la div interne de la grille par :
```tsx
<div className="flex-1 overflow-hidden relative">
  <AnimatePresence mode="wait">
    <motion.div
      key={view}
      ref={gridRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="absolute inset-0 overflow-auto"
    >
      {view === 'month' ? <MonthView .../> : <TimeGrid .../>}
    </motion.div>
  </AnimatePresence>
</div>
```

Note : `ref={gridRef}` passe à `motion.div` — Framer Motion supporte les refs React normalement.

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Planning.tsx
git commit -m "feat: planning view transitions with AnimatePresence fade+slide"
```

---

## Task 14: Planning — Modal animation + rounded-3xl

**Files:**
- Modify: `frontend/src/components/Planning.tsx`

- [ ] **Step 1: Wrapper le modal Planning avec AnimatePresence**

Remplacer `{modal && (...)}` par :

```tsx
<AnimatePresence>
  {modal && (
    <motion.div
      key="planning-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={closeModal}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
        style={{ background: '#0e0e11', border: '1px solid #1e1e24' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Tout le contenu interne du modal — inchangé */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 2: Inputs du modal Planning → ring-2 rounded-xl**

Dans les inputs du modal tâche et créneau (title input, date, time, textarea), remplacer :
`border border-[#1e1e24] ... focus:border-zinc-600`
→ `ring-2 ring-zinc-800 focus:ring-zinc-600 border-0`

Et le bouton "Créer la tâche"/"Créer le créneau" : `rounded-xl` (déjà présent dans Planning).

- [ ] **Step 3: Vérifier TypeScript final**

```bash
cd frontend && npx tsc --noEmit
```
Attendu : 0 erreur.

- [ ] **Step 4: Commit final**

```bash
git add frontend/src/components/Planning.tsx
git commit -m "feat: planning modal AnimatePresence + rounded-3xl + ring inputs"
```

---

## Vérification finale

- [ ] Lancer le dev server : `cd frontend && npm run dev`
- [ ] Vérifier dans le navigateur :
  - [ ] Police Plus Jakarta Sans chargée (DevTools Network, onglet Fonts)
  - [ ] Sidebar : item actif indigo avec bordure gauche
  - [ ] Budget : compteurs animés au chargement, modal avec scale animation
  - [ ] Planning : panneau Finance visible à droite (desktop), collapse/expand, valeurs calculées
  - [ ] Planning vue semaine : badges €/jour dans les headers
  - [ ] Planning vue mois : dots colorés dans les cellules
  - [ ] Hover sur EventItem/TaskItem pendant 400ms → tooltip
  - [ ] Changement de vue Jour→Semaine→Mois → fade+slide
  - [ ] Toast : slide depuis la droite
  - [ ] Toutes les modales : scale in/out
  - [ ] Touche Échap ferme toujours les modals
