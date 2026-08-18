import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useTransform, useMotionValueEvent, type MotionValue } from 'framer-motion'
import { ScrollStage } from './ScrollStage'
import { useTranslation } from '../../i18n/translations'

/* =========================================================
   فهلوي — Scroll Story (homepage)
   =========================================================

   ONE continuous cinematic film. Scroll = camera progress.

     Scene 01  Opening        — orbit-globe video, dark world
     Scene 02  Football       — football photo enters
     Scene 03  History        — history photo, warm light
     Scene 04  Geography      — map photo, camera zoom
     Scene 05  Science        — AI photo, deep cyan
     Scene 06  Video chapter  — showcase-stream video as a major cut
     Scene 07  Final CTA      — back to Fahloy petrol + gold

   The stage is sticky (ScrollStage): the viewport never scrolls,
   the camera does. Every scene is a progress range; its photo, title
   and lighting are all mapped from scroll position.

   Videos live in HERO_VIDEOS — add a third file to public/videos/home/
   and append one entry, no component change needed.

   Performance: only the opening video is loaded immediately; the
   second video mounts (and starts buffering) when the story reaches
   its chapter. Decorative layers are pointer-events-none.
   ========================================================= */

interface HeroVideo {
  id: string
  src: string
}

/** Cinematic video chapters — add a third file here later. */
const HERO_VIDEOS: HeroVideo[] = [
  { id: 'orbit', src: '/videos/home/animo-orbit-globe-720p.mp4' },
  { id: 'stream', src: '/videos/home/animo-showcase-stream-720p.mp4' },
  // Third chapter — drop the file into public/videos/home/ then uncomment:
  // { id: 'third', src: '/videos/home/video-3.mp4' },
]

/** Category photos — the scene actors (portrait posters). */
const PHOTOS = {
  football: '/photos/The legendary players of soccer.jpeg',
  history: '/photos/download.jpeg',
  geography: '/photos/download (1).jpeg',
  science: '/photos/Arte AI (anônima).jpeg',
  logo: '/photos/لوجو.jpeg',
}

/* ---------------- Chapter progress ranges (overlap → soft cuts) ---------------- */

const RANGE_OPEN: [number, number] = [0, 0.16]
const RANGE_FOOTBALL: [number, number] = [0.14, 0.32]
const RANGE_HISTORY: [number, number] = [0.3, 0.48]
const RANGE_GEOGRAPHY: [number, number] = [0.46, 0.64]
const RANGE_SCIENCE: [number, number] = [0.62, 0.78]
const RANGE_VIDEO: [number, number] = [0.76, 0.9]
const RANGE_FINAL: [number, number] = [0.88, 1]

/* ---------------- Small shared helpers ---------------- */

/** A chapter layer: fades in/out across its progress range, never blocks clicks. */
function Chapter({
  progress,
  range,
  children,
  visibleAtStart = false,
}: {
  progress: MotionValue<number>
  range: readonly [number, number]
  children: React.ReactNode
  /** First chapter: already fully visible at progress 0 — mount animation handles its entrance. */
  visibleAtStart?: boolean
}) {
  const opacity = useTransform(
    progress,
    [range[0], range[0] + 0.02, range[1] - 0.02, range[1]],
    visibleAtStart ? [1, 1, 1, 0] : [0, 1, 1, 0],
  )
  return (
    <motion.div style={{ opacity }} className="pointer-events-none absolute inset-0">
      {children}
    </motion.div>
  )
}

