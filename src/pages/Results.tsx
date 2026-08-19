import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useGameSetupStore } from '../store/gameSetupStore'
import { useOnlineStore } from '../store/onlineStore'
import { useAppStore } from '../store/appStore'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'

const confettiPieces = Array.from({ length: 10 }, (_, index) => index)

const MEDALS = ['🥇', '🥈', '🥉']

export function Results() {
  const navigate = useNavigate()
  const { team1Name, team2Name, team1Score, team2Score, ffaPlayers } = useGameBoardStore()
  const resetSetup = useGameSetupStore((state) => state.reset)
  const english = useAppStore((state) => state.direction === 'ltr')

  // Free-for-all (3+ players): rank all players by score.
  const isFfa = ffaPlayers.length >= 3
  const ranked = isFfa
    ? [...ffaPlayers].sort((a, b) => b.score - a.score)
    : []
  const winner = isFfa
    ? ranked[0]?.name ?? (english ? 'Draw' : 'تعادل')
    : team1Score === team2Score
      ? (english ? 'Draw' : 'تعادل')
      : team1Score > team2Score ? team1Name : team2Name

  /** Leaves a finished online room so Home / a new game start clean. */
  const clearOnlineSession = () => {
    void useOnlineStore.getState().leaveRoom()
  }

  const handlePlayAgain = () => {
    resetSetup()
    clearOnlineSession()
    useGameBoardStore.setState({
      isInitialized: false,
      gameMode: 'local',
      gameName: '',
      team1Name: '',
      team2Name: '',
      categoryIds: [],
      cells: [],
      currentTurn: 1,
      team1Score: 0,
      team2Score: 0,
      team1Lifelines: [],
      team2Lifelines: [],
      activeQuestion: null,
      usedQuestionKeys: [],
      ffaPlayers: [],
      ffaTurnPlayerId: null,
      ffaPendingDoublePlayerId: null,
      ffaBlockedPlayerId: null,
      ffaCallFriendPlayerId: null,
      pendingDoublePoints: null,
      blockActive: null,
      callFriendActive: null,
      callFriendTimeLeft: 0,
      callFriendHint: null,
      wheelBonus: null,
      wheelPending: false,
      wheelPendingTeam: null,
      ffaWheelPendingPlayerId: null,
      isGameFinished: false,
      isRevealed: false,
      answerSubmitted: false,
      selectedAnswer: null,
      answerCorrect: null,
      answerPoints: 0,
    })
    navigate('/create')
  }

  return (
    <div className="stage-dark mx-auto flex max-w-3xl min-h-[62vh] flex-col justify-center overflow-hidden rounded-[20px] border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.4)] lg:rounded-[28px]">
      {/* gold hairline — the game-show stage line */}
      <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="relative space-y-6 p-1 text-center">
        {/* Subtle gold + green celebration — restrained, no purple */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {confettiPieces.map((piece) => (
            <motion.span
              key={piece}
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: [0, 18, -10], opacity: [0.2, 0.9, 0.3] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: piece * 0.1 }}
              className="absolute h-2.5 w-2.5 rounded-sm"
              style={{
                left: `${10 + piece * 8}%`,
                top: `${-6 + (piece % 4) * 6}%`,
                background:
                  piece % 3 === 0
                    ? 'rgba(201, 162, 39, 0.9)'
                    : piece % 3 === 1
                      ? 'rgba(61, 139, 104, 0.85)'
                      : 'rgba(47, 125, 126, 0.8)',
              }}
            />
          ))}
        </div>

        {/* Winner moment */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
          className="relative mx-auto inline-flex items-center gap-2 rounded-full border border-gold/45 bg-gold/15 px-4 py-1.5 shadow-glow-gold"
        >
          <span className="text-lg" aria-hidden>🏆</span>
          <span className="text-sm font-black text-gold-bright">
            {english ? 'Winner' : 'الفائز'}: {winner}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="font-display text-[clamp(2rem,6vw,3.4rem)] font-extrabold leading-tight tracking-tight text-cream"
        >
          {english ? 'Final results' : 'النتائج النهائية'}
        </motion.h1>

        {isFfa ? (
          <div className="space-y-3">
            {ranked.map((player, index) => (
              <motion.div
                key={player.playerId}
                initial={{ opacity: 0, x: index % 2 === 0 ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: 0.3 + index * 0.09 }}
                whileHover={{ y: -2 }}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${
                  index === 0
                    ? 'border-gold/45 bg-gold/12 shadow-glow-gold'
                    : index === 1
                      ? 'border-white/15 bg-[#101D2E]'
                      : index === 2
                        ? 'border-white/15 bg-[#101D2E]'
                        : 'border-white/10 bg-[#0B1526]/60'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl" aria-hidden>{MEDALS[index] ?? `${index + 1}.`}</span>
                  <span className="truncate text-base font-bold text-cream">{player.name}</span>
                </div>
                <AnimatedNumber from={0} value={player.score} className="score-number text-3xl font-black text-gold-bright" />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.25 }}
              whileHover={{ y: -2 }}
              className={`rounded-2xl border p-5 ${team1Score > team2Score ? 'border-gold/45 bg-gold/12 shadow-glow-gold' : 'border-white/15 bg-[#101D2E]'}`}
            >
              <p className="text-base font-black text-teal-bright">🛡️ {team1Name}</p>
              <AnimatedNumber from={0} value={team1Score} className="score-number mt-1 block text-[clamp(2.4rem,7vw,3.6rem)] font-black text-gold-bright" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.35 }}
              whileHover={{ y: -2 }}
              className={`rounded-2xl border p-5 ${team2Score > team1Score ? 'border-gold/45 bg-gold/12 shadow-glow-gold' : 'border-white/15 bg-[#101D2E]'}`}
            >
              <p className="text-base font-black text-gold-bright">👑 {team2Name}</p>
              <AnimatedNumber from={0} value={team2Score} className="score-number mt-1 block text-[clamp(2.4rem,7vw,3.6rem)] font-black text-gold-bright" />
            </motion.div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handlePlayAgain}
            className="btn btn-gold rounded-2xl px-6 py-3 text-base font-black"
          >
            {english ? 'Play again' : 'العب مجدداً'}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              clearOnlineSession()
              navigate('/')
            }}
            className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-base font-black text-cream/75 transition hover:bg-white/10 hover:text-cream"
          >
            {english ? 'Home' : 'العودة للرئيسية'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
