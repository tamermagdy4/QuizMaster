import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import type { PackWithQuizzes } from '../../types/packs'
import { packCategoryLabel, packDifficultyLabel } from '../../types/packs'
import { getQuizMeta } from '../../utils/packQuizzes'

function CoverArt({ pack, className }: { pack: PackWithQuizzes; className?: string }) {
  if (pack.cover_url) {
    return (
      <img
        src={pack.cover_url}
        alt={pack.title}
        loading="lazy"
        className={`${className ?? ''} object-cover`}
      />
    )
  }
  const firstQuiz = pack.quizzes?.[0] ? getQuizMeta(pack.quizzes[0].quiz_id) : null
  return (
    <div
      className={`${className ?? ''} flex items-center justify-center bg-gradient-to-br ${firstQuiz?.gradient ?? 'from-navy via-navy-2 to-navy-3'}`}
      aria-hidden
    >
      <span className="text-5xl drop-shadow-lg">{firstQuiz?.icon ?? '📚'}</span>
    </div>
  )
}

function DifficultyDots({ difficulty }: { difficulty: PackWithQuizzes['difficulty'] }) {
  const level = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {[1, 2, 3].map((index) => (
        <span
          key={index}
          className={`h-1.5 w-1.5 rounded-full ${index <= level ? 'bg-gold' : 'bg-navy/15'}`}
        />
      ))}
    </span>
  )
}

export function PackCard({ pack, index = 0 }: { pack: PackWithQuizzes; index?: number }) {
  const english = useAppStore((state) => state.language === 'en')
  const quizCount = pack.quizzes?.length ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.05, 0.4), ease: [0.25, 1, 0.5, 1] }}
      className="group relative overflow-hidden rounded-3xl border border-border-soft bg-white shadow-panel transition duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-[0_18px_44px_rgba(18,59,70,0.14)]"
    >
      <Link to={`/packs/${pack.id}`} className="flex h-full flex-col">
        {/* Cover */}
        <div className="relative aspect-[16/9] overflow-hidden">
          <CoverArt pack={pack} className="h-full w-full transition duration-500 group-hover:scale-[1.04]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          {/* Badges */}
          <span className="absolute end-3 top-3 rounded-full border border-teal/50 bg-black/40 px-2.5 py-1 text-[10px] font-black text-teal-bright backdrop-blur-sm">
            🎮 {english ? 'Live' : 'مباشر'}
          </span>
          {pack.featured && (
            <span className="absolute start-3 top-3 rounded-full border border-gold/60 bg-black/40 px-2.5 py-1 text-[10px] font-black text-gold-bright backdrop-blur-sm">
              ★ {english ? 'Featured' : 'مميزة'}
            </span>
          )}
          {/* Difficulty + category chips */}
          <div className="absolute bottom-3 start-3 flex items-center gap-2">
            <span className="rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur-sm">
              {packCategoryLabel(pack.category, english)}
            </span>
            <span className="rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[10px] font-bold text-white/90 backdrop-blur-sm">
              {packDifficultyLabel(pack.difficulty, english)}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <h3 className="line-clamp-1 font-display text-base font-extrabold text-navy transition group-hover:text-navy-3 sm:text-lg">
            {pack.title}
          </h3>
          <p className="line-clamp-2 min-h-[2.4em] text-xs leading-relaxed text-muted sm:text-[13px]">
            {pack.description || (english ? 'No description yet.' : 'لا يوجد وصف بعد.')}
          </p>

          <div className="mt-auto flex items-center justify-between border-t border-border-soft pt-3">
            <div className="flex min-w-0 items-center gap-2">
              {pack.creator_avatar_url ? (
                <img src={pack.creator_avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy/10 text-[10px] font-black text-navy">
                  {pack.creator_name?.charAt(0) || '?'}
                </span>
              )}
              <span className="truncate text-[11px] font-bold text-ink-2">{pack.creator_name || (english ? 'Unknown' : 'مستخدم')}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-[11px] font-bold text-muted">
              {typeof pack.question_count_total === 'number' && (
                <span title={english ? 'Questions' : 'الأسئلة'}>
                  💬 {pack.question_count_total}
                </span>
              )}
              <span title={english ? 'Quizzes' : 'الاختبارات'}>
                📚 {quizCount}
              </span>
              <span title={english ? 'Plays' : 'اللعب'}>
                ▶ {pack.plays_count}
              </span>
              <span title={english ? 'Rating' : 'التقييم'}>
                ★ {Number(pack.average_rating).toFixed(1)}
              </span>
            </div>
          </div>

          {/* CTA row */}
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center justify-center rounded-xl bg-navy px-3 py-2 text-xs font-black text-white shadow-[0_8px_18px_rgba(18,59,70,0.2)] transition group-hover:bg-navy-3">
              {english ? 'Open Pack' : 'فتح الباقة'}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/40 bg-gold/10 text-sm text-gold transition group-hover:bg-gold/20" aria-hidden>
              ←
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export { CoverArt, DifficultyDots }
