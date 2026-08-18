import { MotionConfig } from 'framer-motion'
import { ScrollStory } from '../components/home/ScrollStory'

/**
 * فهلوي — homepage
 *
 * ONE continuous scroll-driven cinematic film. Scroll = camera progress.
 *
 *   Opening (orbit-globe video) → Football → History → Geography
 *   → Science → Video chapter (showcase-stream) → Final CTA
 *
 * Every scene is mapped from scroll position — photos enter the frame,
 * the camera zooms, chapters cross-fade. The Fahloy header floats
 * transparently over the opening and solidifies on scroll (MainLayout).
 *
 * Presentation-only: no real game state is touched.
 */
export function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <ScrollStory />
    </MotionConfig>
  )
}
