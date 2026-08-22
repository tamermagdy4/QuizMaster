import { useRef, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from 'framer-motion'
import { Play, Globe } from 'lucide-react'
import { PHOTOS } from './homeContent'

/* =========================================================
   فهلوي — Premium Home Redesign (after Hero)
   
   DESIGN DIRECTION: "Cinematic Dark Premium"
   
   Every section has a unique composition. No cards/grids.
   Scroll-driven reveals. Horizontal movement in vertical scroll.
   Mask transitions. Parallax depth. Interactive hover states.
   ========================================================= */

const VIEWPORT = { once: true, amount: 0.15 } as const

/* =========================================================
   Section 1 — THE ARENA
   Split-screen horizontal reveal. Giant typography slides in
   from the left while the category image enters from the right.
   ========================================================= */

export function TheArena({
  t,
  english,
}: {
  t: (k: string) => string
  english: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Text slides in from left
  const textX = useTransform(scrollYProgress, [0.1, 0.35], [-120, 0])
  const textOpacity = useTransform(scrollYProgress, [0.1, 0.3], [0, 1])

  // Image enters from right
  const imageX = useTransform(scrollYProgress, [0.15, 0.4], [150, 0])
  const imageOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1])
  const imageScale = useTransform(scrollYProgress, [0.15, 0.45], [1.1, 1])

  // Decorative line grows
  const lineWidth = useTransform(scrollYProgress, [0.2, 0.4], ['0%', '60%'])

  return (
    <section
      ref={ref}
      className="relative min-h-[130svh] w-full overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, #08111C 0%, #0a1823 40%, #0D1B2A 100%)',
      }}
    >
      {/* Horizontal grain texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />

      <div className="relative z-10 mx-auto grid min-h-[130svh] max-w-[1400px] grid-cols-1 items-center gap-8 px-6 md:grid-cols-2 md:gap-16 lg:px-12">
        {/* Left: Giant typography */}
        <motion.div
          style={{ x: textX, opacity: textOpacity }}
          className="relative"
        >
          <div className="space-y-2">
            <motion.h2
              className="font-display text-[clamp(3.5rem,10vw,9rem)] font-black leading-[0.85] tracking-tight text-cream"
            >
              {english ? 'TEST' : 'اختبر'}
            </motion.h2>
            <motion.h2
              className="font-display text-[clamp(3.5rem,10vw,9rem)] font-black leading-[0.85] tracking-tight text-teal-bright"
            >
              {english ? 'YOUR' : 'معلوماتك'}
            </motion.h2>
            <motion.h2
              className="font-display text-[clamp(3.5rem,10vw,9rem)] font-black leading-[0.85] tracking-tight text-cream"
            >
              {english ? 'KNOWLEDGE' : ''}
            </motion.h2>
          </div>

          {/* Accent line */}
          <motion.div
            className="mt-8 h-[2px] origin-left bg-gradient-to-r from-teal-bright via-teal-bright/50 to-transparent"
            style={{ width: lineWidth }}
          />

          {/* Subtitle */}
          <motion.p
            className="mt-6 max-w-md text-lg font-bold leading-relaxed text-cream/50 sm:text-xl"
          >
            {t('mosaicDesc')}
          </motion.p>

          {/* Minimal stat */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-10 flex items-baseline gap-3"
          >
            <span className="font-display text-5xl font-black text-gold-bright sm:text-6xl">
              6
            </span>
            <span className="text-sm font-bold tracking-[0.2em] uppercase text-cream/40">
              {english ? 'Worlds' : 'عوالم'}
            </span>
          </motion.div>
        </motion.div>

        {/* Right: Category image with mask reveal */}
        <motion.div
          style={{ x: imageX, opacity: imageOpacity }}
          className="relative hidden md:block"
        >
          <div className="relative overflow-hidden rounded-[2rem]">
            <motion.img
              src={PHOTOS.football}
              alt=""
              style={{ scale: imageScale }}
              className="aspect-[3/4] w-full object-cover object-center"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#08111C] via-transparent to-transparent opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#08111C] via-transparent to-transparent opacity-40" />

            {/* Floating label */}
            <div className="absolute bottom-6 left-6">
              <div className="rounded-full border border-teal-bright/30 bg-[#08111C]/80 px-4 py-2 backdrop-blur-sm">
                <span className="text-xs font-bold tracking-[0.15em] uppercase text-teal-bright">
                  {english ? 'Football' : 'كرة القدم'}
                </span>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </section>
  )
}

