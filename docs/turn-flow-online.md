# الوضع الجماعي (Online) — تدفق الأدوار والتحكم

وثيقة مختصرة تشرح **من يختار السؤال، متى ينتقل الدور، ومن يملك التصحيح والإنهاء** في اللعب الجماعي عبر الإنترنت. الكود المرجعي: `src/store/gameBoardStore.ts` + `src/services/online/onlineGameSync.ts`.

## 1. الأدوار والفرق

| اللاعب | الفريق | التحكم |
| --- | --- | --- |
| **الـHOST** (منشئ الغرفة) | فريق 1 | **المتحكم الكامل**: يختار، يجيب، يصحّح، يُنهي |
| **اللاعب الآخر** (Joiner) | فريق 2 | مشارك في دوره فقط: يختار ويجيب — **لا يصحّح ولا يُنهي** |

المطابقة تتم عبر `getOnlinePlayerTeam()`: `self.id === room.hostId ? 1 : 2`.

في الوضع الجماعي بـ 3+ لاعبين (Free-for-all) لا توجد فرق — كل لاعب له دوره الخاص ويُتخطّى من أنهى كل خلاياه.

## 2. من يختار السؤال؟

- **فقط صاحب الدور الحالي** يستطيع اختيار خانة: `isCellPlayable()` و`selectQuestion()` يرفضان أي لاعب آخر (`getOnlinePlayerTeam() !== currentTurn` → `return null`).
- الخانة تُحسب مستخدمة بعد اختيارها (للفريقين في وضع الفريقين، أو للاعب نفسه في FFA).

## 3. من يجيب؟

- **فقط مَن يملك السؤال** يستطيع إرسال إجابة: `submitAnswer()` يرجع فورًا إذا `getOnlinePlayerTeam() !== activeQuestion.team`.
- الـHOST لا يجيب بدلًا عن Joiner والعكس — السؤال مربوط بصاحبه من لحظة اختياره.

## 4. من يصحّح الإجابة؟

- **الـHOST فقط** (فريق 1): `resolveQuestion()` يرجع فورًا إذا `getOnlinePlayerTeam() !== 1`.
- الـJoiner لا يملك أزرار صح/خطأ ولا إظهار الإجابة ولا إنهاء السؤال — الحماية في الـlogic (`return`) وليست إخفاء CSS فقط.
- اللاعب يرسل إجابته ويبقى "بانتظار اعتماد الـHOST".

## 5. متى ينتقل الدور؟

- **لا ينتقل الدور بمجرد فتح السؤال أو إرسال الإجابة.**
- ينتقل فقط عند **إنهاء السؤال** من الـHOST: `finishSubmittedQuestion()` → `currentTurn: 1 ⇄ 2` (أو `nextFfaPlayerId` في FFA) ثم يُرسل حدث `TURN_CHANGED`.
- الزر اليدوي `switchTurn()` **معطّل في الوضع الجماعي** (`if (gameMode === 'online') return`) — الدور لا يُدار يدويًا أبدًا، فقط عبر إنهاء الأسئلة.

## 6. من يُنهي السؤال؟

- **الـHOST فقط** في وضع الفريقين: `finishSubmittedQuestion()` يرجع فورًا إذا `getOnlinePlayerTeam() !== 1`.
- في FFA: صاحب السؤال هو من يُغلق سؤاله الخاص (كل لاعب يدير أسئلته).

## 7. مصدر الحقيقة (المزامنة)

- `gameBoardStore` هو المصدر الوحيد لحالة `currentTurn / activeQuestion / isRevealed / scores`.
- الأحداث عبر Supabase Realtime (Broadcast): `QUESTION_SELECTED` و`TURN_CHANGED` و`SCORE_UPDATED` و`ANSWER_REVIEWED` و`ANSWER_SUBMITTED` و`GAME_FINISHED`.
- كل عميل يستقبل الحدث ويطبّقه على `gameBoardStore` الخاص به — **لا يوجد تخمين محلي**؛ الـHOST واللاعب يريان نفس الحالة دائمًا.

## 8. دورة كاملة (فريقان)

```text
دور الفريق 1 (HOST)
   ↓ يختار خانة → QUESTION_SELECTED
   ↓ يجيب / ينتظر الـHOST
   ↓ HOST يصحّح (صح/خطأ) → SCORE_UPDATED + ANSWER_REVIEWED
   ↓ HOST يضغط إنهاء السؤال → TURN_CHANGED
دور الفريق 2 (Joiner)
   ↓ يختار خانة → QUESTION_SELECTED
   ↓ يجيب
   ↓ HOST يصحّح → SCORE_UPDATED
   ↓ HOST يُنهي → TURN_CHANGED
   ... حتى كل الخلايا → GAME_FINISHED
```

## 9. ملخص الاختصارات

| العملية | الفريق 1 (HOST) | الفريق 2 (Joiner) |
| --- | --- | --- |
| اختيار سؤال | ✅ في دوره | ✅ في دوره |
| إرسال إجابة | ✅ لسؤاله | ✅ لسؤاله |
| إظهار الإجابة | ✅ | ❌ |
| تصحيح (صح/خطأ) | ✅ | ❌ |
| إنهاء السؤال | ✅ | ❌ |
| تغيير الدور يدويًا | ❌ (معطّل أونلاين) | ❌ |
