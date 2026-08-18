import { motion } from 'framer-motion'
import { useAppStore } from '../store/appStore'

type LegalSection = {
  heading: string
  headingAr: string
  body: string
  bodyAr: string
  items?: { text: string; textAr: string }[]
}

const privacySections: LegalSection[] = [
  {
    heading: 'Data We Collect',
    headingAr: 'البيانات التي نجمعها',
    body: 'We only collect what is necessary to run Fahloy: the name and email you provide when creating an account (managed securely through Supabase authentication), and your in-game preferences and quiz progress stored locally on your device.',
    bodyAr: 'نجمع فقط ما يلزم لتشغيل فهلوي: الاسم والبريد اللذين تقدمهما عند إنشاء حساب (تُدار بأمان عبر مصادقة Supabase)، وتفضيلات اللعب وتقدمك في الأسئلة المخزنة محليًا على جهازك.',
  },
  {
    heading: 'How We Use Your Data',
    headingAr: 'كيف نستخدم بياناتك',
    body: 'Your account data is used solely to authenticate you, save your profile, and let you participate in online games. We never sell or share your personal information with third parties for marketing.',
    bodyAr: 'تُستخدم بيانات حسابك فقط للمصادقة عليك وحفظ ملفك الشخصي وتمكينك من المشاركة في المباريات الأونلاين. لا نبيع أو نشارك معلوماتك الشخصية مع أي طرف ثالث لأغراض تسويقية.',
  },
  {
    heading: 'Local Storage',
    headingAr: 'التخزين المحلي',
    body: 'Game progress, settings, and unfinished boards are kept in your browser\u2019s local storage so you can continue where you left off. You can clear this data anytime from your browser settings.',
    bodyAr: 'يُحفظ تقدم اللعبة والإعدادات واللوحات غير المكتملة في التخزين المحلي لمتصفحك لتتمكن من المتابعة من حيث توقفت. يمكنك مسح هذه البيانات في أي وقت من إعدادات المتصفح.',
  },
  {
    heading: 'Security',
    headingAr: 'الأمان',
    body: 'Authentication and account data are handled by Supabase with industry-standard encryption. We take reasonable measures to protect your information.',
    bodyAr: 'تُدار المصادقة وبيانات الحساب عبر Supabase بتشفير وفق المعايير المتعارف عليها. نتخذ إجراءات معقولة لحماية معلوماتك.',
  },
  {
    heading: 'Your Rights',
    headingAr: 'حقوقك',
    body: 'You can request access to, correction of, or deletion of your personal data at any time by contacting us through the About page.',
    bodyAr: 'يمكنك طلب الاطلاع على بياناتك الشخصية أو تصحيحها أو حذفها في أي وقت عبر التواصل معنا من صفحة عن المطور.',
  },
  {
    heading: 'Changes to This Policy',
    headingAr: 'التغييرات على هذه السياسة',
    body: 'We may update this policy from time to time. Any changes will be reflected on this page with a new effective date.',
    bodyAr: 'قد نحدّث هذه السياسة من وقت لآخر، وسيظهر أي تغيير في هذه الصفحة مع تاريخ سريان جديد.',
  },
]

