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
    { icon: 'f', name: 'Facebook', description: english ? 'Follow me on Facebook' : 'تابعني على Facebook', href: 'https://www.facebook.com/tamer.mmaaggddy.7', external: true },
    { icon: '◎', name: 'Instagram', description: english ? 'Follow me on Instagram' : 'تابعني على Instagram', href: 'https://www.instagram.com/tamermagdy56/', external: true },
    { icon: '◌', name: 'WhatsApp', description: english ? 'Contact me directly' : 'تواصل معي مباشرة', href: whatsappUrl, external: true },
    { icon: '@', name: 'Email', description: english ? 'Send me an email' : 'راسلني عبر البريد الإلكتروني', href: 'mailto:tm889737@gmail.com', external: false },
  ]

  return (
    <main dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-5xl space-y-6">
      <header className="text-center"><p className="text-xs font-black uppercase tracking-[0.24em] text-sky-500">{brand}</p><h1 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">{english ? 'About the Developer' : 'عن المطور'}</h1></header>
      <GlassCard strong className="!border-slate-200 !bg-white !shadow-[0_14px_40px_rgba(15,23,42,0.08)]"><div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-start"><div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-teal-600 text-4xl font-black text-white shadow-[0_10px_24px_rgba(23,107,135,0.22)]" aria-hidden>TM</div><div><h2 className="text-2xl font-black text-slate-900">Tamer Magdy</h2><p className="mt-1 font-bold text-sky-700">{english ? `Developer & Creator of ${brand}` : `مطور وصاحب مشروع ${brand}`}</p><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{english ? `I'm Tamer Magdy, the developer and creator of ${brand}, an interactive quiz game designed to provide a fun and competitive experience for friends and teams.` : `أنا Tamer Magdy، مطور وصاحب فكرة ${brand}، وهو مشروع لعبة مسابقات تفاعلية مصممة لتقديم تجربة ممتعة وتنافسية بين الأصدقاء والفرق.`}</p></div></div></GlassCard>
      <GlassCard strong className="!border-slate-200 !bg-white !shadow-[0_14px_40px_rgba(15,23,42,0.08)]"><p className="text-xs font-black uppercase tracking-[0.2em] text-sky-500">{english ? 'The project' : 'المشروع'}</p><h2 className="mt-2 text-2xl font-black text-slate-900">{english ? `About ${brand}` : `عن ${brand}`}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{english ? `${brand} is an interactive quiz game that combines knowledge and competition, allowing players to create games, choose categories, and compete as teams.` : `${brand} هو مشروع لعبة مسابقات تفاعلية تجمع بين المعرفة والمنافسة، وتتيح للاعبين إنشاء مباريات واختيار الفئات والتنافس بين الفرق.`}</p></GlassCard>
      <section><div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.2em] text-sky-500">{english ? 'Contact' : 'التواصل'}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{english ? 'Contact me' : 'تواصل معي'}</h2></div><div className="grid gap-4 sm:grid-cols-2">{contacts.map((contact) => <a key={contact.name} href={contact.href} target={contact.external ? '_blank' : undefined} rel={contact.external ? 'noopener noreferrer' : undefined} aria-label={`${contact.name}: ${contact.description}`} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_12px_28px_rgba(14,165,233,0.12)]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-lg font-black text-sky-700 transition group-hover:bg-sky-100">{contact.icon}</span><span><strong className="block text-sm font-black text-slate-900">{contact.name}</strong><span className="mt-1 block text-xs text-slate-500">{contact.description}</span></span><span className="ms-auto text-slate-400 transition group-hover:text-sky-600" aria-hidden>↗</span></a>)}</div></section>
      <GlassCard strong className="!border-amber-200 !bg-amber-50/70 !shadow-[0_12px_30px_rgba(180,120,20,0.08)]"><h2 className="text-xl font-black text-slate-900">{english ? 'Support the project ❤️' : 'دعم المشروع ❤️'}</h2><p className="mt-2 text-sm leading-7 text-slate-600">{english ? `If you enjoy ${brand} and would like to support the project or share your feedback, you can contact me through any of the channels above.` : `إذا أعجبك ${brand} وترغب في دعم المشروع أو مشاركة رأيك، يمكنك التواصل معي عبر أي من وسائل التواصل الموجودة بالأعلى.`}</p></GlassCard>
    </main>
  )
}
