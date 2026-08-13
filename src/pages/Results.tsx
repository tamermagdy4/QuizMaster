import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useGameSetupStore } from '../store/gameSetupStore'
import { useAppStore } from '../store/appStore'

const confettiPieces = Array.from({ length: 12 }, (_, index) => index)

export function Results() {
  const navigate = useNavigate()
  const { team1Name, team2Name, team1Score, team2Score } = useGameBoardStore()
  const resetSetup = useGameSetupStore((state) => state.reset)
  const english = useAppStore((state) => state.direction === 'ltr')
  const winner = team1Score === team2Score ? (english ? 'Draw' : 'تعادل') : team1Score > team2Score ? team1Name : team2Name

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
    <GlassCard strong className="mx-auto max-w-3xl overflow-hidden border border-[#D4A843]/20 bg-[#0B1220]/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="relative space-y-6 p-1 text-center">
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

        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{english ? 'Final results' : 'النتائج النهائية'}</h1>
        <p className="text-lg font-bold text-[#D4A843]">{english ? 'Winner' : 'الفائز'}: {winner}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-[#3B82F6]/40 bg-[#3B82F6]/10 p-4 shadow-[0_10px_30px_rgba(59,130,246,0.12)]">
            <p className="text-sm font-bold text-[#BFDBFE]">{team1Name}</p>
            <motion.p key={team1Score} initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="text-4xl font-black text-[#60A5FA]">{team1Score}</motion.p>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-4 shadow-[0_10px_30px_rgba(239,68,68,0.12)]">
            <p className="text-sm font-bold text-[#FECACA]">{team2Name}</p>
            <motion.p key={team2Score} initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="text-4xl font-black text-[#F87171]">{team2Score}</motion.p>
          </motion.div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handlePlayAgain}
            className="glass-button rounded-2xl px-6 py-3 text-base font-bold text-white"
          >
            {english ? 'Play again' : 'العب مجدداً'}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/')}
            className="rounded-2xl border border-[#D4A843]/40 bg-[#D4A843]/5 px-6 py-3 text-base font-bold text-[#F5D98B] transition hover:border-[#D4A843]/70 hover:bg-[#D4A843]/10"
          >
            {english ? 'Home' : 'العودة للرئيسية'}
          </motion.button>
        </div>
      </motion.div>
    </GlassCard>
  )
}
