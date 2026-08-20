import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LivePlayerRow, LiveRoomRow } from '../../services/livePackService'
import { copyLiveInvite, updateLiveRoomSettings, deleteLiveRoom, setReady } from '../../services/livePackService'
import { cn } from '../../utils/cn'
import { PlayerAvatar } from './shared'
import { ChatPanel } from './ChatPanel'

// ---------------------------------------------------------------------------
// Host Lobby
// ---------------------------------------------------------------------------
export function HostLobby({
  room,
  players,
  english,
  onStart,
  onDelete,
  onUpdateSettings,
  starting,
}: {
  room: LiveRoomRow
  players: LivePlayerRow[]
  english: boolean
  onStart: () => void
  onDelete: () => void
  onUpdateSettings: (s: Record<string, unknown>) => void
  starting: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const readyCount = players.filter((p) => p.is_ready).length
  const allReady = players.length > 0 && readyCount === players.length

  const handleCopyCode = async () => {
    await copyLiveInvite(room.room_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/live/join?code=${room.room_code}`
    try { await navigator.clipboard.writeText(url) } catch { window.prompt('Link', url) }
  }

  return (
    <div className="space-y-6">
      {/* Room code display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-dark rounded-3xl p-8 text-center"
      >
        <p className="text-sm font-bold text-teal-bright/60 mb-2">
          {english ? 'Share this code with your friends' : 'شارك هذا الكود مع أصدقائك'}
        </p>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="my-4 font-display text-5xl font-black tracking-[0.15em] text-gold-bright"
        >
          {room.room_code}
        </motion.div>

        <div className="flex justify-center gap-3 mt-4">
          <button
            type="button"
            onClick={handleCopyCode}
            className="btn btn-ghost rounded-xl px-4 py-2 text-xs"
          >
            📋 {copied ? (english ? 'Copied!' : 'تم النسخ!') : (english ? 'Copy Code' : 'نسخ الكود')}
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="btn btn-ghost rounded-xl px-4 py-2 text-xs"
          >
            🔗 {english ? 'Copy Link' : 'نسخ الرابط'}
          </button>
        </div>
      </motion.div>

      {/* Ready count */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center"
      >
        <span className={cn(
          'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-black',
          allReady
            ? 'border-green/50 bg-green/15 text-green'
            : 'border-petro-line bg-petro-800/50 text-teal-bright/60',
        )}>
          <span className={cn('h-2.5 w-2.5 rounded-full', allReady ? 'bg-green animate-pulse' : 'bg-gold animate-pulse')} />
          {english
            ? `${readyCount}/${players.length} ready`
            : `${readyCount}/${players.length} جاهزين`}
        </span>
      </motion.div>

      {/* Players */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-dark rounded-3xl p-6"
      >
        <h3 className="font-display text-lg font-black text-cream mb-4">
          {english ? 'Players' : 'اللاعبون'} ({players.length})
        </h3>

        {players.length === 0 ? (
          <div className="py-8 text-center">
            <div className="animate-fh-floaty mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-petro-700 text-3xl">
              👀
            </div>
            <p className="text-sm text-teal-bright/50">
              {english ? 'Waiting for players to join…' : 'في انتظار انضمام اللاعبين…'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {players.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl border border-petro-line bg-petro-800/50 p-3"
                >
                  <PlayerAvatar player={player} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-cream">{player.name}</p>
                  </div>
                  {/* Ready indicator */}
                  <span className={cn(
                    'h-3 w-3 rounded-full border-2 transition-colors',
                    player.is_ready
                      ? 'border-green bg-green'
                      : 'border-petro-line-strong bg-transparent',
                  )} />
                  {player.id === room.host_player_id && (
                    <span className="text-[10px] font-black text-gold">👑</span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Host controls */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="btn btn-ghost rounded-xl px-4 py-2 text-xs"
        >
          ⚙️ {english ? 'Settings' : 'الإعدادات'}
        </button>
        <button
          type="button"
          onClick={() => setShowChat(!showChat)}
          className="btn btn-ghost rounded-xl px-4 py-2 text-xs"
        >
          💬 {english ? 'Chat' : 'الشات'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="btn btn-danger rounded-xl px-4 py-2 text-xs"
        >
          🗑️ {english ? 'Delete' : 'حذف'}
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="rounded-2xl border border-petro-line bg-petro-800/50 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-teal-bright/60">{english ? 'Questions' : 'الأسئلة'}</span>
            <select
              value={room.question_count}
              onChange={(e) => onUpdateSettings({ questionCount: Number(e.target.value) })}
              className="rounded-xl border border-petro-line-strong bg-petro-700 px-3 py-1.5 text-sm font-bold text-cream"
            >
              {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-teal-bright/60">{english ? 'Timer' : 'المؤقت'}</span>
            <select
              value={room.question_timeout_seconds}
              onChange={(e) => onUpdateSettings({ questionTimeSeconds: Number(e.target.value) })}
              className="rounded-xl border border-petro-line-strong bg-petro-700 px-3 py-1.5 text-sm font-bold text-cream"
            >
              {[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n}s</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-teal-bright/60">{english ? 'Who can join' : 'مين يقدر ينضم'}</span>
            <select
              value={(room as any).who_can_join ?? 'anyone'}
              onChange={(e) => onUpdateSettings({ whoCanJoin: e.target.value })}
              className="rounded-xl border border-petro-line-strong bg-petro-700 px-3 py-1.5 text-sm font-bold text-cream"
            >
              <option value="invite_only">{english ? 'Invite Only' : 'دعوة فقط'}</option>
              <option value="friends">{english ? 'My Friends' : 'أصدقائي'}</option>
              <option value="anyone">{english ? 'Anyone' : 'الجميع'}</option>
            </select>
          </div>
        </motion.div>
      )}

      {/* Chat panel */}
      {showChat && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <ChatPanel roomId={room.id} english={english} onClose={() => setShowChat(false)} />
        </motion.div>
      )}

      {/* START GAME */}
      <motion.button
        type="button"
        onClick={onStart}
        disabled={starting || players.length === 0}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="btn btn-gold w-full rounded-2xl py-5 text-xl"
      >
        {starting
          ? (english ? 'Starting…' : 'جارٍ البدء…')
          : `🎮 ${english ? 'START GAME' : 'ابدأ اللعب'}`}
      </motion.button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Player Lobby
// ---------------------------------------------------------------------------
export function PlayerLobby({
  room,
  players,
  english,
  selfPlayerId,
}: {
  room: LiveRoomRow
  players: LivePlayerRow[]
  english: boolean
  selfPlayerId?: string
}) {
  const [showChat, setShowChat] = useState(false)
  const [togglingReady, setTogglingReady] = useState(false)

  const myPlayer = players.find((p) => p.user_id === selfPlayerId)
  const isReady = myPlayer?.is_ready ?? false
  const readyCount = players.filter((p) => p.is_ready).length

  const handleToggleReady = useCallback(async () => {
    if (togglingReady) return
    setTogglingReady(true)
    try {
      await setReady(room.id, !isReady)
    } catch {
      // Optimistic: the UI will update via Realtime subscription
    } finally {
      setTogglingReady(false)
    }
  }, [room.id, isReady, togglingReady])

  return (
    <div className="space-y-6">
      {/* Room info */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-dark rounded-3xl p-8 text-center"
      >
        <p className="text-sm font-bold text-teal-bright/60 mb-2">
          {english ? 'Room Code' : 'كود الغرفة'}
        </p>
        <div className="font-display text-5xl font-black tracking-[0.15em] text-gold-bright">
          {room.room_code}
        </div>
        <p className="mt-4 text-lg font-black text-cream">
          {room.pack_title}
        </p>
      </motion.div>

      {/* Ready count */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-petro-line bg-petro-800/50 px-5 py-2.5 text-sm font-bold text-teal-bright/60">
          {english
            ? `${readyCount}/${players.length} ready`
            : `${readyCount}/${players.length} جاهزين`}
        </span>
      </motion.div>

      {/* Players */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-dark rounded-3xl p-6"
      >
        <h3 className="font-display text-lg font-black text-cream mb-4">
          {english ? 'Players' : 'اللاعبون'} ({players.length})
        </h3>
        <div className="space-y-2">
          <AnimatePresence>
            {players.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-petro-line bg-petro-800/50 p-3"
              >
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-cream">{player.name}</p>
                </div>
                <span className={cn(
                  'h-3 w-3 rounded-full border-2 transition-colors',
                  player.is_ready
                    ? 'border-green bg-green'
                    : 'border-petro-line-strong bg-transparent',
                )} />
                {player.id === room.host_player_id && (
                  <span className="text-[10px] font-black text-gold">👑</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Ready toggle button */}
      <motion.button
        type="button"
        onClick={() => void handleToggleReady()}
        disabled={togglingReady}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'w-full rounded-2xl py-4 text-lg font-black transition-all duration-200',
          isReady
            ? 'bg-green/20 border-2 border-green text-green shadow-[0_0_20px_rgba(61,139,104,0.3)]'
            : 'bg-gradient-to-b from-[#C9A227] to-[#A8861D] text-navy shadow-[0_14px_30px_rgba(201,162,39,0.35)]',
        )}
      >
        {isReady
          ? (english ? '✓ Ready!' : '✓ جاهز!')
          : (english ? 'Mark as Ready' : 'أنا جاهز')}
      </motion.button>

      {/* Chat toggle */}
      <button
        type="button"
        onClick={() => setShowChat(!showChat)}
        className="w-full text-center text-xs font-bold text-teal-bright/50 hover:text-cream transition"
      >
        💬 {showChat ? (english ? 'Hide Chat' : 'إخفاء الشات') : (english ? 'Open Chat' : 'فتح الشات')}
      </button>

      {/* Chat panel */}
      {showChat && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <ChatPanel roomId={room.id} english={english} onClose={() => setShowChat(false)} />
        </motion.div>
      )}

      {/* Waiting message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-petro-line bg-petro-800/50 px-6 py-3">
          <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
          <span className="text-sm font-bold text-teal-bright/60">
            {english ? 'Waiting for host to start…' : 'في انتظار المضيف لبدء اللعبة…'}
          </span>
        </div>
      </motion.div>
    </div>
  )
}
