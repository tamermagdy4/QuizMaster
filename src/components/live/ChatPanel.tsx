import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { sendChat, getChat, type ChatMessage } from '../../services/livePackService'
import { cn } from '../../utils/cn'

/**
 * ChatPanel — real-time chat for the live party room.
 * Messages are persisted in the database so late joiners can see history.
 */
export function ChatPanel({
  roomId,
  english,
  onClose,
}: {
  roomId: string
  english: boolean
  onClose?: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastTimestampRef = useRef<string | null>(null)

  // Fetch initial messages
  useEffect(() => {
    let mounted = true
    void getChat(roomId)
      .then((msgs) => {
        if (!mounted) return
        setMessages(msgs)
        if (msgs.length > 0) {
          lastTimestampRef.current = msgs[msgs.length - 1].created_at
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [roomId])

  // Poll for new messages every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void getChat(roomId, lastTimestampRef.current ?? undefined)
        .then((newMsgs) => {
          if (newMsgs.length > 0) {
            setMessages((prev) => [...prev, ...newMsgs])
            lastTimestampRef.current = newMsgs[newMsgs.length - 1].created_at
          }
        })
        .catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [roomId])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await sendChat(roomId, text)
      setInput('')
      // Immediately fetch the new message
      const newMsgs = await getChat(roomId, lastTimestampRef.current ?? undefined)
      if (newMsgs.length > 0) {
        setMessages((prev) => [...prev, ...newMsgs])
        lastTimestampRef.current = newMsgs[newMsgs.length - 1].created_at
      }
    } catch {
      // Silently fail — the message will appear on next poll
    } finally {
      setSending(false)
    }
  }, [input, sending, roomId])

  return (
    <div className="flex flex-col rounded-2xl border border-petro-line bg-petro-800/80 overflow-hidden" style={{ maxHeight: '60vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-petro-line px-4 py-3">
        <h3 className="font-display text-sm font-black text-cream">
          {english ? 'Message Board' : 'لوحة الرسائل'}
        </h3>
        {onClose && (
          <button type="button" onClick={onClose} className="text-teal-bright/50 hover:text-cream">
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: '200px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-teal-bright/40">
            {english ? 'No messages yet. Say hello!' : 'لا توجد رسائل بعد. قل مرحبا!'}
          </p>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-xl px-3 py-2',
                msg.is_system
                  ? 'bg-teal/10 text-center'
                  : 'bg-petro-700/50',
              )}
            >
              {msg.is_system ? (
                <p className="text-[11px] text-teal-bright/60 italic">{msg.message}</p>
              ) : (
                <>
                  <p className="text-[10px] font-black text-gold-bright">{msg.player_name}</p>
                  <p className="text-xs text-cream/90">{msg.message}</p>
                </>
              )}
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-petro-line p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSend() } }}
            placeholder={english ? 'Type a message…' : 'اكتب رسالة…'}
            className="flex-1 rounded-xl border border-petro-line-strong bg-petro-700/60 px-3 py-2 text-xs font-bold text-cream outline-none placeholder:text-teal-bright/30 focus:border-gold/50"
            disabled={sending}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            className="rounded-xl bg-gold px-4 py-2 text-xs font-black text-navy transition hover:brightness-110 disabled:opacity-40"
          >
            {sending ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
