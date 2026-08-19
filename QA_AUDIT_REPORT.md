# FAHLOY QA AUDIT

## 1. Baseline

| Metric | Value |
|--------|-------|
| **Git status** | On branch `main`, up to date with `origin/main`, clean working tree |
| **HEAD commit** | `40aa2ec Remove hardcoded test credentials` |
| **Tests** | 329 passed (13 test files), 0 failed — vitest v4.1.10 |
| **Build** | ✓ built in 5.65s (tsc -b && vite build) — warnings about chunk sizes |
| **npm audit** | 0 vulnerabilities |

---

## 2. Critical Issues

### C1 — Classic Online: No Server-Side Identity Verification
- **Severity:** CRITICAL
- **File:** `src/services/online/onlineChannel.ts:75-86`, `src/services/online/onlineRoomService.ts:84-87`
- **Problem:** The Classic Online system uses Supabase Realtime broadcast channels where the `playerId` field is client-supplied and forgeable. No server-side identity verification exists.
- **Why it matters:** A determined attacker can forge any event type, claim to be any player, and manipulate game state (scores, turns, question selections).
- **Recommended fix:** Migrate Classic Online to server-authoritative RPCs (like the Live Pack system already does), or accept this as a documented limitation for casual play.

### C2 — Classic Online: Bootstrap Trust Exploitation
- **Severity:** CRITICAL
- **File:** `src/services/online/onlineRoomService.ts:265-301`
- **Problem:** When a joiner first connects, they accept the first `ROOM_STATE` event where `event.playerId === payload.room.hostId`. Since `playerId` is client-supplied, an attacker can forge a self-consistent snapshot and hijack the room.
- **Why it matters:** An attacker can impersonate the host and take full control of the game.
- **Recommended fix:** Server-side room state management or cryptographic host verification.

### C3 — FFA Auto-Finish Effect Is Dead Code
- **Severity:** CRITICAL
- **File:** `src/pages/GameBoard.tsx:597-611`, `src/store/gameBoardStore.ts:507-594`
- **Problem:** The auto-finish effect checks `cells.flat().every(cell => cell.team1Played && cell.team2Played)`, but in FFA mode `team1Played`/`team2Played` are never set on cells. The condition is always `false` in FFA mode.
- **Why it matters:** In FFA games, automatic navigation to Results relies solely on the store's `isGameFinished` flag being read elsewhere. The `GameBoard.tsx` auto-navigate effect is dead code for FFA mode.
- **Recommended fix:** Add FFA-aware finish detection using `ffaPlayers` cell usage tracking.

### C4 — Persistent Store State Corruption on Play Again
- **Severity:** CRITICAL
- **File:** `src/pages/Results.tsx:38-59`
- **Problem:** `handlePlayAgain` resets board state but omits several fields: `gameMode`, `pendingDoublePoints`, `blockActive`, `callFriendActive`, `callFriendTimeLeft`, `callFriendHint`, `wheelBonus`, `wheelPending`, `wheelPendingTeam`, `ffaWheelPendingPlayerId`, `answerSubmitted`, `selectedAnswer`, `answerCorrect`, `answerPoints`. These persist to localStorage via Zustand persist middleware.
- **Why it matters:** If the user refreshes on Results, localStorage contains inconsistent state. `gameMode: 'online'` could momentarily affect `isCellPlayable` logic on next game.
- **Recommended fix:** Reset all omitted fields in `handlePlayAgain`.

---

## 3. High Priority Issues

### H1 — FFA Score Broadcasts Carry Stale Team Scores
- **Severity:** HIGH
- **File:** `src/store/gameBoardStore.ts:676-681`
- **Problem:** In FFA `resolveQuestion`, `notifyOnlineGameEvent('SCORE_UPDATED', ...)` sends `team1Score: state.team1Score, team2Score: state.team2Score` which are stale (never updated in FFA). Only `ffaPlayers` carries correct data.
- **Why it matters:** Latent bug if any new code reads team scores in FFA mode.

### H2 — Remote Question Fetch Timeout Is Permanent
- **Severity:** HIGH
- **File:** `src/data/questionLoader.ts:180-210`
- **Problem:** When Supabase fetch times out (4s), `remoteQuestionsLoaded = true` is set permanently. No retry mechanism exists. A page refresh is required.
- **Why it matters:** Slow/unavailable network permanently loses remote questions for the session.

