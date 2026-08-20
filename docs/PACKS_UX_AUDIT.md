# Packs UX Audit: QuizMaster vs Sporcle Party

Date: August 19, 2026
Method: Code analysis + Sporcle Party website reference + running application analysis

---

## 1. PACKS HOME

**CURRENT QUIZMASTER:**
- Dark navy gradient header with title + "Create Pack" button
- Live games banner below with 3-step explanation + host picker + join-by-code form
- Search bar + sort options + category chips
- Featured rail (horizontal scroll), Popular rail, Recent grid
- My Packs section
- Saved Packs section
- Clean layout, well-organized

**SPORCLE-STYLE EXPECTATION:**
- Clean, bright interface with pack cards as the hero content
- Categories displayed as visual tiles or horizontal scroll
- "Create Your Own" prominently featured
- "Browse by Topic" with visual category cards
- No live game hosting in the home page — that belongs on Pack Details

**GAP:**
- The live games banner (host picker + join code) on the home page is overwhelming and premature — users haven't selected a pack yet
- Host picker dropdown in the home page feels like a developer tool, not a consumer experience
- No "Browse by Category" visual section — categories are just chips
- The home page tries to do too much: discovery + hosting + joining

**PRIORITY: HIGH**

---

## 2. PACK DISCOVERY

**CURRENT QUIZMASTER:**
- Featured / Popular / Recent sections with horizontal rails and grids
- Category filter chips with counts
- Works correctly with real data

**SPORCLE-STYLE EXPECTATION:**
- Category tiles as the primary discovery mechanism (large visual cards per category)
- "Trending" / "Most Played" sections
- "Recently Created" section
- Visual emphasis on pack cover images

**GAP:**
- No visual category browsing (only text chips)
- Category chips are small and easy to miss
- No visual emphasis on pack covers as the primary discovery mechanism
- Missing "Browse by Category" page or section with large category tiles

**PRIORITY: MEDIUM**

---

## 3. SEARCH

**CURRENT QUIZMASTER:**
- Single search bar with debounced input
- Searches pack name, description, creator
- Works correctly

**SPORCLE-STYLE EXPECTATION:**
- Prominent search bar
- Search suggestions / autocomplete
- Search results with pack cards

**GAP:**
- No search autocomplete/suggestions
- Search results appear below the fold (pushed down by category chips)
- No "trending searches" or suggested packs

**PRIORITY: LOW**

---

## 4. PACK CARDS

**CURRENT QUIZMASTER:**
- 16:9 cover image with gradient fallback based on category
- Title, description (2-line clamp), creator avatar + name
- Stats: question count, plays, rating
- Category + difficulty chips on cover
- "Live" badge, "Featured" badge
- CTA: "Open Pack" button + arrow
- Hover: translate up, border highlight

**SPORCLE-STYLE EXPECTATION:**
- Clean card with pack image
- Title + question count + category
- Play/Host button prominently visible
- Creator info subtle
- Fewer stats, cleaner design

**GAP:**
- Card shows too many stats (plays, rating) — Sporcle is cleaner
- "Open Pack" CTA is not prominent enough — should be "Play" or "Host"
- No "Play" action on the card itself (requires opening the pack first)
- Missing play count / question count emphasis on the card face

**PRIORITY: HIGH**

---

## 5. CREATE PACK

**CURRENT QUIZMASTER:**
- 3-step wizard: Pack Info → Questions → Review & Publish
- Pack Info: cover upload, name, description, category, difficulty, visibility, tags
- Questions: inline editor + import + drag-reorder
- Review: summary + publish/save draft
- Works correctly with new pack_id architecture

**SPORCLE-STYLE EXPECTATION:**
- Simple: Name → Start Adding Questions → Done
- No review step — just create and go
- Cover image is optional, not a step
- Category/difficulty are nice-to-have, not required fields
- The focus is on getting questions in fast

**GAP:**
- 3 steps is too many for pack creation — Sporcle is simpler
- "Review & Publish" step is unnecessary friction
- Too many fields on the info step (tags, visibility, difficulty) — overwhelming for quick creation
- The flow should be: Create Pack (name only) → Add Questions → Done

**PRIORITY: HIGH**

---

## 6. PACK DETAILS

**CURRENT QUIZMASTER:**
- Cover hero with gradient overlay
- Pack name, description, category, difficulty, creator, stats
- Play Now + Host Live + Save/Favorite buttons
- Owner toolbar: Edit Pack, Add Question, Import, Export, Delete
- Questions section with count + search
- Empty state if no questions

**SPORCLE-STYLE EXPECTATION:**
- Pack name + cover + description
- Question count prominently displayed
- BIG "Play" / "Host" button — the primary action
- Questions list visible immediately
- Add / Import as secondary actions
- Clean, not cluttered

