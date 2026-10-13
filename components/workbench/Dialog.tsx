'use client'

/**
 * A modal sheet on the native <dialog> element: `showModal()` gives focus
 * containment, Escape to close and an inert page behind it, with no library and no
 * hand-rolled focus trap to get subtly wrong.
 */

import { useEffect, useRef } from 'react'

interface Props {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly closeLabel: string
  readonly children: React.ReactNode
  readonly wide?: boolean
}

export function Dialog({ open, onClose, title, closeLabel, children, wide = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself, not its content.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      aria-label={title}
      className={[
        'w-[calc(100vw-2rem)] rounded-stage border border-ink-rule bg-stock-raised p-0 text-ink shadow-lift backdrop:bg-stock-deep/75 backdrop:backdrop-blur-[2px]',
        wide ? 'max-w-3xl' : 'max-w-md',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 border-b border-ink-rule px-5 py-3.5">
        <h2 className="font-serif text-panel font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="btn btn-small ml-auto">
          {closeLabel}
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  )
}
