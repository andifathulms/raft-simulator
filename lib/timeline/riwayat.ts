/**
 * `Riwayat` (Indonesian: history) — geometry for the event timeline, pure and
 * independent of how it is drawn.
 *
 * DESIGN-REWORK.md §3: one lane per node, coloured by the role that node held over
 * time; term bands across the top; commit marks on the leader's lane; violation
 * regions below. Everything here is computed from a `Trace` and a step index — the
 * x-axis is the step index, matching the scrubber this replaces, not virtual time,
 * because the scrubber and every existing "jump to next X" control already work in
 * step space, and a long quiet stretch of virtual time between two adjacent events
 * would otherwise buy that stretch screen space it did nothing to earn.
 *
 * This module draws nothing. `components/timeline/Riwayat.tsx` reads it.
 */

import type { NodeId, Role } from '@/lib/raft/types'
import type { Trace } from '@/lib/sim/trace'

/** A contiguous stretch of steps during which one node held one role. */
export interface RoleRun {
  readonly node: NodeId
  readonly role: Role
  readonly from: number
  readonly to: number
}

/** Every node's role history, as contiguous runs covering the whole trace. */
export function roleRuns(trace: Trace): readonly RoleRun[] {
  const runs: RoleRun[] = []
  const open = new Map<NodeId, RoleRun>()
  for (const step of trace.steps) {
    for (const node of step.nodes) {
      const current = open.get(node.id)
      if (current === undefined) {
        open.set(node.id, { node: node.id, role: node.role, from: step.index, to: step.index })
        continue
      }
      if (current.role === node.role) {
        open.set(node.id, { ...current, to: step.index })
        continue
      }
      runs.push(current)
      open.set(node.id, { node: node.id, role: node.role, from: step.index, to: step.index })
    }
  }
  for (const run of open.values()) runs.push(run)
  // Ascending by node, then by start step, so a renderer can lay out lane by lane
  // without sorting again.
  runs.sort((a, b) => a.node - b.node || a.from - b.from)
  return runs
}

/**
 * The run immediately following `run`, if it exists and belongs to the same node —
 * i.e. what `run` became. Used to find a follower run that ends in candidacy, which
 * is the moment the depleting rule (§2) and the role change coincide.
 */
export function nextRun(runs: readonly RoleRun[], run: RoleRun): RoleRun | null {
  return runs.find((candidate) => candidate.node === run.node && candidate.from === run.to + 1) ?? null
}

/** A period during which the cluster's furthest-advanced term held. */
export interface TermBand {
  readonly term: number
  readonly from: number
  readonly to: number
}

/**
 * Term bands across the whole trace.
 *
 * A term is not synchronised across nodes the instant it changes — a candidate
 * increments its own term before anyone else has heard of it — so there is no single
 * authoritative "the cluster's term" at a given step. This takes the highest term any
 * node has reached, which only ever increases and is a reasonable read of "how far
 * the run has gotten": a band boundary is the step where some node first reaches a
 * new highest term, which is an election starting.
 */
export function termBands(trace: Trace): readonly TermBand[] {
  const bands: TermBand[] = []
  let open: TermBand | null = null
  for (const step of trace.steps) {
    const term = step.nodes.reduce((max, node) => Math.max(max, node.currentTerm), 0)
    if (open === null) {
      open = { term, from: step.index, to: step.index }
      continue
    }
    if (term === open.term) {
      open = { ...open, to: step.index }
      continue
    }
    bands.push(open)
    open = { term, from: step.index, to: step.index }
  }
  if (open !== null) bands.push(open)
  return bands
}

/** A leader's `commitIndex` advancing — Figure 2, Rules for Servers, Leaders, rule 4. */
export interface CommitMark {
  readonly step: number
  readonly node: NodeId
  readonly commitIndex: number
}

/**
 * Every step at which a leader's own `commitIndex` advanced.
 *
 * Deliberately not `commitSteps` from `lib/sim/trace.ts`, which marks when an entry
 * was *applied* — a follower applies too, well after the leader committed, and the
 * design calls for a mark on the leader's lane at the moment it commits, not one
 * smeared across every node's lane as the entry is eventually applied everywhere.
 */
export function commitMarks(trace: Trace): readonly CommitMark[] {
  const marks: CommitMark[] = []
  for (let i = 1; i < trace.steps.length; i += 1) {
    const previous = trace.steps[i - 1]
    const current = trace.steps[i]
    if (previous === undefined || current === undefined) continue
    for (const node of current.nodes) {
      if (node.role !== 'leader') continue
      const before = previous.nodes[node.id]
      if (before !== undefined && node.commitIndex > before.commitIndex) {
        marks.push({ step: current.index, node: node.id, commitIndex: node.commitIndex })
      }
    }
  }
  return marks
}
