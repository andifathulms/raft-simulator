import Link from 'next/link'
import { notFound } from 'next/navigation'
import { NetworkTierMark } from '@/components/workbench/NetworkTierMark'
import { SCENARIOS, type ScenarioDefinition } from '@/data/scenarios'
import { LOCALES, dictionary, isLocale, type Dictionary, type Locale } from '@/lib/i18n'
import { descriptorFor } from '@/lib/raft/rules'
import { networkTier } from '@/lib/scenarios/tier'
import { TRACKS, trackOf, type Track } from '@/lib/scenarios/tracks'
import { flagCode } from '@/lib/share'

export function generateStaticParams(): { locale: Locale }[] {
  return LOCALES.map((locale) => ({ locale }))
}

/**
 * The scenario library, in reading order.
 *
 * Twelve scenarios in one uniform grid hid the fact that they already form a curve —
 * you cannot appreciate Figure 8 before you have watched a clean election. They are
 * grouped by track now (lib/scenarios/tracks.ts), each card carries a small drawn
 * mark of what it is about, and the long phenomenon paragraph folds away behind
 * "What it shows" so the page can be scanned before it is read.
 */
export default function ScenariosPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = dictionary(locale)

  return (
    <div className="flex flex-col gap-12 pb-8">
      <header className="max-w-3xl pt-2">
        <h1 className="font-serif text-headline font-semibold">{dict.nav.scenarios}</h1>
        <p className="mt-4 max-w-prose font-serif text-lede text-ink">
          {locale === 'id'
            ? 'Tiap skenario adalah satu situasi yang dibangun tangan untuk menunjukkan satu hal — pemilihan yang bersih, dua calon yang saling mengunci, jaringan yang terbelah. Buka salah satu, lalu tekan Jalankan.'
            : 'Each scenario is one hand-built situation showing one thing — a clean election, two candidates deadlocking each other, a network cut in half. Open one and press play.'}
        </p>
        <p className="mt-3 max-w-prose font-sans text-label leading-relaxed text-ink-faint">{dict.scenarios.lede}</p>
        <nav aria-label={dict.nav.scenarios} className="mt-6 flex flex-wrap gap-2">
          {TRACKS.map((track, index) => (
            <a key={track} href={`#track-${track}`} className="chip px-3 py-1 text-ink hover:border-ink-edge">
              <span className="text-ink-faint">{index + 1}</span> {dict.tracks[track].title}
            </a>
          ))}
        </nav>
      </header>

      {TRACKS.map((track, index) => {
        const entries = SCENARIOS.filter((entry) => trackOf(entry.id) === track)
        return (
          <section key={track} id={`track-${track}`} className="scroll-mt-24">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-ink-rule pb-3">
              {/* The tracks are a real reading order, so they are numbered. */}
              <span className="font-mono text-label text-ink-faint">0{index + 1}</span>
              <h2 className="font-serif text-title font-semibold">{dict.tracks[track].title}</h2>
              <p className="font-sans text-label text-ink-soft">{dict.tracks[track].blurb}</p>
            </div>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => (
                <ScenarioCard key={entry.id} entry={entry} track={track} dict={dict} locale={locale} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function ScenarioCard({
  entry,
  track,
  dict,
  locale,
}: {
  entry: ScenarioDefinition
  track: Track
  dict: Dictionary
  locale: Locale
}) {
  const descriptor = entry.ablation === undefined ? null : descriptorFor(entry.ablation.flag)
  const breaking = track === 'breaking' && entry.ablation !== undefined
  return (
    <li
      className={[
        'card flex flex-col overflow-hidden',
        breaking ? 'border-vermilion/50' : '',
      ].join(' ')}
    >
      <Link
        href={`/${locale}/simulasi/#s=${entry.id}`}
        className="stage flex h-28 items-center justify-center rounded-none border-0 border-b border-ink-rule"
        aria-label={`${dict.scenarios.open}: ${entry.title[locale]}`}
      >
        <ScenarioMark entry={entry} track={track} />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-panel font-semibold">{entry.title[locale]}</h3>
          <span className="mt-1.5">
            <NetworkTierMark tier={networkTier(entry.spec.network.dropPerMille)} dict={dict} />
          </span>
        </div>
        <p className="mt-2 font-sans text-label leading-relaxed text-ink-soft">{entry.summary[locale]}</p>

        <details className="group mt-3">
          <summary className="cursor-pointer list-none font-sans text-micro font-medium text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            {dict.landing.whatItShows}
          </summary>
          <p className="mt-2 font-sans text-micro leading-relaxed text-ink-soft">{entry.phenomenon[locale]}</p>
        </details>

        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-micro text-ink-faint">
          <span>
            {entry.spec.nodeCount} {dict.landing.nodes}
          </span>
          <span>seed {entry.spec.seed}</span>
          <span>{entry.id}</span>
        </p>

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <Link href={`/${locale}/simulasi/#s=${entry.id}`} className="btn btn-strong">
            {dict.scenarios.open}
          </Link>
          {entry.ablation !== undefined && descriptor !== null && (
            <Link
              href={`/${locale}/simulasi/#s=${entry.id}&off=${flagCode(entry.ablation.flag)}`}
              className="btn btn-violation"
              title={`${dict.scenarios.breaksWith}: ${dict.ablation.rules[entry.ablation.flag]?.title ?? entry.ablation.flag}`}
            >
              {dict.landing.breakIt}: {dict.ablation.rules[entry.ablation.flag]?.title ?? entry.ablation.flag}
            </Link>
          )}
        </div>
        {entry.ablation !== undefined && (
          <p className="mt-2.5 font-mono text-micro text-ink-faint">
            {dict.ablation.protects}: {dict.invariants.names[entry.ablation.breaks]} · {descriptor?.paperSection}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * A small drawn mark per scenario: the cluster at its size, and the one thing the
 * scenario is about — a leader, a split, a cut network, a crash, a lost record.
 * Decorative (the link around it carries the name), and drawn from the scenario's own
 * data — node count, track, the property its ablation breaks — not invented per card.
 */
function ScenarioMark({ entry, track }: { entry: ScenarioDefinition; track: Track }) {
  const count = entry.spec.nodeCount
  const cx = 80
  const cy = 46
  const r = 32
  const nodes = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2
    return { index, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
  })
  const id = entry.id
  const partitioned = id.includes('partition') || id.includes('divergence') || id.includes('restriction')
  const crashed = id.includes('crash') || id.includes('restart')
  const split = id === 'split-vote' || id === 'double-candidacy'
  const twoLeaders = track === 'breaking' && entry.ablation?.breaks === 'election-safety'
  const roleOf = (index: number): 'leader' | 'candidate' | 'follower' | 'crashed' => {
    if (crashed && index === 0) return 'crashed'
    if (split) return index === 1 || index === Math.ceil(count / 2) ? 'candidate' : 'follower'
    if (twoLeaders) return index === 0 || index === Math.ceil(count / 2) ? 'leader' : 'follower'
    if (crashed) return index === 1 ? 'leader' : 'follower'
    return index === 0 ? 'leader' : 'follower'
  }
  return (
    <svg viewBox="0 0 160 92" width="160" height="92" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-ink-rule" strokeWidth="1.25" strokeDasharray={partitioned ? '4 5' : undefined} />
      {partitioned && <line x1={cx + 6} y1="6" x2={cx - 6} y2="86" className="stroke-ink-faint" strokeWidth="1.25" strokeDasharray="3 3" />}
      {nodes.map((node) => {
        const role = roleOf(node.index)
        if (role === 'leader')
          return <rect key={node.index} x={node.x - 8} y={node.y - 8} width="16" height="16" rx="3" className="fill-leader stroke-ink" strokeWidth="1" />
        if (role === 'candidate')
          return (
            <rect
              key={node.index}
              x={node.x - 7}
              y={node.y - 7}
              width="14"
              height="14"
              rx="2"
              transform={`rotate(45 ${node.x} ${node.y})`}
              className="fill-candidate stroke-ink"
              strokeWidth="1"
            />
          )
        if (role === 'crashed')
          return <circle key={node.index} cx={node.x} cy={node.y} r="8" className="fill-stock-deep stroke-ink-faint" strokeWidth="1" strokeDasharray="2 2" />
        return <circle key={node.index} cx={node.x} cy={node.y} r="8" className="fill-follower stroke-ink" strokeWidth="1" />
      })}
      {track === 'advanced' && id === 'log-compaction' && (
        <g>
          <rect x="128" y="30" width="24" height="10" rx="2" className="fill-stock-deep stroke-ink-edge" />
          <path d="M131 40 l6 -10 M137 40 l6 -10 M143 40 l6 -10" className="stroke-ink-edge" strokeWidth="0.75" />
          <rect x="128" y="44" width="24" height="10" rx="2" className="fill-committed/15 stroke-committed" />
        </g>
      )}
      {track === 'advanced' && id === 'membership-change' && (
        <circle cx={cx + 22} cy={cy} r={r} fill="none" className="stroke-ink-faint" strokeWidth="1" strokeDasharray="1 4" />
      )}
      {track === 'breaking' && (
        <g transform="translate(140 14)">
          <rect x="-8" y="-8" width="16" height="16" rx="2" transform="rotate(45)" className="fill-vermilion" />
          <path d="M-3 -3 L3 3 M3 -3 L-3 3" className="stroke-stock-pale" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}
