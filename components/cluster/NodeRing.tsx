'use client'

/**
 * The cluster view: nodes on a ring, messages travelling between them as slips.
 *
 * Node state is never colour alone. Follower, candidate and leader each carry a
 * distinct shape and a distinct badge as well as a distinct colour, so the view
 * survives both colour blindness and a greyscale screenshot.
 */

import { NodeShape, ROLE_BADGE, ROLE_INK } from '@/components/cluster/glyph'
import type { Dictionary } from '@/lib/i18n'
import { describeConfiguration, isMember, type Configuration } from '@/lib/raft/configuration'
import { configurationOf } from '@/lib/raft/log'
import type { NodeState } from '@/lib/raft/types'
import { electionTimeoutFraction, type InFlight, type TraceStep } from '@/lib/sim/trace'

interface Props {
  readonly step: TraceStep
  readonly dict: Dictionary
  readonly onNodeAction?: (node: number, action: 'crash' | 'restart' | 'isolate') => void
  readonly selected: number | null
  readonly onSelect: (node: number | null) => void
  /** A picture only — the home page's live hero. No controls, nothing focusable. */
  readonly bare?: boolean
}

const SIZE = 420
const CENTRE = SIZE / 2
const RADIUS = 150

// Figure 2, Rules for Servers, Followers rule 2: the election timer, drawn as a ring
// around the follower. It used to be a 3px bar under the node — the protocol's
// driving force at the size of an underline. Same computed fraction, now visible.
const TIMER_RADIUS = 30
const TIMER_WIDTH = 3

// Messages travel on a gentle curve bowed toward the centre rather than a straight
// chord, so the many links of a five-node cluster stop crossing in one knot.
const BOW = 0.22

function position(index: number, count: number): { x: number; y: number } {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  return { x: CENTRE + Math.cos(angle) * RADIUS, y: CENTRE + Math.sin(angle) * RADIUS }
}

interface Point {
  readonly x: number
  readonly y: number
}

/** The control point of the link from `a` to `b`: its midpoint, pulled toward the centre. */
function bow(a: Point, b: Point): Point {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  return { x: mid.x + (CENTRE - mid.x) * BOW, y: mid.y + (CENTRE - mid.y) * BOW }
}

/** A point `t` of the way along the quadratic curve a → c → b. */
function along(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}

/**
 * A slip takes the colour of the role whose RPC it belongs to — vote traffic is a
 * candidate's, replication and snapshots a leader's — and replies are dashed. This
 * is the role palette reused, not a new one: a slip is coloured by who asked.
 */
function slipStyle(message: InFlight['message']): { stroke: string; reply: boolean } {
  switch (message.type) {
    case 'RequestVote':
      return { stroke: 'stroke-candidate', reply: false }
    case 'RequestVoteResponse':
      return { stroke: 'stroke-candidate', reply: true }
    case 'AppendEntries':
    case 'InstallSnapshot':
      return { stroke: 'stroke-leader', reply: false }
    case 'AppendEntriesResponse':
    case 'InstallSnapshotResponse':
      return { stroke: 'stroke-leader', reply: true }
    default: {
      const unreachable: never = message
      throw new Error(`Unhandled message: ${JSON.stringify(unreachable)}`)
    }
  }
}

function slipLabel(flight: InFlight): string {
  switch (flight.message.type) {
    case 'RequestVote':
      return 'RV'
    case 'RequestVoteResponse':
      return flight.message.voteGranted ? 'RV✓' : 'RV✗'
    case 'AppendEntries':
      return flight.message.entries.length === 0 ? 'HB' : `AE·${flight.message.entries.length}`
    case 'AppendEntriesResponse':
      return flight.message.success ? 'AE✓' : 'AE✗'
    case 'InstallSnapshot':
      return `IS@${flight.message.lastIncludedIndex}`
    case 'InstallSnapshotResponse':
      return 'IS✓'
    default: {
      const unreachable: never = flight.message
      throw new Error(`Unhandled message: ${JSON.stringify(unreachable)}`)
    }
  }
}

