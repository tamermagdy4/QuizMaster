# Homepage cinematic video backgrounds

The homepage is built around **real MP4 scenes** (the actual assets shipped for
Fahloy). Each chapter's video lives in this folder and is wired in
`src/components/home/scenes.tsx` (`VIDEO` map). Keep these names — they are the
current assets:

| Chapter           | File                  |
| ----------------- | --------------------- |
| Football          | `الرياضه.mp4`          |
| History           | `التاريخ.mp4`          |
| Geography         | `الجغرافيا.mp4`        |
| General Knowledge | `معلومات عامه.mp4`     |
| Movies            | `افلام.mp4`            |

## Behaviour (already implemented)

- **One video plays at a time** — only the scene currently on screen plays;
  every other clip is paused (even while mounted).
- **Lazy loading** — a clip is only fetched once its scene approaches the
  viewport (`LOAD_WINDOW` in `CinematicScene.tsx`), so the first load stays
  light. Once fetched it stays mounted, so scrolling back never re-downloads.
- **Graceful poster** — the layered CSS world renders underneath each clip and
  the video fades in over it once its first frame decodes (no black flash).
- **Reduced motion** — `prefers-reduced-motion` users never see video playback;
  the CSS world shows instead.
- Videos are `muted loop playsInline object-fit: cover` — never distorted.

## Recommended specs

- **Duration:** 3–8 s, seamless loop (start frame ≈ end frame)
- **Codec:** H.264 (MP4) — broadest support, hardware-accelerated
- **Resolution:** 1280×720 or 1920×1080 (keep under ~5 MB)
- **Color:** dark, muted, no text / logo / watermark inside the video

## Replace a scene

Drop the new file over the same name (or update the `VIDEO` map in
`src/components/home/scenes.tsx`). Delete a file and that chapter gracefully
falls back to its CSS world with no console errors.

## Sound

Homepage ambient audio is a single loop at `/sounds/home/ambient.mp3` (optional,
same drop-in idea). The 🔊 toggle on the homepage activates it — autoplay is
never forced; when enabled it fades in smoothly.