/** A portrait photo that enters the frame, holds, then recedes with blur. */
function PhotoActor({
  local,
  src,
  alt,
  from,
  parallax = 16,
}: {
  local: MotionValue<number>
  src: string
  alt: string
  from: number
  parallax?: number
}) {
  const opacity = useTransform(local, [0.12, 0.24, 0.82, 0.94], [0, 1, 1, 0])
  const x = useTransform(local, [0.12, 0.4, 0.82, 1], [from, 0, 0, from * -0.55])
  const scale = useTransform(local, [0.12, 0.42], [0.84, 1])
  const blur = useTransform(local, [0.84, 1], ['blur(0px)', 'blur(9px)'])
  const drift = useTransform(local, [0, 1], [parallax, -parallax])
  return (
    <motion.div
      style={{ opacity, x, scale, filter: blur }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <motion.div style={{ y: drift }} className="relative">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-[52vh] w-[min(82vw,20rem)] rounded-[1.4rem] border border-white/12 object-cover shadow-[0_44px_90px_rgba(0,0,0,0.6)] ring-1 ring-black/40 sm:h-[60vh] sm:w-[min(30vw,21rem)]"
        />
      </motion.div>
    </motion.div>
  )
}

/** The chapter's title — appears late in the scene, elegant and calm. */
function ChapterTitle({
  local,
  title,
  accent,
}: {
  local: MotionValue<number>
  title: string
  accent: string
}) {
  const opacity = useTransform(local, [0.42, 0.6], [0, 1])
  const y = useTransform(local, [0.42, 0.62], [22, 0])
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-x-0 bottom-[13vh] flex flex-col items-center gap-2 px-6 text-center"
    >
      <span className="font-display text-3xl font-extrabold text-cream sm:text-5xl" style={{ color: accent }}>
        {title}
      </span>
    </motion.div>
  )
}

/** Soft atmospheric glow behind a chapter's photo. */
function SceneGlow({ local, color }: { local: MotionValue<number>; color: string }) {
  const opacity = useTransform(local, [0.15, 0.45, 0.85, 1], [0, 0.55, 0.55, 0])
  return (
    <motion.div
      aria-hidden
      style={{ opacity, background: `radial-gradient(52% 42% at 50% 46%, ${color}, transparent 72%)` }}
      className="absolute inset-0"
    />
  )
}

/* =========================================================
   Scene components
   ========================================================= */