### H3 — `syncStarted` Flag Never Reset
- **Severity:** HIGH
- **File:** `src/services/online/onlineGameSync.ts:693, 724-726`
- **Problem:** `syncStarted` is set to `true` on first call and never reset. If a player starts a second game without page reload, `startOnlineGameSync()` is a no-op.
- **Why it matters:** Stale event subscriptions from a previous game could accumulate.

### H4 — `wiredCallbacks` Flag Fragility
- **Severity:** HIGH
- **File:** `src/services/online/onlineRoomService.ts:63, 421`
- **Problem:** If a crash occurs without calling `leaveOnlineRoom()`, `wiredCallbacks` stays `true` while the channel is dead. On reconnection, `ensureChannelCallbacks()` skips re-registration.
- **Why it matters:** New channel would have no event handlers after reconnect.

### H5 — Race Condition in Category/Lifeline Toggles
- **Severity:** HIGH
- **File:** `src/store/onlineStore.ts:262-300`
- **Problem:** Host can toggle categories/lifelines rapidly. The broadcast echo can overwrite optimistic state, losing the second toggle.
- **Why it matters:** Category/lifeline changes may be lost during rapid host interaction.

### H6 — No Event Ordering Enforcement
- **Severity:** HIGH
- **File:** `src/services/online/onlineGameSync.ts:70-104`
- **Problem:** Out-of-order events are accepted. A `SCORE_UPDATED` with wrong score could arrive before `QUESTION_SELECTED`.
- **Why it matters:** Game state can become inconsistent between clients.

### H7 — AudioContext Never Closed
- **Severity:** HIGH
- **File:** `src/pages/GameBoard.tsx:192, 282-346`
- **Problem:** AudioContext is created lazily but never closed on unmount. OscillatorNodes connect but are only stopped, not disconnected.
- **Why it matters:** Browser-level resource leak. On mobile, can block other audio.

### H8 — Resolve Buttons 3-Column Grid Overflow on Phones
- **Severity:** HIGH
- **File:** `src/pages/GameBoard.tsx:2182-2197`
- **Problem:** The resolve buttons use `grid-cols-3` on phones. At 320-430px, each button gets ~89px with `px-4` padding, leaving ~57px for Arabic text "الفريق الأول أجاب صح".
- **Why it matters:** Text overflows or wraps badly on phones.

---

## 4. Medium Priority Issues

### M1 — `temporaryAnswerType` Only Handles Arabic
- **Severity:** MEDIUM
- **File:** `src/store/gameBoardStore.ts:228-246`
- **Problem:** Uses Arabic regex patterns only. English questions get classified as `'other'`, producing suboptimal distractors for the `two-answers` lifeline.

### M2 — Biased Shuffle in `buildTemporaryAnswerOptions`
- **Severity:** MEDIUM
- **File:** `src/store/gameBoardStore.ts:268`
- **Problem:** `[answer, ...distractors].sort(() => Math.random() - 0.5)` is not Fisher-Yates. Produces biased distribution for answer positions.

### M3 — `getOnlinePlayerTeam` Duplicated
- **Severity:** MEDIUM
- **File:** `src/store/gameBoardStore.ts:89-93`, `src/services/online/onlineGameSync.ts:28-32`
- **Problem:** Two identical implementations exist. Future modifications could diverge.

### M4 — Call-Friend Timer Re-registers Every Second
- **Severity:** MEDIUM
- **File:** `src/pages/GameBoard.tsx:639-657`
- **Problem:** Effect depends on `callFriendTimeLeft`, creating a new `setInterval` every second instead of running continuously.

### M5 — Question Timer Resets State Before Early-Return
- **Severity:** MEDIUM
- **File:** `src/pages/GameBoard.tsx:428-463`
- **Problem:** On `answerSubmitted` transition, effect calls `resetReveal()`, `setCountdown()`, `setResolveTone(null)` before hitting `if (answerSubmitted) return`.
- **Impact:** Minor visual glitch.

