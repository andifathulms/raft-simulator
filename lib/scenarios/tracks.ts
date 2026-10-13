/**
 * The scenario library's reading order: four tracks, from the ordinary case to the
 * two extensions the paper treats last.
 *
 * Twelve scenarios in one flat grid hide the fact that they already form a learning
 * curve — you cannot appreciate Figure 8 before you have watched a clean election.
 * The tracks say so. Kept here rather than as a field on each scenario so the
 * scenario schema, and every fixture keyed on it, stays exactly as it was.
 */

export type Track = 'start' | 'failures' | 'breaking' | 'advanced'

/** In reading order. */
export const TRACKS: readonly Track[] = ['start', 'failures', 'breaking', 'advanced']

const TRACK_OF: Readonly<Record<string, Track>> = {
  // The ordinary case first, then the one thing that makes elections converge.
  'clean-election': 'start',
  'split-vote': 'start',
  // Unmodified Raft under crashes and partitions: what the rules are for.
  'partition-stranded-leader': 'failures',
  'log-divergence-repair': 'failures',
  'leader-crash-mid-replication': 'failures',
  // Each of these exists to show one rule's absence. A scenario in another track may
  // also carry an ablation, but this is the track whose whole point is the break.
  'figure-8': 'breaking',
  'election-restriction-overwrite': 'breaking',
  'double-vote-restart': 'breaking',
  'log-matching-break': 'breaking',
  'double-candidacy': 'breaking',
  // §6 and §7: membership changes and log compaction.
  'membership-change': 'advanced',
  'log-compaction': 'advanced',
}

/** The track a scenario belongs to. Unknown ids fall into `advanced`, last. */
export function trackOf(scenarioId: string): Track {
  return TRACK_OF[scenarioId] ?? 'advanced'
}

/** Ids in a track, in the order they appear in `ids` — the library's own order. */
export function inTrack(ids: readonly string[], track: Track): readonly string[] {
  return ids.filter((id) => trackOf(id) === track)
}

/** Every id the table names, for the test that keeps it in step with the library. */
export const TRACKED_IDS: readonly string[] = Object.keys(TRACK_OF).sort()
