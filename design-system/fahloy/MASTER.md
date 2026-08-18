# فهلوي (Fahloy) — Design System MASTER

Source: UI/UX Pro Max skill — Reasoning Rule #121 (Trivia & Quiz Game)
Persisted: 2026-08-15

---

## PRODUCT

- **Product:** Arabic trivia / game-show / multiplayer quiz game
- **Platforms:** Web (desktop + mobile portrait/landscape), RTL-first (Arabic), LTR (English)
- **Stack:** React + TypeScript + Tailwind v4 + Framer Motion (installed)
- **Pattern:** Feature-Rich Showcase + Social Proof (landing) → immersive game surfaces
- **Style:** Vibrant & Block-based + Micro-interactions (skill-recommended for trivia)
- **Mood:** Premium television game show + modern Arabic product. Confident, warm, comfortable for long sessions.

## COLOR DIRECTION

Skill-recommended mood for Trivia & Quiz: **Energetic blue + correct green + incorrect red + leaderboard gold.**

Anti-patterns (avoid): muted/low-energy palettes, neon purple, neon pink, rainbow gradients, excessive cyan glow, AI purple/pink gradients.

### Palette (contrast-verified, WCAG AA ≥ 4.5:1 on navy)

| Token | Hex | Use | Contrast on `--color-navy` |
|---|---|---|---|
| `--color-navy` (bg) | `#0B1526` | Base background | — |
| `--color-navy-2` | `#101D2E` | Panels | — |
| `--color-navy-3` | `#15263A` | Tiles / raised | — |
| `--color-cream` | `#F2EEE4` | Primary text | 15.8:1 |
| `--color-gold` | `#C9A227` | Scores, winners, premium CTA | 7.6:1 |
| `--color-gold-bright` | `#E3C76A` | Gold emphasis text | 11.0:1 |
| `--color-teal` | `#2A7F8C` | Interactive elements | — |
| `--color-teal-bright` | `#8CC3CA` | Teal text on navy | 9.4:1 |
| `--color-green` | `#3E7C59` | Correct / positive | — |
| `--color-green-bright` | `#7FB88F` | Green text on navy | 8.0:1 |
| `--color-red` | `#B0554F` | Incorrect / negative | — |
| `--color-red-bright` | `#D19A94` | Red text on navy | 7.6:1 |
| `--color-muted` | `#9FB0C4` | Secondary text | 8.3:1 |

CTA button: `#201A08` on gold gradient (7.2:1). One accent color per context — no rainbow.

## TYPOGRAPHY

- **Display:** Changa (Arabic + Latin, game-show energy) — wordmark, scene titles, scores
- **Body/UI:** IBM Plex Sans Arabic — body, buttons, questions, labels
- **Scale intent:** Large questions (mobile ≥ 24px), bold scores with `tabular-nums` (no layout shift), display headlines for scene titles.
- Numerals: `tabular-nums` everywhere scores/counts render.

## EFFECTS & MOTION

- **Micro-interactions:** 50–150ms, snappy (per skill rule: small 50–100ms animations for trivia).
- **State communication:** press/scale on cells, count-up on scores, glow on current turn, distinct reveal for answers.
- **Motion language:** one shared set of framer-motion variants; exit faster than enter; reduced-motion respected (MotionConfig + CSS media query — already in project).
- Avoid: infinite decorative animation, animating width/height, random per-component durations.

## ANTI-PATTERNS (DO NOT)

1. Cyan→blue→purple rainbow gradients (existing OnlineHome create button — must go)
2. Scattered raw hex in components — always tokens
3. Muted/low-energy neutrals for the game surfaces
4. Emoji as icons in UI chrome (keep emoji only inside playful scene art)
5. Light page backgrounds mixed with dark components (the current /online light page)
6. Touch targets < 44px, text < 12px for essential content

## PRE-DELIVERY CHECKLIST (per surface)

- [ ] text contrast ≥ 4.5:1 (verified above for on-navy text)
- [ ] touch targets ≥ 44px on mobile; ≥ 8px spacing between adjacent targets
- [ ] visible focus states for keyboard
- [ ] prefers-reduced-motion respected
- [ ] no horizontal overflow at 320 / 360 / 390 / 768 / desktop
- [ ] question text scrolls independently; images/videos stay OUTSIDE the scroll container
- [ ] status (turn, used cell, lifeline used, connection) never conveyed by color alone