export function NodeRing({ step, dict, onNodeAction, selected, onSelect, bare = false }: Props) {
  const count = step.nodes.length
  const partitions = new Set(step.network.partitionOf)
  const split = partitions.size > 1
  // §6 — a server's configuration is whatever its own log says, so the cluster shown
  // is the one the leader believes in, falling back to node 0's view when there is no
  // leader. Servers can genuinely disagree about membership mid-change, and the node
  // badges show that rather than hiding it behind one authoritative answer.
  const authority = step.nodes.find((node) => node.role === 'leader') ?? step.nodes[0]
  const configuration: Configuration =
    authority === undefined ? { type: 'simple', servers: [] } : configurationOf(authority.log)

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[420px] mx-auto"
        role="img"
        aria-label={`${dict.sim.cluster}: ${step.nodes
          .map((node) => `node ${node.id} ${node.role} term ${node.currentTerm}`)
          .join(', ')}`}
      >
        {/* The ring itself. A partition renders as a visible break rather than a
            colour change, because colour is reserved. */}
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          fill="none"
          className="stroke-ink-rule"
          strokeWidth="1.25"
          strokeDasharray={split ? '6 10' : undefined}
        />

        {/* Messages in flight, positioned along their link by how far they have got. */}
        {step.inFlight.slice(0, 24).map((flight) => {
          const from = position(flight.message.from, count)
          const to = position(flight.message.to, count)
          const control = bow(from, to)
          const span = Math.max(1, flight.arrivesAt - flight.sentAt)
          const progress = Math.min(1, Math.max(0, (step.time - flight.sentAt) / span))
          const at = along(from, control, to, progress)
          const style = slipStyle(flight.message)
          return (
            <g key={`${flight.seq}`} className="slip-in">
              <path
                d={`M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`}
                fill="none"
                className="stroke-ink-rule"
                strokeWidth="1"
              />
              <rect
                x={at.x - 18}
                y={at.y - 8.5}
                width="36"
                height="17"
                rx="4"
                className={`fill-stock-raised ${style.stroke}`}
                strokeWidth="1.5"
                strokeDasharray={style.reply ? '3 2' : undefined}
              />
              <text
                x={at.x}
                y={at.y + 3.5}
                textAnchor="middle"
                className="fill-ink text-[9px] font-mono font-medium tabular"
              >
                {slipLabel(flight)}
              </text>
            </g>
          )
        })}

        {/* A message the network just lost: a ghost slip, dotted, halfway along
            the link it never finished. Loss is the default condition (CLAUDE.md
            invariant 9), so it should be visible when it happens, not silent. */}
        {step.event.kind === 'drop' &&
          (() => {
            const message = step.event.message
            const from = position(message.from, count)
            const to = position(message.to, count)
            const at = along(from, bow(from, to), to, 0.5)
            return (
              <g aria-hidden className="slip-in">
                <rect
                  x={at.x - 20}
                  y={at.y - 8.5}
                  width="40"
                  height="17"
                  rx="4"
                  className="fill-stock-pale stroke-ink-faint"
                  strokeWidth="1.25"
                  strokeDasharray="1.5 2.5"
                />
                <text x={at.x} y={at.y + 3.5} textAnchor="middle" className="fill-ink-faint text-[9px] font-mono">
                  {dict.workbench.lost}
                </text>
              </g>
            )
          })()}

        {step.nodes.map((node) => {
          const { x, y } = position(node.id, count)
          const crashed = step.crashed[node.id] === true
          const isSelected = selected === node.id
          const fraction =
            node.role === 'follower' && !crashed
              ? electionTimeoutFraction(step.time, step.electionTimers[node.id] ?? null)
              : null
          return (
            <g
              key={node.id}
              transform={`translate(${x} ${y})`}
              {...(bare
                ? {}
                : {
                    onClick: () => onSelect(isSelected ? null : node.id),
                    className: 'cursor-pointer',
                    tabIndex: 0,
                    role: 'button',
                    'aria-pressed': isSelected,
                    'aria-label': `Node ${node.id}, ${node.role}, term ${node.currentTerm}`,
                    onKeyDown: (event: React.KeyboardEvent) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(isSelected ? null : node.id)
                      }
                    },
                  })}
            >
              {isSelected && (
                <circle r="37" fill="none" className="stroke-ink" strokeWidth="1.25" strokeDasharray="2 3" />
              )}
              {/* The leader's halo: still, not pulsing. The election timer is the only
                  ambient motion in the app (PRD §10), and it encodes information. */}
              {node.role === 'leader' && !crashed && (
                <rect x="-29" y="-29" width="58" height="58" rx="12" className="fill-leader/10 stroke-leader/40" strokeWidth="1" />
              )}
              {/* §6 — a server outside the configuration is not part of the cluster.
                  Drawn with a dashed outer ring rather than a colour, because colour
                  is spoken for and membership is not a state of the server. */}
              {!isMember(configurationOf(node.log), node.id) && (
                <circle r="33" fill="none" className="stroke-ink-faint" strokeWidth="1" strokeDasharray="1 4" />
              )}
              {/* Figure 2, Rules for Servers, Followers rule 2: the randomized election
                  timeout, depleting toward the instant this follower becomes a
                  candidate. A pure function of (now, lastHeartbeat, electionTimeout)
                  from the trace at this step — not a CSS animation with a duration —
                  so it refills on stepping back and redraws correctly on a jump.
                  Drawn only for followers: a leader has no election timeout. */}
              {fraction !== null && (
                <g aria-hidden>
                  <circle r={TIMER_RADIUS} fill="none" className="stroke-ink-rule" strokeWidth={TIMER_WIDTH} />
                  <circle
                    r={TIMER_RADIUS}
                    fill="none"
                    className="stroke-ink-soft"
                    strokeWidth={TIMER_WIDTH}
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={`${Math.max(0, Math.min(100, fraction * 100))} 100`}
                    transform="rotate(-90)"
                  />
                </g>
              )}
              <NodeShape role={node.role} crashed={crashed} />
              {/* The digit follows the fill's lightness (glyph.tsx, ROLE_INK). Set at
                  19px bold, large text by WCAG; the id is also in the aria-label. */}
              <text
                y="6.5"
                textAnchor="middle"
                className={[
                  'pointer-events-none text-[19px] font-mono font-bold tabular',
                  crashed ? 'fill-ink-faint' : ROLE_INK[node.role],
                ].join(' ')}
              >
                {node.id}
              </text>
              {/* Badge: the role in one letter, so the shape is doubly redundant. */}
              <circle cx="20" cy="-20" r="8" className="fill-stock-raised stroke-ink" strokeWidth="1" />
              <text
                x="20"
                y="-17"
                textAnchor="middle"
                className="pointer-events-none fill-ink text-[9px] font-mono font-bold"
              >
                {crashed ? '×' : ROLE_BADGE[node.role]}
              </text>
              <text
                y="47"
                textAnchor="middle"
                className="pointer-events-none fill-ink-soft text-[10px] font-mono tabular"
              >
                t{node.currentTerm} · c{node.commitIndex}
              </text>
              {/* Partition group, only when there is more than one. */}
              {split && (
                <text
                  y="59"
                  textAnchor="middle"
                  className="pointer-events-none fill-ink-faint text-[9px] font-mono"
                >
                  {dict.sim.partitionGroup} {step.network.partitionOf[node.id]}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {!bare && (
        <>
          <p className="text-center font-mono text-micro tabular text-ink-soft">
            {dict.sim.configuration}: {describeConfiguration(configuration)}
          </p>

          <NodeDetail
            step={step}
            node={selected === null ? null : (step.nodes[selected] ?? null)}
            dict={dict}
            onNodeAction={onNodeAction}
          />
        </>
      )}
    </div>
  )
}

function NodeDetail({
  step,
  node,
  dict,
  onNodeAction,
}: {
  step: TraceStep
  node: NodeState | null
  dict: Dictionary
  onNodeAction?: (node: number, action: 'crash' | 'restart' | 'isolate') => void
}) {
  if (node === null) {
    return (
      <p className="text-center font-sans text-micro text-ink-faint">{dict.workbench.selectNode}</p>
    )
  }
  const crashed = step.crashed[node.id] === true
  return (
    <div className="rounded-panel border border-ink-rule bg-stock-raised p-3 font-mono text-micro tabular">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-sans text-label font-semibold">
          node {node.id} — {crashed ? dict.roles.crashed : dict.roles[node.role]}
        </span>
        {onNodeAction !== undefined && (
          <span className="flex gap-1">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => onNodeAction(node.id, crashed ? 'restart' : 'crash')}
            >
              {crashed ? dict.sim.restart : dict.sim.crash}
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => onNodeAction(node.id, 'isolate')}
            >
              {dict.sim.isolate}
            </button>
          </span>
        )}
      </div>
      {/* nextIndex and matchIndex used to be two arrays of integers here, decoded
          against the ledger by hand. DESIGN-REWORK.md §5: they are positions in that
          very table, so they are drawn on it now instead — a line under the last
          entry the leader knows is replicated, a dashed box around the one it will
          try next. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <Field label="currentTerm" value={node.currentTerm} />
        <Field label="votedFor" value={node.votedFor ?? '—'} />
        <Field label="commitIndex" value={node.commitIndex} />
        <Field label="lastApplied" value={node.lastApplied} />
        <Field label="configuration" value={describeConfiguration(configurationOf(node.log))} />
      </dl>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-faint">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
