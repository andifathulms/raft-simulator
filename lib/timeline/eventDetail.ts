/**
 * Structured description of a trace event, for the event-detail panel.
 * DESIGN-REWORK.md §3.3: "Render the event as what it is — a discriminated union
 * with fields — ... sender, receiver, RPC type, term, and the Figure 2 [citation]."
 *
 * Citations here name only the RPC section a message is *defined* under — e.g.
 * "Figure 2, AppendEntries RPC, Arguments" — quoted verbatim from the doc comment on
 * that message's type in `lib/raft/types.ts`. They deliberately do not name which
 * numbered *receiver* rule fired to produce this specific outcome (e.g. why a
 * particular vote was refused): pinning that down would mean either re-implementing
 * the algorithm's branching logic here, which invariant 11 forbids ("no component
 * computes algorithm state ... or decides what happened"), or recording it at the
 * source in `lib/raft`, out of scope for this change. What's below is exactly what's
 * knowable from `message.type` alone, and it is quoted, not paraphrased.
 */

import type { Message, MessageType } from '@/lib/raft/types'
import type { TraceEvent } from '@/lib/sim/trace'

const FIGURE2_CITATIONS: Record<MessageType, string> = {
  RequestVote: 'Figure 2, RequestVote RPC, Arguments.',
  RequestVoteResponse: 'Figure 2, RequestVote RPC, Results.',
  AppendEntries: 'Figure 2, AppendEntries RPC, Arguments.',
  AppendEntriesResponse: 'Figure 2, AppendEntries RPC, Results — plus matchIndex.',
  InstallSnapshot: 'Figure 13, InstallSnapshot RPC, Arguments.',
  InstallSnapshotResponse: 'Figure 13, InstallSnapshot RPC, Results — plus the acknowledged index.',
}

/** The citation quoted verbatim from `lib/raft/types.ts` for this message's type. */
export function figure2Citation(type: MessageType): string {
  return FIGURE2_CITATIONS[type]
}

/** The citation for this event, if it carries one — only `deliver` and `drop` do. */
export function eventCitation(event: TraceEvent): string | null {
  switch (event.kind) {
    case 'deliver':
    case 'drop':
      return figure2Citation(event.message.type)
    default:
      return null
  }
}

/** A field's translation key (into `dict.eventDetail`) and its already-final value. */
export interface EventField {
  readonly key: keyof import('@/lib/i18n').Dictionary['eventDetail']
  readonly value: string
}

function messageFields(message: Message): EventField[] {
  return [
    { key: 'sender', value: `n${message.from}` },
    { key: 'receiver', value: `n${message.to}` },
    { key: 'rpc', value: message.type },
    { key: 'term', value: String(message.term) },
  ]
}

/** One row per structurally meaningful field this event actually carries. */
export function eventFields(event: TraceEvent): readonly EventField[] {
  switch (event.kind) {
    case 'start':
    case 'heal':
      return []
    case 'deliver':
      return event.isDuplicate
        ? [...messageFields(event.message), { key: 'duplicate', value: 'yes' }]
        : messageFields(event.message)
    case 'drop':
      return [...messageFields(event.message), { key: 'reason', value: event.reason }]
    case 'timer':
      return [
        { key: 'node', value: `n${event.node}` },
        { key: 'timer', value: event.timer },
      ]
    case 'client-request':
      return [
        { key: 'node', value: `n${event.node}` },
        { key: 'command', value: event.command },
        { key: 'accepted', value: event.accepted ? 'yes' : 'no' },
        ...(event.redirectedTo !== null
          ? [{ key: 'redirectedTo' as const, value: `n${event.redirectedTo}` }]
          : []),
      ]
    case 'crash':
    case 'restart':
      return [{ key: 'node', value: `n${event.node}` }]
    case 'partition':
      return [{ key: 'groups', value: event.partitionOf.join(',') }]
    case 'change-configuration':
      return [
        { key: 'node', value: `n${event.node}` },
        { key: 'servers', value: `{${event.servers.join(',')}}` },
        { key: 'accepted', value: event.accepted ? 'yes' : 'no' },
        ...(event.redirectedTo !== null
          ? [{ key: 'redirectedTo' as const, value: `n${event.redirectedTo}` }]
          : []),
      ]
    default: {
      const unreachable: never = event
      throw new Error(`Unhandled event: ${JSON.stringify(unreachable)}`)
    }
  }
}
