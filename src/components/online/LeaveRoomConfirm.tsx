import { motion } from 'framer-motion'
import { useTranslation } from '../../i18n/translations'

interface LeaveRoomConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

/**
 * Confirmation shown before intentionally leaving an online room. Leaving
 * cancels the whole match and ejects the other player, so we always ask.
 */
export function LeaveRoomConfirm({ open, onClose, onConfirm }: LeaveRoomConfirmProps) {
  const { english } = useTranslation()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/88 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-rose-400/30 bg-[#0B1220] p-5 shadow-2xl"
      >
        <p className="text-lg font-black text-white">
          🚪 {english ? 'Leave the room?' : 'مغادرة الروم'}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {english
            ? 'Are you sure you want to leave the room? Leaving will cancel the match and remove the other player from the room.'
            : 'هل أنت متأكد أنك تريد مغادرة الروم؟ سيؤدي خروجك إلى إلغاء المباراة وإخراج اللاعب الآخر من الروم.'}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl border-2 border-rose-400/60 bg-rose-500/20 px-4 py-2.5 text-sm font-black text-rose-200 transition hover:bg-rose-500/30"
          >
            🚪 {english ? 'Leave room' : 'مغادرة الروم'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-black text-slate-300 transition hover:bg-white/10"
          >
            {english ? 'Cancel' : 'إلغاء'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
