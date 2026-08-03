import type { Lifeline } from '../types/board'

export const defaultLifelines = (): Lifeline[] => [
  {
    id: 'double',
    label: 'مضاعفة النقاط',
    description: 'ضاعف نقاط هذا السؤال',
    icon: '✕2',
    used: false,
  },
  {
    id: 'block',
    label: 'حظر الخصم',
    description: 'امنع الفريق الآخر من الإجابة',
    icon: '🛡️',
    used: false,
  },
  {
    id: 'call',
    label: 'اتصال بصديق',
    description: 'اطلب مساعدة لمدة ٣٠ ثانية',
    icon: '📞',
    used: false,
  },
  {
    id: 'wheel',
    label: 'عجلة الحظ',
    description: 'دُر العجلة لمكافأة عشوائية',
    icon: '🎡',
    used: false,
  },
]
