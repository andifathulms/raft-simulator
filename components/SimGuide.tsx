'use client'

/**
 * "What am I looking at."
 *
 * The workbench is dense on purpose, and dense is fine once you know the vocabulary.
 * This is where the vocabulary lives: the four node states and the eight message
 * labels, each said in a sentence rather than defined by a key.
 *
 * It used to be a card in the workbench's scroll. The workbench is one screen now, so
 * the guide is a sheet opened from the toolbar (or `G`), and a first-visit hint in
 * the rail points at it until dismissed. The dismissal persists in `localStorage` —
 * a first-run hint that never remembers being dismissed becomes chrome.
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
    // The hint simply reappears every visit then.
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

/** The legend and the message glossary, for the guide sheet. */
export function GuideContent({ dict }: { dict: Dictionary }) {
  const roles: { role: Role; crashed?: boolean; name: string; body: string }[] = [
    { role: 'leader', name: dict.roles.leader, body: dict.plain.roles.leader },
    { role: 'follower', name: dict.roles.follower, body: dict.plain.roles.follower },
    { role: 'candidate', name: dict.roles.candidate, body: dict.plain.roles.candidate },
    { role: 'follower', crashed: true, name: dict.roles.crashed, body: dict.plain.roles.crashed },
  ]

  return (
    // Two blocks of genuinely equal weight, so an even 1fr/1fr is the shape.
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h3 className="field-label">{dict.plain.legendTitle}</h3>
        <p className="mt-2 max-w-prose font-sans text-label leading-relaxed text-ink-soft">
          {dict.plain.clusterHelp}
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {roles.map((entry) => (
            <li key={entry.name} className="flex items-start gap-3">
              <RoleGlyph role={entry.role} crashed={entry.crashed} size={28} />
              <div className="min-w-0">
                <p className="font-sans text-label font-semibold">{entry.name}</p>
                <p className="mt-0.5 font-sans text-micro leading-relaxed text-ink-soft">{entry.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-sans text-micro leading-relaxed text-ink-soft">{dict.plain.ledgerHelp}</p>
      </div>

      <div>
        <h3 className="field-label">{dict.plain.messagesTitle}</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {dict.plain.messages.map((message) => (
            <li key={message.code} className="flex items-baseline gap-2.5">
              <span className="chip w-14 shrink-0 justify-center text-ink">{message.code}</span>
              <span className="font-sans text-micro leading-relaxed text-ink-soft">{message.body}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** The first-visit pointer at the guide. Gone for good once dismissed or opened. */
export function GuideHint({ dict, onOpen }: { dict: Dictionary; onOpen: () => void }) {
  // Hidden on the server and first client frame, shown after mount only if never
  // dismissed: a returning reader never sees it flash.
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!readDismissed()) setShow(true)
  }, [])

  if (!show) return null
  const dismiss = () => {
    setShow(false)
    writeDismissed(true)
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-panel border border-ink-rule bg-stock-pale px-3.5 py-3">
      <p className="font-sans text-label leading-snug text-ink-soft">{dict.workbench.guideHint}</p>
      <div className="flex gap-1.5">
        <button
          type="button"
          className="btn btn-small btn-strong"
          onClick={() => {
            dismiss()
            onOpen()
          }}
        >
          {dict.workbench.guide}
        </button>
        <button type="button" className="btn btn-small" onClick={dismiss}>
          {dict.workbench.dismiss}
        </button>
      </div>
    </div>
  )
}
