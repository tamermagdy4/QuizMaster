/** فهلوي — shared home media content (videos + photos). */

export interface HeroVideo {
  id: string
  src: string
}

/** Cinematic video chapters — add a third file here later. */
export const HERO_VIDEOS: HeroVideo[] = [
  { id: 'orbit', src: '/videos/home/animo-orbit-globe-720p.mp4' },
  { id: 'stream', src: '/videos/home/animo-showcase-stream-720p.mp4' },
  // Third chapter — drop the file into public/videos/home/ then uncomment:
  // { id: 'third', src: '/videos/home/video-3.mp4' },
]

/** Category photos — the scene actors (portrait posters). */
export const PHOTOS = {
  football: '/photos/The legendary players of soccer.jpeg',
  history: '/photos/download.jpeg',
  geography: '/photos/download (1).jpeg',
  science: '/photos/Arte AI (anônima).jpeg',
  logo: '/photos/لوجو.jpeg',
}