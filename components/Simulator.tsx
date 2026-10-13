'use client'

/**
 * The simulation workbench: cluster, ledger, invariants, timeline, ablation.
 *
 * Everything on this page is a rendering of the trace. Nothing here computes
 * algorithm state or evaluates a property — when a component needs to know whether an
 * entry is committed, it reads `commitIndex` from the trace, and when it needs to
 * know whether Log Matching holds, it reads the checker's verdict.
 *
 * One screen, not a scroll. The toolbar says what is running and whether Raft's five
 * promises hold; the stage, the ledger and the rules sit side by side; the transport
 * and the history dock to the bottom edge, always in reach of the picture they move.
 * The previous layout stacked these vertically and put the play button about 1,400px
 * below the cluster it played.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AblationPanel } from '@/components/ablation/AblationPanel'
import { NodeRing } from '@/components/cluster/NodeRing'
import { InvariantPanel } from '@/components/invariants/InvariantPanel'
import { LogLedger } from '@/components/ledger/LogLedger'
import { RunSummary } from '@/components/RunSummary'
import { GuideContent, GuideHint } from '@/components/SimGuide'
import { Timeline, nextAfter, previousBefore } from '@/components/timeline/Timeline'
import { Dialog } from '@/components/workbench/Dialog'
import { EventCaption } from '@/components/workbench/EventCaption'
import { HazardBand, ModifiedWatermark } from '@/components/workbench/HazardBand'
import { SafetyLights, SafetyStrip } from '@/components/workbench/SafetyStrip'
import { ScenarioPicker } from '@/components/workbench/ScenarioPicker'
import { SCENARIOS, scenarioById } from '@/data/scenarios'
import { dictionary, type Locale } from '@/lib/i18n'
import type { SafetyProperty } from '@/lib/invariants/types'
import { UNMODIFIED_RAFT, type AblationFlagName } from '@/lib/raft/rules'
import { decodeShare, encodeShare, specFromShare, type ShareState } from '@/lib/share'
import type { Action } from '@/lib/sim/simulation'
import { commitSteps, electionSteps, termChangeSteps, violationSteps } from '@/lib/sim/trace'
import { useSimulation } from '@/lib/useSimulation'

export function Simulator({ locale }: { locale: Locale }) {
  const dict = dictionary(locale)
  const [share, setShare] = useState<ShareState>(() => ({
    scenarioId: SCENARIOS[0]?.id ?? 'clean-election',
    seed: SCENARIOS[0]?.spec.seed ?? 1,
    flags: UNMODIFIED_RAFT,
    extraActions: [],
    step: null,
  }))
  const [hydrated, setHydrated] = useState(false)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const [selected, setSelected] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [railTab, setRailTab] = useState<'rules' | 'safety'>('rules')
  const [focusProperty, setFocusProperty] = useState<SafetyProperty | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)

  // The hash is the whole state, so a shared link reproduces the run exactly —
  // including any violation, and including the fact that a rule was switched off.
  useEffect(() => {
    const load = () => {
      const decoded = decodeShare(window.location.hash)
      setShare(decoded)
      if (decoded.step !== null) setStep(decoded.step)
      setHydrated(true)
    }
    load()
    // Also on `hashchange`, which is how the browser's back button, and a link from
    // the scenario or ablation page while already on this one, arrive. Without this
    // the URL would say one thing and the run would be another.
    window.addEventListener('hashchange', load)
    return () => window.removeEventListener('hashchange', load)
  }, [])

  const spec = useMemo(() => specFromShare(share), [share])
  const { trace, running, error } = useSimulation(spec)

  useEffect(() => {
    if (!hydrated) return
    const hash = encodeShare({ ...share, step: null })
    if (window.location.hash.slice(1) !== hash) {
      window.history.replaceState(null, '', `#${hash}`)
    }
    setCopied(false)
  }, [share, hydrated])

  useEffect(() => {
    if (trace === null) return
    setStep((current) => Math.min(current, Math.max(0, trace.steps.length - 1)))
  }, [trace])

  const marks = useMemo(() => {
    if (trace === null) return { terms: [], elections: [], commits: [], violations: [] }
    return {
      terms: termChangeSteps(trace),
      elections: electionSteps(trace),
      commits: commitSteps(trace),
      violations: violationSteps(trace),
    }
  }, [trace])

  const current = trace?.steps[step] ?? null

  const addAction = useCallback((action: Action) => {
    setPlaying(false)
    setShare((state) => ({ ...state, extraActions: [...state.extraActions, action] }))
  }, [])

  const onNodeAction = useCallback(
    (node: number, kind: 'crash' | 'restart' | 'isolate') => {
      if (current === null) return
      // Actions land at the moment being viewed, so direct manipulation composes
      // with the scenario script rather than fighting it.
      const at = current.time + 1
      if (kind === 'isolate') {
        const partitionOf = current.nodes.map((_, id) => (id === node ? 1 : 0))
        addAction({ at, kind: 'partition', partitionOf })
        return
      }
      addAction({ at, kind, node })
    },
    [current, addAction],
  )

  const onSubmitEntry = useCallback(
    (node: number) => {
      if (current === null) return
      const ordinal = share.extraActions.filter((a) => a.kind === 'client-request').length + 1
      addAction({ at: current.time + 1, kind: 'client-request', node, command: `entry ${ordinal}` })
    },
    [current, share.extraActions, addAction],
  )

  const onToggle = useCallback((flag: AblationFlagName, enabled: boolean) => {
    setPlaying(false)
    setShare((state) => ({ ...state, flags: { ...state.flags, [flag]: enabled } }))
  }, [])

  const definition = scenarioById(share.scenarioId)

  // Every moment worth landing on, in order — what J and K walk between.
  const notable = useMemo(
    () =>
      Array.from(new Set([...marks.terms, ...marks.elections, ...marks.commits, ...marks.violations])).sort(
        (a, b) => a - b,
      ),
    [marks],
  )

  const jump = useCallback((target: number) => {
    setPlaying(false)
    setStep(target)
  }, [])

  const chooseScenario = useCallback((id: string) => {
    const chosen = scenarioById(id)
    setPlaying(false)
    setStep(0)
    setShare({
      scenarioId: id,
      seed: chosen.spec.seed,
      flags: chosen.spec.flags,
      extraActions: [],
      step: null,
    })
  }, [])

  const showProperty = useCallback((property: SafetyProperty) => {
    setRailTab('safety')
    setFocusProperty(property)
    window.requestAnimationFrame(() =>
      document.getElementById(`safety-${property}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    )
  }, [])

  // A button, not an `#ablation-…` link: the hash is the share state, and a fragment
  // link would replace it — which reset the whole run to the first scenario.
  const showRule = useCallback((flag: AblationFlagName) => {
    setRailTab('rules')
    window.requestAnimationFrame(() =>
      document.getElementById(`ablation-${flag}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    )
  }, [])

  // Keyboard: space, arrows, J/K, Home/End, G, ?. Nothing fires while typing in a
  // field or while a dialog is open, and Space is left to a focused button so it
  // presses that button rather than also toggling playback.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, select, textarea, [contenteditable="true"], dialog[open]') != null) return
      if (trace === null) return
      const last = trace.steps.length - 1
      const onControl = target?.closest('button, a, [role="switch"], [role="option"]') != null
      switch (event.key) {
        case ' ':
          if (onControl) return
          event.preventDefault()
          setPlaying((state) => !state)
          return
        case 'ArrowLeft':
          event.preventDefault()
          jump(Math.max(0, step - (event.shiftKey ? 10 : 1)))
          return
        case 'ArrowRight':
          event.preventDefault()
          jump(Math.min(last, step + (event.shiftKey ? 10 : 1)))
          return
        case 'Home':
          event.preventDefault()
          jump(0)
          return
        case 'End':
          event.preventDefault()
          jump(last)
          return
        case 'j':
        case 'J': {
          const target = previousBefore(notable, step)
          if (target !== null) jump(target)
          return
        }
        case 'k':
        case 'K': {
          const target = nextAfter(notable, step)
          if (target !== null) jump(target)
          return
        }
        case 'g':
        case 'G':
          setGuideOpen(true)
          return
        case '?':
          setKeysOpen(true)
          return
        default:
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [trace, step, notable, jump])

  const restore = useCallback(() => {
    setPlaying(false)
    setShare((state) => ({ ...state, flags: UNMODIFIED_RAFT }))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* Loudest of the three Modified Raft marks. Above everything, so it is the
          first thing read and the last thing a screenshot can crop away. */}
      <HazardBand flags={share.flags} dict={dict} onRestore={restore} />

      {/* ---- The toolbar: what is running, and whether Raft is holding. ---- */}
      <section className="card flex flex-col gap-2.5 px-3 py-2.5" aria-label={dict.nav.scenarios}>
        <div className="flex flex-wrap items-center gap-2">
          <ScenarioPicker value={share.scenarioId} onChange={chooseScenario} dict={dict} locale={locale} />
          <label className="flex items-center gap-1.5">
            <span className="font-sans text-micro text-ink-faint">{dict.sim.seed}</span>
            <input
              type="number"
              value={share.seed}
              onChange={(event) => {
                const seed = Number(event.target.value)
                if (!Number.isInteger(seed)) return
                setPlaying(false)
                setShare((state) => ({ ...state, seed }))
              }}
              className="input w-20 py-1.5 font-mono tabular"
            />
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPlaying(false)
                setStep(0)
                setShare((state) => ({ ...state, extraActions: [] }))
              }}
              className="btn"
            >
              <span aria-hidden>↻</span> {dict.sim.rerun}
            </button>
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}#${encodeShare({
                  ...share,
                  step,
                })}`
                void navigator.clipboard?.writeText(url).then(() => setCopied(true))
              }}
              className="btn"
            >
              <span aria-hidden>⧉</span> {copied ? dict.sim.shared : dict.sim.share}
            </button>
            <button type="button" onClick={() => setGuideOpen(true)} className="btn" title={`${dict.workbench.guide} (G)`}>
              {dict.workbench.guide}
            </button>
          </div>
          {trace !== null && (
            <div className="hidden xl:ml-auto xl:block">
              <SafetyStrip violations={trace.violations} upToStep={step} dict={dict} onSelect={showProperty} />
            </div>
          )}
        </div>
        {trace !== null && (
          <div className="xl:hidden">
            <div className="hidden sm:block">
              <SafetyStrip violations={trace.violations} upToStep={step} dict={dict} onSelect={showProperty} />
            </div>
            <div className="sm:hidden">
              <SafetyLights violations={trace.violations} upToStep={step} dict={dict} onSelect={showProperty} />
            </div>
          </div>
        )}
        <details className="group border-t border-ink-rule pt-2">
          <summary className="flex cursor-pointer list-none items-baseline gap-2 font-sans text-label text-ink-soft [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">{definition.summary[locale]}</span>
            <span className="shrink-0 font-sans text-micro text-ink-faint underline decoration-dotted underline-offset-2 group-open:hidden">
              {dict.scenarios.phenomenon}
            </span>
          </summary>
          <p className="mt-1.5 max-w-3xl font-sans text-micro leading-relaxed text-ink-faint">
            {definition.phenomenon[locale]}
            <span className="ml-2 font-mono">{definition.id}</span>
          </p>
        </details>
      </section>

      {error !== null && (
        <p className="rounded-panel border border-vermilion bg-vermilion/5 px-3 py-2 font-mono text-label text-vermilion">
          {error}
        </p>
      )}

      {trace === null || current === null ? (
        <WorkbenchSkeleton label={running ? dict.sim.computing : '—'} />
      ) : (
        <>
          {/*
           * The workbench split, three ways. Stage at a fixed 25rem — sized to the
           * ring — the ledger taking the unbounded remainder, and the rules rail at
           * 21rem from 1360px, the narrowest width at which the ledger still gets
           * ~600px for five columns. Between `lg` and 1360px the rail drops below and
           * spans both columns; below `lg` everything stacks.
           */}
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] min-[1360px]:grid-cols-[minmax(0,25rem)_minmax(0,1fr)_minmax(0,21rem)]">
            <section className="card min-w-0" aria-label={dict.sim.cluster}>
              <div className="panel-head">
                <h2 className="panel-title">{dict.sim.cluster}</h2>
                <span className="ml-auto font-mono text-micro tabular text-ink-faint">
                  {dict.sim.time.toLowerCase()} {current.time}
                </span>
              </div>
              <div className="flex flex-col gap-3 p-3">
                <div className="stage relative p-2">
                  <ModifiedWatermark flags={share.flags} dict={dict} />
                  <NodeRing
                    step={current}
                    dict={dict}
                    selected={selected}
                    onSelect={setSelected}
                    onNodeAction={onNodeAction}
                  />
                </div>
                {/* The sentence sits under the picture it describes, like a subtitle. */}
                <EventCaption step={current} dict={dict} locale={locale} />
                <div className="flex flex-col gap-1.5">
                  <h3 className="field-label">{dict.sim.submit}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {current.nodes.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => onSubmitEntry(node.id)}
                        title={dict.sim.submitHint}
                        className="btn btn-small font-mono"
                      >
                        + n{node.id}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => addAction({ at: current.time + 1, kind: 'heal' })}
                      className="btn btn-small ml-auto"
                    >
                      {dict.sim.heal}
                    </button>
                  </div>
                  <p className="font-sans text-micro text-ink-faint">{dict.sim.submitHint}</p>
                </div>
              </div>
            </section>

            <section className="card min-w-0" aria-label={dict.sim.ledger}>
              <div className="panel-head">
                <h2 className="panel-title">{dict.sim.ledger}</h2>
                <span className="ml-auto font-mono text-micro text-ink-faint">index × node</span>
              </div>
              <div className="min-w-0 p-3">
                <LogLedger step={current} dict={dict} />
              </div>
            </section>

            {/*
             * The rail. Rules is the default tab and the first one, always: ablation
             * is the differentiator, and a reader who never finds it has used a worse
             * RaftScope. Safety holds the full invariant panel the strip summarises.
             */}
            <aside
              className="card min-w-0 lg:col-span-2 min-[1360px]:sticky min-[1360px]:top-[4.5rem] min-[1360px]:col-span-1 min-[1360px]:max-h-[calc(100vh-15rem)] min-[1360px]:overflow-y-auto"
              aria-label={`${dict.workbench.rules} · ${dict.workbench.safety}`}
            >
              <div
                role="tablist"
                aria-label={`${dict.workbench.rules} · ${dict.workbench.safety}`}
                className="sticky top-0 z-10 m-2 flex gap-0.5 rounded-control bg-stock-deep p-[3px]"
              >
                {(['rules', 'safety'] as const).map((tab) => {
                  const brokenCount = new Set(
                    trace.violations.filter((v) => v.stepIndex <= step).map((v) => v.property),
                  ).size
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      id={`rail-tab-${tab}`}
                      aria-selected={railTab === tab}
                      aria-controls={`rail-panel-${tab}`}
                      onClick={() => setRailTab(tab)}
                      className={[
                        'flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 py-1.5 font-sans text-label transition-colors',
                        railTab === tab ? 'bg-stock-raised font-semibold text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
                      ].join(' ')}
                    >
                      {tab === 'rules' ? dict.workbench.rules : dict.workbench.safety}
                      {tab === 'safety' && brokenCount > 0 && (
                        <span className="rounded-full bg-vermilion px-1.5 font-mono text-[0.625rem] font-bold text-stock-pale">
                          {brokenCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="px-3 pb-3">
                {railTab === 'rules' ? (
                  <div id="rail-panel-rules" role="tabpanel" aria-labelledby="rail-tab-rules" className="flex flex-col gap-3">
                    <GuideHint dict={dict} onOpen={() => setGuideOpen(true)} />
                    <p className="font-sans text-micro leading-relaxed text-ink-soft">{dict.plain.ablationHelp}</p>
                    <AblationPanel
                      flags={share.flags}
                      onToggle={onToggle}
                      onReset={restore}
                      dict={dict}
                      locale={locale}
                      compact
                      violations={trace.violations}
                      upToStep={step}
                      onJump={jump}
                    />
                  </div>
                ) : (
                  <div id="rail-panel-safety" role="tabpanel" aria-labelledby="rail-tab-safety" className="flex flex-col gap-3">
                    <div className="rounded-panel bg-stock-pale px-3 py-2.5">
                      <h3 className="field-label">{dict.workbench.runSoFar}</h3>
                      <div className="mt-1.5">
                        <RunSummary
                          step={current}
                          elections={marks.elections.filter((s) => s <= step).length}
                          violations={trace.violations.filter((v) => v.stepIndex <= step)}
                          flags={share.flags}
                          dict={dict}
                          locale={locale}
                          variant="sentences"
                        />
                      </div>
                    </div>
                    <p className="font-sans text-micro leading-relaxed text-ink-soft">{dict.plain.invariantsHelp}</p>
                    <InvariantPanel
                      violations={trace.violations}
                      upToStep={step}
                      dict={dict}
                      flags={share.flags}
                      onJump={jump}
                      onRule={showRule}
                      focus={focusProperty}
                    />
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/*
           * The dock. Sticky to the viewport's bottom edge while the workbench is on
           * screen, so play, the playhead and the history never scroll away from the
           * picture they move; it comes to rest at the end of the workbench.
           */}
          <div
            className="sticky bottom-0 z-20 -mx-4 border-t border-ink-rule bg-stock-raised/95 px-4 pt-3 shadow-[0_-10px_30px_-18px_rgb(20_25_23/0.35)] backdrop-blur-md sm:-mx-6 sm:px-6"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <Timeline
              trace={trace}
              step={step}
              onStep={setStep}
              playing={playing}
              onPlaying={setPlaying}
              speed={speed}
              onSpeed={setSpeed}
              marks={marks}
              dict={dict}
              onShortcuts={() => setKeysOpen(true)}
              summary={
                <RunSummary
                  step={current}
                  elections={marks.elections.filter((s) => s <= step).length}
                  violations={trace.violations.filter((v) => v.stepIndex <= step)}
                  flags={share.flags}
                  dict={dict}
                  locale={locale}
                  variant="dock"
                />
              }
            />
          </div>
        </>
      )}

      <Dialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title={dict.plain.newHere}
        closeLabel={dict.workbench.close}
        wide
      >
        <GuideContent dict={dict} />
      </Dialog>

      <Dialog
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        title={dict.workbench.shortcuts}
        closeLabel={dict.workbench.close}
      >
        <dl className="flex flex-col">
          {dict.workbench.keys.map((entry) => (
            <div key={entry.keys} className="flex items-center gap-4 border-b border-ink-rule py-2 last:border-b-0">
              <dt className="flex w-28 shrink-0 gap-1">
                {entry.keys.split('  ').map((key) => (
                  <kbd key={key} className="kbd">
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="font-sans text-label text-ink-soft">{entry.does}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  )
}

/** Shaped like the workbench it stands in for, so nothing jumps when the trace lands. */
function WorkbenchSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] min-[1360px]:grid-cols-[minmax(0,25rem)_minmax(0,1fr)_minmax(0,21rem)]">
      <div className="card flex aspect-square items-center justify-center p-3">
        <div className="stage flex h-full w-full animate-pulse items-center justify-center">
          <p className="font-sans text-label text-ink-faint">{label}</p>
        </div>
      </div>
      <div className="card hidden h-80 animate-pulse lg:block" />
      <div className="card hidden h-80 animate-pulse min-[1360px]:block" />
    </div>
  )
}
