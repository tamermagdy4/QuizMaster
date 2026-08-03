import { motion } from 'framer-motion'
import { GlassCard } from '../components/GlassCard'
import { useGameBoardStore } from '../store/gameBoardStore'
import { getCategoryById } from '../utils/categories'

export function QuestionScreen() {
  const activeQuestion = useGameBoardStore((state) => state.activeQuestion)
  const team1Name = useGameBoardStore((state) => state.team1Name)
  const team2Name = useGameBoardStore((state) => state.team2Name)

  const category = activeQuestion ? getCategoryById(activeQuestion.categoryId) : undefined

  return (
    <GlassCard strong className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.24em] text-gold-400">شاشة السؤال</p>
          <h1 className="text-2xl font-bold text-white">{category?.title ?? 'السؤال'}</h1>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">
          {activeQuestion ? `الفريق ${activeQuestion.team === 1 ? team1Name : team2Name}` : 'لا يوجد سؤال مفعّل'}
        </div>
      </div>

      {activeQuestion ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-lg leading-relaxed text-white">{activeQuestion.questionText}</p>
          </div>
          <div className="rounded-2xl border border-teal-400/25 bg-teal-500/10 p-4 text-white">
            <p className="mb-1 text-xs font-semibold text-teal-300">الإجابة</p>
            <p className="text-base leading-relaxed">{activeQuestion.answerText}</p>
          </div>
        </motion.div>
      ) : (
        <p className="text-white/65">اختر مربعاً في لوحة اللعب لإظهار السؤال مباشرة.</p>
      )}
    </GlassCard>
  )
}
