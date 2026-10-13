'use client'

/**
 * What just happened, as a caption under the stage.
 *
 * The sentence sits beneath the picture it describes, like a subtitle, so the eye
 * does not travel to a card above the fold to find out what the ring just did. Under
 * it, the same event in the paper's vocabulary — fields and the Figure 2 citation —
 * quoted from `lib/timeline/eventDetail.ts`, never paraphrased.
 */

import type { Dictionary, Locale } from '@/lib/i18n'
import { narrateEvent } from '@/lib/narrate'
import type { TraceStep } from '@/lib/sim/trace'
import { eventCitation, eventFields } from '@/lib/timeline/eventDetail'

export function EventCaption({ step, dict, locale }: { step: TraceStep; dict: Dictionary; locale: Locale }) {
  const citation = eventCitation(step.event)
  return (
    <section aria-label={dict.plain.whatHappening} className="rounded-panel bg-stock-deep px-4 py-3">
      <h2 className="sr-only">{dict.plain.whatHappening}</h2>
      <p className="font-serif text-lede leading-snug text-ink">{narrateEvent(step.event, locale)}</p>
      <dl className="mt-2 flex flex-wrap gap-x-3.5 gap-y-0.5 font-mono text-micro tabular text-ink-soft">
        {eventFields(step.event).map((field) => (
          <div key={field.key} className="flex gap-1">
            <dt className="text-ink-faint">{dict.eventDetail[field.key]}</dt>
            <dd>
              {(field.key === 'accepted' || field.key === 'duplicate') && field.value === 'yes'
                ? dict.eventDetail.yes
                : (field.key === 'accepted' || field.key === 'duplicate') && field.value === 'no'
                  ? dict.eventDetail.no
                  : field.value}
            </dd>
          </div>
        ))}
      </dl>
      {citation !== null && <p className="mt-1 font-mono text-micro text-ink-faint">{citation}</p>}
    </section>
  )
}