/* =========================================================
   Section 2 — WORLDS
   Full-screen horizontal scrolling showcase on desktop.
   Each category gets a full-viewport panel that slides in.
   On mobile: stacked cards with swipe feel.
   ========================================================= */

const WORLDS = [
  {
    id: 'football',
    titleKey: 'mosaicFootball' as const,
    color: '#8cc3ca',
    image: PHOTOS.football,
    descKey: 'sceneFootball' as const,
    number: '01',
  },
  {
    id: 'history',
    titleKey: 'mosaicHistory' as const,
    color: '#e3c76a',
    image: PHOTOS.history,
    descKey: 'sceneHistory' as const,
    number: '02',
  },
  {
    id: 'geography',
    titleKey: 'mosaicGeography' as const,
    color: '#93bcd8',
    image: PHOTOS.geography,
    descKey: 'sceneGeography' as const,
    number: '03',
  },
  {
    id: 'science',
    titleKey: 'mosaicScience' as const,
    color: '#7fb88f',
    image: PHOTOS.science,
    descKey: 'sceneScience' as const,
    number: '04',
  },
]

function WorldPanel({
  world,
  index,
  isActive,
  onHover,
  t,
}: {
  world: (typeof WORLDS)[number]
  index: number
  isActive: boolean
  onHover: () => void
  t: (k: string) => string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.8, delay: index * 0.15 }}
      onMouseEnter={onHover}
      className="group relative flex-shrink-0 cursor-pointer"
      style={{ width: 'min(85vw, 380px)' }}
    >
      {/* Image container with mask */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
        <motion.img
          src={world.image}
          alt={t(world.titleKey)}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08111C] via-[#08111C]/20 to-transparent opacity-80" />
        
        {/* Active border */}
        <div
          className="absolute inset-0 rounded-2xl border-2 transition-all duration-500"
          style={{
            borderColor: isActive ? world.color : 'rgba(255,255,255,0.08)',
          }}
        />

        {/* Number overlay */}
        <div className="absolute left-4 top-4">
          <span
            className="font-display text-6xl font-black opacity-20"
            style={{ color: world.color }}
          >
            {world.number}
          </span>
        </div>

        {/* Content overlay */}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <h3
            className="font-display text-3xl font-black sm:text-4xl"
            style={{ color: world.color }}
          >
            {t(world.titleKey)}
          </h3>
          <p className="mt-2 text-sm font-bold text-cream/60">
            {t(world.descKey)}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export function Worlds({
  t,
  english,
}: {
  t: (k: string) => string
  english: boolean
}) {
  const [activeWorld, setActiveWorld] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Handle mouse wheel for horizontal scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY
    }
  }, [])

  return (
    <section
      className="relative w-full overflow-hidden py-24 md:py-32"
      style={{
        background:
          'linear-gradient(180deg, #0D1B2A 0%, #0a1823 50%, #08111C 100%)',
      }}
    >
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.8 }}
          className="mb-16 md:mb-20"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-teal-bright/30 to-transparent" />
            <span className="text-xs font-bold tracking-[0.3em] uppercase text-teal-bright/60">
              {english ? 'Explore' : 'استكشف'}
            </span>
          </div>
          <h2 className="font-display text-4xl font-black text-cream sm:text-5xl lg:text-6xl">
            {t('mosaicTitle')}
          </h2>
          <p className="mt-4 max-w-xl text-lg text-cream/50">
            {english
              ? 'Four worlds. Infinite questions. One champion.'
              : 'أربعة عوالم. أسئلة لا نهائية. بطل واحد.'}
          </p>
        </motion.div>

        {/* Horizontal scrolling panels — Desktop */}
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="hidden gap-6 overflow-x-auto pb-8 scrollbar-hide md:flex"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {WORLDS.map((world, index) => (
            <WorldPanel
              key={world.id}
              world={world}
              index={index}
              isActive={activeWorld === index}
              onHover={() => setActiveWorld(index)}
              t={t}
            />
          ))}
        </div>

        {/* Stacked layout — Mobile */}
        <div className="grid gap-4 md:hidden">
          {WORLDS.map((world, index) => (
            <motion.div
              key={world.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative flex items-end overflow-hidden rounded-xl"
              style={{ aspectRatio: '16/9' }}
            >
              <img
                src={world.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08111C] via-[#08111C]/40 to-transparent" />
              <div className="relative z-10 p-4">
                <span
                  className="text-xs font-bold tracking-[0.2em]"
                  style={{ color: world.color }}
                >
                  {world.number}
                </span>
                <h3
                  className="font-display text-2xl font-black"
                  style={{ color: world.color }}
                >
                  {t(world.titleKey)}
                </h3>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Active world background glow */}
        <AnimatePresence>
          <motion.div
            key={activeWorld}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.08 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${WORLDS[activeWorld].color}, transparent 70%)`,
            }}
          />
        </AnimatePresence>
      </div>
    </section>
  )
}

/* =========================================================
   Section 3 — THE CHALLENGE
   Interactive game demo. Shows a question card with answer
   reveal animation. Scroll-driven entrance.
   ========================================================= */

export function TheChallenge({
  t,
  english,
}: {
  t: (k: string) => string
  english: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const cardY = useTransform(scrollYProgress, [0.2, 0.5], [80, 0])
  const cardOpacity = useTransform(scrollYProgress, [0.2, 0.4], [0, 1])
  const cardRotate = useTransform(scrollYProgress, [0.2, 0.5], [3, 0])

  const [showAnswer, setShowAnswer] = useState(false)

  // Auto-show answer when section is in view
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (v) => {
      if (v > 0.45 && !showAnswer) {
        setShowAnswer(true)
      }
    })
    return () => unsubscribe()
  }, [scrollYProgress, showAnswer])

  return (
    <section
      ref={ref}
      className="relative min-h-[120svh] w-full overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, #08111C 0%, #0D1B2A 40%, #102433 100%)',
      }}
    >
      {/* Background pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(140,195,202,0.1) 40px, rgba(140,195,202,0.1) 41px)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[120svh] max-w-[1200px] flex-col items-center justify-center gap-12 px-6 md:flex-row md:gap-20 lg:px-12">
        {/* Left: Section intro */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.8 }}
          className="flex-1"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px w-12 bg-gradient-to-r from-gold/60 to-transparent" />
            <span className="text-xs font-bold tracking-[0.3em] uppercase text-gold/60">
              {english ? 'Demo' : 'تجربة'}
            </span>
          </div>
          <h2 className="font-display text-4xl font-black text-cream sm:text-5xl">
            {t('sec1Title')}
          </h2>
          <p className="mt-4 max-w-md text-lg text-cream/50">
            {t('sec1Desc')}
          </p>

        </motion.div>

        {/* Right: Interactive question card */}
        <motion.div
          style={{ y: cardY, opacity: cardOpacity, rotate: cardRotate }}
          className="flex-1"
        >
          <div className="relative">
            {/* Question card */}
            <div className="relative overflow-hidden rounded-3xl border border-petro-line-strong bg-gradient-to-b from-[#102433] to-[#0a1823] p-8 shadow-2xl sm:p-10">
              {/* Top accent */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />

              {/* Question */}
              <div className="mb-6">
                <span className="text-xs font-bold tracking-[0.2em] uppercase text-gold/60">
                  {t('demoTurn')}
                </span>
                <h3 className="mt-2 font-display text-2xl font-black text-cream sm:text-3xl">
                  {t('demoQuestion')}
                </h3>
              </div>

              {/* Answer */}
              <AnimatePresence>
                {showAnswer && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/10 pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green/20">
                          <svg
                            className="h-4 w-4 text-green-bright"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <span className="text-lg font-bold text-green-bright">
                          {t('demoAnswer')}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reveal button */}
              {!showAnswer && (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="group mt-4 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-6 py-3 text-sm font-bold text-gold-bright transition-all hover:bg-gold/20"
                >
                  <span>{t('demoReveal')}</span>
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Decorative elements */}
            <div className="absolute -right-4 -bottom-4 h-full w-full rounded-3xl border border-teal/10" />
            <div className="absolute -right-8 -bottom-8 h-full w-full rounded-3xl border border-teal/5" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* =========================================================
   Section 4 — FACE OFF
   Competition showcase. Split view: Local vs Online.
   Horizontal scroll on desktop reveals each mode.
   ========================================================= */

export function FaceOff({
  t,
  english,
}: {
  t: (k: string) => string
  english: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const leftX = useTransform(scrollYProgress, [0.2, 0.5], [-80, 0])
  const rightX = useTransform(scrollYProgress, [0.2, 0.5], [80, 0])
  const opacity = useTransform(scrollYProgress, [0.2, 0.4], [0, 1])

  return (
    <section
      ref={ref}
      className="relative min-h-[110svh] w-full overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, #102433 0%, #0D1B2A 40%, #08111C 100%)',
      }}
    >
      <div className="relative z-10 mx-auto flex min-h-[110svh] max-w-[1400px] flex-col items-center justify-center gap-12 px-6 lg:px-12">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-teal/30" />
            <span className="text-xs font-bold tracking-[0.3em] uppercase text-teal-bright/60">
              {english ? 'Compete' : 'تنافس'}
            </span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-teal/30" />
          </div>
          <h2 className="font-display text-4xl font-black text-cream sm:text-5xl lg:text-6xl">
            {t('sec2Title')}
          </h2>
        </motion.div>

        {/* Two modes: Local vs Online */}
        <motion.div
          style={{ opacity }}
          className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 md:gap-8"
        >
          {/* Local mode */}
          <motion.div
            style={{ x: leftX }}
            className="group relative overflow-hidden rounded-3xl border border-petro-line bg-gradient-to-b from-[#102433]/80 to-[#0a1823]/80 p-8 sm:p-10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-teal/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-teal/20 bg-teal/10">
                  <svg
                    className="h-7 w-7 text-teal-bright"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 015 17.119V5a2 2 0 012-2h6"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-2xl font-black text-cream">
                    {english ? 'Local Play' : 'لعب محلي'}
                  </h3>
                  <p className="text-sm font-bold text-teal-bright/60">
                    {english ? 'Same device' : 'جهاز واحد'}
                  </p>
                </div>
              </div>

              <p className="text-base text-cream/60 leading-relaxed">
                {t('sec2Desc')}
              </p>

              {/* Team indicators */}
              <div className="mt-6 flex gap-3">
                <div className="flex items-center gap-2 rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
                  <span className="text-xs font-bold text-[#93bcd8]">
                    {english ? 'Team 1' : 'فريق 1'}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-[#ef4444]" />
                  <span className="text-xs font-bold text-[#fca5a5]">
                    {english ? 'Team 2' : 'فريق 2'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Online mode */}
          <motion.div
            style={{ x: rightX }}
            className="group relative overflow-hidden rounded-3xl border border-petro-line bg-gradient-to-b from-[#102433]/80 to-[#0a1823]/80 p-8 sm:p-10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10">
                  <svg
                    className="h-7 w-7 text-gold-bright"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-2xl font-black text-cream">
                    {english ? 'Online Play' : 'لعب أونلاين'}
                  </h3>
                  <p className="text-sm font-bold text-gold-bright/60">
                    {english ? 'Up to 6 players' : 'لحد ٦ لاعبين'}
                  </p>
                </div>
              </div>

              <p className="text-base text-cream/60 leading-relaxed">
                {t('sec4Desc')}
              </p>

              {/* Room code preview */}
              <div className="mt-6 flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-petro-line-strong bg-[#0D1B2A] px-4 py-2 font-mono text-sm font-bold tracking-widest text-cream">
                  FHL-2024
                </div>
                <span className="text-xs font-bold text-cream/40">
                  {english ? 'Room Code' : 'كود الغرفة'}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Lifelines showcase */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-4 text-center"
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/30" />
            <span className="text-xs font-bold tracking-[0.3em] uppercase text-gold-bright/60">
              {english ? 'Lifelines' : 'المساعدات'}
            </span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/30" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              {
                label: english ? 'Call Friend' : 'اتصال بصديق',
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                ),
              },
              {
                label: english ? 'Block' : 'حظر',
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                ),
              },
              {
                label: english ? 'Double Points' : 'مضاعفة',
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                  </svg>
                ),
              },
              {
                label: english ? 'Spin Wheel' : 'عجلة الحظ',
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-2 text-sm font-bold text-gold-bright"
              >
                {item.icon}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* =========================================================
   Section 5 — JOIN
   Powerful closing. Massive typography with the logo.
   Two CTAs with distinct visual weight.
   ========================================================= */

export function Join({
  t,
  english,
}: {
  t: (k: string) => string
  english: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const titleScale = useTransform(scrollYProgress, [0.2, 0.5], [0.85, 1])
  const titleOpacity = useTransform(scrollYProgress, [0.2, 0.4], [0, 1])
  const titleY = useTransform(scrollYProgress, [0.2, 0.5], [60, 0])

  const ctaOpacity = useTransform(scrollYProgress, [0.4, 0.6], [0, 1])
  const ctaY = useTransform(scrollYProgress, [0.4, 0.6], [30, 0])

  // Background parallax
  const bgY = useTransform(scrollYProgress, [0, 1], ['-10%', '10%'])

  return (
    <section
      ref={ref}
      className="relative min-h-[100svh] w-full overflow-hidden px-6"
      style={{
        background:
          'linear-gradient(180deg, #08111C 0%, #0D1B2A 40%, #123247 100%)',
      }}
    >
      {/* Background radial glow */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ y: bgY }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 50%, rgba(227,199,106,0.06), transparent 70%)',
          }}
        />
      </motion.div>

      {/* Diagonal accent lines */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-[30%] h-px w-[150%] rotate-[-8deg] bg-gradient-to-r from-transparent via-teal/8 to-transparent" />
        <div className="absolute -left-1/4 top-[60%] h-px w-[150%] rotate-[-8deg] bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center text-center">
        {/* Logo */}
        <motion.img
          src={PHOTOS.logo}
          alt="فهلوي"
          style={{
            scale: titleScale,
            opacity: titleOpacity,
          }}            className="h-24 w-24 rounded-2xl object-cover ring-1 ring-white/10 sm:h-28 sm:w-28"
        />

        {/* Giant title */}
        <motion.h2
          className="mt-8 font-display text-[clamp(4rem,14vw,11rem)] font-black leading-[0.85] text-cream"
          style={{
            scale: titleScale,
            opacity: titleOpacity,
            y: titleY,

          }}
        >
          فهلوي
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          style={{ opacity: ctaOpacity, y: ctaY }}
          className="mt-6 max-w-lg text-xl font-bold text-cream/50 sm:text-2xl"
        >
          {t('heroReady')}
        </motion.p>

        {/* CTAs */}
        <motion.div
          style={{ opacity: ctaOpacity, y: ctaY }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          {/* Primary CTA */}
          <Link
            to="/create"
            className="group inline-flex items-center justify-center gap-3 rounded-xl border border-[#f3cc62]/70 bg-gradient-to-b from-[#e8ba3c] via-[#cca028] to-[#b3881b] px-9 py-4 text-lg font-extrabold text-[#09121d] shadow-[0_4px_18px_rgba(204,160,40,0.3),inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.2)] transition-all duration-200 hover:from-[#f5c748] hover:to-[#be9320] hover:shadow-[0_6px_24px_rgba(204,160,40,0.45)] active:translate-y-[1px]"
          >
            <Play className="h-5 w-5 fill-current transition-transform duration-200 group-hover:scale-110" />
            <span>{t('ctaPlay')}</span>
          </Link>

          {/* Secondary CTA */}
          <Link
            to="/online"
            className="group inline-flex items-center justify-center gap-3 rounded-xl border border-[#2b4468] bg-[#0c1929]/90 px-8 py-4 text-lg font-extrabold text-[#9ec4ed] shadow-[0_4px_18px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:border-[#4272aa] hover:bg-[#112238] hover:text-white active:translate-y-[1px]"
          >
            <Globe className="h-5 w-5 text-[#5fa4e6] transition-transform duration-200 group-hover:rotate-12 group-hover:text-[#7ec2ff]" />
            <span>{t('ctaOnline')}</span>
          </Link>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-20 text-xs font-bold tracking-[0.1em] text-cream/30"
        >
          {english
            ? '© 2024 Fahloy — An original Arabic quiz experience'
            : '© 2024 فهلوي — تجربة مسابقات عربية أصلية'}
        </motion.p>
      </div>
    </section>
  )
}
