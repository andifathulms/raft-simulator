import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LOCALES, dictionary, isLocale, type Locale } from '@/lib/i18n'

export function generateStaticParams(): { locale: Locale }[] {
  return LOCALES.map((locale) => ({ locale }))
}

const REPO = 'https://github.com/andifathulms/raft-simulator'

/**
 * How it's built — the engineering account, written for engineers and interviewers.
 *
 * It used to be the last section of the home page, under a rule, after everything
 * written for a newcomer. The readers it is for — someone weighing whether to trust
 * the simulator, or weighing the person who wrote it — should not have to scroll past
 * an explanation of what a computer cluster is to reach it.
 *
 * Every claim here is one the repository checks: the paths name where.
 */
export default function AboutPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = dictionary(locale)

  return (
    <div className="flex flex-col gap-14 pb-8">
      <header className="max-w-3xl pt-2">
        <p className="field-label">{dict.nav.tagline}</p>
        <h1 className="mt-4 font-serif text-headline font-semibold">{dict.about.title}</h1>
        <p className="mt-5 max-w-prose font-serif text-lede text-ink">{dict.about.lede}</p>
        <p className="mt-4 max-w-prose plain">{dict.home.lede}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href={REPO} className="btn btn-strong px-5 py-2.5">
            {dict.about.repo} ↗
          </a>
          <Link href={`/${locale}/simulasi`} className="btn px-5 py-2.5">
            {dict.nav.simulation}
          </Link>
        </div>
      </header>

      <section>
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dict.about.pillars.map((pillar) => (
            <li key={pillar.title} className="card flex flex-col gap-3 p-6">
              <h2 className="font-serif text-panel font-semibold">{pillar.title}</h2>
              <p className="font-sans text-label leading-relaxed text-ink-soft">{pillar.body}</p>
              <a
                href={`${REPO}/tree/main/${pillar.path}`}
                className="mt-auto self-start rounded-full border border-ink-rule px-2.5 py-0.5 font-mono text-micro text-ink-soft transition-colors hover:border-ink-edge hover:text-ink"
              >
                {pillar.path}
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-ink-rule pt-10">
        <h2 className="font-serif text-title font-semibold">{dict.about.creditTitle}</h2>
        <div className="mt-6 grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-serif text-panel font-semibold">{dict.home.priorArtTitle}</h3>
            <p className="mt-2 font-sans text-label leading-relaxed text-ink-soft">{dict.home.priorArt}</p>
            <a href="https://raft.github.io/" className="mt-3 inline-block font-sans text-label text-leader underline underline-offset-2">
              RaftScope ↗
            </a>
          </div>
          <div>
            <h3 className="font-serif text-panel font-semibold">{dict.home.contributionTitle}</h3>
            <p className="mt-2 font-sans text-label leading-relaxed text-ink-soft">{dict.home.contribution}</p>
          </div>
          <div>
            <h3 className="font-serif text-panel font-semibold">{dict.home.sourceTitle}</h3>
            <p className="mt-2 font-sans text-label leading-relaxed text-ink-soft">{dict.home.source}</p>
            <a href="https://raft.github.io/raft.pdf" className="mt-3 inline-block font-sans text-label text-leader underline underline-offset-2">
              raft.pdf ↗
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
