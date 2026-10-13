import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RoleGlyph } from '@/components/cluster/glyph'
import { LiveCluster } from '@/components/home/LiveCluster'
import { MajorityDiagram } from '@/components/home/MajorityDiagram'
import { LOCALES, dictionary, isLocale, type Locale } from '@/lib/i18n'
import { SAFETY_PROPERTIES, PROPERTY_STATEMENTS } from '@/lib/invariants/types'
import type { Role } from '@/lib/raft/types'

export function generateStaticParams(): { locale: Locale }[] {
  return LOCALES.map((locale) => ({ locale }))
}

/**
 * The home page has two readers and does not make them read each other's copy.
 *
 * Someone who has never heard of Raft needs to know what problem it solves before any
 * of this means anything, and they will bounce off "deterministic discrete-event
 * simulation" in the first line. Someone who has read the paper wants to know what
 * this adds to RaftScope and can skip the explanation entirely.
 *
 * So the page runs plain-first and technical-second. It opens on the product itself
 * — the real simulator, running — because a cluster electing a leader explains more
 * in five seconds than the paragraph beside it. The technical account is complete,
 * on its own page (/tentang), where the readers it is written for will look for it.
 */
export default function Home({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = dictionary(locale)
  const id = locale === 'id'

  const routes: { href: string; title: string; body: string; tone: 'strong' | 'quiet' | 'violation' }[] = [
    {
      href: `/${locale}/simulasi/#s=clean-election`,
      title: id ? 'Tonton satu pemilihan' : 'Watch an election',
      body: id
        ? 'Lima komputer, tidak ada yang memimpin, lalu satu terpilih. Mulailah dari sini.'
        : 'Five computers, nobody in charge, then one is elected. Start here.',
      tone: 'strong',
    },
    {
      href: `/${locale}/ablasi`,
      title: id ? 'Matikan sebuah aturan' : 'Switch a rule off',
      body: id
        ? 'Setiap aturan menjaga satu janji. Matikan salah satunya, lalu lihat janjinya gagal.'
        : 'Each rule defends one promise. Switch one off and watch that promise fail.',
      tone: 'quiet',
    },
    {
      href: `/${locale}/simulasi/#s=figure-8&off=ct`,
      title: id ? 'Figure 8, hidup' : 'Figure 8, live',
      body: id
        ? 'Diagram paling terkenal di makalah Raft — di sini ia berjalan, dan catatan yang sudah sah tertimpa.'
        : 'The most famous diagram in the Raft paper — here it runs, and a settled record is overwritten.',
      tone: 'violation',
    },
  ]

  const legend: { role: Role; crashed?: boolean; name: string; body: string }[] = [
    { role: 'leader', name: dict.roles.leader, body: dict.plain.roles.leader },
    { role: 'follower', name: dict.roles.follower, body: dict.plain.roles.follower },
    { role: 'candidate', name: dict.roles.candidate, body: dict.plain.roles.candidate },
    { role: 'follower', crashed: true, name: dict.roles.crashed, body: dict.plain.roles.crashed },
  ]

  return (
    <div className="flex flex-col gap-20 pb-8">
      {/* ---- The hero states the thesis: the real simulator, running, beside the
              plain-language headline. No algorithm term appears before the reader
              has a reason to care about it. ---- */}
      <section className="grid items-center gap-10 pt-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex flex-col">
          <p className="field-label">{dict.nav.tagline}</p>
          <h1 className="mt-4 font-serif text-headline font-semibold sm:text-display">{dict.plain.headline}</h1>
          <p className="mt-6 max-w-prose font-serif text-lede text-ink">{dict.plain.lede}</p>
          <p className="mt-4 max-w-prose plain">{dict.plain.whyHard}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={`/${locale}/simulasi/#s=clean-election`} className="btn btn-strong px-5 py-2.5 text-body">
              {dict.landing.watch} <span aria-hidden>▶</span>
            </Link>
            <Link href={`/${locale}/ablasi`} className="btn px-5 py-2.5 text-body">
              {dict.landing.breakOne}
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[30rem]">
          <LiveCluster dict={dict} locale={locale} />
        </div>
      </section>

      <section>
        <h2 className="font-serif text-title font-semibold">{dict.plain.tryTitle}</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {routes.map((route) => (
            <li key={route.href} className="flex">
              <Link
                href={route.href}
                className={[
                  'card group flex w-full flex-col gap-2 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift',
                  route.tone === 'violation' ? 'border-vermilion/60' : '',
                  route.tone === 'strong' ? 'border-ink-edge' : '',
                ].join(' ')}
              >
                <RouteArt tone={route.tone} />
                <h3
                  className={[
                    'mt-2 font-serif text-panel font-semibold',
                    route.tone === 'violation' ? 'text-vermilion' : '',
                  ].join(' ')}
                >
                  {route.title}
                </h3>
                <p className="font-sans text-label leading-relaxed text-ink-soft">{route.body}</p>
                <span aria-hidden className="mt-auto pt-2 font-sans text-label text-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-ink">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 className="font-serif text-title font-semibold">{dict.plain.stepsTitle}</h2>
          {/* A real sequence — election, replication, repair — so numbered. */}
          <ol className="mt-6 flex flex-col gap-6">
            {dict.plain.steps.map((entry, index) => (
              <li key={entry.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-4">
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-mono text-label font-bold text-stock-pale"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-serif text-panel font-semibold">{entry.title}</h3>
                  <p className="mt-1.5 max-w-prose font-sans text-label leading-relaxed text-ink-soft">{entry.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-8">
          <MajorityDiagram locale={locale} />
          <div>
            <h2 className="font-serif text-panel font-semibold">{dict.plain.legendTitle}</h2>
            <p className="mt-2 max-w-prose font-sans text-label leading-relaxed text-ink-soft">{dict.plain.clusterHelp}</p>
            <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {legend.map((entry) => (
                <li key={entry.name} className="flex items-start gap-3">
                  <RoleGlyph role={entry.role} crashed={entry.crashed} />
                  <div className="min-w-0">
                    <p className="font-sans text-label font-semibold">{entry.name}</p>
                    <p className="mt-0.5 font-sans text-micro leading-relaxed text-ink-soft">{entry.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- The five properties, said twice: once plainly, once exactly. Neither is
              a substitute for the other — the plain line is what makes someone care,
              the formal statement is what the checker actually evaluates. ---- */}
      <section>
        <h2 className="font-serif text-title font-semibold">{dict.plain.propertiesTitle}</h2>
        <p className="mt-3 max-w-prose plain">{dict.plain.propertiesIntro}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SAFETY_PROPERTIES.map((property) => (
            <li key={property} className="flex flex-col gap-2 rounded-panel border border-ink-rule border-t-committed bg-stock-raised p-4 [border-top-width:3px]">
              <p className="flex items-center gap-2 font-sans text-label font-semibold">
                <span aria-hidden className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-committed text-[10px] font-bold text-stock-pale">
                  ✓
                </span>
                {dict.invariants.names[property]}
              </p>
              <p className="font-sans text-label leading-relaxed text-ink">{dict.plain.properties[property]}</p>
              <p className="mt-auto border-t border-ink-rule pt-2 font-mono text-[0.6875rem] leading-relaxed text-ink-faint">
                {PROPERTY_STATEMENTS[property]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Technical second. The full account lives on its own page now, where
              the engineers and interviewers it is written for will look for it. ---- */}
      <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-title font-semibold">{dict.landing.builtTitle}</h2>
          <p className="mt-3 max-w-prose font-serif text-lede text-ink-soft">{dict.landing.builtBody}</p>
        </div>
        <Link href={`/${locale}/tentang`} className="btn btn-strong shrink-0 self-start px-5 py-2.5 sm:self-center">
          {dict.landing.builtLink} →
        </Link>
      </section>
    </div>
  )
}

/** A small drawn mark per route: an election, a switch thrown off, a struck record. */
function RouteArt({ tone }: { tone: 'strong' | 'quiet' | 'violation' }) {
  return (
    <svg viewBox="0 0 120 44" width="120" height="44" aria-hidden className="overflow-visible">
      {tone === 'strong' && (
        <>
          <line x1="22" y1="22" x2="98" y2="22" className="stroke-ink-rule" strokeWidth="1.5" />
          <circle cx="16" cy="22" r="9" className="fill-follower stroke-ink" strokeWidth="1.25" />
          <rect x="51" y="13" width="18" height="18" rx="3" className="fill-leader stroke-ink" strokeWidth="1.25" />
          <circle cx="104" cy="22" r="9" className="fill-follower stroke-ink" strokeWidth="1.25" />
        </>
      )}
      {tone === 'quiet' && (
        <>
          <rect x="4" y="13" width="34" height="18" rx="9" className="fill-ink" />
          <circle cx="29" cy="22" r="6.5" className="fill-stock-raised" />
          <path d="M48 22 h20" className="stroke-ink-faint" strokeWidth="1.5" strokeDasharray="3 3" />
          <rect x="78" y="13" width="34" height="18" rx="9" className="fill-vermilion" />
          <circle cx="87" cy="22" r="6.5" className="fill-stock-raised" />
        </>
      )}
      {tone === 'violation' && (
        <>
          <rect x="4" y="12" width="30" height="20" rx="3" className="fill-committed/15 stroke-committed" strokeWidth="1.25" />
          <text x="19" y="26" textAnchor="middle" className="fill-committed font-mono text-[11px] font-bold">
            t2
          </text>
          <path d="M42 22 h16" className="stroke-ink-faint" strokeWidth="1.5" />
          <rect x="66" y="12" width="46" height="20" rx="3" className="fill-vermilion" />
          <text x="89" y="26" textAnchor="middle" className="fill-stock-pale font-mono text-[11px] font-bold">
            t2→t3
          </text>
        </>
      )}
    </svg>
  )
}
