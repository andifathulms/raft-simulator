'use client'

/**
 * The home page's hero: the real simulator, running the clean-election scenario.
 *
 * Not an animation drawn to look like Raft — the same worker, the same trace and the
 * same ring as the workbench, played back on a loop. The most convincing thing this
 * project has is a cluster electing a leader, and a reader should see it before they
 * read a word about it.
 *
 * Playback is UI timing only and never feeds the simulation. Under
 * `prefers-reduced-motion` it does not play: it holds one representative frame — a
 * leader elected and entries replicating — and stays there.
 */

import { useEffect, useMemo, useState } from 'react'
import { NodeRing } from '@/components/cluster/NodeRing'
import { scenarioById } from '@/data/scenarios'
import type { Dictionary, Locale } from '@/lib/i18n'
import { narrateEvent } from '@/lib/narrate'
import { UNMODIFIED_RAFT } from '@/lib/raft/rules'
import { specFromShare } from '@/lib/share'
import { commitSteps } from '@/lib/sim/trace'
import { useSimulation } from '@/lib/useSimulation'

const SCENARIO = 'clean-election'
const FRAME_MS = 140

export function LiveCluster({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const spec = useMemo(
    () =>
      specFromShare({
        scenarioId: SCENARIO,
        seed: scenarioById(SCENARIO).spec.seed,
        flags: UNMODIFIED_RAFT,
        extraActions: [],
        step: null,
      }),
    [],
  )
  const { trace } = useSimulation(spec)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (trace === null) return
    const last = trace.steps.length - 1
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      // A frame worth holding: just after the first commit, leader in place.
      setStep(Math.min(last, (commitSteps(trace)[0] ?? Math.floor(last / 3)) + 1))
      return
    }
    const interval = window.setInterval(() => {
      // Loop the opening — the election and the first commits — rather than the
      // long steady state that follows, which is the same heartbeat repeated.
      const loopEnd = Math.min(last, (commitSteps(trace)[2] ?? last) + 40)
      setStep((current) => (current >= loopEnd ? 0 : current + 1))
    }, FRAME_MS)
    return () => window.clearInterval(interval)
  }, [trace])

  const current = trace?.steps[step] ?? null

  return (
    <figure className="flex flex-col gap-3">
      <div className="stage relative aspect-square w-full p-3 shadow-card">
        {current === null ? (
          <div className="flex h-full items-center justify-center font-sans text-label text-ink-faint">
            {dict.sim.computing}
          </div>
        ) : (
          <NodeRing step={current} dict={dict} selected={null} onSelect={() => undefined} bare />
        )}
      </div>
      <figcaption className="flex min-h-[3.25rem] flex-col gap-0.5 px-1">
        <span className="font-serif text-body leading-snug text-ink" aria-live="off">
          {current === null ? ' ' : narrateEvent(current.event, locale)}
        </span>
        <span className="font-mono text-micro text-ink-faint">{dict.landing.liveCaption}</span>
      </figcaption>
    </figure>
  )
}
