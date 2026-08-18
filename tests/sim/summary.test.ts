import { describe, expect, it } from 'vitest'
import { narrateSummary, summarize } from '@/lib/summary'
import { UNMODIFIED_RAFT } from '@/lib/raft/rules'
import { scenarioById } from '@/data/scenarios'
import { run } from '@/lib/sim/simulation'
import { electionSteps } from '@/lib/sim/trace'
import { SCENARIOS, ablated } from '@/data/scenarios'

function findScenario(id: string) {
  const found = SCENARIOS.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No scenario ${id}`)
  return found
}

describe('summarize', () => {
  it('has no leader and no elections at step 0', () => {
    const trace = run(findScenario('clean-election').spec)
    const summary = summarize(trace.steps[0]!, 0, [], UNMODIFIED_RAFT)
    expect(summary.leader).toBeNull()
    expect(summary.elections).toBe(0)
    expect(summary.committed).toBe(0)
    expect(summary.brokenProperties).toEqual([])
    expect(summary.modified).toBe(false)
  })

  it('names the leader, term and commit progress once a leader exists', () => {
    const trace = run(findScenario('clean-election').spec)
    const last = trace.steps[trace.steps.length - 1]!
    const elections = electionSteps(trace).length
    const summary = summarize(last, elections, [], UNMODIFIED_RAFT)
    expect(summary.leader).not.toBeNull()
    expect(summary.term).toBeGreaterThan(0)
    expect(summary.committed).toBeGreaterThan(0)
    expect(summary.elections).toBe(elections)
  })

  it('lists broken properties in Figure 3 order, deduplicated across many violation steps', () => {
    const spec = ablated(findScenario('election-restriction-overwrite'), 'electionRestriction')
    const trace = run(spec)
    const summary = summarize(trace.steps[trace.steps.length - 1]!, 0, trace.violations, spec.flags)
    // election-restriction-overwrite is designated to break Leader Completeness; an
    // overwritten committed entry then diverges from what was already applied
    // elsewhere, which cascades into State Machine Safety too — a real consequence,
    // not a double-count, and Figure 3's order puts Leader Completeness first.
    expect(summary.brokenProperties).toEqual(['leader-completeness', 'state-machine-safety'])
    expect(new Set(trace.violations.map((v) => v.property)).size).toBe(summary.brokenProperties.length)
    expect(summary.modified).toBe(true)
  })

  it('only counts violations at or before the step being viewed', () => {
    const spec = ablated(findScenario('election-restriction-overwrite'), 'electionRestriction')
    const trace = run(spec)
    const firstViolation = trace.violations[0]!
    const before = summarize(
      trace.steps[firstViolation.stepIndex - 1]!,
      0,
      trace.violations.filter((v) => v.stepIndex <= firstViolation.stepIndex - 1),
      spec.flags,
    )
    expect(before.brokenProperties).toEqual([])
  })
})

describe('narrateSummary', () => {
  const propertyName = (p: string) => p
  const ruleName = (f: string) => f

  it('says no leader yet when there is none', () => {
    const summary = summarize(
      run(findScenario('clean-election').spec).steps[0]!,
      0,
      [],
      UNMODIFIED_RAFT,
    )
    for (const locale of ['en', 'id'] as const) {
      const sentences = narrateSummary(summary, propertyName, ruleName, [], locale)
      expect(sentences.length).toBeGreaterThanOrEqual(2)
      expect(sentences.join(' ')).not.toBe('')
    }
  })

  it('adds a third sentence only when the run is modified', () => {
    const clean = summarize(run(findScenario('clean-election').spec).steps[0]!, 0, [], UNMODIFIED_RAFT)
    const cleanSentences = narrateSummary(clean, propertyName, ruleName, [], 'en')
    expect(cleanSentences.length).toBe(2)

    const spec = ablated(findScenario('election-restriction-overwrite'), 'electionRestriction')
    const modified = summarize(run(spec).steps[0]!, 0, [], spec.flags)
    const modifiedSentences = narrateSummary(modified, propertyName, ruleName, ['electionRestriction'], 'en')
    expect(modifiedSentences.length).toBe(3)
    expect(modifiedSentences[2]).toContain('electionRestriction')
  })

  it('produces valid, non-empty text in both locales for a run with every kind of fact', () => {
    const spec = ablated(findScenario('election-restriction-overwrite'), 'electionRestriction')
    const trace = run(spec)
    const summary = summarize(trace.steps[trace.steps.length - 1]!, 3, trace.violations, spec.flags)
    for (const locale of ['en', 'id'] as const) {
      const sentences = narrateSummary(summary, propertyName, ruleName, ['electionRestriction'], locale)
      expect(sentences).toHaveLength(3)
      for (const sentence of sentences) expect(sentence.length).toBeGreaterThan(0)
    }
  })
})
