import { describe, expect, it } from 'vitest'
import { electionTimeoutFraction, type ElectionTimer } from '@/lib/sim/trace'
import { run, scenario } from '@/lib/sim/simulation'

/**
 * The election-timeout bar under each follower (§2 of DESIGN-REWORK) is a pure
 * function of the trace at the current step, not a CSS animation with a duration —
 * it has to refill on stepping backwards and redraw correctly on a jump.
 */
describe('electionTimeoutFraction', () => {
  it('is 1 right after arming and 0 once the timeout has fully elapsed', () => {
    const timer: ElectionTimer = { lastHeartbeat: 100, electionTimeout: 200 }
    expect(electionTimeoutFraction(100, timer)).toBe(1)
    expect(electionTimeoutFraction(200, timer)).toBe(0.5)
    expect(electionTimeoutFraction(300, timer)).toBe(0)
  })

  it('clamps rather than going negative or above 1', () => {
    const timer: ElectionTimer = { lastHeartbeat: 100, electionTimeout: 200 }
    expect(electionTimeoutFraction(50, timer)).toBe(1)
    expect(electionTimeoutFraction(1000, timer)).toBe(0)
  })

  it('is 0 for a node with no armed timer, e.g. a leader', () => {
    expect(electionTimeoutFraction(500, null)).toBe(0)
  })

  it('is recoverable at any step without depending on the steps visited before it', () => {
    // The whole point: the same (now, timer) pair must give the same answer whether
    // it was reached by stepping forward, stepping backward, or jumping straight in.
    const timer: ElectionTimer = { lastHeartbeat: 1000, electionTimeout: 150 }
    const forward = [1000, 1030, 1060, 1090, 1120, 1150].map((now) => electionTimeoutFraction(now, timer))
    const jumpedTo90 = electionTimeoutFraction(1090, timer)
    const steppedBackTo30 = electionTimeoutFraction(1030, timer)
    expect(jumpedTo90).toBe(forward[3])
    expect(steppedBackTo30).toBe(forward[1])
  })
})

describe('recorded election timers', () => {
  it('draws visibly different timeout lengths across a fresh cluster', () => {
    // Randomised timeouts are the reason split votes resolve — two followers with
    // identical bars would teach the opposite of the mechanism.
    const trace = run(scenario({ seed: 7, maxTime: 1 }))
    const first = trace.steps[0]
    expect(first).toBeDefined()
    const durations = (first?.electionTimers ?? [])
      .filter((timer): timer is ElectionTimer => timer !== null)
      .map((timer) => timer.electionTimeout)
    expect(new Set(durations).size).toBeGreaterThan(1)
  })

  it('has no armed election timer for the elected leader once one exists', () => {
    const trace = run(scenario({ seed: 7, maxTime: 5000 }))
    const withLeader = trace.steps.find((step) => step.nodes.some((node) => node.role === 'leader'))
    expect(withLeader).toBeDefined()
    const leaderId = withLeader?.nodes.find((node) => node.role === 'leader')?.id
    expect(leaderId).toBeDefined()
    if (leaderId === undefined || withLeader === undefined) return
    expect(withLeader.electionTimers[leaderId]).toBeNull()
  })

  it('tracks the same value regardless of how the step is reached (determinism)', () => {
    const a = run(scenario({ seed: 11, maxTime: 6000 }))
    const b = run(scenario({ seed: 11, maxTime: 6000 }))
    expect(a.steps.map((s) => s.electionTimers)).toEqual(b.steps.map((s) => s.electionTimers))
  })
})
