import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameBoardStore } from '../store/gameBoardStore'
import { getCategoryById } from '../utils/categories'
import { presentCategory } from '../i18n/translations'
import { useAppStore } from '../store/appStore'

export function QuestionScreen() {
  const activeQuestion = useGameBoardStore((state) => state.activeQuestion)
  const direction = useAppStore((state) => state.direction)
  const english = direction === 'ltr'
  const team1Name = useGameBoardStore((state) => state.team1Name)
  const team2Name = useGameBoardStore((state) => state.team2Name)
  const [showAnswer, setShowAnswer] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const category = activeQuestion ? getCategoryById(activeQuestion.categoryId) : undefined

  const handleShowAnswer = () => {
    setShowAnswer(true)
  }

  const handleResetQuestion = () => {
    setShowAnswer(false)
    setShowHint(false)
  }

  const handleShowHint = () => {
    setShowHint(true)
  }

  const isImageQuestion = activeQuestion?.mediaType === 'image'
  const isVideoQuestion = activeQuestion?.mediaType === 'video'
  const categoryTitle = category ? presentCategory(activeQuestion?.categoryId ?? '', category.title, english) : undefined
  const activeTeamName = activeQuestion ? (activeQuestion.team === 1 ? team1Name : team2Name) : ''

  return (
    <main dir={direction} className="mx-auto w-full max-w-4xl py-2 sm:py-6">
      <section className="stage-dark overflow-hidden rounded-[20px] lg:rounded-[28px] border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.4)]">
        {/* gold hairline — the game-show stage line */}
        <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

        <header className="border-b border-white/10 bg-[#101D2E]/90 px-2 py-2 sm:px-3 sm:py-5 lg:px-8 lg:py-6">
          <div className="flex flex-wrap items-start justify-between gap-1.5 sm:gap-4">
            <div>
              <p className="eyebrow text-[9px] sm:text-xs">{english ? 'Fahloy' : 'فهلوي'}</p>
              <h1 className="mt-1 sm:mt-2 text-base sm:text-2xl lg:text-3xl font-display font-extrabold tracking-tight text-cream">{english ? 'Question' : 'السؤال'}</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
              {activeQuestion && (
                <span className="rounded-full border border-gold/45 bg-gold/12 px-1.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-sm font-black text-gold-bright">
                  {activeQuestion.points} {english ? 'points' : 'نقطة'}
                </span>
              )}
              <span className="rounded-full border border-teal/35 bg-teal/10 px-1.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-sm font-bold text-teal-bright">
                {activeQuestion ? activeTeamName : (english ? 'No active question' : 'لا يوجد سؤال مفعّل')}
              </span>
            </div>
          </div>
          {categoryTitle && (
            <p className="mt-1.5 sm:mt-4 text-[10px] sm:text-sm font-bold text-cream/55">
              {english ? 'Category' : 'التصنيف'} <span className="mx-1 text-cream/25">•</span>
              <span className="text-gold-bright">{categoryTitle}</span>
            </p>
          )}
        </header>

        <div className="px-2 py-3 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
          {activeQuestion ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 sm:space-y-5">
              {/* Question — the hero element; long text scrolls on its own */}
              <div className="max-h-[40dvh] min-h-0 overflow-y-auto overscroll-contain rounded-xl sm:rounded-2xl border border-white/10 bg-[#0B1526]/70 px-2 py-3 sm:px-5 sm:py-7 lg:px-8 lg:py-10 text-center sm:max-h-[45dvh] lg:max-h-[55dvh]">
                {!showAnswer && (
                  <p className="text-sm sm:text-xl lg:text-3xl font-black leading-[1.5] sm:leading-[1.9] text-cream">{activeQuestion.questionText}</p>
                )}
                {showAnswer && (
                  <p className="text-[10px] sm:text-sm font-bold uppercase tracking-[0.16em] text-gold-bright">{english ? 'Answer revealed' : 'تم إظهار الإجابة'}</p>
                )}
              </div>

              {/* Media stays OUTSIDE the text scroll container */}
              {isVideoQuestion && activeQuestion.media && (
                <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-[#0B1526]/50 p-1.5 sm:p-3">
                  <video src={activeQuestion.media} controls className="mx-auto max-h-[28vh] sm:max-h-80 w-full rounded-lg sm:rounded-xl" />
                </div>
              )}
              {!showAnswer && isImageQuestion && activeQuestion.media && (
                <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-[#0B1526]/50 p-1.5 sm:p-3">
                  <img src={activeQuestion.media} alt={english ? 'Question image' : 'صورة السؤال'} className="mx-auto max-h-[28vh] sm:max-h-80 w-full rounded-lg sm:rounded-xl object-contain" />
                </div>
              )}

              {activeQuestion?.hint && showHint && !showAnswer && (
                <div className="rounded-xl sm:rounded-2xl border border-gold/35 bg-gold/10 p-2 sm:p-4">
                  <p className="mb-0.5 sm:mb-1 text-[10px] sm:text-xs font-black text-gold-bright">💡 {english ? 'Hint' : 'تلميح'}</p>
                  <p className="text-sm sm:text-base leading-relaxed text-cream/85">{activeQuestion.hint}</p>
                </div>
              )}
              {showAnswer && activeQuestion.answerMedia && (
                <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-[#0B1526]/50 p-1.5 sm:p-3">
                  <img src={activeQuestion.answerMedia} alt={english ? 'Answer image' : 'صورة الإجابة'} className="mx-auto max-h-[28vh] sm:max-h-80 w-full rounded-lg sm:rounded-xl object-contain" />
                </div>
              )}
              {showAnswer && !isVideoQuestion && (
                <div className="max-h-[30dvh] min-h-0 overflow-y-auto overscroll-contain rounded-xl sm:rounded-2xl border border-green/45 bg-green/10 p-2 sm:p-5 sm:max-h-[35dvh] lg:max-h-[45dvh]">
                  <p className="mb-1 sm:mb-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.14em] text-green-bright">{english ? 'Correct answer' : 'الإجابة الصحيحة'}</p>
                  <p className="text-sm sm:text-lg font-black leading-relaxed text-cream">{activeQuestion.answerText}</p>
                </div>
              )}

              {(isVideoQuestion || isImageQuestion) && (
                <div className="flex flex-col gap-1.5 sm:gap-3 sm:flex-row">
                  {!showAnswer && activeQuestion?.hint && (!isImageQuestion || !showHint) && (
                    <button type="button" onClick={handleShowHint} className="flex-1 rounded-lg sm:rounded-xl border border-gold/40 bg-gold/10 px-2 py-1.5 sm:px-4 sm:py-3 text-[10px] sm:text-sm font-black text-gold-bright transition hover:bg-gold/20">
                      {english ? 'Show hint' : 'إظهار التلميح'}
                    </button>
                  )}
                  {!showAnswer && (
                    <button type="button" onClick={handleShowAnswer} className="flex-1 rounded-lg sm:rounded-xl bg-gradient-to-b from-[#20616C] to-[#123B46] px-2 py-1.5 sm:px-4 sm:py-3 text-[10px] sm:text-sm font-black text-white shadow-[0_10px_22px_rgba(18,59,70,0.4)] transition hover:brightness-110">
                      {english ? 'Show answer' : 'إظهار الإجابة'}
                    </button>
                  )}
                  {showAnswer && (
                    <button type="button" onClick={handleResetQuestion} className="flex-1 rounded-lg sm:rounded-xl border border-white/15 bg-white/5 px-2 py-1.5 sm:px-4 sm:py-3 text-[10px] sm:text-sm font-black text-cream/70 transition hover:bg-white/10">
                      {english ? 'Reset question' : 'إعادة السؤال'}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="rounded-xl sm:rounded-2xl border border-dashed border-white/15 bg-[#0B1526]/50 px-2 py-6 sm:px-5 sm:py-12 text-center">
              <div className="mx-auto flex h-8 w-8 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-teal/12 text-lg sm:text-2xl text-teal-bright">?</div>
              <h2 className="mt-2 sm:mt-4 text-lg sm:text-xl font-black text-cream">{english ? 'No question available' : 'لا يوجد سؤال متاح'}</h2>
              <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-cream/55">{english ? 'Choose a question from the game board to continue.' : 'اختر سؤالًا من لوحة اللعب للمتابعة.'}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
