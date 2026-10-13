'use client'

/**
 * The Modified Raft band across the top of the workbench.
 *
 * CLAUDE.md invariant 7: a run with any rule off is visibly and permanently
 * labelled. This is the loudest of three marks — this band, the struck light in the
 * safety strip, and the watermark inside the cluster stage — so that a screenshot of
 * a broken run carries the label however tightly it is cropped.
 *
 * Vermilion, because off means a broken run. Renders nothing for unmodified Raft.
 */

import type { Dictionary } from '@/lib/i18n'
import { ABLATION_FLAG_NAMES, isModifiedRaft, type AblationFlags } from '@/lib/raft/rules'

interface Props {
  readonly flags: AblationFlags
  readonly dict: Dictionary
  readonly onRestore: () => void
}

export function HazardBand({ flags, dict, onRestore }: Props) {
  if (!isModifiedRaft(flags)) return null
  const off = ABLATION_FLAG_NAMES.filter((flag) => !flags[flag])
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 overflow-hidden rounded-panel bg-vermilion py-2 pl-3 pr-2 text-stock-pale sm:pl-0"
    >
      {/* Hazard hatching: decorative, and kept off the text so the label holds its
          full 5.9:1 against the solid fill. */}
      <span
        aria-hidden
        className="-my-2 hidden w-10 shrink-0 self-stretch sm:block"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-45deg, rgb(var(--c-stock-pale) / 0.45) 0 5px, transparent 5px 10px)',
        }}
      />
      <p className="font-mono text-label font-bold tracking-[0.12em]">{dict.ablation.modified}</p>
      <p className="min-w-[12rem] flex-1 font-sans text-label">
        {off.map((flag) => dict.ablation.rules[flag]?.title ?? flag).join(' · ')}{' '}
        <span className="opacity-90">— {dict.workbench.notRaft}</span>
      </p>
      <button
        type="button"
        onClick={onRestore}
        className="rounded-control border border-stock-pale px-3 py-1 font-sans text-label font-semibold transition-colors hover:bg-stock-pale hover:text-vermilion"
      >
        {dict.workbench.restore}
      </button>
    </div>
  )
}

/** The in-stage mark: survives a screenshot cropped to just the cluster. */
export function ModifiedWatermark({ flags, dict }: { flags: AblationFlags; dict: Dictionary }) {
  if (!isModifiedRaft(flags)) return null
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-3 top-3 z-10 rounded border-[1.5px] border-vermilion bg-stock-raised px-1.5 py-0.5 font-mono text-[0.625rem] font-bold tracking-[0.12em] text-vermilion"
    >
      {dict.ablation.modified}
    </span>
  )
}
