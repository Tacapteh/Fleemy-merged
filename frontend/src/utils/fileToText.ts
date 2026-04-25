import * as XLSX from 'xlsx'

export async function fileToText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv' || ext === 'txt') {
    return await file.text()
  }

  if (ext === 'json') {
    const text = await file.text()
    return JSON.stringify(JSON.parse(text), null, 2)
  }

  if (['xlsx', 'xls', 'ods'].includes(ext ?? '')) {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

    let result = ''
    for (const sheetName of wb.SheetNames) {
      if (sheetName.toLowerCase() === 'template') continue
      const ws = wb.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(ws, { skipHidden: true })
      result += `\n=== Onglet: ${sheetName} ===\n${csv}\n`
    }
    return result.slice(0, 20000)
  }

  return ''
}
