import * as XLSX from 'xlsx'
import type { EventItem } from '../types'

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
  const { auth } = await import('../services/firebase')
  const token = (await auth.currentUser?.getIdToken()) ?? ''
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch(`${apiUrl}/api/import/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ content: fileContent, filename: fileName }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}))
      if (detail?.detail === 'timeout') throw new Error('timeout')
      throw new Error(`API ${response.status}`)
    }

    const parsed = await response.json()
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('timeout')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

// ── Multi-sheet Excel parser ──────────────────────────────────────────────────

function isSheetEmpty(csv: string): boolean {
  return !csv.replace(/[,\n\r\s]/g, '').trim()
}

/**
 * Parses any file type, processing each Excel sheet separately to avoid
 * the 20k-char truncation that would cut off months after the first tab.
 * Non-Excel files fall back to a single AI call.
 */
export async function parseExcelAllSheets(
  file: File
): Promise<{ rows: AIImportedRow[]; sheetsProcessed: number }> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (!['xlsx', 'xls', 'ods'].includes(ext ?? '')) {
    const { fileToText } = await import('./fileToText')
    const content = await fileToText(file)
    if (!content.trim()) return { rows: [], sheetsProcessed: 0 }
    const rows = await parseWithAI(content, file.name)
    return { rows, sheetsProcessed: 1 }
  }

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  const sheetContents: { name: string; content: string }[] = []
  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === 'template') continue
    const ws = wb.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(ws, { skipHidden: true })
    if (isSheetEmpty(csv)) continue
    sheetContents.push({
      name: sheetName,
      content: `=== Onglet: ${sheetName} ===\n${csv}`,
    })
  }

  if (sheetContents.length === 0) return { rows: [], sheetsProcessed: 0 }

  // Process sheets one at a time to avoid rate limiting on parallel calls
  const allRows: AIImportedRow[] = []
  for (const { name, content } of sheetContents) {
    const rows = await parseWithAI(content.slice(0, 50000), `${file.name} — ${name}`)
      .catch(() => [] as AIImportedRow[])
    allRows.push(...rows)
  }

  return { rows: allRows, sheetsProcessed: sheetContents.length }
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
