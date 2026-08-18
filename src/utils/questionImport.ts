/**
 * Question import parsers for Pack quiz authoring.
 *
 * Supports:
 *   * Paste / .txt  — several common text formats, auto-detected
 *   * .csv          — header detection + optional column mapping
 *   * .json         — the project's Fahlwy question structure and simple arrays
 *   * .xlsx         — first worksheet (ExcelJS)
 *
 * All parsers return normalized ImportedQuestion rows with a localized
 * `error` field for invalid rows — nothing is written to the database here.
 * The UI always shows a preview before any data is persisted.
 */
import ExcelJS from 'exceljs'
import type {
  ImportedQuestion,
  ImportParseResult,
  PackDifficulty,
} from '../types/packs'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const DIFFICULTIES: PackDifficulty[] = ['easy', 'medium', 'hard']

export function validateQuestion(row: {
  question: unknown
  answer: unknown
  points?: unknown
}): string | undefined {
  const question = typeof row.question === 'string' ? row.question.trim() : ''
  const answer = typeof row.answer === 'string' ? row.answer.trim() : ''
  if (!question) return 'السؤال فارغ'
  if (question.length > 2000) return 'السؤال طويل جدًا (2000 حرف كحد أقصى)'
  if (!answer) return 'الإجابة فارغة'
  if (answer.length > 1000) return 'الإجابة طويلة جدًا (1000 حرف كحد أقصى)'
  if (row.points !== undefined && row.points !== null) {
    const points = Number(row.points)
    if (!Number.isFinite(points) || points < 0 || points > 5000) return 'النقاط غير صحيحة'
  }
  return undefined
}

function parsePoints(value: unknown, fallback = 100): number {
  if (value === undefined || value === null) return fallback
  const parsed = Number(String(value).trim())
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

function parseDifficulty(value: unknown): PackDifficulty {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (DIFFICULTIES.includes(normalized as PackDifficulty)) return normalized as PackDifficulty
    // Arabic labels
    if (normalized === 'سهل' || normalized === 'easy') return 'easy'
    if (normalized === 'متوسط' || normalized === 'medium') return 'medium'
    if (normalized === 'صعب' || normalized === 'hard') return 'hard'
  }
  return 'medium'
}

function toRow(partial: {
  question?: unknown
  answer?: unknown
  points?: unknown
  difficulty?: unknown
  hint?: unknown
  image?: unknown
  answerImage?: unknown
}): ImportedQuestion {
  const hint = partial.hint === undefined || partial.hint === null ? '' : String(partial.hint).trim()
  const imageUrl = partial.image === undefined || partial.image === null ? '' : String(partial.image).trim()
  const answerImageUrl = partial.answerImage === undefined || partial.answerImage === null ? '' : String(partial.answerImage).trim()
  return {
    question: String(partial.question ?? '').trim(),
    answer: String(partial.answer ?? '').trim(),
    points: parsePoints(partial.points),
    difficulty: parseDifficulty(partial.difficulty),
    hint,
    imageUrl,
    answerImageUrl,
    error: undefined,
  }
}

function finalize(rows: ImportedQuestion[], format: string, notes: string[] = []): ImportParseResult {
  let validCount = 0
  let invalidCount = 0
  for (const row of rows) {
    const error = validateQuestion(row)
    row.error = error
    if (error) invalidCount += 1
    else validCount += 1
  }
  return { format, rows, validCount, invalidCount, notes }
}

// ---------------------------------------------------------------------------
// Text formats (paste + .txt)
// ---------------------------------------------------------------------------

/**
 * Detects which text layout the user pasted:
 *   'labeled'  → "Question: …" / "Answer: …" blocks
 *   'piped'    → "question | answer" per line
 *   'alternating' → question line, then answer line (repeated)
 */
export function detectTextFormat(text: string): 'labeled' | 'piped' | 'alternating' {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return 'alternating'
  if (lines.every((line) => /^(Question|Answer|السؤال|الإجابة|Q|A)\s*:/i.test(line))) return 'labeled'
  const piped = lines.filter((line) => line.includes('|')).length
  if (piped >= Math.ceil(lines.length / 2)) return 'piped'
  return 'alternating'
}

