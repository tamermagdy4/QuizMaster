import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useGameBoardStore } from '../../store/gameBoardStore'
import { useOnlineStore } from '../../store/onlineStore'
import { cn } from '../../utils/cn'

/**
 * Tiny connection status pill shown ONLY while an online game is running.
 *
 *   🟢 Opponent connected
 *   🟡 Reconnecting… (this client's channel is recovering)
 *   🔴 Opponent / host offline — the game is NOT ended, play continues and
 *      the opponent's presence reappears automatically when they return.
 *
 * It renders nothing for local games, in the lobby or after the game
 * finished (Results), and it never blocks the board or the question modal.
 */
export function OnlineConnectionBadge() {
  const gameMode = useGameBoardStore((state) => state.gameMode)
  const direction = useAppStore((state) => state.direction)
  const english = direction === 'ltr'
  const { room, self, players, connectionStatus } = useOnlineStore()

  if (gameMode !== 'online' || !room || !self) return null
  if (room.status !== 'playing') return null

  const opponent = players.find((player) => player.id !== self.id)

  let dot: string
  let label: string
  let tone: string
  let pulsing = false

  if (connectionStatus !== 'connected') {
    const lost = connectionStatus === 'error' || connectionStatus === 'disconnected'
    dot = lost ? '🔴' : '🟡'
    label = lost
      ? english
        ? 'Connection lost'
        : 'انقطع الاتصال'
      : english
        ? 'Reconnecting...'
        : 'جاري إعادة الاتصال...'
    tone = lost
      ? 'border-red/50 bg-red/15 text-red-bright'
      : 'border-gold/50 bg-gold/15 text-gold-bright'
    pulsing = !lost
  } else if (opponent) {
    dot = '🟢'
    label = english ? `${opponent.name} connected` : `${opponent.name} متصل`
    tone = 'border-green/50 bg-green/15 text-green-bright'
  } else {
    const hostMissing = self.id !== room.hostId
    dot = '🔴'
    label = hostMissing
      ? english
        ? 'Host offline — waiting for them to return...'
        : 'المضيف غير متصل — في انتظار عودته...'
      : english
        ? 'Opponent offline — waiting for them to return...'
        : 'اللاعب الآخر غير متصل — في انتظار عودته...'
    tone = 'border-red/50 bg-red/15 text-red-bright'
  }

  return (
    <div className="flex justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${dot}-${label}`}
          initial={{ opacity: 0, y: -6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={cn(
            'pointer-events-none inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold leading-none',
            tone,
          )}
          dir={direction}
        >
          <motion.span
            animate={pulsing ? { opacity: [1, 0.6, 1] } : undefined}
            transition={pulsing ? { duration: 1.4, repeat: Infinity } : undefined}
            className="inline-flex items-center gap-1.5"
          >
            <span aria-hidden>{dot}</span>
            <span>{label}</span>
          </motion.span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
