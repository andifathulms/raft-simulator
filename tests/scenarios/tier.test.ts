import { describe, expect, it } from 'vitest'
import { networkTier } from '@/lib/scenarios/tier'
import { SCENARIOS } from '@/data/scenarios'

describe('networkTier', () => {
  it('is calm at zero drop', () => {
    expect(networkTier(0)).toBe('calm')
  })

  it('is lossy for a real-network drop rate, including LOSSY_NETWORK\'s own 80‰', () => {
    expect(networkTier(80)).toBe('lossy')
    expect(networkTier(1)).toBe('lossy')
    expect(networkTier(100)).toBe('lossy')
  })

  it('is hostile past that', () => {
    expect(networkTier(101)).toBe('hostile')
    expect(networkTier(500)).toBe('hostile')
  })

  it('classifies every curated scenario\'s actual drop rate without throwing', () => {
    for (const entry of SCENARIOS) {
      expect(['calm', 'lossy', 'hostile']).toContain(networkTier(entry.spec.network.dropPerMille))
    }
  })
})
