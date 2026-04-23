# Fleemy — UI Refonte "Rounded Modern" + Finance Panel

**Date:** 2026-04-23  
**Status:** Approved

## 1. Typographie
- Remplace DM Sans par **Plus Jakarta Sans** (Google Fonts, weights 400/500/600/700)
- Syne conservé uniquement pour le H1 titre du Planning
- `tailwind.config.js` : `fontFamily.sans = ['Plus Jakarta Sans', 'system-ui', 'sans-serif']`
- `index.css` : `font-family: 'Plus Jakarta Sans'` sur `body`

## 2. Système de rayons
| Élément | Classe |
|---|---|
| Cards globales | `rounded-2xl` |
| Modals | `rounded-3xl` |
| Inputs/Selects | `rounded-xl ring-2 ring-zinc-700/50 focus:ring-indigo-500` |
| Boutons primaires | `rounded-xl` |
| Pills/badges | `rounded-full` |
| TaskItem/EventItem | `rounded-xl shadow-lg hover:scale-[1.02] hover:shadow-xl transition-all duration-200` |
| Sidebar items actifs | `rounded-xl bg-indigo-500/20 border-l-2 border-indigo-400` |

## 3. Finance Panel
- Composant interne `FinancePanelInner` dans `Planning.tsx`
- Calcul : `durationH × client.hourlyRate` par EventItem visible, groupé par paymentStatus
- Fallback : pas de client ou pas de taux → montant = 0, affiché `—`
- Tâches : `done/total` + barre linéaire + badge "Productivité X%"
- État collapsed : `localStorage` clé `fleemy:planning:panel`
- Layout : 220px expanded / 40px collapsed (desktop) | bas 180px/80px (mobile)
- Style : `bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl`

## 4. Badges financiers par jour
- `TimeGrid` : reçoit prop `clients`, affiche micro-badge sous le numéro de jour
- `MonthView` : reçoit prop `clients`, affiche dot coloré dans coin de cellule
- Couleurs : vert si paid > 0, orange si pending/unpaid, zinc si rien

## 5. Tooltips
- State `tooltip: { id; kind; rect } | null` dans `Planning`
- Délai 400ms (timerRef) sur `onMouseEnter` des pills
- Positionné en `fixed` avec clamp pour éviter débordements
- Composant interne `PlanningTooltip` rendu à la fin du JSX

## 6. Animations
- Planning views : `AnimatePresence mode="wait"` + `motion.div` keyed par `view`, `y:8→0 opacity:0→1` 180ms
- Modals : `motion.div` `scale:0.95→1 opacity:0→1` 200ms (tous composants)
- Budget counters : `useCountUp(value, 800)` basé sur `requestAnimationFrame`
- Toasts : slide depuis droite via `AnimatePresence` dans `ToastContext`

## Contrainte
- `Planning.tsx` reste un seul fichier (composants internes définis dans le même fichier)
- Ne pas casser les hooks existants
