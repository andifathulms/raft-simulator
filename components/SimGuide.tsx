'use client'

/**
 * "What am I looking at."
 *
 * The workbench is dense on purpose, and dense is fine once you know the vocabulary.
 * This is where the vocabulary lives: the four node states and the eight message
 * labels, each said in a sentence rather than defined by a key.
 *
 * Collapsed by default after the first visit, via `localStorage` — a first-run panel
 * that never remembers being dismissed becomes chrome. The server-rendered (and
 * first client) frame always shows it open, matching what a visitor with nothing
 * stored yet should see and avoiding a hydration mismatch; an effect corrects it
 * to closed right after mount if a previous visit dismissed it, so a returning
 * reader sees one brief open-then-closed flash rather than a mismatch warning.
 */

import { useEffect, useState } from 'react'
import { RoleGlyph } from '@/components/cluster/glyph'
import type { Dictionary } from '@/lib/i18n'
import type { Role } from '@/lib/raft/types'

const DISMISSED_KEY = 'raft-simulator:guide-dismissed'

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    // Storage can be unavailable — private browsing, quota, a locked-down embed.
    // The guide simply reopens every visit then, exactly today's behaviour.
    return false
  }
}

function writeDismissed(dismissed: boolean): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, dismissed ? '1' : '0')
  } catch {
    // Nothing to recover from; the preference just does not persist this time.
  }
}

export function SimGuide({ dict }: { dict: Dictionary }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (readDismissed()) setOpen(false)
  }, [])

  const roles: { role: Role; crashed?: boolean; name: string; body: string }[] = [
    { role: 'leader', name: dict.roles.leader, body: dict.plain.roles.leader },
    { role: 'follower', name: dict.roles.follower, body: dict.plain.roles.follower },
    { role: 'candidate', name: dict.roles.candidate, body: dict.plain.roles.candidate },
    { role: 'follower', crashed: true, name: dict.roles.crashed, body: dict.plain.roles.crashed },
  ]

  return (
    <section className="card">
      <div className="panel-head">
        <h2 className="panel-title">{dict.plain.newHere}</h2>
        <button
          type="button"
          onClick={() => {
            const next = !open
            setOpen(next)
            writeDismissed(!next)
          }}
          aria-expanded={open}
          className="ml-auto font-sans text-micro text-ink-faint underline underline-offset-2 hover:text-ink"
        >
          {open ? dict.plain.hide : dict.plain.guide}
        </button>
      </div>

      {open && (
        // The reference split: role legend and message glossary are two blocks of
        // genuinely equal weight, so an even 1fr/1fr is the shape, not a fixed
        // sidebar or rail sized to one side's own content — unlike the other two
        // two-column grids in the app (Simulator.tsx, ablasi/page.tsx), which are.
        // `lg` matches the rail split for the same reason: neither needs a fixed
        // element to fit as early as the workbench's 26rem sidebar does.
        <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="field-label">{dict.plain.legendTitle}</h3>
            <p className="mt-2 max-w-prose font-sans text-label leading-relaxed text-ink-soft">
              {dict.plain.clusterHelp}
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {roles.map((entry) => (
                <li key={entry.name} className="flex items-start gap-2.5">
                  <RoleGlyph role={entry.role} crashed={entry.crashed} size={24} />
                  <div className="min-w-0">
                    <p className="font-mono text-micro font-bold">{entry.name}</p>
                    <p className="mt-0.5 font-sans text-micro leading-relaxed text-ink-soft">
                      {entry.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="field-label">{dict.plain.messagesTitle}</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {dict.plain.messages.map((message) => (
                <li key={message.code} className="flex items-baseline gap-2.5">
                  <span className="chip w-14 shrink-0 justify-center text-ink">{message.code}</span>
                  <span className="font-sans text-micro leading-relaxed text-ink-soft">
                    {message.body}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
