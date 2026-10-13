'use client'

/**
 * The ablation panel — the flagship.
 *
 * Each rule is toggleable and labelled with the property it protects, the section of
 * the paper that justifies it, its location in Figure 2, and the single place in the
 * source where the guard is consulted. The last of those is what makes the toggle
 * checkable rather than merely claimed.
 */

import Link from 'next/link'
import {
  ABLATION_FLAG_NAMES,
  descriptorFor,
  isModifiedRaft,
  type AblationFlagName,
  type AblationFlags,
} from '@/lib/raft/rules'
import type { Dictionary, Locale } from '@/lib/i18n'
import { scenarioById } from '@/data/scenarios'
import type { Violation } from '@/lib/invariants/types'

interface Props {
  readonly flags: AblationFlags
  readonly onToggle: (flag: AblationFlagName, enabled: boolean) => void
  readonly onReset: () => void
  readonly dict: Dictionary
  readonly locale: Locale
  readonly compact?: boolean
  /**
   * DESIGN-REWORK.md §4: when a rule is off and the property it protects has broken
   * in the run being watched, say so on the rule itself rather than making the
   * reader cross-reference the invariant panel. Omitted on the standalone `/ablasi`
   * explorer, which previews toggles against no running trace.
   */
  readonly violations?: readonly Violation[]
  readonly upToStep?: number
  readonly onJump?: (step: number) => void
}

export function AblationPanel({
  flags,
  onToggle,
  onReset,
  dict,
  locale,
  compact = false,
  violations,
  upToStep,
  onJump,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* In the workbench (`compact`) the hazard band already carries this, above
          everything; repeating it in the rail would only push the rules down. */}
      {!compact && <ModifiedBanner flags={flags} dict={dict} />}
      <ul className="flex flex-col gap-3">
        {ABLATION_FLAG_NAMES.map((flag) => {
          const descriptor = descriptorFor(flag)
          const copy = dict.ablation.rules[flag]
          const enabled = flags[flag]
          const scenario = scenarioById(descriptor.scenarioId)
          const brokenAt =
            !enabled && violations !== undefined && upToStep !== undefined
              ? violations.find(
                  (violation) => violation.property === descriptor.protects && violation.stepIndex <= upToStep,
                )
              : undefined
          return (
            <li
              key={flag}
              id={`ablation-${flag}`}
              className={[
                'scroll-mt-24 rounded-panel border',
                compact ? 'p-3' : 'p-4',
                enabled ? 'border-ink-rule bg-stock-raised' : 'border-vermilion bg-vermilion/5',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                {/* The switch states its position in a word as well as by the knob's
                    side and the track's colour, and its off position is vermilion
                    because off means a broken run. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={copy?.title ?? flag}
                  onClick={() => onToggle(flag, !enabled)}
                  className="group mt-0.5 flex shrink-0 flex-col items-center gap-1"
                >
                  <span
                    aria-hidden
                    className={[
                      'relative block h-[18px] w-8 rounded-full transition-colors',
                      enabled ? 'bg-ink group-hover:bg-ink-soft' : 'bg-vermilion',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-stock-raised shadow-sm transition-all',
                        enabled ? 'left-[16px]' : 'left-[2px]',
                      ].join(' ')}
                    />
                  </span>
                  <span
                    className={[
                      'font-mono text-[0.625rem] font-bold uppercase tracking-wider',
                      enabled ? 'text-ink-soft' : 'text-vermilion',
                    ].join(' ')}
                  >
                    {enabled ? dict.ablation.on : dict.ablation.off}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="font-sans text-label font-semibold">{copy?.title ?? flag}</h3>
                  {/* What is at stake, said without jargon, before the paper citation
                      that justifies it. This is the line that makes a toggle feel
                      like a consequence rather than a preference. */}
                  <p
                    className={[
                      'mt-1 font-sans leading-relaxed text-ink',
                      compact ? 'text-micro' : 'text-label',
                    ].join(' ')}
                  >
                    <span className="text-ink-faint">{dict.ablation.ifOff}: </span>
                    {dict.plain.properties[descriptor.protects]}
                  </p>
                  {!compact && (
                    <p className="mt-2 max-w-prose font-sans text-label leading-relaxed text-ink-soft">
                      {copy?.body}
                    </p>
                  )}
                  <dl
                    className={[
                      'mt-2.5 grid grid-cols-1 gap-x-4 gap-y-0.5 border-t border-ink-rule pt-2 font-mono text-micro text-ink-faint',
                      compact ? '' : 'sm:grid-cols-2',
                    ].join(' ')}
                  >
                    <Row label={dict.ablation.protects}>
                      {dict.invariants.names[descriptor.protects]}
                    </Row>
                    <Row label={dict.ablation.section}>{descriptor.paperSection}</Row>
                    {!compact && (
                      <>
                        <Row label={dict.ablation.figure2}>{descriptor.figure2}</Row>
                        <Row label={dict.ablation.callSite}>{descriptor.callSite}</Row>
                      </>
                    )}
                    <Row label={dict.ablation.scenario}>
                      <Link
                        href={`/${locale}/simulasi/#s=${scenario.id}&off=${flag}`}
                        className="underline decoration-dotted underline-offset-2 hover:text-ink"
                      >
                        {scenario.id}
                      </Link>
                    </Row>
                  </dl>
                  {brokenAt !== undefined && (
                    <p className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-vermilion/30 pt-2 font-sans text-micro font-medium text-vermilion">
                      {dict.ablation.brokenNote}
                      {onJump !== undefined && (
                        <button
                          type="button"
                          className="btn btn-small btn-violation"
                          onClick={() => onJump(brokenAt.stepIndex)}
                        >
                          {dict.invariants.stepBack}
                        </button>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={onReset}
        disabled={!isModifiedRaft(flags)}
        className="btn self-start"
      >
        {dict.ablation.reset}
      </button>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0">{label}:</dt>
      <dd className="text-ink-soft">{children}</dd>
    </div>
  )
}

/**
 * A run with any rule off is permanently and visibly labelled. Nobody should
 * screenshot a broken run and take it for real Raft.
 */
export function ModifiedBanner({ flags, dict }: { flags: AblationFlags; dict: Dictionary }) {
  if (!isModifiedRaft(flags)) {
    return (
      <p className="flex items-center gap-2 rounded-panel border border-committed/50 bg-committed/10 px-3 py-2 font-sans text-label text-ink">
        <span
          aria-hidden
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-committed text-[10px] font-bold leading-none text-stock-pale"
        >
          ✓
        </span>
        {dict.ablation.unmodified}
      </p>
    )
  }
  const off = ABLATION_FLAG_NAMES.filter((flag) => !flags[flag])
  return (
    /* The tint is 5%, not 10%: vermilion text on a 10% vermilion wash over the page
       measures 4.39:1, under AA, and this is the one label in the application that
       must not be hard to read. At 5% it is 4.72:1, and the 2px border carries the
       alarm anyway. */
    <div className="rounded-panel border-2 border-vermilion bg-vermilion/5 px-4 py-3">
      <p className="font-mono text-base font-bold tracking-wide text-vermilion">
        {dict.ablation.modified}
      </p>
      <p className="mt-1.5 max-w-prose font-sans text-label leading-relaxed text-ink">
        {dict.ablation.modifiedLong}
      </p>
      <p className="mt-2 font-mono text-micro text-ink-soft">
        {off.map((flag) => dict.ablation.rules[flag]?.title ?? flag).join(' · ')}
      </p>
    </div>
  )
}