function OpeningScene({ progress, t }: { progress: MotionValue<number>; t: (k: string) => string }) {
  // The world fades in on MOUNT (never scroll-gated) — the first paint
  // already shows the video. Scroll only drives the camera push that
  // carries us into the next chapter.
  const videoScale = useTransform(progress, [0, 0.14], [1, 1.14])
  const videoBlur = useTransform(progress, [0.1, 0.16], ['blur(0px)', 'blur(5px)'])
  const hintOpacity = useTransform(progress, [0.05, 0.14], [1, 0])

  const EASE = [0.25, 1, 0.5, 1] as const

  return (
    <Chapter progress={progress} range={RANGE_OPEN} visibleAtStart>
      {/* opening video — the world. Mount-driven fade-in: visible immediately. */}
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
      <div className="vignette-dark" aria-hidden />

      {/* opening identity — appears on mount with a calm stagger */}
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

      {/* scroll hint — visible immediately, fades as the camera moves on */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1.5"
      >
        <motion.div style={{ opacity: hintOpacity }} className="flex flex-col items-center gap-1.5">
        <span className="text-[11px] font-bold tracking-[0.3em] text-cream/60">{t('scrollHint')}</span>
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="text-base text-gold-bright"
            aria-hidden
          >
            ▾
          </motion.span>
        </motion.div>
      </motion.div>
    </Chapter>
  )
}

function FootballScene({ progress, t, english }: { progress: MotionValue<number>; t: (k: string) => string; english: boolean }) {
  const local = useTransform(progress, RANGE_FOOTBALL, [0, 1])
  // the opening world recedes into the background as the photo arrives
  const bgOpacity = useTransform(progress, [0.14, 0.24], [1, 0.16])
  const bgScale = useTransform(progress, [0.14, 0.32], [1.14, 1.3])
  const bgBlur = useTransform(progress, [0.14, 0.28], ['blur(5px)', 'blur(12px)'])
  return (
    <Chapter progress={progress} range={RANGE_FOOTBALL}>
      <motion.div style={{ opacity: bgOpacity, scale: bgScale, filter: bgBlur }} className="absolute inset-0" aria-hidden>
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
      <SceneGlow local={local} color="rgba(47, 111, 126, 0.5)" />
      <PhotoActor local={local} src={PHOTOS.football} alt={t('mosaicFootball')} from={english ? -90 : 90} />
      <ChapterTitle local={local} title={t('mosaicFootball')} accent="#8cc3ca" />
    </Chapter>
  )
}

function HistoryScene({ progress, t, english }: { progress: MotionValue<number>; t: (k: string) => string; english: boolean }) {
  const local = useTransform(progress, RANGE_HISTORY, [0, 1])
  return (
    <Chapter progress={progress} range={RANGE_HISTORY}>
      <SceneGlow local={local} color="rgba(201, 162, 39, 0.34)" />
      <PhotoActor local={local} src={PHOTOS.history} alt={t('mosaicHistory')} from={english ? 90 : -90} parallax={20} />
      <ChapterTitle local={local} title={t('mosaicHistory')} accent="#e3c76a" />
    </Chapter>
  )
}

function GeographyScene({ progress, t }: { progress: MotionValue<number>; t: (k: string) => string }) {
  const local = useTransform(progress, RANGE_GEOGRAPHY, [0, 1])
  // camera zoom into the map
  const opacity = useTransform(local, [0.1, 0.26, 0.84, 0.96], [0, 1, 1, 0])
  const scale = useTransform(local, [0.1, 0.55], [0.62, 1.12])
  const blur = useTransform(local, [0.88, 1], ['blur(0px)', 'blur(10px)'])
  const titleY = useTransform(local, [0.5, 0.68], [26, 0])
  const titleOpacity = useTransform(local, [0.5, 0.68], [0, 1])
  return (
    <Chapter progress={progress} range={RANGE_GEOGRAPHY}>
      <SceneGlow local={local} color="rgba(46, 111, 158, 0.45)" />
      <motion.div style={{ opacity, scale, filter: blur }} className="absolute inset-0 flex items-center justify-center">
        <img
          src={PHOTOS.geography}
          alt={t('mosaicGeography')}
          loading="lazy"
          decoding="async"
          className="h-[54vh] w-[min(84vw,21rem)] rounded-[1.4rem] border border-white/12 object-cover shadow-[0_44px_90px_rgba(0,0,0,0.6)] sm:h-[62vh]"
        />
      </motion.div>
      <motion.div style={{ opacity: titleOpacity, y: titleY }} className="absolute inset-x-0 bottom-[13vh] px-6 text-center">
        <span className="font-display text-3xl font-extrabold text-cream sm:text-5xl" style={{ color: '#93bcd8' }}>
          {t('mosaicGeography')}
        </span>
      </motion.div>
    </Chapter>
  )
}

function ScienceScene({ progress, t, english }: { progress: MotionValue<number>; t: (k: string) => string; english: boolean }) {
  const local = useTransform(progress, RANGE_SCIENCE, [0, 1])
  return (
    <Chapter progress={progress} range={RANGE_SCIENCE}>
      <SceneGlow local={local} color="rgba(47, 125, 126, 0.4)" />
      <PhotoActor local={local} src={PHOTOS.science} alt={t('mosaicScience')} from={english ? -80 : 80} parallax={22} />
      <ChapterTitle local={local} title={t('mosaicScience')} accent="#7fb88f" />
    </Chapter>
  )
}

function VideoChapter({ progress, t }: { progress: MotionValue<number>; t: (k: string) => string }) {
  const local = useTransform(progress, RANGE_VIDEO, [0, 1])
  const [mounted, setMounted] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  useMotionValueEvent(local, 'change', (v) => {
    if (v > 0.04 && !mounted) setMounted(true)
  })
  const opacity = useTransform(local, [0.08, 0.32, 0.86, 1], [0, 1, 1, 0])
  const scale = useTransform(local, [0.08, 0.4], [1.16, 1])
  const blur = useTransform(local, [0.08, 0.34], ['blur(12px)', 'blur(0px)'])
  const textOpacity = useTransform(local, [0.3, 0.48], [0, 1])
  const textY = useTransform(local, [0.3, 0.5], [18, 0])

  return (
    <Chapter progress={progress} range={RANGE_VIDEO}>
      <motion.div style={{ opacity, scale, filter: blur }} className="absolute inset-0">
        {mounted && (
          <video
            ref={videoRef}
            src={HERO_VIDEOS[1].src}
            autoPlay
            muted
            playsInline
            loop
            preload="auto"
            disablePictureInPicture
            className="h-full w-full object-cover object-center"
          />
        )}
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,15,23,0.6)_0%,rgba(6,15,23,0.18)_45%,rgba(6,15,23,0.55)_100%)]" />
      <motion.div style={{ opacity: textOpacity, y: textY }} className="absolute inset-x-0 bottom-[16vh] flex flex-col items-center gap-3 px-6 text-center">
        <span className="font-display text-3xl font-extrabold text-cream sm:text-5xl">{t('mosaicTitle')}</span>
        <span className="max-w-md text-sm font-bold text-cream/75 sm:text-base">{t('mosaicDesc')}</span>
      </motion.div>
    </Chapter>
  )
}