const termsSections: LegalSection[] = [
  {
    heading: 'Acceptance of Terms',
    headingAr: 'قبول الشروط',
    body: 'By using Fahloy, you agree to these terms. If you do not agree, please do not use the game.',
    bodyAr: 'باستخدامك فهلوي فأنت توافق على هذه الشروط. إذا كنت لا توافق، فيرجى عدم استخدام اللعبة.',
  },
  {
    heading: 'Using the Game',
    headingAr: 'استخدام اللعبة',
    body: 'Fahloy is provided for personal, non-commercial entertainment. You may not copy, resell, or misuse the game, its questions, or its content.',
    bodyAr: 'فهلوي متاح للاستخدام الشخصي والترفيه غير التجاري. لا يجوز نسخ اللعبة أو أسئلتها أو محتواها أو إعادة بيعها أو إساءة استخدامها.',
    items: [
      { text: 'You may play, create games, and invite friends.', textAr: 'يمكنك اللعب وإنشاء المباريات ودعوة الأصدقاء.' },
      { text: 'You may not reproduce or redistribute game content commercially.', textAr: 'لا يجوز نسخ أو إعادة توزيع محتوى اللعبة تجاريًا.' },
    ],
  },
  {
    heading: 'Accounts',
    headingAr: 'الحسابات',
    body: 'You are responsible for keeping your account credentials safe. Account data is used only within the game and its online rooms.',
    bodyAr: 'أنت مسؤول عن الحفاظ على سرية بيانات حسابك. تُستخدم بيانات الحساب فقط داخل اللعبة وغرفها الأونلاين.',
  },
  {
    heading: 'Intellectual Property',
    headingAr: 'الملكية الفكرية',
    body: 'The Fahloy name, logo, interface, and question content belong to Fahloy. Category images and question media are used within the game for educational and entertainment purposes.',
    bodyAr: 'اسم فهلوي وشعارها وواجهتها ومحتوى الأسئلة ملك لفهلوي. تُستخدم صور الفئات ووسائط الأسئلة داخل اللعبة لأغراض تعليمية وترفيهية.',
  },
  {
    heading: 'Disclaimer',
    headingAr: 'إخلاء المسؤولية',
    body: 'The game is provided \u201cas is\u201d without warranties of any kind. We are not liable for any losses arising from your use of the game.',
    bodyAr: 'تُقدَّم اللعبة "كما هي" دون أي ضمانات من أي نوع. لا نتحمل مسؤولية أي خسائر تنشأ عن استخدامك للعبة.',
  },
  {
    heading: 'Changes to These Terms',
    headingAr: 'التغييرات على هذه الشروط',
    body: 'We may update these terms from time to time. Continued use of Fahloy after changes means you accept the updated terms.',
    bodyAr: 'قد نحدّث هذه الشروط من وقت لآخر، واستمرارك في استخدام فهلوي بعد التغييرات يعني قبولك للشروط المحدثة.',
  },
]

function LegalLayout({ eyebrow, title, updated, intro, sections }: {
  eyebrow: string
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}) {
  const { direction } = useAppStore()
  const english = direction === 'ltr'

  return (
    <div dir={direction} className="mx-auto max-w-4xl space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-6 text-white shadow-panel sm:p-8"
      >
        <div className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-gold/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-44 w-44 rounded-full bg-teal/15 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-bold text-white/70">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 flex items-center gap-2 text-xs font-bold text-gold-bright">
            <span aria-hidden>📅</span>
            {updated}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">{intro}</p>
        </div>
      </motion.header>

      <div className="space-y-4">
        {sections.map((section, index) => (
          <motion.section
            key={section.heading}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
            className="glass-panel p-5 sm:p-6"
          >
            <h2 className="text-lg font-black text-navy">
              {english ? section.heading : section.headingAr}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              {english ? section.body : section.bodyAr}
            </p>
            {section.items && (
              <ul className="mt-3 space-y-1.5 ps-4 text-sm leading-relaxed text-ink-2">
                {section.items.map((item) => (
                  <li key={item.text} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{english ? item.text : item.textAr}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        ))}
      </div>
    </div>
  )
}

export function PrivacyPolicy() {
  const english = useAppStore((state) => state.direction === 'ltr')
  return (
    <LegalLayout
      eyebrow="Fahloy · Legal"
      title={english ? 'Privacy Policy' : 'سياسة الخصوصية'}
      updated={english ? 'Effective: August 2026' : 'تاريخ السريان: أغسطس 2026'}
      intro={
        english
          ? 'This policy explains how Fahloy collects, uses, and protects your information when you use the game.'
          : 'توضح هذه السياسة كيف تجمع فهلوي معلوماتك وتستخدمها وتحميها عند استخدامك للعبة.'
      }
      sections={privacySections}
    />
  )
}

export function TermsOfService() {
  const english = useAppStore((state) => state.direction === 'ltr')
  return (
    <LegalLayout
      eyebrow="Fahloy · Legal"
      title={english ? 'Terms of Service' : 'شروط الاستخدام'}
      updated={english ? 'Effective: August 2026' : 'تاريخ السريان: أغسطس 2026'}
      intro={
        english
          ? 'These terms govern your use of the Fahloy quiz game. Please read them carefully before playing.'
          : 'تحكم هذه الشروط استخدامك للعبة الأسئلة فهلوي. يرجى قراءتها بعناية قبل اللعب.'
      }
      sections={termsSections}
    />
  )
}
