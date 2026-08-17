'use client'

/**
 * The invariant panel: five properties, five indicators, always visible.
 *
 * Evaluated after every event across all nodes by `lib/invariants`, which shares no
 * code with the algorithm. On a violation the panel names the property, the index,
 * the terms and the nodes, and offers to step back to the moment it happened.
 *
 * In normal operation all five stay green, which is itself informative: it shows the
 * algorithm holding under adversarial conditions.
 *
 * Vermilion appears here and nowhere else in the application.
 */

import type { Dictionary } from '@/lib/i18n'
import { SAFETY_PROPERTIES, type SafetyProperty, type Violation } from '@/lib/invariants/types'
import { disabledRulesProtecting, type AblationFlags } from '@/lib/raft/rules'

interface Props {
  readonly violations: readonly Violation[]
  /** Only violations at or before the step being viewed are shown as having happened. */
  readonly upToStep: number
  readonly dict: Dictionary
  readonly onJump: (step: number) => void
  /** DESIGN-REWORK.md §4: a broken property names the ablation rule(s) responsible. */
  readonly flags: AblationFlags
}

export function InvariantPanel({ violations, upToStep, dict, onJump, flags }: Props) {
  const sofar = violations.filter((violation) => violation.stepIndex <= upToStep)
  const firstByProperty = new Map<SafetyProperty, Violation>()
  for (const violation of sofar) {
    if (!firstByProperty.has(violation.property)) firstByProperty.set(violation.property, violation)
  }

  const newest = sofar[sofar.length - 1]

  return (
    <section aria-label={dict.sim.invariants} className="flex flex-col gap-2">
      {/*
       * A violation is the one thing in this application that must not be noticed only
       * by looking. The panel is polite rather than assertive: scrubbing through a
       * broken run would otherwise interrupt continuously.
       */}
      <p aria-live="polite" className="sr-only">
        {newest === undefined
          ? dict.invariants.allHolding
          : `${dict.invariants.broken}: ${dict.invariants.names[newest.property]}. ${newest.summary}`}
      </p>
      <ul className="flex flex-col">
        {SAFETY_PROPERTIES.map((property) => {
          const violation = firstByProperty.get(property)
          const broken = violation !== undefined
          return (
            <li
              key={property}
              className={[
                'border-b border-ink-rule py-2',
                // A 10% tint drops vermilion-on-tint to 4.39:1 against the page.
                // 5% holds 5.30:1 on the card it sits in, and the row still reads as
                // the only tinted one in the list.
                broken ? 'bg-vermilion/5' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                {/* Shape as well as colour: a filled square holds, a struck square
                    does not. Never colour alone. */}
                <span
                  aria-hidden
                  className={[
                    'inline-flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] font-bold leading-none',
                    broken
                      ? 'border-vermilion text-vermilion'
                      : 'border-committed bg-committed text-stock-pale',
                  ].join(' ')}
                >
                  {broken ? '×' : '✓'}
                </span>
                <span className="font-mono text-data">{dict.invariants.names[property]}</span>
                <span
                  className={[
                    'ml-auto font-sans text-micro',
                    broken ? 'text-vermilion font-semibold' : 'text-ink-faint',
                  ].join(' ')}
                >
                  {broken ? dict.invariants.broken : dict.invariants.holding}
                </span>
              </div>
              {/* The formal statement is what the checker evaluates; this is what the
                  formal statement means. An indicator nobody can read is decoration. */}
              <p className="mt-1 pl-6 font-sans text-micro leading-relaxed text-ink-soft">
                {dict.plain.properties[property]}
              </p>
              {violation !== undefined && (
                <div className="mt-2 pl-6 font-sans text-micro text-ink">
                  {/* Stated flatly, with the mechanism named. No alarm language. */}
                  <p>{violation.summary}</p>
                  <p className="mt-1 text-ink-faint font-mono tabular">
                    {violation.logIndex !== null && <>index {violation.logIndex} · </>}
                    {violation.terms.length > 0 && <>term {violation.terms.join(', ')} · </>}
                    node {violation.nodes.join(', ')} · {dict.invariants.atStep}{' '}
                    {violation.stepIndex}
                  </p>
                  {/* The rule this run actually turned off to produce this violation
                      — named here, not left for the reader to match against the
                      ablation panel by hand. Not every violation has one: a fuzz
                      failure under unmodified Raft would name none, which is exactly
                      the signal that something is really broken rather than switched
                      off on purpose. */}
                  {disabledRulesProtecting(flags, property).map((flag) => (
                    <p key={flag} className="mt-1 font-mono text-micro text-vermilion">
                      {dict.invariants.disabledBy}:{' '}
                      <a href={`#ablation-${flag}`} className="underline decoration-dotted underline-offset-2 hover:text-ink">
                        {dict.ablation.rules[flag]?.title ?? flag}
                      </a>
                    </p>
                  ))}
                  <button
                    type="button"
                    className="btn btn-small btn-violation mt-2"
                    onClick={() => onJump(violation.stepIndex)}
                  >
                    {dict.invariants.stepBack}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {firstByProperty.size === 0 && (
        <p className="font-sans text-micro leading-relaxed text-ink-faint">
          {dict.invariants.allHolding}
        </p>
      )}
    </section>
  )
}
