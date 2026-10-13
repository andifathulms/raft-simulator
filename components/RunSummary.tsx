'use client'

/**
 * What this run has shown, up to the step being viewed — not what just happened
 * (that's the sentence above the cluster), the accumulated picture: who leads, how
 * many elections it took, how much has committed, and whether every safety property
 * has held. Always visible, recomputed on every step.
 */

import { disabledRules, type AblationFlags } from '@/lib/raft/rules'
import type { Dictionary, Locale } from '@/lib/i18n'
import type { Violation } from '@/lib/invariants/types'
import { narrateSummary, summarize } from '@/lib/summary'
import type { TraceStep } from '@/lib/sim/trace'

interface Props {
  readonly step: TraceStep
  readonly elections: number
  readonly violations: readonly Violation[]
  readonly flags: AblationFlags
  readonly dict: Dictionary
  readonly locale: Locale
  /**
   * `dock`: the figures alone, inline beside the transport. `sentences`: the prose
   * alone, for the Safety tab. `card` (default): both, as a panel.
   */
  readonly variant?: 'card' | 'dock' | 'sentences'
}

export function RunSummary({ step, elections, violations, flags, dict, locale, variant = 'card' }: Props) {
  const summary = summarize(step, elections, violations, flags)
  const sentences = narrateSummary(
    summary,
    (property) => dict.invariants.names[property] ?? property,
    (flag) => dict.ablation.rules[flag]?.title ?? flag,
    disabledRules(flags),
    locale,
  )
  const broken = summary.brokenProperties.length

  if (variant === 'dock') {
    return (
      <dl aria-label={dict.workbench.runSoFar} className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <InlineStat label={dict.summary.term} value={summary.term} />
        <InlineStat
          label={dict.summary.leader}
          value={summary.leader === null ? dict.summary.none : `n${summary.leader}`}
        />
        <InlineStat label={dict.summary.elections} value={summary.elections} />
        <InlineStat label={dict.summary.committed} value={summary.committed} />
        <InlineStat label={dict.summary.violations} value={broken} tone={broken > 0 ? 'broken' : 'plain'} />
      </dl>
    )
  }

  if (variant === 'sentences') {
    return (
      <div className="font-sans text-label leading-relaxed text-ink-soft">
        {sentences.map((sentence, index) => (
          <p key={index} className={index > 0 ? 'mt-1' : undefined}>
            {sentence}
          </p>
        ))}
      </div>
    )
  }

  return (
    <section className="card p-4" aria-label={dict.summary.title}>
      <h2 className="field-label">{dict.summary.title}</h2>
      <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
        <Stat label={dict.summary.term} value={summary.term} />
        <Stat
          label={dict.summary.leader}
          value={summary.leader === null ? dict.summary.none : `n${summary.leader}`}
        />
        <Stat label={dict.summary.elections} value={summary.elections} />
        <Stat label={dict.summary.committed} value={summary.committed} />
        <Stat label={dict.summary.violations} value={broken} tone={broken > 0 ? 'broken' : 'holding'} />
      </dl>
      <div className="mt-3 max-w-prose border-t border-ink-rule pt-2.5 font-sans text-label leading-relaxed text-ink-soft">
        {sentences.map((sentence, index) => (
          <p key={index} className={index > 0 ? 'mt-1' : undefined}>
            {sentence}
          </p>
        ))}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  tone = 'plain',
}: {
  label: string
  value: string | number
  tone?: 'plain' | 'holding' | 'broken'
}) {
  return (
    <div className="flex flex-col">
      <dt className="field-label">{label}</dt>
      {/* A broken-property count is the one number here that is ever anything but
          plain ink — and only when it is actually above zero, matching the rule
          that vermilion means a safety violation and nothing else. */}
      <dd
        className={[
          'font-mono text-lede tabular font-bold',
          tone === 'broken' ? 'text-vermilion' : tone === 'holding' ? 'text-committed' : 'text-ink',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  )
}

function InlineStat({
  label,
  value,
  tone = 'plain',
}: {
  label: string
  value: string | number
  tone?: 'plain' | 'broken'
}) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="font-sans text-micro text-ink-faint">{label}</dt>
      <dd
        className={[
          'font-mono text-label font-semibold tabular',
          tone === 'broken' ? 'text-vermilion' : 'text-ink',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  )
}
