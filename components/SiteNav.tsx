'use client'

/**
 * The site header's navigation.
 *
 * A client component only so it can mark the current section — without that, the
 * three destinations read as a flat list and nothing tells you where you are, which
 * is the one job a persistent nav has beyond linking.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CommandPalette } from '@/components/CommandPalette'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LOCALES, dictionary, type Locale } from '@/lib/i18n'

interface Props {
  readonly locale: Locale
  readonly links: readonly { readonly href: string; readonly label: string }[]
}

export function SiteNav({ locale, links }: Props) {
  const pathname = usePathname() ?? ''

  return (
    <nav className="ml-auto flex flex-wrap items-center gap-1 font-sans text-label">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'rounded-full px-3 py-1 transition-colors',
              active
                ? 'bg-ink font-semibold text-stock-pale'
                : 'text-ink-soft hover:bg-stock-deep hover:text-ink',
            ].join(' ')}
          >
            {link.label}
          </Link>
        )
      })}

      <span className="ml-2 flex items-center gap-1">
        <CommandPalette locale={locale} dict={dictionary(locale)} links={links} />
        <ThemeToggle dict={dictionary(locale)} />
      </span>

      {/* The locale switch keeps you where you are rather than dropping you home:
          changing language is not a request to lose your place. */}
      <span className="ml-2 flex items-center gap-1 border-l border-ink-rule pl-3 font-mono text-micro uppercase">
        {LOCALES.map((option) => {
          const rest = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) : ''
          return (
            <Link
              key={option}
              href={`/${option}${rest}`}
              aria-current={option === locale ? 'true' : undefined}
              className={
                option === locale
                  ? 'px-1 font-semibold text-ink'
                  : 'px-1 text-ink-faint hover:text-ink'
              }
            >
              {option}
            </Link>
          )
        })}
      </span>
    </nav>
  )
}
