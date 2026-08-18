/**
 * The scenario library's drop-rate tier. DESIGN-REWORK.md §5:
 *
 * "The drop percentage in particular is the knob that decides whether a scenario is
 * calm or chaotic, and it reads as a number in a list. A small inline indicator per
 * card — even a three-step calm/lossy/hostile mark — makes the library scannable for
 * what a reader is actually choosing between."
 *
 * Three tiers, not a continuous scale: a reader scanning twelve cards is choosing
 * between "nothing gets lost," "Raft's normal operating condition," and "actively
 * hostile," not comparing exact per-mille figures against each other.
 */

export type NetworkTier = 'calm' | 'lossy' | 'hostile'

/** In display order — the count of filled bars in the indicator. */
export const NETWORK_TIERS: readonly NetworkTier[] = ['calm', 'lossy', 'hostile']

/**
 * `calm` is deterministic and quiet — the scripted scenarios use it so a written
 * sequence plays out as written. `lossy` is `LOSSY_NETWORK` in data/scenarios/index.ts
 * (80‰, §9's "message loss is the default"): Raft's normal operating condition, not
 * an edge case. `hostile` is reserved for anything drawn worse than that — no curated
 * scenario currently reaches it, but the fuzz suite draws rates well past it.
 */
export function networkTier(dropPerMille: number): NetworkTier {
  if (dropPerMille <= 0) return 'calm'
  if (dropPerMille <= 100) return 'lossy'
  return 'hostile'
}
