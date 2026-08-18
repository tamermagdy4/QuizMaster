import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import { useAppStore } from '../../store/appStore'
import type { ImportedQuestion, ImportParseResult, PackDifficulty } from '../../types/packs'
import { PACK_DIFFICULTIES } from '../../types/packs'
import { importQuestions } from '../../services/packQuizService'
import { parseImportFile, parseTextImport } from '../../utils/questionImport'
import { cn } from '../../utils/cn'

const ACCEPTED = '.txt,.csv,.json,.xlsx,.xls'

export function ImportModal({
  quizId,
  user,
  onClose,
  onImported,
}: {
  quizId: string
  user: User | null
  onClose: () => void
  onImported: (count: number) => void
}) {
  const english = useAppStore((state) => state.language === 'en')
  const [mode, setMode] = useState<'paste' | 'file'>('paste')
  const [pasted, setPasted] = useState('')
  const [parsed, setParsed] = useState<ImportParseResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePaste = () => {
    setError(null)
    if (!pasted.trim()) {
      setError(english ? 'Paste some questions first.' : 'الصق الأسئلة أولًا.')
      return
    }
    setProcessing(true)
    // Defer so the UI can paint "processing…" before heavy parsing.
    window.setTimeout(() => {
      setParsed(parseTextImport(pasted))
      setProcessing(false)
    }, 30)
  }

  const handleFile = useCallback(
    (file: File | undefined) => {
      setError(null)
      if (!file) return
      setProcessing(true)
      void (async () => {
        try {
          const result = await parseImportFile(file)
          setParsed(result)
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : (english ? 'Could not parse the file.' : 'تعذر قراءة الملف.'))
        } finally {
          setProcessing(false)
        }
      })()
    },
    [english],
  )

  const updateRow = (index: number, patch: Partial<ImportedQuestion>) => {
    setParsed((current) => {
      if (!current) return current
      const rows = [...current.rows]
      rows[index] = { ...rows[index], ...patch }
      return { ...current, rows }
    })
  }

  const removeRow = (index: number) => {
    setParsed((current) => {
      if (!current) return current
      const rows = current.rows.filter((_, rowIndex) => rowIndex !== index)
      return { ...current, rows }
    })
  }

  const handleConfirm = async () => {
    if (!parsed) return
    setImporting(true)
    setError(null)
    try {
      const valid = parsed.rows.filter((row) => !row.error && row.question && row.answer)
      if (valid.length === 0) {
        setError(english ? 'No valid questions to import.' : 'لا توجد أسئلة صالحة للاستيراد.')
        setImporting(false)
        return
      }
      const count = await importQuestions(quizId, valid, user)
      onImported(count)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not import questions.' : 'تعذر استيراد الأسئلة.'))
      setImporting(false)
    }
  }

  const reset = () => {
    setParsed(null)
    setPasted('')
    setError(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border-soft bg-white shadow-[0_40px_90px_rgba(6,15,23,0.4)]"
        dir={english ? 'ltr' : 'rtl'}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-extrabold text-navy">{english ? 'Import questions' : 'استيراد أسئلة'}</h2>
            <p className="text-xs text-muted">
              {english ? 'TXT, CSV, JSON or Excel — preview before importing.' : 'TXT أو CSV أو JSON أو Excel — معاينة قبل الاستيراد.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-border-soft px-3 py-1.5 text-sm font-black text-muted transition hover:border-red/40 hover:text-red">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Mode switch */}
          {!parsed && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('paste')}
                className={cn('rounded-xl px-4 py-2 text-xs font-black transition', mode === 'paste' ? 'bg-navy text-white' : 'border border-border-soft bg-surface-raised text-muted')}
              >
                📋 {english ? 'Paste text' : 'لصق نص'}
              </button>
              <button
                type="button"
                onClick={() => setMode('file')}
                className={cn('rounded-xl px-4 py-2 text-xs font-black transition', mode === 'file' ? 'bg-navy text-white' : 'border border-border-soft bg-surface-raised text-muted')}
              >
                📁 {english ? 'Upload file' : 'رفع ملف'}
              </button>
            </div>
          )}

          {!parsed && mode === 'paste' && (
            <div className="space-y-3">
              <textarea
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                rows={10}
                placeholder={english
                  ? 'Question: What is the capital of France?\nAnswer: Paris\n\nOr one per line:\nWhat is the capital of France? | Paris'
                  : 'Question: ما هي عاصمة فرنسا؟\nAnswer: باريس\n\nأو بسطر واحد:\nما هي عاصمة فرنسا؟ | باريس'}
                className="w-full resize-y rounded-2xl border border-border-strong bg-surface-raised/40 px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={processing}
                className="w-full rounded-xl bg-navy py-2.5 text-sm font-black text-white transition hover:bg-navy-3 disabled:opacity-60"
              >
                {processing ? (english ? 'Processing…' : 'جاري معالجة النص…') : (english ? 'Parse questions' : 'تحليل الأسئلة')}
              </button>
            </div>
          )}

          {!parsed && mode === 'file' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border-strong bg-surface-raised/40 px-6 py-10 transition hover:border-navy/50 hover:bg-surface-raised"
              >
                <span className="text-3xl" aria-hidden>📁</span>
                <span className="text-sm font-black text-navy">{english ? 'Choose a file' : 'اختر ملفًا'}</span>
                <span className="text-xs text-muted">{english ? '.txt, .csv, .json, .xlsx' : '.txt أو .csv أو .json أو .xlsx'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              {processing && (
                <p className="text-center text-sm font-black text-navy">{english ? 'Processing file…' : 'جاري معالجة الملف…'}</p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm font-bold text-red">{error}</div>
          )}

          {/* Preview */}
          {parsed && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface-raised/60 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-navy">
                    {english ? `Found ${parsed.rows.length} questions` : `تم العثور على ${parsed.rows.length} سؤالًا`}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full border border-green/40 bg-green/10 px-2.5 py-0.5 text-green">
                      ✓ {english ? `${parsed.validCount} valid` : `${parsed.validCount} سؤال صالح`}
                    </span>
                    <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-gold">
                      ⚠ {english ? `${parsed.invalidCount} need review` : `${parsed.invalidCount} سؤال يحتاج مراجعة`}
                    </span>
                  </div>
                  {parsed.notes.map((note, index) => (
                    <p key={index} className="mt-1 text-[11px] text-muted">ℹ {note}</p>
                  ))}
                </div>
                <button type="button" onClick={reset} className="rounded-xl border border-border-strong px-3 py-2 text-xs font-black text-muted transition hover:text-navy">
                  ↺ {english ? 'Start over' : 'إعادة'}
                </button>
              </div>

              {parsed.rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-strong px-6 py-8 text-center text-sm font-bold text-muted">
                  {english ? 'No rows were recognized.' : 'لم يتم التعرف على أي صفوف.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {parsed.rows.map((row, index) => (
                    <div
                      key={index}
                      className={cn('rounded-2xl border p-3', row.error ? 'border-gold/50 bg-gold/5' : 'border-border-soft bg-white')}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1 w-8 shrink-0 text-center font-display text-xs font-black text-gold" dir="ltr">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <input
                            value={row.question}
                            onChange={(event) => updateRow(index, { question: event.target.value })}
                            className={cn('w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15', row.error === 'السؤال فارغ' || row.error === 'السؤال طويل جدًا (2000 حرف كحد أقصى)' ? 'border-gold' : 'border-border-strong')}
                            placeholder={english ? 'Question' : 'السؤال'}
                          />
                          <input
                            value={row.answer}
                            onChange={(event) => updateRow(index, { answer: event.target.value })}
                            className={cn('w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15', row.error === 'الإجابة فارغة' || row.error === 'الإجابة طويلة جدًا (1000 حرف كحد أقصى)' ? 'border-gold' : 'border-border-strong')}
                            placeholder={english ? 'Answer' : 'الإجابة'}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={row.points}
                              onChange={(event) => updateRow(index, { points: Number(event.target.value) })}
                              className="rounded-lg border border-border-strong bg-white px-2 py-1.5 text-xs font-black text-navy outline-none"
                            >
                              {[100, 200, 300, 500, 1000].map((points) => (
                                <option key={points} value={points}>{points}</option>
                              ))}
                            </select>
                            <select
                              value={row.difficulty}
                              onChange={(event) => updateRow(index, { difficulty: event.target.value as PackDifficulty })}
                              className="rounded-lg border border-border-strong bg-white px-2 py-1.5 text-xs font-black text-navy outline-none"
                            >
                              {PACK_DIFFICULTIES.map((item) => (
                                <option key={item.id} value={item.id}>{english ? item.en : item.label}</option>
                              ))}
                            </select>
                            {row.error && <span className="text-xs font-black text-gold">⚠ {row.error}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="mt-1 shrink-0 rounded-lg px-2 py-1 text-xs font-black text-muted transition hover:bg-red/10 hover:text-red"
                          aria-label={english ? 'Remove row' : 'حذف الصف'}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {parsed && (
          <div className="flex items-center justify-end gap-2 border-t border-border-soft px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-border-soft px-4 py-2.5 text-sm font-black text-muted transition hover:text-navy">
              {english ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={importing || parsed.validCount === 0}
              className="rounded-xl bg-gold px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_22px_rgba(201,162,39,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? '…' : `⬇ ${english ? 'Import' : 'استيراد'} ${parsed.validCount}`}
            </button>
          </div>
        )}

        <AnimatePresence>{/* exit animation handled by parent */}</AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
