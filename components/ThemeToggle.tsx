'use client'

/**
 * System → light → dark. The choice is stored in `localStorage` and applied as
 * `data-theme` on <html>; "system" removes the attribute and lets
 * `prefers-color-scheme` decide. The inline script in app/layout.tsx applies a stored
 * choice before first paint, so a reader who chose dark never sees a light flash.
 *
 * Theme is presentation only: nothing here reaches the simulation.
 */

import { useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'

export const THEME_KEY = 'raft-simulator:theme'
type Theme = 'system' | 'light' | 'dark'
const ORDER: readonly Theme[] = ['system', 'light', 'dark']

function read(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function apply(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try {
    if (theme === 'system') window.localStorage.removeItem(THEME_KEY)
    else window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Unavailable storage: the choice holds for this page view only.
  }
}

export function ThemeToggle({ dict }: { dict: Dictionary }) {
  // `system` on the server and first client frame; corrected after mount. The
  // attribute itself was already set by the pre-paint script, so only this
  // button's icon can be briefly out of date — never the page.
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => setTheme(read()), [])

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system'
  const label = `${dict.theme.label}: ${dict.theme[theme]}`

  return (
    <button
      type="button"
      onClick={() => {
        apply(next)
        setTheme(next)
      }}
      aria-label={`${label}. ${dict.theme.switchTo} ${dict.theme[next]}`}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-stock-deep hover:text-ink"
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden className="fill-none stroke-current" strokeWidth="1.5">
        {theme === 'light' && (
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" strokeLinecap="round" />
          </>
        )}
        {theme === 'dark' && <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" strokeLinejoin="round" />}
        {theme === 'system' && (
          <>
            <circle cx="8" cy="8" r="6" />
            <path d="M8 2a6 6 0 0 1 0 12z" className="fill-current" stroke="none" />
          </>
        )}
      </svg>
    </button>
  )
}
