import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[#223147] bg-[#0d1420] p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-950/60 text-rose-400">
            <LogOut className="h-5 w-5" />
          </span>
          <p className="text-lg font-extrabold text-white">
            {english ? 'Leave the room?' : 'مغادرة الروم'}
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
          {english
            ? 'Are you sure you want to leave the room? Leaving will cancel the match and remove the other player from the room.'
            : 'هل أنت متأكد أنك تريد مغادرة الروم؟ سيؤدي خروجك إلى إلغاء المباراة وإخراج اللاعب الآخر من الروم.'}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-gradient-to-b from-[#b04d49] to-[#8a3835] px-4 py-2.5 text-xs font-black text-white shadow-md shadow-rose-950/50 transition hover:brightness-110 active:scale-[0.97] sm:text-sm"
          >
            <LogOut className="h-4 w-4" />
            <span>{english ? 'Leave room' : 'مغادرة الروم'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#223147] bg-[#141d2b] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-[#1e293b] hover:text-white sm:text-sm"
          >
            {english ? 'Cancel' : 'إلغاء'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
