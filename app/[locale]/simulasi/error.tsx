'use client'

/**
 * Route-level error boundary for the workbench.
 *
 * Worker errors are already surfaced as a vermilion box inside `Simulator.tsx` — that
 * path is correct and untouched. This catches the other failure mode: a render throw
 * inside `LogLedger`, `NodeRing`, `Timeline` or anything else on this page, which
 * would otherwise take the whole page down to Next's generic error screen.
 *
 * Nothing is lost on the way here. `(config, seed, actions, flags, step)` all live in
 * the URL hash, so the address bar still names the exact run that broke — `reset()`
 * re-renders this segment against that same unchanged URL.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DEFAULT_LOCALE, dictionary, isLocale } from '@/lib/i18n'

export default function SimulatorError({ error, reset }: { error: Error; reset: () => void }) {
  // error.tsx is not handed route params, only the error itself — the locale is
  // read from the URL the same way a client component anywhere else would.
  const pathname = usePathname()
  const segment = pathname.split('/')[1] ?? ''
  const locale = isLocale(segment) ? segment : DEFAULT_LOCALE
  const dict = dictionary(locale)

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error)
  }, [error])

  return (
    <div className="card border-l-4 border-l-vermilion p-6">
      <h1 className="font-serif text-lede text-ink">{dict.error.title}</h1>
      <p className="mt-2 max-w-prose font-sans text-body leading-relaxed text-ink-soft">
        {dict.error.body}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="btn btn-strong">
          {dict.error.retry}
        </button>
        <Link href={`/${locale}/skenario`} className="btn">
          {dict.error.backToScenarios}
        </Link>
      </div>
    </div>
  )
}