**GAP:**
- Owner toolbar is a flat row of buttons — too many equal-weight actions
- "Host Live" is not prominent enough — it should be THE primary CTA
- The owner toolbar should be reorganized: Host (primary) > Add Questions > Import > Edit > Delete
- The non-owner view and owner view should be more distinct
- Missing a clear "This pack has X questions, ready to play!" prompt

**PRIORITY: CRITICAL**

---

## 7. QUESTION LIST

**CURRENT QUIZMASTER:**
- Numbered list items (01, 02, ...)
- Question text (truncated) + answer (green) + points + difficulty + hint icon
- Hover actions: preview, edit, delete
- Drag-reorder handle
- Works correctly

**SPORCLE-STYLE EXPECTATION:**
- Simple list with question number + text
- Answer hidden by default (click to reveal)
- Edit/Delete as subtle actions
- Focus on readability

**GAP:**
- Answers are always visible (green text) — in Sporcle they're hidden until revealed
- Too much info per row (points, difficulty, hint icon) — cluttered
- No expand/collapse for question details
- The list feels like an admin table, not a content preview

**PRIORITY: HIGH**

---

## 8. QUESTION EDITOR

**CURRENT QUIZMASTER:**
- Inline form with side-by-side Question/Answer fields
- Points, Difficulty, Hint fields
- Image URL, Answer Image URL fields
- Save / Cancel buttons
- Works correctly

**SPORCLE-STYLE EXPECTATION:**
- Simple: Question text + Answer text + Save
- Points and difficulty are advanced settings, not in the main form
- Media (image/video) as expandable "Add Media" section
- Clean, focused editing experience

**GAP:**
- Too many fields visible at once — overwhelming for quick question entry
- Image URLs should be hidden behind an "Add Media" toggle
- Points and difficulty should be in a collapsible "Advanced" section
- The form should prioritize speed: Question → Answer → Save

**PRIORITY: MEDIUM**

---

## 9. IMPORT EXPERIENCE

**CURRENT QUIZMASTER:**
- Two modes: Paste text / Upload file
- Supported formats: .txt, .csv, .json, .xlsx
- File picker with drag area
- Works correctly with new pack_id architecture

**SPORCLE-STYLE EXPECTATION:**
- File upload as the primary method
- Drag-and-drop zone
- Clear format instructions
- Preview before importing

**GAP:**
- The "Paste text" mode is shown first — file upload should be primary
- No drag-and-drop zone (just a button)
- Missing format instructions before the upload area
- The import modal could be larger and more inviting

**PRIORITY: MEDIUM**

---

## 10. IMPORT PREVIEW

**CURRENT QUIZMASTER:**
- Shows total count, valid count, invalid count
- Each row: question input + answer input + points selector + difficulty selector + error message + remove button
- Editable before import
- Import button shows count

**SPORCLE-STYLE EXPECTATION:**
- Clean preview table: # | Question | Answer | Status
- Invalid rows highlighted with error reasons
- "Import All Valid" button
- Option to skip invalid rows

**GAP:**
- Preview rows are editable (good) but too complex (points + difficulty per row)
- No clear "Import X Valid / Skip Y Invalid" summary at the top
- Error messages are mixed in with the row content
- The import button is not prominent enough

**PRIORITY: MEDIUM**

---

## 11. HOST FLOW

**CURRENT QUIZMASTER:**
- From Pack Details: "Host Live" button
- Creates live room immediately
- Navigates to /packs/live/:roomId
- LiveRoom has game settings, lobby, and game phases

**SPORCLE-STYLE EXPECTATION:**
- From Pack: "Host" button
- Game setup screen: choose number of questions, timer, settings
- Then: Lobby with room code
- Players join
- Host starts the game

**GAP:**
- No game setup step before creating the room — goes directly to live room
- The live room is complex (450+ lines) — should be simpler
- Missing a clear "Game Setup" step between Pack Details and Live Room
- The host flow should feel like a deliberate progression, not an instant jump

**PRIORITY: HIGH**

---

## 12. GAME SETUP

**CURRENT QUIZMASTER:**
- Game settings are inside the LiveRoom component
- Settings: question count, timer, max players
- No dedicated setup page

**SPORCLE-STYLE EXPECTATION:**
- Dedicated "Game Setup" screen
- Choose pack (pre-selected)
- Choose number of questions
- Choose timer per question
- Choose game mode
- "Start Game" button → Lobby

**GAP:**
- No dedicated game setup page — settings are embedded in the live room
- Settings are small select dropdowns, not prominent controls
- Missing a visual "Game Setup" step that shows the selected pack prominently
- The setup should feel like configuring a party, not filling a form

**PRIORITY: CRITICAL**

---

## 13. LOBBY

