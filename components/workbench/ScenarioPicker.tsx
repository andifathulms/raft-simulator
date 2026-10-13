'use client'

/**
 * The scenario picker: a searchable list grouped by reading-order track.
 *
 * A native <select> showed twelve titles in one flat list, with nothing to say which
 * is the place to start and which needs three others first. This groups them by the
 * same tracks as the library page, carries the network-tier mark, and filters as you
 * type. Hand-built — a combobox is a text input, a listbox, and a few keys.
 *
 * ARIA 1.2 combobox pattern: the input owns `aria-activedescendant`, the options are
 * `role="option"`, and focus never leaves the input while the list is open.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { NetworkTierMark } from '@/components/workbench/NetworkTierMark'
import { SCENARIOS, type ScenarioDefinition } from '@/data/scenarios'
import type { Dictionary, Locale } from '@/lib/i18n'
import { networkTier } from '@/lib/scenarios/tier'
import { TRACKS, trackOf, type Track } from '@/lib/scenarios/tracks'

interface Props {
  readonly value: string
  readonly onChange: (id: string) => void
  readonly dict: Dictionary
  readonly locale: Locale
}

export function ScenarioPicker({ value, onChange, dict, locale }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  const current = SCENARIOS.find((entry) => entry.id === value) ?? SCENARIOS[0]

  // Grouped, then flattened for keyboard order — arrow keys walk the list as it is
  // drawn, track by track.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = (entry: ScenarioDefinition) =>
      needle === '' ||
      entry.title[locale].toLowerCase().includes(needle) ||
      entry.id.includes(needle) ||
      entry.summary[locale].toLowerCase().includes(needle)
    return TRACKS.map((track) => ({
      track,
      entries: SCENARIOS.filter((entry) => trackOf(entry.id) === track && matches(entry)),
    })).filter((group) => group.entries.length > 0)
  }, [query, locale])
  const flat = useMemo(() => groups.flatMap((group) => group.entries), [groups])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, flat.findIndex((entry) => entry.id === value)))
    input.current?.focus()
    // Only on opening: while open, typing re-ranks and resets to the top instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const choose = (entry: ScenarioDefinition | undefined) => {
    if (entry === undefined) return
    onChange(entry.id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={root} className="relative min-w-0 flex-1 sm:max-w-md">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${dict.workbench.pickScenario}: ${current?.title[locale] ?? ''}`}
        className="flex w-full items-center gap-2.5 rounded-control border border-ink-edge bg-stock-raised px-3 py-1.5 text-left transition-colors hover:bg-stock-deep"
      >
        {current !== undefined && (
          <NetworkTierMark tier={networkTier(current.spec.network.dropPerMille)} dict={dict} />
        )}
        <span className="min-w-0 flex-1 truncate font-serif text-base font-semibold leading-snug">
          {current?.title[locale]}
        </span>
        <span aria-hidden className="text-micro text-ink-faint">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-ink-rule bg-stock-raised shadow-lift">
          <div className="border-b border-ink-rule p-2">
            <input
              ref={input}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={flat[active] === undefined ? undefined : `${listId}-${flat[active]?.id}`}
              aria-label={dict.workbench.search}
              placeholder={dict.workbench.search}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActive((index) => Math.min(flat.length - 1, index + 1))
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActive((index) => Math.max(0, index - 1))
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  choose(flat[active])
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setOpen(false)
                }
              }}
              className="input w-full"
            />
          </div>
          <ul id={listId} role="listbox" aria-label={dict.nav.scenarios} className="max-h-[min(26rem,60vh)] overflow-y-auto py-1">
            {groups.length === 0 && (
              <li className="px-3 py-4 font-sans text-label text-ink-faint">{dict.workbench.noMatch}</li>
            )}
            {groups.map((group) => (
              <li key={group.track} role="presentation">
                <TrackHeading track={group.track} dict={dict} />
                <ul role="group" aria-label={dict.tracks[group.track].title}>
                  {group.entries.map((entry) => {
                    const index = flat.indexOf(entry)
                    const selected = entry.id === value
                    return (
                      <li
                        key={entry.id}
                        id={`${listId}-${entry.id}`}
                        role="option"
                        aria-selected={selected}
                        onPointerEnter={() => setActive(index)}
                        onClick={() => choose(entry)}
                        className={[
                          'mx-1 flex cursor-pointer items-start gap-2.5 rounded-control px-2.5 py-2',
                          index === active ? 'bg-stock-deep' : '',
                        ].join(' ')}
                      >
                        <span className="mt-1.5">
                          <NetworkTierMark tier={networkTier(entry.spec.network.dropPerMille)} dict={dict} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className={['font-sans text-label', selected ? 'font-semibold' : 'font-medium'].join(' ')}>
                              {entry.title[locale]}
                            </span>
                            {entry.ablation !== undefined && trackOf(entry.id) === 'breaking' && (
                              <span className="font-mono text-[0.6875rem] text-vermilion">
                                {dict.invariants.names[entry.ablation.breaks]}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block font-sans text-micro leading-snug text-ink-faint">
                            {entry.summary[locale]}
                          </span>
                        </span>
                        {selected && (
                          <span aria-hidden className="mt-0.5 text-label text-ink">
                            ✓
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TrackHeading({ track, dict }: { track: Track; dict: Dictionary }) {
  return (
    <p className="field-label px-3.5 pb-1 pt-3" aria-hidden>
      {dict.tracks[track].title}
    </p>
  )
}
