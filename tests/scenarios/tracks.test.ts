import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '@/data/scenarios'
import { TRACKED_IDS, TRACKS, inTrack, trackOf } from '@/lib/scenarios/tracks'

describe('scenario tracks', () => {
  it('places every curated scenario in exactly one track, and names no scenario that does not exist', () => {
    const ids = SCENARIOS.map((entry) => entry.id).sort()
    expect(TRACKED_IDS).toEqual(ids)
    const placed = TRACKS.flatMap((track) => inTrack(ids, track)).sort()
    expect(placed).toEqual(ids)
  })

  it('opens with the clean election — the scenario every other one assumes', () => {
    const ids = SCENARIOS.map((entry) => entry.id)
    expect(inTrack(ids, 'start')[0]).toBe('clean-election')
  })

  it('files Figure 8 under breaking a rule', () => {
    expect(trackOf('figure-8')).toBe('breaking')
  })

  it('puts a scenario whose whole point is an ablation in the breaking track', () => {
    // Scenarios that exist only to show a rule's absence start with a position that
    // needs the ablation to go wrong; they belong with the other breaks.
    expect(trackOf('log-matching-break')).toBe('breaking')
    expect(trackOf('double-candidacy')).toBe('breaking')
  })
})
