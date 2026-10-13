'use client'

/**
 * The transport dock: history, playhead and controls, pinned to the bottom of the
 * workbench.
 *
 * It used to sit about 1,400px below the cluster it moved, so pressing play meant
 * scrolling away from the thing that started moving. Now it docks: sticky to the
 * viewport's bottom edge while the workbench is on screen, resting at the end of it
 * otherwise.
 *
 * Stepping backwards is free, because the trace is materialised: nothing is
 * recomputed, the previous step is simply read. Animation timing lives here and never
 * feeds back into the simulation — the virtual clock does not know this component
 * exists.
 */

import { useEffect } from 'react'
import { Riwayat } from '@/components/timeline/Riwayat'
import type { Dictionary } from '@/lib/i18n'
import { describeEvent, type Trace } from '@/lib/sim/trace'

interface Props {
  readonly trace: Trace
  readonly step: number
  readonly onStep: (step: number) => void
  readonly playing: boolean
  readonly onPlaying: (playing: boolean) => void
  readonly speed: number
  readonly onSpeed: (speed: number) => void
  readonly marks: {
    readonly terms: readonly number[]
    readonly elections: readonly number[]
    readonly commits: readonly number[]
    readonly violations: readonly number[]
  }
  readonly dict: Dictionary
  /** The run-so-far figures, rendered beside the transport. */
  readonly summary?: React.ReactNode
  readonly onShortcuts?: () => void
}

export function nextAfter(marks: readonly number[], current: number): number | null {
  for (const mark of marks) if (mark > current) return mark
  return null
}

export function previousBefore(marks: readonly number[], current: number): number | null {
  let found: number | null = null
  for (const mark of marks) {
    if (mark >= current) break
    found = mark
  }
  return found
}

export function Timeline({
  trace,
  step,
  onStep,
  playing,
  onPlaying,
  speed,
  onSpeed,
  marks,
  dict,
  summary,
  onShortcuts,
}: Props) {
  const last = trace.steps.length - 1
  const current = trace.steps[step]

  useEffect(() => {
    if (!playing) return
    // `prefers-reduced-motion` disables autoplay; stepping stays instantaneous.
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      onPlaying(false)
      return
    }
    const interval = window.setInterval(() => {
      onStep(Math.min(last, step + 1))
    }, Math.max(16, 500 / speed))
    return () => window.clearInterval(interval)
  }, [playing, speed, step, last, onStep, onPlaying])

  useEffect(() => {
    if (step >= last && playing) onPlaying(false)
  }, [step, last, playing, onPlaying])

  const go = (target: number) => {
    onPlaying(false)
    onStep(Math.min(last, Math.max(0, target)))
  }

  return (
    <section aria-label={dict.sim.timeline} className="flex flex-col gap-2.5">
      {/*
       * `Riwayat` is the picture; the range input is still the whole control. It sits
       * on top, stretched over the drawing — visually transparent, but in the DOM
       * exactly as before: same value, same onChange, same aria-valuetext, same tab
       * order. Focus has to move to something visible, so the group gets the ring.
       */}
      <div className="group relative overflow-hidden rounded-control border border-ink-rule bg-stock-pale">
        <Riwayat trace={trace} step={step} dense />
        <input
          type="range"
          min={0}
          max={last}
          value={step}
          onChange={(event) => go(Number(event.target.value))}
          aria-label={dict.sim.timeline}
          // The raw step number says nothing on its own. Announce the virtual time and
          // what actually happened, which is what the scrubber is for.
          aria-valuetext={`${dict.sim.step} ${step}, ${dict.sim.time} ${current?.time ?? 0}, ${
            current === undefined ? '' : describeEvent(current.event)
          }`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 outline-none"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden rounded-control ring-2 ring-inset ring-leader group-focus-within:block"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <Key onClick={() => go(0)} label="⏮" title={dict.sim.start} />
          <Key onClick={() => go(step - 1)} label="◀" title={dict.sim.back} />
          {/* The one primary control on the workbench: round, filled, and the only
              thing in the dock drawn in solid ink. */}
          <button
            type="button"
            onClick={() => onPlaying(!playing)}
            aria-label={playing ? dict.sim.pause : dict.sim.play}
            title={`${playing ? dict.sim.pause : dict.sim.play} (Space)`}
            className="mx-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-ink text-stock-pale transition-colors hover:bg-ink-soft"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="fill-current">
              {playing ? (
                <path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" />
              ) : (
                <path d="M4 2.2v11.6c0 .6.6.9 1.1.6l9-5.8c.5-.3.5-1 0-1.3l-9-5.8C4.6 1.2 4 1.6 4 2.2z" />
              )}
            </svg>
          </button>
          <Key onClick={() => go(step + 1)} label="▶" title={dict.sim.forward} />
          <Key onClick={() => go(last)} label="⏭" title={dict.sim.end} />
          <label className="ml-1.5 flex items-center gap-1 font-sans text-micro text-ink-soft">
            <span className="sr-only">{dict.sim.speed}</span>
            <select
              value={speed}
              onChange={(event) => onSpeed(Number(event.target.value))}
              title={dict.sim.speed}
              className="input py-1 pl-1.5 pr-1 font-mono text-micro"
            >
              {[0.5, 1, 2, 4, 8].map((option) => (
                <option key={option} value={option}>
                  {option}×
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="font-mono text-micro tabular text-ink-faint">
          <span className="font-semibold text-ink">{step}</span>/{last} · {dict.sim.time.toLowerCase()} {current?.time ?? 0}
        </p>

        {summary}

        {/* Jump to the next thing worth looking at. Scrubbing an event at a time is
            how you inspect a run; these are how you find the moment worth inspecting. */}
        <div className="flex flex-wrap items-center gap-1 lg:ml-auto">
          <span className="sr-only">{dict.sim.jumpTo}</span>
          <Jump label={dict.sim.nextElection} target={nextAfter(marks.elections, step)} go={go} />
          <Jump label={dict.sim.nextCommit} target={nextAfter(marks.commits, step)} go={go} />
          <Jump label={dict.sim.nextViolation} target={nextAfter(marks.violations, step)} go={go} danger />
          {onShortcuts !== undefined && (
            <button
              type="button"
              onClick={onShortcuts}
              title={dict.workbench.shortcuts}
              aria-label={dict.workbench.shortcuts}
              className="kbd ml-1 hidden h-6 cursor-pointer px-1.5 hover:text-ink sm:inline-flex"
            >
              ?
            </button>
          )}
        </div>
      </div>
      {trace.truncated && <p className="font-sans text-micro text-ink-faint">{dict.sim.truncated}</p>}
    </section>
  )
}

function Key({ onClick, label, title }: { onClick: () => void; label: string; title: string }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className="btn btn-icon">
      <span aria-hidden className="text-[0.6875rem]">
        {label}
      </span>
    </button>
  )
}

function Jump({
  label,
  target,
  go,
  danger = false,
}: {
  label: string
  target: number | null
  go: (step: number) => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={target === null}
      onClick={() => {
        if (target !== null) go(target)
      }}
      className={[
        'rounded-full border px-2.5 py-0.5 font-sans text-micro transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        // Vermilion only when there is a violation ahead to jump to.
        danger && target !== null
          ? 'border-vermilion text-vermilion hover:bg-vermilion hover:text-stock-pale'
          : 'border-ink-rule text-ink-soft hover:border-ink-edge hover:text-ink',
      ].join(' ')}
    >
      ⇥ {label}
    </button>
  )
}