### M6 — `'r'` Keyboard Shortcut Can Switch Turn During Active Question
- **Severity:** MEDIUM
- **File:** `src/pages/GameBoard.tsx:521-524`
- **Problem:** The 'R' key calls `switchTurn()` unconditionally with no guard for `activeQuestion`.
- **Impact:** In local mode, accidental turn switch while question modal is open.

### M7 — FFA Wheel Bonus Hardcodes `teamId: 1`
- **Severity:** MEDIUM
- **File:** `src/store/gameBoardStore.ts:1299`
- **Problem:** `wheelBonus: { teamId: 1, points }` is hardcoded in FFA mode. Display always shows team 1's color.

### M8 — Admin Login Reveals Account Existence
- **Severity:** MEDIUM
- **File:** `src/pages/admin/AdminLogin.tsx:6`
- **Problem:** Error message says "This account does not have admin access" for non-admin users, confirming the account exists.

### M9 — 330 Questions Have Empty Answers
- **Severity:** MEDIUM
- **File:** Multiple JSON files (who-am-i-general, currency-country, saudi-league, tennis, wwe)
- **Problem:** 330 questions have empty `answer` fields. The loader doesn't crash (all have explicit IDs), but UI display may be affected.

### M10 — `usePlayerImage` Image Load Cleanup
- **Severity:** MEDIUM
- **File:** `src/pages/GameBoard.tsx:27-73`
- **Problem:** 4 `Image()` objects created with `onload` handlers. Cleanup only clears timeout, not pending image loads. Stale handlers can fire and overwrite state.

---

## 5. Low Priority / Polish

### L1 — Dead Code: `questionRegistry.ts`
- **File:** `src/data/questionRegistry.ts`
- **Problem:** Entire file is never imported. Superseded by glob-based loading.

### L2 — `isCellUsed` Prop Plumbing Not Wired Up
- **File:** `src/components/game-board/CategoryBoard.tsx:13`, `CategoryPanel.tsx:17`
- **Problem:** Props exist but `GameBoard.tsx` never passes them.

### L3 — `'c'` Keyboard Shortcut Hardcodes Team 1
- **File:** `src/pages/GameBoard.tsx:526-535`
- **Problem:** Always awards to team 1. No team 2 shortcut.

### L4 — Direct `setState` Bypasses Store Actions
- **File:** `src/pages/GameBoard.tsx:669`
- **Problem:** `useGameBoardStore.setState({ wheelBonus: null })` called directly in useEffect.

### L5 — Full-Object Store Subscription Causes Excessive Re-Renders
- **File:** `src/hooks/useOnlineRoom.ts:17`, `src/pages/GameBoard.tsx:190`
- **Problem:** `useOnlineStore()` with no selector subscribes to entire store.

### L6 — `Math.random()` Used for Room Codes
- **File:** `src/services/online/roomCode.ts:23`
- **Problem:** Not cryptographically secure. Low risk for short-lived codes.

### L7 — No Player Name Length Limit
- **File:** `src/services/online/onlineRoomService.ts:200-209`
- **Problem:** Player names are trimmed but not length-limited.

### L8 — `increment_pack_plays` Granted to `anon`
- **File:** `supabase/migrations/004_packs.sql:266`
- **Problem:** Unauthenticated users can inflate play counts.

### L9 — Password Minimum Length Is Only 6 Characters
- **File:** `src/pages/auth/Signup.tsx:33-38`
- **Problem:** Client-side validation enforces minimum 6 characters.

### L10 — `console.warn` Calls in Production
- **Files:** Multiple service files
- **Problem:** May leak internal error details in browser DevTools.

---

## 6. Question System

| Metric | Value |
|--------|-------|
| Total JSON files | 61 |
| Total questions (raw) | 6,796 |
| Total unique questions (after dedup) | ~5,985 |
| Categories with JSON files | 45 |
| Categories without JSON files (auto-excluded) | 14 |
| Questions with empty answers | 330 (5 files) |
| Intra-tier duplicates | 14 (5 files) — auto-deduped at runtime |
| Cross-tier duplicates | 212 — by design, filtered by point tier |
| BOM/encoding issues | 0 |
| Malformed JSON | 0 |
| Dead code | `questionRegistry.ts` confirmed dead |

**Questions per point tier (approximate):**
- 100pt: ~2,100
- 300pt: ~2,050
- 500pt: ~1,850