function FinalScene({ progress, t, english }: { progress: MotionValue<number>; t: (k: string) => string; english: boolean }) {
  const local = useTransform(progress, RANGE_FINAL, [0, 1])
  const frameOpacity = useTransform(local, [0.1, 0.3], [0, 1])
  const frameY = useTransform(local, [0.1, 0.32], [30, 0])
  const logoScale = useTransform(local, [0.16, 0.36], [0.9, 1])
  const ctaOpacity = useTransform(local, [0.45, 0.62], [0, 1])
  const ctaY = useTransform(local, [0.45, 0.64], [24, 0])
  // only let the CTA catch clicks once the scene is actually on screen
  const pointer = useTransform(local, [0.5, 0.55], ['none', 'auto'])

  return (
    <motion.div
      style={{ opacity: frameOpacity, y: frameY, pointerEvents: pointer }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
    >
      <div aria-hidden className="vignette-dark" />
      <motion.img
        src={PHOTOS.logo}
        alt="فهلوي"
        style={{ scale: logoScale }}
        className="h-20 w-20 rounded-2xl object-cover shadow-[0_18px_44px_rgba(0,0,0,0.5)] ring-1 ring-gold/40 sm:h-24 sm:w-24"
      />
      <h2 className="title-hero mt-5 text-cream" style={{ textShadow: '0 18px 60px rgba(8,17,28,0.75)' }}>
        فهلوي
      </h2>
      <p className="mt-4 text-xl font-black text-gold-bright sm:text-2xl">{t('heroReady')}</p>
      <motion.div style={{ opacity: ctaOpacity, y: ctaY }} className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link to="/create" className="btn btn-gold rounded-xl px-10 py-4 text-base font-black">
          {t('ctaPlay')} <span aria-hidden>{english ? '→' : '←'}</span>
        </Link>
        <Link to="/online" className="btn btn-teal rounded-xl px-9 py-4 text-base font-black">
          🌐 {t('ctaOnline')}
        </Link>
      </motion.div>
    </motion.div>
  )
}

/* =========================================================
   The full story — sticky camera over a tall stage
   ========================================================= */

export function ScrollStory() {
  const { t: translate, english } = useTranslation()
  // Presentation-only: widen the key type so scenes can look up
  // visual copy without touching game state.
  const t = (k: string) => translate(k as Parameters<typeof translate>[0])

  return (
    <ScrollStage height="h-[850vh]">
      {(progress) => (
        <>
          {/* stage base — deep navy, shared by every world */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(130% 120% at 50% -10%, #123247 0%, #0D1B2A 55%, #08111C 100%)' }}
          />

          <OpeningScene progress={progress} t={t} />
          <FootballScene progress={progress} t={t} english={english} />
          <HistoryScene progress={progress} t={t} english={english} />
          <GeographyScene progress={progress} t={t} />
          <ScienceScene progress={progress} t={t} english={english} />
          <VideoChapter progress={progress} t={t} />
          <FinalScene progress={progress} t={t} english={english} />

          {/* scroll-progress rail — a gold hairline tracking the camera's journey */}
          <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-y-8 start-3 z-40 w-[3px] rounded-full bg-white/10 sm:start-5"
          >
            <motion.div
              className="absolute inset-x-0 top-0 h-full origin-top rounded-full bg-gradient-to-b from-gold via-gold/85 to-teal"
              style={{ scaleY: progress }}
            />
          </motion.div>
        </>
      )}
    </ScrollStage>
  )
}
