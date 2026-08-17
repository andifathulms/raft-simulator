/**
 * The EventTrace: the only interface between simulation and rendering.
 *
 * No component computes algorithm state, evaluates an invariant, or decides what
 * happened. Everything on screen is a rendering of these records.
 *
 * Storage relies on the algorithm's immutability rather than on copying. One event
 * touches one node, so the `nodes` array of a step shares every unchanged
 * `NodeState` object with the previous step: the marginal cost of a step is one
 * array of pointers, and stepping backwards is free because nothing was overwritten.
 */

import type { Violation } from '@/lib/invariants/types'
import { heldEntries, type Log } from '@/lib/raft/log'
import type { Message, NodeId, NodeState } from '@/lib/raft/types'
import type { NetworkState } from './network'

/**
 * A follower's (or candidate's) running election timer, as last armed.
 *
 * Figure 2, Rules for Servers, Followers rule 2, arms this with a randomized delay
 * drawn from the node's own PRNG stream — the mechanism that breaks split votes.
 * `lastHeartbeat` and `electionTimeout` are recorded exactly as the arming event saw
 * them, so a renderer can recover "how much of the timeout is left" at any step
 * without recomputing anything the algorithm decided. A leader has no election
 * timeout (Figure 2), so its slot is `null`.
 */
export interface ElectionTimer {
  /** Virtual time the timer was last (re)armed — a heartbeat, a vote grant, a restart. */
  readonly lastHeartbeat: number
  /** The randomized duration drawn at that arming. */
  readonly electionTimeout: number
}

/**
 * Fraction of the election timeout remaining at `now`, from 1 (just armed) to 0 (due
 * to fire). Pure function of the three recorded values — never a CSS duration — so it
 * gives the same answer stepping forward, stepping backward, or jumping directly to a
 * step: there is no elapsed wall-clock state to desynchronise from the scrubber.
 */
export function electionTimeoutFraction(
  now: number,
  timer: ElectionTimer | null,
): number {
  if (timer === null || timer.electionTimeout <= 0) return 0
  const elapsed = now - timer.lastHeartbeat
  const remaining = 1 - elapsed / timer.electionTimeout
  return Math.min(1, Math.max(0, remaining))
}

/** A message on the wire: sent, not yet delivered. */
export interface InFlight {
  readonly message: Message
  readonly sentAt: number
  readonly arrivesAt: number
  /** Queue sequence number — the tiebreak that makes delivery order total. */
  readonly seq: number
  /** True for the second copy produced by network duplication. */
  readonly isDuplicate: boolean
}

/** What happened at a step. Discriminated on `kind`; the UI switches exhaustively. */
export type TraceEvent =
  | { readonly kind: 'start' }
  | { readonly kind: 'deliver'; readonly message: Message; readonly isDuplicate: boolean }
  | { readonly kind: 'drop'; readonly message: Message; readonly reason: DropReason }
  | { readonly kind: 'timer'; readonly node: NodeId; readonly timer: 'election' | 'heartbeat' }
  | {
      readonly kind: 'client-request'
      readonly node: NodeId
      readonly command: string
      readonly accepted: boolean
      /** Set when a follower redirected the request to the leader it knows. */
      readonly redirectedTo: NodeId | null
    }
  | { readonly kind: 'crash'; readonly node: NodeId }
  | { readonly kind: 'restart'; readonly node: NodeId }
  | { readonly kind: 'partition'; readonly partitionOf: readonly number[] }
  | { readonly kind: 'heal' }
  | {
      readonly kind: 'change-configuration'
      readonly node: NodeId
      readonly servers: readonly number[]
      readonly accepted: boolean
      readonly redirectedTo: NodeId | null
    }

export type DropReason = 'network' | 'partition' | 'crashed-sender' | 'crashed-receiver'

export interface AppliedRecord {
  readonly node: NodeId
  readonly index: number
  readonly term: number
  readonly command: string
}

export interface TraceStep {
  readonly index: number
  readonly time: number
  readonly event: TraceEvent
  /** Cluster state *after* the event. Structurally shared with the previous step. */
  readonly nodes: readonly NodeState[]
  readonly crashed: readonly boolean[]
  readonly network: NetworkState
  readonly inFlight: readonly InFlight[]
  /** Each node's running election timer, by node id. `null` where none is armed. */
  readonly electionTimers: readonly (ElectionTimer | null)[]
  readonly applied: readonly AppliedRecord[]
  /** Violations newly observed at this step. */
  readonly violations: readonly Violation[]
}

export interface Trace {
  readonly steps: readonly TraceStep[]
  /** Every violation in the run, in the order observed. */
  readonly violations: readonly Violation[]
  /** True when the run was cut short by the event budget rather than running dry. */
  readonly truncated: boolean
}

/** Index of the first step at which any property broke, or null. */
export function firstViolationStep(trace: Trace): number | null {
  const first = trace.violations[0]
  return first === undefined ? null : first.stepIndex
}