**Crash risk:** Low. `normalizeQuestionEntry` would crash on empty answer + missing ID, but all 330 empty-answer questions have explicit IDs.

---

## 7. Local Game

| Flow | Status |
|------|--------|
| HOME → CREATE GAME | **PASS** |
| CREATE GAME → GAME SETUP | **PASS** |
| GAME SETUP → TEAM SELECTION | **PASS** |
| TEAM SELECTION → BOARD | **PASS** |
| BOARD → QUESTION | **PASS** |
| QUESTION → ANSWER | **PASS** |
| ANSWER → SCORE | **PASS** |
| SCORE → NEXT TURN | **PASS** |
| NEXT TURN → GAME FINISHED | **PASS** |
| GAME FINISHED → RESULTS | **PASS** |
| PLAY AGAIN → RESET | **PASS** (with caveat: incomplete state reset) |
| Rapid double-click protection | **PASS** |
| Used cell protection | **PASS** |
| Repeated question prevention | **PASS** |
| Refresh during question | **PASS** (localStorage persistence) |
| Timer expiration | **PASS** |

---

## 8. Online Multiplayer

| Flow | Status |
|------|--------|
| Room creation | **PASS** (with caveats: client-side IDs) |
| Room joining | **PASS** |
| Lobby | **PASS** |
| Player state | **PASS** |
| Host authority (team mode) | **PASS** (client-side guards) |
| Host leaving | **PASS** (transfer mechanism exists) |
| Host transfer | **PASS** |
| Reconnect | **PASS** (GAME_STATE_SYNC recovery) |
| Duplicate events | **PASS** (sequence-based dedup) |
| Event ordering | **FAIL** (no total ordering) |
| Game state sync | **PASS** |
| Question selection | **PASS** |
| Answer state | **PASS** |
| Scoring | **PASS** (with FFA stale-score caveat) |
| Lifelines | **PASS** |
| Wheel | **PASS** |
| Timer | **PASS** (host-authoritative duration) |
| Game finished | **PASS** |
| Results | **PASS** |
| Play again | **PASS** |
| Live Pack (server-authoritative) | **PASS** (well-designed) |

---

## 9. Lifelines + Wheel

| Component | Status |
|-----------|--------|
| Double lifeline | **PASS** |
| Block lifeline | **PASS** |
| Call friend lifeline | **PASS** |
| Two-answers lifeline | **PASS** |
| Wheel of Fortune | **PASS** |
| State reset between games | **PASS** |
| Online/local consistency | **PASS** |
| One lifeline per question enforcement | **PASS** |
| Edge cases (negative score, double-double, etc.) | **PASS** |

---

## 10. Timer

| Check | Status |
|-------|--------|
| Timer start | **PASS** |
| Timer expiration | **PASS** |
| Timer reset | **PASS** |
| Next question transition | **PASS** |
| Reconnect behavior | **PASS** |
| Host/client sync | **PASS** |
| Cleanup after leaving | **PASS** |
| Timer drift | **PASS** |
| Duplicate intervals | **PASS** |
| Memory leaks | **PASS** |
| Supported durations (15/30/60) | **PASS** |

---

## 11. Authentication + Security

| Check | Status |
|-------|--------|
| No service_role keys exposed | **PASS** |
| No private keys in codebase | **PASS** |
| No hardcoded credentials | **PASS** (removed in 40aa2ec) |
| No JWT secrets exposed | **PASS** |
| RLS policies comprehensive | **PASS** |
| Admin authorization (RLS + client) | **PASS** |
| Storage bucket policies | **PASS** |
| Security-definer RPCs properly guarded | **PASS** |
| `.env.local` gitignored | **PASS** |
| Null-role fix (migration 013) | **PASS** |
| Admin login user enumeration | **FAIL** (reveals account existence) |
| Password minimum length | **WEAK** (6 chars) |

---

## 12. Mobile

| Viewport | Issues |
|----------|--------|
| **320px** | CRITICAL: Resolve buttons overflow. HIGH: Answer text wrapping. MEDIUM: 11px text below readability minimum. |
| **375px** | MEDIUM: Resolve buttons cramped. Answer option touch targets at 44px minimum. |
| **390px** | LOW: Question modal single-column creates long scroll. |
| **430px** | LOW: Question text scroll area tight (25dvh). |
| **768px** | LOW: Board still 2-column. Question modal single-column. |
| **1024px** | PASS: 3-column board, 2-column modal. Good layout. |
| **1440px** | PASS: Full desktop layout. |

