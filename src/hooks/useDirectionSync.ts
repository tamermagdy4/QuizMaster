import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

export function useDirectionSync() {
  const direction = useAppStore((state) => state.direction)

  useEffect(() => {
    document.documentElement.dir = direction
    document.documentElement.lang = direction === 'rtl' ? 'ar' : 'en'
  }, [direction])
}
