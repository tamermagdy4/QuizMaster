import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { HERO_VIDEOS } from './homeContent'
import {
  TheArena,
  Worlds,
  TheChallenge,
  FaceOff,
  Join,
} from './HomeSections'
import { useTranslation } from '../../i18n/translations'

/* =========================================================
   فهلوي — ScrollStory (homepage)
   
   PREMIUM REDESIGN: "Cinematic Dark Premium"
   
   The Hero (OpeningScene) is preserved EXACTLY as-is.
   Everything after uses entirely new section designs:
   - TheArena: Split-screen horizontal reveal
   - Worlds: Horizontal scrolling category showcase
   - TheChallenge: Interactive game demo
   - FaceOff: Competition showcase (Local vs Online)
   - Join: Powerful closing CTA
   ========================================================= */

/* =========================================================
   Scene 01 — Opening (Hero) — DO NOT MODIFY
   
   This is the exact same OpeningScene from the original.
   It is the Hero section and must remain 100% unchanged.
   ========================================================= */

function OpeningScene({ t }: { t: (k: string) => string }) {
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.14])
  const videoBlur = useTransform(scrollYProgress, [0, 1], ['blur(0px)', 'blur(5px)'])
  const hintOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  const EASE = [0.25, 1, 0.5, 1] as const

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(130% 120% at 50% -10%, #123247 0%, #0D1B2A 55%, #08111C 100%)',
      }}
    >
      {/* opening video — the world */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        style={{ scale: videoScale, filter: videoBlur }}
        className="absolute inset-0"
      >
        <video
          src={HERO_VIDEOS[0].src}
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
          disablePictureInPicture
          className="h-full w-full object-cover object-center"
        />
      </motion.div>

      {/* readability + depth overlays */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,15,23,0.72)_0%,rgba(6,15,23,0.22)_45%,rgba(6,15,23,0.5)_75%,rgba(6,15,23,0.92)_100%)]" />
      <div className="pointer-events-none absolute inset-0 vignette-dark" aria-hidden />

      {/* opening identity */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
          className="font-display text-2xl font-extrabold tracking-[0.3em] text-cream sm:text-3xl"
        >
          فهلوي
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
          className="mt-3 max-w-xl text-sm font-bold leading-relaxed text-cream/75 sm:text-base"
        >
          {t('heroTag')}
        </motion.p>
      </div>

      {/* scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1.5"
      >
        <motion.span style={{ opacity: hintOpacity }} className="text-[11px] font-bold tracking-[0.3em] text-cream/60">
          {t('scrollHint')}
        </motion.span>
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="text-base text-gold-bright"
          aria-hidden
        >
          ▾
        </motion.span>
      </motion.div>
    </section>
  )
}

/* =========================================================
   The full story — Cinematic Dark Premium design
   ========================================================= */

export function ScrollStory() {
  const { t: translate, english } = useTranslation()
  const t = (k: string) => translate(k as Parameters<typeof translate>[0])

  return (
    <div className="relative w-full bg-[#08111C]" aria-label="فهلوي">
      {/* Hero — preserved EXACTLY as-is */}
      <OpeningScene t={t} />

      {/* Premium new sections */}
      <TheArena t={t} english={english} />
      <Worlds t={t} english={english} />
      <TheChallenge t={t} english={english} />
      <FaceOff t={t} english={english} />
      <Join t={t} english={english} />
    </div>
  )
}