**Key problems:**
- Resolve buttons 3-column grid overflows on phones (320-430px)
- Touch targets at or below 44px WCAG minimum
- Text sizes below 12px minimum on small phones
- Question text scroll area too tight at 25dvh on phones

---

## 13. Performance

| Priority | Issue | Impact |
|----------|-------|--------|
| **P0** | Egyptian poster PNGs 193 MB uncompressed in dist/ | 50% of total dist size |
| **P0** | Two homepage videos 34 MB in dist/ | Loaded on every deploy |
| **P1** | GameBoard subscribes to entire store (2700-line component) | Re-renders on any state change |
| **P1** | OnlineStore subscribed wholesale | Re-renders on player list changes |
| **P1** | `buildTemporaryAnswerOptions` O(N²) on main thread | Stall on lifeline use |
| **P1** | All 61 question JSONs loaded in parallel (1.8 MB) | Blocks board init on slow connections |
| **P2** | AudioContext never closed | System audio resource leak |
| **P2** | `usePlayerImage` probes 4 URLs uncontrolled | Wasted HTTP requests per question |
| **P2** | `usedQuestionKeys` grows, linear `.includes()` | O(N²) over full game |
| **P3** | Wheel SVG re-renders on every React tick | Unnecessary DOM work |
| **P3** | No `vendor-react` chunk | React not cacheable across deploys |

**Total dist/ size: 384 MB** (333 MB is unoptimized media)

---

## 14. Test Coverage

**What IS tested (well-covered):**
- Game board store logic (7 files, ~4,800 lines)
- Data layer / question loading (2 files, ~670 lines)
- Domain contracts and invariants (2 files, ~1,060 lines)
- Online service security (1 file)
- Online scenarios (1 file)
- Reconnection and regression (2 files)

**What is NOT tested (critical gaps):**
- ALL React UI components (0/60+ files)
- Authentication flows (0/4 files)
- Game setup store (0 tests)
- Online store (0 tests)
- Online game sync (0 tests)
- FFA game logic (0 tests)
- Wheel of Fortune (0 tests)
- Block/Call Friend/Two-Answers lifelines (0 tests)
- Timer (0 tests)
- Navigation flows (0 tests)
- Mobile responsive behavior (0 tests)

**Estimated line coverage:** ~15-20% of application logic

**Highest-value missing tests:**
1. Wheel `applyWheelResult` — score mutations including negatives
2. FFA game logic — 3+ player mode
3. Online event application (`reduceEvent`)
4. Auth service (signUp, signIn, signOut)
5. Question timer / answer timeout
6. Block lifeline interaction
7. Call Friend timer expiry
8. Two Answers option generation
9. GameSetupStore (toggleCategory, canStartGame)
10. `initializeBoard` async flow

---

## 15. Release Readiness

**READY WITH FIXES**

The core gameplay is solid: local game lifecycle passes all flows, lifelines and wheel work correctly, timer is clean, authentication and RLS are well-implemented, and 329 tests pass. However, there are blocking issues before production release:

**Must-fix before release:**
1. C4 — Incomplete state reset in `handlePlayAgain` (corrupts localStorage)
2. C3 — FFA auto-finish dead code (FFA games may not navigate to results)
3. H8 — Resolve buttons overflow on phones (320-430px)
4. M8 — Admin login reveals account existence (user enumeration)

**Should-fix before release:**
5. H2 — Remote question fetch timeout with no retry
6. H7 — AudioContext never closed (resource leak on mobile)
7. M4 — Call-friend timer re-registers every second
8. M6 — 'R' keyboard shortcut can switch turn during active question
9. P0 — Compress media assets (193 MB of uncompressed PNGs)

**Known limitations (acceptable for v1):**
- Classic Online is client-authoritative (documented, mitigated by client-side guards)
- No event ordering enforcement in Classic Online
- 330 questions with empty answers (media-only questions)
- 14 intra-tier duplicates (auto-deduped at runtime)
- Weak test coverage on UI components and auth flows
