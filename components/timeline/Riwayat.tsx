'use client'

/**
 * `Riwayat` — the event timeline: one lane per node, term bands, commit marks, and
 * the violation region, all laid out on the step axis. DESIGN-REWORK.md §3.
 *
 * Decorative: `aria-hidden` throughout. The range input in `Timeline.tsx` is the
 * accessible control and stays the keyboard and screen-reader path — its
 * `aria-valuetext` already says what happened rather than a raw step number. This
 * component is the picture beside it, not a replacement for it.
 *
 * Standalone for now (DESIGN-REWORK.md build order, step 4): not wired into
 * `Simulator.tsx` yet. `onStep` is accepted so wiring it in is a prop, not a rewrite.
 */

import { ROLE_BADGE, ROLE_FILL } from '@/components/cluster/glyph'
import { commitMarks, nextRun, roleRuns, termBands } from '@/lib/timeline/riwayat'
import { electionTimeoutFraction, runsOf, violationSteps, type Trace } from '@/lib/sim/trace'

interface Props {
  readonly trace: Trace
  readonly step: number
  readonly onStep?: (step: number) => void
}

const TERM_BAND_HEIGHT = 16
const LANE_HEIGHT = 22
const LANE_GAP = 3
const VIOLATION_HEIGHT = 10
const TOP_MARGIN = 2
const BOTTOM_MARGIN = 2

// Term bands alternate between these two so adjacent terms are legible even when a
// band is a single step wide — colour alone would vanish at that width.
const TERM_TINTS = ['fill-stock-deep', 'fill-stock-pale']

// The depleting overlay, banded left to right instead of a true gradient (see below).
// `at` is where in [start, end] this band samples its opacity from.
const DEPLETE_BANDS = [
  { from: 0, to: 0.25, at: 0.125 },
  { from: 0.25, to: 0.5, at: 0.375 },
  { from: 0.5, to: 0.75, at: 0.625 },
  { from: 0.75, to: 1, at: 0.875 },
]

export function Riwayat({ trace, step, onStep }: Props) {
  const last = trace.steps.length - 1
  const first = trace.steps[0]
  const nodeCount = first?.nodes.length ?? 0
  const runs = roleRuns(trace)
  const bands = termBands(trace)
  const commits = commitMarks(trace)
  const violationRuns = runsOf(violationSteps(trace))

  const laneTop = (node: number) => TOP_MARGIN + TERM_BAND_HEIGHT + node * (LANE_HEIGHT + LANE_GAP)
  // 1 SVG unit per step on x, 1 unit per pixel on y — `preserveAspectRatio="none"`
  // lets it fill the container's width regardless of run length, since this is a
  // schematic axis, not a drawing with a shape to preserve, while the vertical scale
  // stays exact so the per-lane text stays whatever size it was drawn at.
  const height =
    TOP_MARGIN + TERM_BAND_HEIGHT + nodeCount * (LANE_HEIGHT + LANE_GAP) + VIOLATION_HEIGHT + BOTTOM_MARGIN
  const width = Math.max(1, last + 1)

  const jump = (clientX: number, target: SVGSVGElement) => {
    if (onStep === undefined) return
    const box = target.getBoundingClientRect()
    const fraction = box.width === 0 ? 0 : (clientX - box.left) / box.width
    onStep(Math.min(last, Math.max(0, Math.round(fraction * last))))
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      aria-hidden
      className={onStep !== undefined ? 'cursor-pointer' : undefined}
      onClick={onStep !== undefined ? (event) => jump(event.clientX, event.currentTarget) : undefined}
    >
      {/* Term bands. A term is a period, not a number in a list — the boundary
          between two bands is where an election happened. */}
      {bands.map((band, index) => (
        <g key={`${band.term}-${band.from}`}>
          <rect
            x={band.from}
            y={TOP_MARGIN}
            width={band.to - band.from + 1}
            height={TERM_BAND_HEIGHT}
            className={TERM_TINTS[index % 2]}
          />
          {band.to - band.from + 1 >= 3 && (
            <text
              x={band.from + 0.3}
              y={TOP_MARGIN + TERM_BAND_HEIGHT - 4}
              className="fill-ink-soft"
              style={{ fontSize: 6 }}
            >
              t{band.term}
            </text>
          )}
        </g>
      ))}

      {/* One lane per node. */}
      {runs.map((run) => {
        const y = laneTop(run.node)
        const w = run.to - run.from + 1
        const following = nextRun(runs, run)
        // Figure 2, Rules for Servers, Followers rule 2: the depleting election
        // timeout, drawn inline on the run that ends in candidacy so the timeout
        // reaching zero and the role change sit at the same x — reusing the exact
        // per-step fraction lib/sim/trace.ts already records, not a redrawn curve.
        const depleting = run.role === 'follower' && following?.role === 'candidate'
        const startTimer = trace.steps[run.from]?.electionTimers[run.node] ?? null
        const endTimer = trace.steps[run.to]?.electionTimers[run.node] ?? null
        const startFraction = electionTimeoutFraction(trace.steps[run.from]?.time ?? 0, startTimer)
        const endFraction = electionTimeoutFraction(trace.steps[run.to]?.time ?? 0, endTimer)
        return (
          <g key={`${run.node}-${run.from}`}>
            <rect x={run.from} y={y} width={w} height={LANE_HEIGHT} className={ROLE_FILL[run.role]} />
            {depleting &&
              // No `stop-color` utility exists in Tailwind, and this repo never writes
              // raw hex in a component — so the depleting overlay is banded steps of
              // the `ink` fill at a computed opacity instead of a true SVG gradient,
              // each still just a token-coloured rect.
              DEPLETE_BANDS.map((band, index) => (
                <rect
                  key={index}
                  x={run.from + band.from * w}
                  y={y}
                  width={Math.max(0, (band.to - band.from) * w)}
                  height={LANE_HEIGHT}
                  className="fill-ink"
                  fillOpacity={(startFraction + (endFraction - startFraction) * band.at) * 0.32}
                />
              ))}
            {w >= 2 && (
              <text
                x={run.from + 0.3}
                y={y + LANE_HEIGHT / 2 + 2.5}
                className="fill-ink font-bold"
                style={{ fontSize: 7 }}
              >
                {ROLE_BADGE[run.role]}
              </text>
            )}
          </g>
        )
      })}

      {/* Commits, on the leader's own lane — Figure 2, Rules for Servers, Leaders,
          rule 4. Not applied entries, which land on every node in turn well after. */}
      {commits.map((mark) => (
        <circle
          key={`${mark.node}-${mark.step}`}
          cx={mark.step + 0.5}
          cy={laneTop(mark.node) + LANE_HEIGHT / 2}
          r={1.6}
          className="fill-committed stroke-stock-pale"
          strokeWidth={0.4}
        />
      ))}

      {/* The violation region. Vermilion is reserved for exactly this. */}
      {violationRuns.map((v) => (
        <rect
          key={v.from}
          x={v.from}
          y={height - VIOLATION_HEIGHT - BOTTOM_MARGIN}
          width={Math.max(0.4, v.to - v.from + 1)}
          height={VIOLATION_HEIGHT}
          className="fill-vermilion"
        />
      ))}

      {/* The playhead. */}
      <line x1={step + 0.5} x2={step + 0.5} y1={0} y2={height} className="stroke-leader" strokeWidth={0.5} />
    </svg>
  )
}
