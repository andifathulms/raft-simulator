/**
 * The run summary: what this run has shown up to the step being viewed.
 *
 * `lib/narrate.ts` says what one event meant; this says what the run means so far —
 * who leads, how many elections it took to get there, how much has committed, and
 * whether every safety property has held. Same relationship to the trace as
 * `narrate.ts` has: this decides nothing and computes no algorithm state, it only
 * reads facts the simulation already recorded and chooses words and numbers for
 * them. Recomputed on every step, so "so far" is always accurate to the playhead,
 * not just to the end of the run.
 */

import type { Locale } from '@/lib/i18n'
import { SAFETY_PROPERTIES, type SafetyProperty, type Violation } from '@/lib/invariants/types'
import { isModifiedRaft, type AblationFlags } from '@/lib/raft/rules'
import type { NodeId } from '@/lib/raft/types'
import type { TraceStep } from '@/lib/sim/trace'

export interface RunSummary {
  /** The highest term any node has reached by this step. */
  readonly term: number
  /** The current leader, if this step has one that isn't crashed. */
  readonly leader: NodeId | null
  readonly elections: number
  /** The highest commitIndex any node carries at this step. */
  readonly committed: number
  /** Properties broken at or before this step, in Figure 3's order. */
  readonly brokenProperties: readonly SafetyProperty[]
  readonly modified: boolean
}

export function summarize(
  step: TraceStep,
  electionsSoFar: number,
  violationsSoFar: readonly Violation[],
  flags: AblationFlags,
): RunSummary {
  const leader = step.nodes.find((node) => node.role === 'leader' && step.crashed[node.id] !== true)
  const term = step.nodes.reduce((max, node) => Math.max(max, node.currentTerm), 0)
  const committed = step.nodes.reduce((max, node) => Math.max(max, node.commitIndex), 0)
  const broken = new Set(violationsSoFar.map((violation) => violation.property))
  return {
    term,
    leader: leader?.id ?? null,
    elections: electionsSoFar,
    committed,
    brokenProperties: SAFETY_PROPERTIES.filter((property) => broken.has(property)),
    modified: isModifiedRaft(flags),
  }
}

function n(id: number): string {
  return `n${id}`
}

/** 2-4 sentences: leadership and commits, the safety verdict, and modified-Raft. */
export function narrateSummary(
  summary: RunSummary,
  propertyName: (property: SafetyProperty) => string,
  ruleName: (flag: string) => string,
  disabledFlags: readonly string[],
  locale: Locale,
): readonly string[] {
  const id = locale === 'id'
  const sentences: string[] = []

  sentences.push(
    summary.leader === null
      ? id
        ? 'Belum ada leader yang terpilih.'
        : 'No leader has been elected yet.'
      : id
        ? `${n(summary.leader)} memimpin di term ${summary.term} dan telah meng-commit ${summary.committed} entry, lewat ${summary.elections} kali pemilihan.`
        : `${n(summary.leader)} leads in term ${summary.term} and has committed ${summary.committed} ${summary.committed === 1 ? 'entry' : 'entries'}, over ${summary.elections} ${summary.elections === 1 ? 'election' : 'elections'}.`,
  )

  sentences.push(
    summary.brokenProperties.length === 0
      ? id
        ? 'Kelima properti keamanan masih bertahan.'
        : 'All five safety properties are still holding.'
      : id
        ? `${summary.brokenProperties.map(propertyName).join(', ')} sudah dilanggar.`
        : `${summary.brokenProperties.map(propertyName).join(', ')} ${summary.brokenProperties.length > 1 ? 'have' : 'has'} broken.`,
  )

  if (summary.modified) {
    sentences.push(
      id
        ? `Aturan yang dimatikan: ${disabledFlags.map(ruleName).join(', ')}.`
        : `Disabled rule${disabledFlags.length > 1 ? 's' : ''}: ${disabledFlags.map(ruleName).join(', ')}.`,
    )
  }

  return sentences
}
