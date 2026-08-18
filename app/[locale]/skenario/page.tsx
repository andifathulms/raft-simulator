import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SCENARIOS } from '@/data/scenarios'
import { LOCALES, dictionary, isLocale, type Dictionary, type Locale } from '@/lib/i18n'
import { descriptorFor } from '@/lib/raft/rules'
import { NETWORK_TIERS, networkTier, type NetworkTier } from '@/lib/scenarios/tier'

export function generateStaticParams(): { locale: Locale }[] {
  return LOCALES.map((locale) => ({ locale }))
}

/** Short codes must match `lib/share.ts`; they appear in links people have sent. */
const FLAG_CODES: Record<string, string> = {
  electionRestriction: 'er',
  currentTermCommitRule: 'ct',
  appendEntriesConsistencyCheck: 'ae',
  termIncrementOnCandidacy: 'ti',
  stepDownOnHigherTerm: 'sd',
  persistVotedFor: 'pv',
  jointConsensus: 'jc',
}

export default function ScenariosPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = dictionary(locale)

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="font-serif text-3xl sm:text-4xl">{dict.nav.scenarios}</h1>
        <p className="mt-3 max-w-prose plain">
          {locale === 'id'
            ? 'Tiap skenario adalah satu situasi yang dibangun tangan untuk menunjukkan satu hal — pemilihan yang bersih, dua calon yang saling mengunci, jaringan yang terbelah. Buka salah satu, lalu tekan Jalankan.'
            : 'Each scenario is one hand-built situation showing one thing — a clean election, two candidates deadlocking each other, a network cut in half. Open one and press play.'}
        </p>
        <p className="mt-3 max-w-prose font-sans text-label leading-relaxed text-ink-faint">
          {dict.scenarios.lede}
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {SCENARIOS.map((entry) => {
          const descriptor =
            entry.ablation === undefined ? null : descriptorFor(entry.ablation.flag)
          return (
            <li key={entry.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-xl leading-snug">{entry.title[locale]}</h2>
                {/* DESIGN-REWORK.md §5: the drop rate is the knob deciding whether a
                    run is calm or chaotic, and a number in a <dl> does not scan. */}
                <NetworkTierMark tier={networkTier(entry.spec.network.dropPerMille)} dict={dict} />
              </div>
              <p className="mt-0.5 font-mono text-micro text-ink-faint">{entry.id}</p>
              <p className="mt-2.5 font-sans text-body leading-relaxed">{entry.summary[locale]}</p>

              <div className="mt-3.5 border-t border-ink-rule pt-2.5">
                <h3 className="field-label">{dict.scenarios.phenomenon}</h3>
                <p className="mt-1 font-sans text-label leading-relaxed text-ink-soft">
                  {entry.phenomenon[locale]}
                </p>
              </div>

              <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-micro text-ink-faint">
                <div className="flex gap-2">
                  <dt>nodes:</dt>
                  <dd className="text-ink-soft tabular">{entry.spec.nodeCount}</dd>
                </div>
                <div className="flex gap-2">
                  <dt>seed:</dt>
                  <dd className="text-ink-soft tabular">{entry.spec.seed}</dd>
                </div>
                <div className="flex gap-2">
                  <dt>drop:</dt>
                  <dd className="text-ink-soft tabular">
                    {(entry.spec.network.dropPerMille / 10).toFixed(1)}%
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt>actions:</dt>
                  <dd className="text-ink-soft tabular">{entry.spec.actions.length}</dd>
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <Link href={`/${locale}/simulasi/#s=${entry.id}`} className="btn btn-strong">
                  {dict.scenarios.open}
                </Link>
                {entry.ablation !== undefined && descriptor !== null && (
                  <Link
                    href={`/${locale}/simulasi/#s=${entry.id}&off=${FLAG_CODES[entry.ablation.flag]}`}
                    className="btn btn-violation"
                  >
                    {dict.scenarios.breaksWith}:{' '}
                    {dict.ablation.rules[entry.ablation.flag]?.title ?? entry.ablation.flag}
                  </Link>
                )}
              </div>
              {entry.ablation !== undefined && (
                <p className="mt-2.5 font-mono text-micro text-ink-faint">
                  {dict.ablation.protects}: {dict.invariants.names[entry.ablation.breaks]} ·{' '}
                  {descriptor?.paperSection}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Three bars, filled left to right by tier — shape as well as colour, so it reads on
 * a greyscale screenshot and not just by eye colour. `title` and `sr-only` text carry
 * the same word for anyone who cannot see the bars at all.
 */
function NetworkTierMark({ tier, dict }: { tier: NetworkTier; dict: Dictionary }) {
  const filled = NETWORK_TIERS.indexOf(tier) + 1
  return (
    <span
      className="mt-1 flex shrink-0 items-end gap-0.5"
      title={`${dict.scenarios.network}: ${dict.scenarios.tiers[tier]}`}
    >
      <span className="sr-only">
        {dict.scenarios.network}: {dict.scenarios.tiers[tier]}
      </span>
      {NETWORK_TIERS.map((step, index) => (
        <span
          key={step}
          aria-hidden
          className={[
            'w-1.5 border border-ink-edge',
            index < filled ? 'bg-ink-soft' : 'bg-transparent',
          ].join(' ')}
          style={{ height: `${6 + index * 4}px` }}
        />
      ))}
    </span>
  )
}
