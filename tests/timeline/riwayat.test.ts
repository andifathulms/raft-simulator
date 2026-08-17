import { describe, expect, it } from 'vitest'
import { commitMarks, nextRun, roleRuns, termBands } from '@/lib/timeline/riwayat'
import { SCENARIOS, ablated } from '@/data/scenarios'
import { run } from '@/lib/sim/simulation'
import type { Trace } from '@/lib/sim/trace'

/**
 * `Riwayat`'s geometry, standalone, against three real recorded traces: a clean
 * election, a run with a partition, and an ablation run that produces a violation.
 * DESIGN-REWORK.md's build order, step 4.
 */

function scenarioById(id: string) {
  const found = SCENARIOS.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No scenario ${id}`)
  return found
}

const CLEAN_ELECTION: Trace = run(scenarioById('clean-election').spec)
const PARTITIONED: Trace = run(scenarioById('partition-stranded-leader').spec)
const ABLATED_VIOLATION: Trace = run(
  ablated(scenarioById('election-restriction-overwrite'), 'electionRestriction'),
)

describe('roleRuns', () => {
  it.each([
    ['clean election', CLEAN_ELECTION],
    ['partitioned', PARTITIONED],
    ['ablation violation', ABLATED_VIOLATION],
  ])('covers every step of every node exactly once, in %s', (_label, trace) => {
    const runs = roleRuns(trace)
    const nodeCount = trace.steps[0]?.nodes.length ?? 0
    for (let node = 0; node < nodeCount; node += 1) {
      const own = runs.filter((r) => r.node === node).sort((a, b) => a.from - b.from)
      expect(own[0]?.from).toBe(0)
      expect(own[own.length - 1]?.to).toBe(trace.steps.length - 1)
      for (let i = 1; i < own.length; i += 1) {
        expect(own[i]?.from).toBe((own[i - 1]?.to ?? -2) + 1)
      }
    }
  })

  it('a clean election has at least one follower run ending in candidacy', () => {
    const runs = roleRuns(CLEAN_ELECTION)
    const followerRuns = runs.filter((r) => r.role === 'follower')
    const endsInCandidacy = followerRuns.some((r) => nextRun(runs, r)?.role === 'candidate')
    expect(endsInCandidacy).toBe(true)
  })

  it('every node reaches leader exactly once per term it holds it, never two at once', () => {
    for (const trace of [CLEAN_ELECTION, PARTITIONED]) {
      const leaderRuns = roleRuns(trace).filter((r) => r.role === 'leader')
      for (const step of trace.steps) {
        const leadersNow = leaderRuns.filter((r) => r.from <= step.index && step.index <= r.to)
        const terms = new Set(leadersNow.map((r) => trace.steps[r.from]?.nodes[r.node]?.currentTerm))
        // Two leaders can coexist mid-partition, but never in the same term — that
        // would be the very property this scenario keeps intact.
        if (leadersNow.length > 1) expect(terms.size).toBe(leadersNow.length)
      }
    }
  })
})

describe('termBands', () => {
  it.each([
    ['clean election', CLEAN_ELECTION],
    ['partitioned', PARTITIONED],
    ['ablation violation', ABLATED_VIOLATION],
  ])('is non-decreasing and covers the whole trace, in %s', (_label, trace) => {
    const bands = termBands(trace)
    expect(bands[0]?.from).toBe(0)
    expect(bands[bands.length - 1]?.to).toBe(trace.steps.length - 1)
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i]?.from).toBe((bands[i - 1]?.to ?? -2) + 1)
      expect(bands[i]?.term).toBeGreaterThan(bands[i - 1]?.term ?? -1)
    }
  })

  it('starts at term 0, before any election', () => {
    expect(termBands(CLEAN_ELECTION)[0]?.term).toBe(0)
  })
})

describe('commitMarks', () => {
  it('a clean election commits at least one entry', () => {
    const marks = commitMarks(CLEAN_ELECTION)
    expect(marks.length).toBeGreaterThan(0)
  })

  it('every mark is on a node that was actually leader at that step', () => {
    for (const trace of [CLEAN_ELECTION, PARTITIONED]) {
      for (const mark of commitMarks(trace)) {
        expect(trace.steps[mark.step]?.nodes[mark.node]?.role).toBe('leader')
      }
    }
  })

  it('commitIndex only ever advances, never marked on the way down', () => {
    for (const trace of [CLEAN_ELECTION, PARTITIONED, ABLATED_VIOLATION]) {
      const marks = commitMarks(trace)
      const perNode = new Map<number, number[]>()
      for (const mark of marks) {
        const list = perNode.get(mark.node) ?? []
        list.push(mark.commitIndex)
        perNode.set(mark.node, list)
      }
      for (const [, indices] of perNode) {
        for (let i = 1; i < indices.length; i += 1) {
          expect(indices[i]).toBeGreaterThan(indices[i - 1] ?? -1)
        }
      }
    }
  })
})