/** Step indices where a node's term changed — for "jump to next term change". */
export function termChangeSteps(trace: Trace): readonly number[] {
  const out: number[] = []
  for (let i = 1; i < trace.steps.length; i += 1) {
    const previous = trace.steps[i - 1]
    const current = trace.steps[i]
    if (previous === undefined || current === undefined) continue
    if (current.nodes.some((node, id) => node.currentTerm !== previous.nodes[id]?.currentTerm)) {
      out.push(i)
    }
  }
  return out
}

/** Step indices at which a node became leader. */
export function electionSteps(trace: Trace): readonly number[] {
  const out: number[] = []
  for (let i = 1; i < trace.steps.length; i += 1) {
    const previous = trace.steps[i - 1]
    const current = trace.steps[i]
    if (previous === undefined || current === undefined) continue
    if (current.nodes.some((node, id) => node.role === 'leader' && previous.nodes[id]?.role !== 'leader')) {
      out.push(i)
    }
  }
  return out
}

/** Step indices at which anything was applied. */
export function commitSteps(trace: Trace): readonly number[] {
  const out: number[] = []
  for (const step of trace.steps) {
    if (step.applied.length > 0) out.push(step.index)
  }
  return out
}

/** Step indices at which a violation was observed. */
export function violationSteps(trace: Trace): readonly number[] {
  const out: number[] = []
  for (const step of trace.steps) {
    if (step.violations.length > 0) out.push(step.index)
  }
  return out
}

/** A contiguous run of step indices. */
export interface StepRun {
  readonly from: number
  readonly to: number
}

/** Collapse an ascending list of step indices into contiguous runs. */
export function runsOf(marks: readonly number[]): readonly StepRun[] {
  const runs: StepRun[] = []
  for (const mark of marks) {
    const open = runs[runs.length - 1]
    if (open !== undefined && mark === open.to + 1) {
      runs[runs.length - 1] = { from: open.from, to: mark }
    } else {
      runs.push({ from: mark, to: mark })
    }
  }
  return runs
}

/**
 * A stable, order-independent digest of a trace. Two runs of the same
 * `(config, seed, actions, flags)` must produce the same string on any machine —
 * this is what the determinism suite compares.
 */
export function traceDigest(trace: Trace): string {
  const lines: string[] = []
  for (const step of trace.steps) {
    lines.push(`${step.index}@${step.time} ${describeEvent(step.event)}`)
    for (const node of step.nodes) {
      // The snapshot point is emitted only when there is one, so a run that never
      // compacts produces exactly the digest it produced before compaction existed.
      const snapshot =
        node.log.lastIncludedIndex === 0
          ? ''
          : ` snap=${node.log.lastIncludedIndex}/${node.log.lastIncludedTerm}`
      lines.push(
        `  n${node.id} ${node.role} t=${node.currentTerm} v=${node.votedFor ?? '-'} ` +
          `c=${node.commitIndex} a=${node.lastApplied} log=${describeLog(node.log)}${snapshot}`,
      )
    }
    for (const flight of step.inFlight) {
      lines.push(`  ~ ${flight.message.type} ${flight.message.from}->${flight.message.to}@${flight.arrivesAt}`)
    }
    for (const violation of step.violations) {
      lines.push(`  ! ${violation.property} ${violation.summary}`)
    }
  }
  return lines.join('\n')
}

function describeLog(log: Log): string {
  return heldEntries(log)
    .map((entry) => `${entry.term}:${entry.command}`)
    .join(',')
}

export function describeEvent(event: TraceEvent): string {
  switch (event.kind) {
    case 'start':
      return 'start'
    case 'deliver':
      return `deliver ${event.message.type} ${event.message.from}->${event.message.to} term=${event.message.term}${event.isDuplicate ? ' (duplicate)' : ''}`
    case 'drop':
      return `drop ${event.message.type} ${event.message.from}->${event.message.to} (${event.reason})`
    case 'timer':
      return `timer ${event.timer} n${event.node}`
    case 'client-request':
      return `client n${event.node} "${event.command}"${event.accepted ? '' : event.redirectedTo === null ? ' (no leader known)' : ` (redirected to n${event.redirectedTo})`}`
    case 'crash':
      return `crash n${event.node}`
    case 'restart':
      return `restart n${event.node}`
    case 'partition':
      return `partition [${event.partitionOf.join(',')}]`
    case 'heal':
      return 'heal'
    case 'change-configuration':
      return `configuration n${event.node} -> {${event.servers.join(',')}}${
        event.accepted
          ? ''
          : event.redirectedTo === null
            ? ' (no leader known)'
            : ` (redirected to n${event.redirectedTo})`
      }`
    default: {
      const unreachable: never = event
      throw new Error(`Unhandled trace event: ${JSON.stringify(unreachable)}`)
    }
  }
}
