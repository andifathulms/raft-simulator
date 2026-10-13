'use client'

/**
 * ⌘K / Ctrl+K: go anywhere — a page, a scenario, or a scenario with a rule
 * switched off — by typing a few letters of its name.
 *
 * Built on the native <dialog>, like the workbench's sheets: focus containment and
 * Escape come from the platform. The list is the ARIA combobox pattern — focus stays
 * in the input, `aria-activedescendant` names the highlighted row.
 */

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { SCENARIOS, scenarioForFlag } from '@/data/scenarios'
import type { Dictionary, Locale } from '@/lib/i18n'
import { ABLATION_FLAG_NAMES } from '@/lib/raft/rules'
import { flagCode } from '@/lib/share'

interface Item {
  readonly key: string
  readonly group: 'pages' | 'scenarios' | 'breakRule'
  readonly label: string
  readonly detail: string
  readonly href: string
  readonly breaks: boolean
}

export function CommandPalette({
  locale,
  dict,
  links,
}: {
  locale: Locale
  dict: Dictionary
  links: readonly { readonly href: string; readonly label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const router = useRouter()
  const pathname = usePathname() ?? ''

  const items = useMemo<Item[]>(
    () => [
      ...[{ href: `/${locale}`, label: 'Raft Simulator' }, ...links].map((link) => ({
        key: `page:${link.href}`,
        group: 'pages' as const,
        label: link.label,
        detail: link.href,
        href: link.href,
        breaks: false,
      })),
      ...SCENARIOS.map((entry) => ({
        key: `scenario:${entry.id}`,
        group: 'scenarios' as const,
        label: entry.title[locale],
        detail: entry.summary[locale],
        href: `/${locale}/simulasi/#s=${entry.id}`,
        breaks: false,
      })),
      ...ABLATION_FLAG_NAMES.map((flag) => {
        const scenario = scenarioForFlag(flag)
        return {
          key: `rule:${flag}`,
          group: 'breakRule' as const,
          label: dict.ablation.rules[flag]?.title ?? flag,
          detail: scenario.title[locale],
          href: `/${locale}/simulasi/#s=${scenario.id}&off=${flagCode(flag)}`,
          breaks: true,
        }
      }),
    ],
    [locale, dict, links],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return items
    return items.filter(
      (item) => item.label.toLowerCase().includes(needle) || item.detail.toLowerCase().includes(needle),
    )
  }, [items, query])

  const show = useCallback(() => {
    setQuery('')
    setActive(0)
    setOpen(true)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (open) setOpen(false)
        else show()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, show])

  useEffect(() => {
    const element = dialog.current
    if (element === null) return
    if (open && !element.open) {
      element.showModal()
      input.current?.focus()
    }
    if (!open && element.open) element.close()
  }, [open])

  const go = (item: Item | undefined) => {
    if (item === undefined) return
    setOpen(false)
    const [path = '', hash] = item.href.split('#')
    // Same page, new hash: set it directly, so the workbench's `hashchange` listener
    // reloads the run. A router push would update the URL without that event.
    const here = pathname.replace(/\/$/, '') === path.replace(/\/$/, '')
    if (hash !== undefined && here) {
      window.location.hash = hash
      return
    }
    router.push(item.href)
  }

  const groups: Item['group'][] = ['pages', 'scenarios', 'breakRule']

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={dict.palette.open}
        title={`${dict.palette.open} (⌘K)`}
        className="flex items-center gap-1.5 rounded-full border border-ink-rule bg-stock-raised py-1 pl-2.5 pr-1.5 font-sans text-micro text-ink-faint transition-colors hover:border-ink-edge hover:text-ink"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden className="fill-none stroke-current" strokeWidth="1.75">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 L14 14" strokeLinecap="round" />
        </svg>
        <span className="hidden md:inline">{dict.palette.hint}</span>
        <kbd className="kbd hidden md:inline-flex">⌘K</kbd>
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
        aria-label={dict.palette.open}
        className="mt-[12vh] w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-stage border border-ink-rule bg-stock-raised p-0 text-ink shadow-lift backdrop:bg-stock-deep/75 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex items-center gap-3 border-b border-ink-rule px-4">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="shrink-0 fill-none stroke-ink-faint" strokeWidth="1.75">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 L14 14" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={filtered[active] === undefined ? undefined : `${listId}-${active}`}
            aria-label={dict.palette.placeholder}
            placeholder={dict.palette.placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((index) => Math.min(filtered.length - 1, index + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((index) => Math.max(0, index - 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                go(filtered[active])
              }
            }}
            className="min-w-0 flex-1 bg-transparent py-3.5 font-sans text-body text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="kbd">esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label={dict.palette.open} className="max-h-[min(28rem,60vh)] overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center font-sans text-label text-ink-faint">{dict.palette.empty}</li>
          )}
          {groups.map((group) => {
            const rows = filtered.filter((item) => item.group === group)
            if (rows.length === 0) return null
            return (
              <li key={group} role="presentation">
                <p aria-hidden className="field-label px-4 pb-1 pt-3">
                  {dict.palette[group]}
                </p>
                <ul role="group" aria-label={dict.palette[group]}>
                  {rows.map((item) => {
                    const index = filtered.indexOf(item)
                    return (
                      <li
                        key={item.key}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === active}
                        onPointerEnter={() => setActive(index)}
                        onClick={() => go(item)}
                        className={[
                          'mx-1.5 flex cursor-pointer items-baseline gap-3 rounded-control px-3 py-2',
                          index === active ? 'bg-stock-deep' : '',
                        ].join(' ')}
                      >
                        <span className={['shrink-0 font-sans text-label font-medium', item.breaks ? 'text-vermilion' : 'text-ink'].join(' ')}>
                          {item.label}
                        </span>
                        <span className="min-w-0 truncate font-sans text-micro text-ink-faint">{item.detail}</span>
                        {index === active && (
                          <span aria-hidden className="ml-auto font-mono text-micro text-ink-faint">
                            ↵
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      </dialog>
    </>
  )
}