**CURRENT QUIZMASTER:**
- Inside LiveRoom component
- Shows game code, host, players
- Players join in realtime
- Start button when ready

**SPORCLE-STYLE EXPECTATION:**
- Large room code display
- Player avatars in a grid
- "Share Link" / "Copy Code" buttons
- Waiting state with animation
- "Start" when enough players

**GAP:**
- Room code is not prominently displayed
- Missing a "Share" / "Copy Code" button that's easy to find
- The lobby is mixed with game settings in the same component
- No waiting animation or visual feedback that players are joining

**PRIORITY: HIGH**

---

## 14. RESPONSIVE DESIGN

**CURRENT QUIZMASTER:**
- Uses Tailwind responsive classes (sm:, lg:)
- Grid layouts adjust to screen size
- Mobile: single column, stacked elements
- Desktop: 2-3 column grids

**SPORCLE-STYLE EXPECTATION:**
- Mobile-first design
- Touch-friendly buttons (larger tap targets)
- Bottom navigation on mobile
- Full-width cards on mobile

**GAP:**
- The live game banner on PacksHome is too complex for mobile
- The host picker dropdown is small on mobile
- Pack cards may be too wide on small screens
- The owner toolbar on PackDetails wraps poorly on mobile
- No bottom navigation for mobile users

**PRIORITY: MEDIUM**

---

## 15. EMPTY STATES

**CURRENT QUIZMASTER:**
- PacksHome: "No packs yet" + CTA
- PackDetails: "No questions yet" + Add/Import buttons
- Search results: "No packs found"
- All have icons + text + CTA buttons

**SPORCLE-STYLE EXPECTATION:**
- Friendly illustrations
- Clear CTAs
- Encouraging copy

**GAP:**
- Empty states use emoji (📚, 📝) instead of proper illustrations
- The copy is functional but not encouraging
- Missing an "illustrated empty state" like Sporcle uses

**PRIORITY: LOW**

---

## 16. LOADING STATES

**CURRENT QUIZMASTER:**
- Skeleton loaders (gray pulsing rectangles) for pack cards
- Loading spinner for individual actions
- Works correctly

**SPORCLE-STYLE EXPECTATION:**
- Skeleton loaders matching the card shape
- Smooth transitions from loading to content

**GAP:**
- Skeleton cards are generic rectangles — should match PackCard shape
- No skeleton for PackDetails hero section
- No skeleton for question list

**PRIORITY: LOW**

---

## 17. ERROR STATES

**CURRENT QUIZMASTER:**
- Red border + error message + dismiss button
- Toast notifications for success/error
- Works correctly

**SPORCLE-STYLE EXPECTATION:**
- Inline error messages
- Retry buttons
- Friendly error illustrations

**GAP:**
- No retry buttons on errors
- Error messages are technical (e.g., "Could not load the pack")
- Missing friendly error illustrations

**PRIORITY: LOW**

---

## 18. BUTTON HIERARCHY

**CURRENT QUIZMASTER:**
- Gold buttons: "Create Pack", "Publish", "Play Now"
- Navy buttons: "Add Question", "Edit Pack"
- Outline buttons: "Import", "Cancel"
- Red outline: "Delete"

**SPORCLE-STYLE EXPECTATION:**
- One clear primary action per page
- Primary: filled, large
- Secondary: outline, smaller
- Destructive: red, with confirmation

**GAP:**
- Multiple gold buttons compete for attention (Create Pack, Play Now, Publish)
- "Host Live" uses teal — should be gold or navy for consistency
- The owner toolbar has too many buttons at the same visual weight
- Missing a clear primary CTA per page

**PRIORITY: HIGH**

---

## 19. NAVIGATION

**CURRENT QUIZMASTER:**
- Top nav: Home, Packs, Create Game, Online, Question, About, Board, Results, Settings, Admin
- Packs is just one link in the nav
- No sub-navigation within Packs

**SPORCLE-STYLE EXPECTATION:**
- Dedicated Packs section with its own navigation
- Browse / My Packs / Create as tabs
- Back to Packs from detail pages
- Breadcrumbs or back button

**GAP:**
- No sub-navigation within the Packs section
- "My Packs" is buried at the bottom of PacksHome — should be a tab
- No breadcrumbs (e.g., Packs > My Pack > Questions)
- Missing a "Create Pack" floating action or prominent nav item

**PRIORITY: HIGH**

---

## 20. OVERALL VISUAL QUALITY

**CURRENT QUIZMASTER:**
- Dark navy theme with gold accents
- Rounded corners (rounded-3xl)
- Gradient overlays
- Professional-looking components
- Consistent spacing and typography

**SPORCLE-STYLE EXPECTATION:**
- Light, clean interface
- White backgrounds with subtle shadows
- Bold typography
- Large images
- Minimal color usage (mostly brand color accents)

