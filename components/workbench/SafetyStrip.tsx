'use client'

/**
 * Five safety lights, always on screen.
 *
 * The invariant panel is the app's whole argument, and it used to be the third card
 * down. This is its summary, lifted into the toolbar: one light per property, a
 * shape and a word as well as a colour. A ticked circle holds; a struck diamond is
 * broken. Selecting a light opens the full panel — the statement, the violation, the
 * rule that was switched off — in the rail.
 *
 * Reads the checker's verdicts from the trace. Evaluates nothing.
 */

import type { Dictionary } from '@/lib/i18n'
import { SAFETY_PROPERTIES, type SafetyProperty, type Violation } from '@/lib/invariants/types'

interface Props {
  readonly violations: readonly Violation[]
  readonly upToStep: number
  readonly dict: Dictionary
  readonly onSelect: (property: SafetyProperty) => void
}

export function SafetyStrip({ violations, upToStep, dict, onSelect }: Props) {
  const broken = new Set(
    violations.filter((violation) => violation.stepIndex <= upToStep).map((v) => v.property),
  )
  return (
    <ul aria-label={dict.sim.invariants} className="flex flex-wrap gap-1.5">
      {SAFETY_PROPERTIES.map((property) => {
        const isBroken = broken.has(property)
        return (
          <li key={property}>
            <button
              type="button"
              onClick={() => onSelect(property)}
              aria-label={`${dict.invariants.names[property]}: ${
                isBroken ? dict.invariants.broken : dict.invariants.holding
              }`}
              title={dict.plain.properties[property]}
              className={[
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-1 pl-1 pr-2.5 font-mono text-[0.6875rem] transition-colors',
                isBroken
                  ? 'border-vermilion bg-vermilion font-bold text-stock-pale'
                  : 'border-ink-rule bg-stock-raised text-ink-soft hover:border-ink-edge hover:text-ink',
              ].join(' ')}
            >
              <Light broken={isBroken} />
              {dict.invariants.names[property]}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Never colour alone: a ticked circle holds, a struck diamond does not. */
function Light({ broken }: { broken: boolean }) {
  return (
    <svg viewBox="-8 -8 16 16" width="16" height="16" aria-hidden className="shrink-0">
      {broken ? (
        <>
          <rect x="-5.5" y="-5.5" width="11" height="11" rx="1.5" transform="rotate(45)" className="fill-stock-pale" />
          <path d="M-2.5 -2.5 L2.5 2.5 M2.5 -2.5 L-2.5 2.5" className="stroke-vermilion" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle r="7" className="fill-committed" />
          <path d="M-3 0.2 L-0.8 2.4 L3.2 -2" fill="none" className="stroke-stock-pale" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

/** Compact form for narrow screens: five lights in a row, the broken one named. */
export function SafetyLights({ violations, upToStep, dict, onSelect }: Props) {
  const broken = SAFETY_PROPERTIES.filter((property) =>
    violations.some((violation) => violation.property === property && violation.stepIndex <= upToStep),
  )
  return (
    <button
      type="button"
      onClick={() => onSelect(broken[0] ?? SAFETY_PROPERTIES[0] ?? 'election-safety')}
      className="flex items-center gap-1.5 rounded-full border border-ink-rule bg-stock-raised py-1 pl-1 pr-2.5"
      aria-label={
        broken.length === 0
          ? dict.invariants.allHolding
          : `${dict.invariants.broken}: ${broken.map((p) => dict.invariants.names[p]).join(', ')}`
      }
    >
      {SAFETY_PROPERTIES.map((property) => (
        <Light key={property} broken={broken.includes(property)} />
      ))}
      <span
        className={[
          'ml-1 font-mono text-[0.6875rem]',
          broken.length > 0 ? 'font-bold text-vermilion' : 'text-ink-soft',
        ].join(' ')}
      >
        {broken.length > 0
          ? dict.invariants.names[broken[0] ?? 'election-safety']
          : `5/5 ${dict.invariants.holding.toLowerCase()}`}
      </span>
    </button>
  )
}
