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
      <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
        <header className="border-b border-slate-200/80 bg-white px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">{english ? 'Fahloy' : 'فهلوي'}</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{english ? 'Question' : 'السؤال'}</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {activeQuestion && <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-black text-sky-700">{activeQuestion.points} {english ? 'points' : 'نقطة'}</span>}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-600">{activeQuestion ? activeTeamName : (english ? 'No active question' : 'لا يوجد سؤال مفعّل')}</span>
            </div>
          </div>
          {categoryTitle && <p className="mt-4 text-sm font-bold text-slate-500">{english ? 'Category' : 'التصنيف'} <span className="mx-1 text-slate-300">•</span><span className="text-slate-800">{categoryTitle}</span></p>}
        </header>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {activeQuestion ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-7 text-center sm:px-8 sm:py-10">
                {!showAnswer && <p className="text-xl font-black leading-[1.9] text-slate-900 sm:text-3xl">{activeQuestion.questionText}</p>}
                {showAnswer && <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-400">{english ? 'Answer revealed' : 'تم إظهار الإجابة'}</p>}
              </div>

              {isVideoQuestion && activeQuestion.media && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3"><video src={activeQuestion.media} controls className="mx-auto max-h-80 w-full rounded-xl" /></div>}
              {!showAnswer && isImageQuestion && activeQuestion.media && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3"><img src={activeQuestion.media} alt={english ? 'Question image' : 'صورة السؤال'} className="mx-auto max-h-80 w-full rounded-xl object-contain" /></div>}

              {activeQuestion?.hint && showHint && !showAnswer && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><p className="mb-1 text-xs font-black text-amber-700">💡 {english ? 'Hint' : 'تلميح'}</p><p className="text-base leading-relaxed">{activeQuestion.hint}</p></div>}
              {showAnswer && activeQuestion.answerMedia && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3"><img src={activeQuestion.answerMedia} alt={english ? 'Answer image' : 'صورة الإجابة'} className="mx-auto max-h-80 w-full rounded-xl object-contain" /></div>}
              {showAnswer && !isVideoQuestion && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{english ? 'Correct answer' : 'الإجابة الصحيحة'}</p><p className="text-lg font-black leading-relaxed">{activeQuestion.answerText}</p></div>}

              {(isVideoQuestion || isImageQuestion) && <div className="flex flex-col gap-3 sm:flex-row">
                {!showAnswer && activeQuestion?.hint && (!isImageQuestion || !showHint) && <button type="button" onClick={handleShowHint} className="flex-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800 transition hover:bg-amber-100">{english ? 'Show hint' : 'إظهار التلميح'}</button>}
                {!showAnswer && <button type="button" onClick={handleShowAnswer} className="flex-1 rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-700">{english ? 'Show answer' : 'إظهار الإجابة'}</button>}
                {showAnswer && <button type="button" onClick={handleResetQuestion} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">{english ? 'Reset question' : 'إعادة السؤال'}</button>}
              </div>}
            </motion.div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-600">?</div><h2 className="mt-4 text-xl font-black text-slate-900">{english ? 'No question available' : 'لا يوجد سؤال متاح'}</h2><p className="mt-2 text-sm text-slate-500">{english ? 'Choose a question from the game board to continue.' : 'اختر سؤالًا من لوحة اللعب للمتابعة.'}</p></div>
          )}
        </div>
      </section>
    </main>
  )
}