**GAP:**
- QuizMaster is dark-themed; Sporcle is light — this is a design choice, not a gap
- The dark theme makes some elements harder to read (white text on dark backgrounds)
- Missing the "light and airy" feel of Sporcle
- Some components are too busy (too many borders, shadows, gradients)

**PRIORITY: MEDIUM**

---

# SUMMARY

## TOTAL CRITICAL GAPS: 2
- #6: Pack Details — "Host Live" is not prominent enough, owner toolbar is cluttered
- #12: Game Setup — No dedicated game setup page

## TOTAL HIGH GAPS: 7
- #1: Packs Home — Live games banner is overwhelming
- #4: Pack Cards — CTA not prominent enough
- #5: Create Pack — 3 steps is too many
- #7: Question List — Answers visible by default, too much info per row
- #11: Host Flow — No game setup step
- #13: Lobby — Room code not prominently displayed
- #18: Button Hierarchy — Multiple gold buttons compete for attention
- #19: Navigation — No sub-navigation within Packs

## TOTAL MEDIUM GAPS: 7
- #2: Pack Discovery — No visual category browsing
- #8: Question Editor — Too many fields visible
- #9: Import Experience — Paste mode shown first
- #10: Import Preview — Too complex per row
- #14: Responsive Design — Mobile layout issues
- #20: Overall Visual Quality — Too busy
- #8: Question Editor — Advanced fields not hidden

## TOTAL LOW GAPS: 5
- #3: Search — No autocomplete
- #15: Empty States — Emoji instead of illustrations
- #16: Loading States — Generic skeletons
- #17: Error States — No retry buttons
- #15: Empty States — Not encouraging enough

---

# PRIORITIZED IMPLEMENTATION PLAN

## PHASE 1 — Critical + High Gaps (Core UX)
**Goal: Make the Pack system feel like a real trivia platform**

1. **Rebuild Pack Details as the central hub**
   - Prominent "Host This Pack" as the #1 CTA (gold, large)
   - Reorganize owner toolbar: Host (primary) > Add > Import > Edit > Delete
   - Add "This pack has X questions, ready to play!" prompt
   - Make owner vs. non-owner views visually distinct

2. **Add dedicated Game Setup page**
   - New route: `/packs/:id/host`
   - Shows selected pack prominently
   - Number of questions selector
   - Timer selector
   - Game mode options
   - "Start Game" button → creates live room → lobby

3. **Simplify Pack Creation**
   - Reduce to 2 steps: Create (name + description) → Add Questions
   - Remove Review & Publish step — auto-publish on creation
   - Move advanced fields (tags, visibility, difficulty) to Edit Pack
   - Make the create flow faster

4. **Rebuild Pack Cards**
   - Remove rating from card face
   - Add "Play" / "Host" action button on card
   - Emphasize question count more
   - Cleaner card layout

5. **Reorganize Pack Details question list**
   - Hide answers by default (click to reveal)
   - Simpler row layout: number + question text + actions
   - Expand/collapse for question details

6. **Rebuild Host Flow**
   - Pack Details → "Host" → Game Setup → Lobby → Game
   - Clear progression with visual steps

7. **Fix Button Hierarchy**
   - One gold CTA per page
   - Secondary actions as outline buttons
   - Consistent sizing

8. **Add Packs Sub-Navigation**
   - Tabs: Discover / My Packs
   - Breadcrumbs on detail pages
   - "Create Pack" as a persistent action

## PHASE 2 — Medium Gaps (Polish)
**Goal: Refine the experience**

9. **Visual Category Browsing**
   - Add category tiles section to PacksHome
   - Each tile: category icon + name + pack count
   - Click to filter by category

10. **Simplify Question Editor**
    - Question + Answer as main fields
    - "Add Media" toggle for images
    - "Advanced" toggle for points/difficulty
    - Faster question entry

11. **Improve Import Experience**
    - File upload as primary mode
    - Larger drag-and-drop zone
    - Clear format instructions
    - Cleaner preview table

12. **Improve Responsive Design**
    - Larger tap targets on mobile
    - Simplified toolbar on mobile
    - Full-width pack cards on mobile

13. **Clean Up Visual Density**
    - Reduce borders and shadows
    - More whitespace
    - Cleaner gradients

## PHASE 3 — Low Gaps (Delight)
**Goal: Make it feel premium**

14. **Better Empty States**
    - Custom illustrations instead of emoji
    - More encouraging copy

15. **Better Loading States**
    - Card-shaped skeletons
    - Smooth transitions

16. **Better Error States**
    - Retry buttons
    - Friendly error messages

17. **Search Improvements**
    - Autocomplete
    - Trending searches

18. **Pack Sharing**
    - Share link button
    - Social media sharing