/** Parses paste / .txt content using every supported layout. */
export function parseTextImport(text: string): ImportParseResult {
  const format = detectTextFormat(text)
  const rows: ImportedQuestion[] = []
  const notes: string[] = []

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (format === 'piped') {
    for (const line of lines) {
      const [question, ...rest] = line.split('|').map((part) => part.trim())
      const answer = rest.join('|').trim()
      rows.push(toRow({ question, answer }))
    }
    return finalize(rows, 'txt', ['تم التعرف على صيغة: سؤال | إجابة'])
  }

  if (format === 'labeled') {
    let current: Partial<ImportedQuestion> | null = null
    const flush = () => {
      if (current && (current.question !== undefined || current.answer !== undefined)) {
        rows.push(toRow(current))
      }
      current = null
    }
    for (const line of lines) {
      const match = line.match(/^(Question|Answer|السؤال|الإجابة|Q|A)\s*:\s*(.*)$/i)
      if (!match) {
        // Treat stray content as part of the current answer (wrapped lines).
        if (current && current.answer) current.answer += ` ${line}`
        continue
      }
      const [, label, value] = match
      const normalized = label.toLowerCase()
      if (normalized === 'question' || normalized === 'q' || label === 'السؤال') {
        flush()
        current = { question: value }
      } else {
        current = current ?? {}
        current.answer = value
      }
    }
    flush()
    return finalize(rows, 'txt', ['تم التعرف على صيغة: سؤال / إجابة'])
  }

  // Alternating: every odd line is a question, every even line is an answer.
  if (lines.length % 2 !== 0) {
    notes.push('عدد الأسطر فردي — قد يكون السطر الأخير ناقص الإجابة.')
  }
  for (let index = 0; index + 1 < lines.length; index += 2) {
    rows.push(toRow({ question: lines[index], answer: lines[index + 1] }))
  }
  if (lines.length % 2 !== 0) {
    rows.push(toRow({ question: lines[lines.length - 1], answer: '' }))
  }
  return finalize(rows, 'txt', ['تم التعرف على صيغة: سؤال ثم إجابة في السطر التالي.'])
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC-4180-ish CSV line splitter that respects quoted fields. */
export function parseCsvLines(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  return rows
}

/** Maps a CSV header name to a normalized field key. */
const HEADER_ALIASES: Record<string, string> = {
  question: 'question',
  'السؤال': 'question',
  'سؤال': 'question',
  answer: 'answer',
  'الإجابة': 'answer',
  'إجابة': 'answer',
  'الجواب': 'answer',
  points: 'points',
  'النقاط': 'points',
  'نقطة': 'points',
  difficulty: 'difficulty',
  'الصعوبة': 'difficulty',
  'المستوى': 'difficulty',
  hint: 'hint',
  'التلميح': 'hint',
  'مساعدة': 'hint',
  image: 'image',
  'صورة': 'image',
  'صورة السؤال': 'image',
  answer_image: 'answerImage',
  'صورة الإجابة': 'answerImage',
  'صورة الجواب': 'answerImage',
}

function normalizeHeader(header: string): string {
  const key = header.trim().toLowerCase()
  return HEADER_ALIASES[key] ?? key.replace(/\s+/g, '_')
}

export function parseCsvImport(text: string): ImportParseResult {
  const lines = parseCsvLines(text)
  if (lines.length === 0) {
    return finalize([], 'csv', ['الملف فارغ.'])
  }

  const notes: string[] = []
  let header: string[] | null = null
  let dataStart = 0

  // Header detection: the first row whose cells map to known field names.
  for (let index = 0; index < Math.min(lines.length, 5); index += 1) {
    const cells = lines[index].map(normalizeHeader)
    // A row is a header when at least two cells map to known field names.
    const recognized = cells.filter((cell) => Object.values(HEADER_ALIASES).includes(cell)).length
    if (recognized >= 2) {
      header = lines[index]
      dataStart = index + 1
      notes.push('تم التعرف على صف العناوين تلقائيًا.')
      break
    }
  }

  if (!header) {
    header = lines[0]
    dataStart = 1
    notes.push('لم يتم العثور على عناوين — سيتم اعتبار العمود الأول سؤالًا والثاني إجابة.')
  }

  const columns = header.map(normalizeHeader)
  const rows: ImportedQuestion[] = []

  for (let index = dataStart; index < lines.length; index += 1) {
    const cells = lines[index]
    const record: Record<string, string> = {}
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      record[columns[columnIndex]] = cells[columnIndex] ?? ''
    }
    // Fall back to positional when no header was recognized.
    if (record.question === undefined && record.answer === undefined) {
      rows.push(
        toRow({
          question: cells[0],
          answer: cells[1],
          points: cells[2],
          difficulty: cells[3],
          hint: cells[4],
          image: cells[5],
          answerImage: cells[6],
        }),
      )
      continue
    }
    rows.push(
      toRow({
        question: record.question,
        answer: record.answer,
        points: record.points,
        difficulty: record.difficulty,
        hint: record.hint,
        image: record.image,
        answerImage: record.answerImage,
      }),
    )
  }

  return finalize(rows, 'csv', notes)
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

/** Parses the project's Fahlwy question JSON or a plain array. */
export function parseJsonImport(text: string): ImportParseResult {
  const notes: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return finalize([], 'json', ['صيغة JSON غير صالحة.'])
  }

  const rows: ImportedQuestion[] = []
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        rows.push(
          toRow({
            question: record.question ?? record.text ?? record.q,
            answer: record.answer ?? record.correct ?? (Array.isArray(record.answers) ? record.answers[0] : undefined),
            points: record.points,
            difficulty: record.difficulty,
            hint: record.hint,
            image: record.image ?? record.media ?? record.image_url,
            answerImage: record.answer_image ?? record.answer_image_url,
          }),
        )
      }
    }
    notes.push('تم استيراد مصفوفة أسئلة.')
    return finalize(rows, 'json', notes)
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    const list = record.questions ?? record.items ?? record.quiz
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>
          rows.push(
            toRow({
              question: row.question ?? row.text ?? row.q,
              answer: row.answer ?? row.correct ?? (Array.isArray(row.answers) ? row.answers[0] : undefined),
              points: row.points,
              difficulty: row.difficulty,
              hint: row.hint,
              image: row.image ?? row.media ?? row.image_url,
              answerImage: row.answer_image ?? row.answer_image_url,
            }),
          )
        }
      }
      notes.push('تم استيراد بنية questions الخاصة بفهلوي.')
      return finalize(rows, 'json', notes)
    }
  }

  return finalize([], 'json', ['تعذر العثور على أسئلة في ملف JSON.'])
}

