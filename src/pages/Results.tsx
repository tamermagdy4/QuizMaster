import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useGameSetupStore } from '../store/gameSetupStore'

const confettiPieces = Array.from({ length: 12 }, (_, index) => index)

export function Results() {
  const navigate = useNavigate()
  const { team1Name, team2Name, team1Score, team2Score } = useGameBoardStore()
  const resetSetup = useGameSetupStore((state) => state.reset)
  const winner = team1Score === team2Score ? 'تعادل' : team1Score > team2Score ? team1Name : team2Name

  const handlePlayAgain = () => {
    resetSetup()
    useGameBoardStore.setState({
      isInitialized: false,
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
    })
    navigate('/create')
  }

  return (
    <GlassCard strong className="mx-auto max-w-3xl overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative space-y-5 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {confettiPieces.map((piece) => (
            <motion.span
              key={piece}
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: [0, 18, -10], opacity: [0.3, 1, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: piece * 0.08 }}
              className="absolute h-3 w-3 rounded-full"
              style={{
                left: `${8 + piece * 7}%`,
                top: `${-6 + (piece % 4) * 6}%`,
                background:
                  piece % 2 === 0
                    ? 'rgba(245, 200, 66, 0.95)'
                    : 'rgba(107, 77, 255, 0.92)',
              }}
            />
          ))}
        </div>

        <h1 className="text-3xl font-black text-white">النتائج النهائية</h1>
        <p className="text-lg font-bold text-gold-400">الفائز: {winner}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-royal-400/25 bg-royal-500/10 p-4">
            <p className="text-sm text-white/70">{team1Name}</p>
            <p className="text-4xl font-black text-royal-400">{team1Score}</p>
          </div>
          <div className="rounded-2xl border border-gold-400/25 bg-gold-500/10 p-4">
            <p className="text-sm text-white/70">{team2Name}</p>
            <p className="text-4xl font-black text-gold-400">{team2Score}</p>
          </div>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={handlePlayAgain}
          className="glass-button rounded-2xl px-6 py-3 text-base font-bold text-white"
        >
          العب مجدداً
        </motion.button>
      </motion.div>
    </GlassCard>
  )
}
