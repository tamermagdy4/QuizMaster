import { useEffect } from 'react'
import { GlassCard } from '../components/GlassCard'
import { useTranslation } from '../i18n/translations'

const whatsappUrl = 'https://wa.me/201096257919'

export function About() {
  const { english, t } = useTranslation()
    const brand = t('arena')

  useEffect(() => {
    document.title = english ? `About the Developer | ${brand}` : `عن المطور | ${brand}`
    return () => { document.title = 'Fahloy' }
  }, [english])

  const contacts = [
    { icon: '◌', name: 'WhatsApp', description: english ? 'Contact me directly' : 'تواصل معي مباشرة', href: whatsappUrl, external: true },
    { icon: '@', name: 'Email', description: english ? 'Send me an email' : 'راسلني عبر البريد الإلكتروني', href: 'mailto:tm889737@gmail.com', external: false },
  ]

  return (
    <main dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-5xl space-y-6">
      <header className="text-center"><p className="eyebrow">{brand}</p><h1 className="mt-2 text-3xl font-black text-navy sm:text-4xl">{english ? 'About the Developer' : 'عن المطور'}</h1></header>
      <GlassCard strong><div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-start"><div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-navy-3 text-4xl font-black text-white shadow-[0_10px_24px_rgba(18,59,70,0.22)]" aria-hidden>TM</div><div><h2 className="text-2xl font-black text-ink">Tamer Magdy</h2><p className="mt-1 font-bold text-teal">{english ? `Developer & Creator of ${brand}` : `مطور وصاحب مشروع ${brand}`}</p><p className="mt-4 max-w-3xl text-sm leading-7 text-ink-2">{english ? `I'm Tamer Magdy, the developer and creator of ${brand}, an interactive quiz game designed to provide a fun and competitive experience for friends and teams.` : `أنا Tamer Magdy، مطور وصاحب فكرة ${brand}، وهو مشروع لعبة مسابقات تفاعلية مصممة لتقديم تجربة ممتعة وتنافسية بين الأصدقاء والفرق.`}</p></div></div></GlassCard>
      <GlassCard strong><p className="eyebrow">{english ? 'The project' : 'المشروع'}</p><h2 className="mt-2 text-2xl font-black text-ink">{english ? `About ${brand}` : `عن ${brand}`}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-ink-2">{english ? `${brand} is an interactive quiz game that combines knowledge and competition, allowing players to create games, choose categories, and compete as teams.` : `${brand} هو مشروع لعبة مسابقات تفاعلية تجمع بين المعرفة والمنافسة، وتتيح للاعبين إنشاء مباريات واختيار الفئات والتنافس بين الفرق.`}</p></GlassCard>
      <section><div className="mb-4"><p className="eyebrow">{english ? 'Contact' : 'التواصل'}</p><h2 className="mt-1 text-2xl font-black text-ink">{english ? 'Contact me' : 'تواصل معي'}</h2></div><div className="grid gap-4 sm:grid-cols-2">{contacts.map((contact) => <a key={contact.name} href={contact.href} target={contact.external ? '_blank' : undefined} rel={contact.external ? 'noopener noreferrer' : undefined} aria-label={`${contact.name}: ${contact.description}`} className="group flex items-center gap-4 rounded-2xl border border-border-soft bg-white p-4 shadow-panel transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raised"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal/10 text-lg font-black text-teal transition group-hover:bg-teal/20">{contact.icon}</span><span><strong className="block text-sm font-black text-ink">{contact.name}</strong><span className="mt-1 block text-xs text-muted">{contact.description}</span></span><span className="ms-auto text-muted transition group-hover:text-teal" aria-hidden>↗</span></a>)}</div></section>
      <GlassCard strong className="border-gold/40 bg-gold/5"><h2 className="text-xl font-black text-ink">{english ? 'Support the project ❤️' : 'دعم المشروع ❤️'}</h2><p className="mt-2 text-sm leading-7 text-ink-2">{english ? `If you enjoy ${brand} and would like to support the project or share your feedback, you can contact me through any of the channels above.` : `إذا أعجبك ${brand} وترغب في دعم المشروع أو مشاركة رأيك، يمكنك التواصل معي عبر أي من وسائل التواصل الموجودة بالأعلى.`}</p></GlassCard>
    </main>
  )
}
