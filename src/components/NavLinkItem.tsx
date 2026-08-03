import { NavLink } from 'react-router-dom'
import { cn } from '../utils/cn'

interface NavLinkItemProps {
  to: string
  label: string
  end?: boolean
}

export function NavLinkItem({ to, label, end = false }: NavLinkItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-white/15 text-gold-400 shadow-glow-gold'
            : 'text-white/70 hover:bg-white/10 hover:text-white',
        )
      }
    >
      {label}
    </NavLink>
  )
}
