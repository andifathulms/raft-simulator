/**
 * The calm / lossy / hostile mark: three rising bars, filled to the tier.
 * DESIGN-REWORK.md §5 — the drop rate decides whether a run is calm or chaotic, and a
 * percentage in a list does not scan. Shared by the scenario library and the picker.
 */

import type { Dictionary } from '@/lib/i18n'
import { NETWORK_TIERS, type NetworkTier } from '@/lib/scenarios/tier'

export function NetworkTierMark({ tier, dict }: { tier: NetworkTier; dict: Dictionary }) {
  const filled = NETWORK_TIERS.indexOf(tier) + 1
  return (
    <span
      className="flex shrink-0 items-end gap-[2px]"
      title={`${dict.scenarios.network}: ${dict.scenarios.tiers[tier]}`}
    >
      <span className="sr-only">
        {dict.scenarios.network}: {dict.scenarios.tiers[tier]}
      </span>
      {NETWORK_TIERS.map((step, index) => (
        <span
          key={step}
          aria-hidden
          className={['w-[3px] rounded-[1px]', index < filled ? 'bg-ink-soft' : 'bg-ink-rule'].join(' ')}
          style={{ height: `${5 + index * 3}px` }}
        />
      ))}
    </span>
  )
}
