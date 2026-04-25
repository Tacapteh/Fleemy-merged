import * as XLSX from 'xlsx'
import type { EventItem } from '../types'
import { IMPORT_SYSTEM_PROMPT } from './importPrompt'

// ── AI import types ──────────────────────────────────────────────────────────

export interface AIImportedRow {
  clientName: string
  date: string
  hours: number
  amount: number
  hourlyRate: number
  notes: string
  isExpense: boolean
}

// Convert HH:mm + decimal hours → HH:mm
function addHours(base: string, h: number): string {
  const [bh, bm] = base.split(':').map(Number)
  const totalMin = bh * 60 + bm + Math.round(h * 60)
  const clamp = Math.min(totalMin, 23 * 60 + 59)
  return `${String(Math.floor(clamp / 60)).padStart(2, '0')}:${String(clamp % 60).padStart(2, '0')}`
}

// Map AIImportedRow → EventItem (Option A: start=09:00, end derived from hours)
export function aiRowToEvent(row: AIImportedRow): Omit<EventItem, 'id'> {
  const startTime = '09:00'
  const endTime = addHours(startTime, Math.max(row.hours, 0.25))
  const overridePrice = row.amount > 0 ? (row.isExpense ? -row.amount : row.amount) : undefined
  return {
    type: 'event',
    title: row.clientName || row.notes || 'Sans titre',
    date: row.date,
    startTime,
    endTime,
    clientName: row.clientName || undefined,
    isBillable: !row.isExpense,
    paymentStatus: 'unpaid',
    ...(overridePrice !== undefined ? { overridePrice } : {}),
    ...(row.hourlyRate > 0 && !overridePrice ? { hourlyRate: row.hourlyRate } : {}),
  }
}

export async function parseWithAI(fileContent: string, fileName: string): Promise<AIImportedRow[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY manquante')

  const userMessage = `Voici le contenu du fichier "${fileName}" à analyser :\n\n${fileContent}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: IMPORT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`API ${response.status}`)

    const data = await response.json()
    const text: string = data.content?.[0]?.text ?? '[]'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('timeout')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export interface HistoricalEvent extends Omit<EventItem, 'id'> {
  source: 'import'
}

export interface ImportPreviewRow {
  date: string
  title: string
  startTime: string
  endTime: string
  clientName: string
  paymentStatus: EventItem['paymentStatus']
  isBillable: boolean
  overridePrice?: number
}

function normalizeDate(raw: unknown): string | null {
  if (!raw) return null
  // Excel serial date number
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw)
    if (!d) return null
    const mm = String(d.m).padStart(2, '0')
    const dd = String(d.d).padStart(2, '0')
    return `${d.y}-${mm}-${dd}`
  }
  // String: try dd/mm/yyyy or yyyy-mm-dd
  if (typeof raw === 'string') {
    const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    const iso = raw.match(/^\d{4}-\d{2}-\d{2}/)
    if (iso) return raw.slice(0, 10)
  }
  return null
}

function normalizeTime(raw: unknown): string {
  if (!raw) return '09:00'
  if (typeof raw === 'number') {
    // Excel time fraction
    const totalMin = Math.round(raw * 24 * 60)
    const h = Math.floor(totalMin / 60) % 24
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  if (typeof raw === 'string') {
    const match = raw.match(/^(\d{1,2})[h:](\d{2})/)
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`
  }
  return '09:00'
}

function normalizeStatus(raw: unknown): EventItem['paymentStatus'] {
  const s = String(raw ?? '').toLowerCase()
  if (s.includes('pay') || s === 'paid') return 'paid'
  if (s.includes('pend') || s.includes('attente')) return 'pending'
  if (s.includes('impay') || s === 'unpaid') return 'unpaid'
  return 'not-worked'
}

/**
 * Parses an Excel/CSV file and returns preview rows for confirmation.
 * Expected columns (case-insensitive, order flexible):
 *   date, title/intitulé, heure_debut/start, heure_fin/end,
 *   client, statut/status, facturable/billable, prix/price
 */
export async function parseHistoricalPlanning(file: File): Promise<ImportPreviewRow[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  const results: ImportPreviewRow[] = []

  for (const row of rows) {
    const keys = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v])
    )

    const date = normalizeDate(
      keys['date'] ?? keys['jour'] ?? keys['day']
    )
    if (!date) continue

    const title = String(
      keys['title'] ?? keys['titre'] ?? keys['intitulé'] ?? keys['intitule'] ?? keys['nom'] ?? ''
    ).trim()
    if (!title) continue

    const startTime = normalizeTime(
      keys['start'] ?? keys['heure_debut'] ?? keys['debut'] ?? keys['heure debut'] ?? keys['début']
    )
    const endTime = normalizeTime(
      keys['end'] ?? keys['heure_fin'] ?? keys['fin'] ?? keys['heure fin']
    )
    const clientName = String(keys['client'] ?? keys['client_name'] ?? '').trim()
    const paymentStatus = normalizeStatus(keys['statut'] ?? keys['status'] ?? keys['paiement'])
    const isBillable = String(keys['facturable'] ?? keys['billable'] ?? 'oui').toLowerCase() !== 'non'
    const rawPrice = keys['prix'] ?? keys['price'] ?? keys['montant']
    const overridePrice = rawPrice !== '' && !isNaN(Number(rawPrice)) ? Number(rawPrice) : undefined

    results.push({ date, title, startTime, endTime, clientName, paymentStatus, isBillable, overridePrice })
  }

  return results
}
