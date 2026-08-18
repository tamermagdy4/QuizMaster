import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import { useAppStore } from '../../store/appStore'
import type { PackCustomQuiz, PackCustomQuizInput, PackDifficulty } from '../../types/packs'
import { PACK_CATEGORIES, PACK_DIFFICULTIES } from '../../types/packs'
import { createCustomQuiz, uploadQuizCover } from '../../services/packQuizService'
import { cn } from '../../utils/cn'

export function QuizCreateModal({
  packId,
  user,
  onClose,
  onCreated,
}: {
  packId: string
  user: User | null
  onClose: () => void
  onCreated: (quiz: PackCustomQuiz) => void
}) {
  const english = useAppStore((state) => state.language === 'en')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [difficulty, setDifficulty] = useState<PackDifficulty>('medium')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCoverPick = async (file: File | undefined) => {
    if (!file || !user) return
    try {
      setError(null)
      const uploaded = await uploadQuizCover(file, user.id)
      setCoverUrl(uploaded.publicUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not upload the cover.' : 'تعذر رفع صورة الغلاف.'))
    }
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      setError(english ? 'Enter a quiz title.' : 'أدخل اسم الاختبار.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input: PackCustomQuizInput = {
        title,
        description,
        category,
        difficulty,
        cover_url: coverUrl,
      }
      const quiz = await createCustomQuiz(packId, input, user)
      onCreated(quiz)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not create the quiz.' : 'تعذر إنشاء الاختبار.'))
      setSaving(false)
    }
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
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border-soft bg-white shadow-[0_40px_90px_rgba(6,15,23,0.4)]"
        dir={english ? 'ltr' : 'rtl'}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-extrabold text-navy">{english ? 'Create a new quiz' : 'إنشاء اختبار جديد'}</h2>
            <p className="text-xs text-muted">{english ? 'Build your own quiz inside this pack.' : 'أنشئ اختبارك الخاص داخل هذه الباقة.'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-border-soft px-3 py-1.5 text-sm font-black text-muted transition hover:border-red/40 hover:text-red">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Cover */}
          <div>
            <span className="mb-2 block text-sm font-bold text-ink-2">{english ? 'Cover image' : 'صورة الغلاف'}</span>
            <div className="flex items-center gap-3">
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-2xl border border-border-soft bg-surface-raised">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-navy/25">🖼️</div>
                )}
              </div>
              <div className="space-y-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-border-strong bg-surface-raised px-3 py-2 text-xs font-black text-navy transition hover:border-navy">
                  {english ? 'Upload' : 'رفع صورة'}
                </button>
                {coverUrl && (
                  <button type="button" onClick={() => setCoverUrl(null)} className="block text-xs font-bold text-red hover:underline">
                    {english ? 'Remove' : 'إزالة'}
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void handleCoverPick(event.target.files?.[0])} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-bold text-ink-2">{english ? 'Quiz title' : 'اسم الاختبار'} *</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={english ? 'e.g. World Cup Winners' : 'مثال: أبطال كأس العالم'}
              className="w-full rounded-xl border border-border-strong bg-white px-4 py-2.5 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-bold text-ink-2">{english ? 'Description' : 'الوصف'}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder={english ? 'What is this quiz about?' : 'ما موضوع هذا الاختبار؟'}
              className="w-full resize-none rounded-xl border border-border-strong bg-white px-4 py-2.5 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-bold text-ink-2">{english ? 'Category' : 'الفئة'}</span>
            <div className="grid grid-cols-2 gap-2">
              {PACK_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={cn('rounded-xl border px-3 py-2 text-xs font-bold transition', category === item.id ? 'border-gold bg-gold/15 text-gold' : 'border-border-soft bg-surface-raised text-muted hover:border-gold/40')}
                >
                  <span aria-hidden>{item.icon}</span> {english ? item.en : item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-bold text-ink-2">{english ? 'Difficulty' : 'الصعوبة'}</span>
            <div className="flex gap-2">
              {PACK_DIFFICULTIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDifficulty(item.id)}
                  className={cn('flex-1 rounded-xl border px-3 py-2 text-xs font-black transition', difficulty === item.id ? 'border-navy bg-navy text-white' : 'border-border-soft bg-surface-raised text-muted')}
                >
                  {english ? item.en : item.label}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm font-bold text-red">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border-soft px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border-soft px-4 py-2.5 text-sm font-black text-muted transition hover:text-navy">
            {english ? 'Cancel' : 'إلغاء'}
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving || !title.trim()}
            className="rounded-xl bg-navy px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_22px_rgba(18,59,70,0.3)] transition hover:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '…' : (english ? 'Create quiz' : 'إنشاء الاختبار')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
