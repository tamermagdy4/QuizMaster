import { GlassCard } from '../components/GlassCard'
import { useAppStore } from '../store/appStore'

export function Admin() {
  const english = useAppStore((state) => state.direction === 'ltr')

  return (
    <GlassCard>
      <h1 className="mb-2 text-2xl font-bold text-orange-900">{english ? 'Admin panel' : 'لوحة الإدارة'}</h1>
      <p className="text-orange-900/60">{english ? 'Content and user management — coming soon.' : 'إدارة المحتوى والمستخدمين — قريباً.'}</p>
    </GlassCard>
  )
}
