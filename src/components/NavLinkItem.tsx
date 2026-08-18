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
          'rounded-lg px-3 py-2 text-xs font-bold transition-colors duration-150',
          isActive
            ? 'bg-gold/15 text-gold-bright shadow-[0_0_18px_rgba(201,162,39,0.15)]'
            : 'text-slate-400 hover:bg-white/5 hover:text-white',
        )
      }
    >
      {label}
    </NavLink>
  )
}
