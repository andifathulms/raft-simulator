/**
 * The node shapes, in one place.
 *
 * Node state is never colour alone: follower is a circle, candidate a diamond, leader
 * a square, and a crashed node keeps its circle but loses its fill and takes a dashed
 * outline. The ring draws these and so does every legend — and a legend that disagrees
 * with the thing it explains is worse than no legend, so both read from here.
 */

import type { Role } from '@/lib/raft/types'

export const ROLE_FILL: Record<Role, string> = {
  follower: 'fill-follower',
  candidate: 'fill-candidate',
  leader: 'fill-leader',
}

/**
 * The digit or letter set on a role fill follows the fill's lightness: pale on the
 * deep leader, `ink.role` on the follower and candidate — which is dark ink in both
 * themes, because in dark the follower and candidate fills are the light things.
 */
export const ROLE_INK: Record<Role, string> = {
  follower: 'fill-ink-role',
  candidate: 'fill-ink-role',
  leader: 'fill-stock-pale',
}

export const ROLE_BADGE: Record<Role, string> = {
  follower: 'F',
  candidate: 'C',
  leader: 'L',
}

/** SVG primitives centred on the origin, sized for a 22px radius. */
export function NodeShape({ role, crashed }: { role: Role; crashed: boolean }) {
  const className = `${crashed ? 'fill-stock-deep' : ROLE_FILL[role]} stroke-ink`
  if (crashed) {
    return <circle r="22" className={className} strokeWidth="1.5" strokeDasharray="3 3" />
  }
  switch (role) {
    case 'leader':
      return <rect x="-21" y="-21" width="42" height="42" rx="7" className={className} strokeWidth="1.5" />
    case 'candidate':
      return (
        <rect
          x="-19"
          y="-19"
          width="38"
          height="38"
          rx="4"
          transform="rotate(45)"
          className={className}
          strokeWidth="1.5"
        />
      )
    case 'follower':
    default:
      return <circle r="22" className={className} strokeWidth="1.5" />
  }
}

/**
 * A standalone glyph for legends and prose. Decorative: every use is accompanied by
 * the role's name in text, so it carries no information of its own.
 */
export function RoleGlyph({
  role,
  crashed = false,
  size = 28,
}: {
  role: Role
  crashed?: boolean
  size?: number
}) {
  return (
    <svg
      viewBox="-26 -26 52 52"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <NodeShape role={role} crashed={crashed} />
      <text
        y="6"
        textAnchor="middle"
        className={['text-[19px] font-mono font-bold tabular', crashed ? 'fill-ink-faint' : ROLE_INK[role]].join(' ')}
      >
        {crashed ? '×' : ROLE_BADGE[role]}
      </text>
    </svg>
  )
}