// ---------------------------------------------------------------------------
// Excel (.xlsx)
// ---------------------------------------------------------------------------

/** Reads the first worksheet and normalizes rows to ImportedQuestion[]. */
export async function parseXlsxImport(file: ArrayBuffer): Promise<ImportParseResult> {
  const notes: string[] = []
  let workbook: ExcelJS.Workbook
  try {
    workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(file)
  } catch {
    return finalize([], 'xlsx', ['تعذر قراءة ملف Excel. تأكد أنه ملف .xlsx صالح.'])
  }

  const firstSheet = workbook.worksheets[0]
  if (!firstSheet) return finalize([], 'xlsx', ['ملف Excel فارغ.'])

  const matrix: unknown[][] = []
  firstSheet.eachRow({ includeEmpty: true }, (row) => {
    const rowData: unknown[] = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rowData[colNumber - 1] = cell.value
    })
    matrix.push(rowData)
  })

  if (matrix.length === 0) return finalize([], 'xlsx', ['ملف Excel فارغ.'])

  let header: unknown[] | null = null
  let dataStart = 0

  for (let index = 0; index < Math.min(matrix.length, 5); index += 1) {
    const cells = (matrix[index] ?? []).map((cell: unknown) => String(cell ?? '').trim().toLowerCase())
    const recognized = cells.filter((cell: string) => HEADER_ALIASES[cell] !== undefined).length
    if (recognized >= 2) {
      header = matrix[index]
      dataStart = index + 1
      notes.push('تم التعرف على صف العناوين تلقائيًا.')
      break
    }
  }

  const columns: string[] = header
    ? (header as unknown[]).map((cell: unknown) => normalizeHeader(String(cell ?? '')))
    : []

  const rows: ImportedQuestion[] = []
  for (let index = dataStart; index < matrix.length; index += 1) {
    const cells = (matrix[index] ?? []) as unknown[]
    if (!columns.length) {
      rows.push(
        toRow({
          question: cells[0],
          answer: cells[1],
          points: cells[2],
          difficulty: cells[3],
          hint: cells[4],
          image: cells[5],
          answerImage: cells[6],
        }),
      )
      continue
    }
    const record: Record<string, string> = {}
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const value = cells[columnIndex]
      record[columns[columnIndex]] = value === undefined || value === null ? '' : String(value)
    }
    rows.push(
      toRow({
        question: record.question,
        answer: record.answer,
        points: record.points,
        difficulty: record.difficulty,
        hint: record.hint,
        image: record.image,
        answerImage: record.answerImage,
      }),
    )
  }

  notes.push(`قراءة من الورقة الأولى: ${firstSheet.name}`)
  return finalize(rows, 'xlsx', notes)
}

// ---------------------------------------------------------------------------
// File dispatch
// ---------------------------------------------------------------------------

export function parseImportFile(file: File): Promise<ImportParseResult> {
  const name = file.name.toLowerCase()
  const ext = name.split('.').pop() ?? ''

  if (ext === 'xlsx' || ext === 'xls') {
    return file.arrayBuffer().then((buffer) => parseXlsxImport(buffer))
  }

  return file.text().then((text) => {
    if (ext === 'csv') return parseCsvImport(text)
    if (ext === 'json') return parseJsonImport(text)
    if (ext === 'txt') return parseTextImport(text)
    return parseTextImport(text)
  })
}
