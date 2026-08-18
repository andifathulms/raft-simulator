import { describe, expect, it } from 'vitest'
import { eventCitation, eventFields, figure2Citation } from '@/lib/timeline/eventDetail'
import { LOCALES, dictionary } from '@/lib/i18n'
import type { TraceEvent } from '@/lib/sim/trace'
import type { MessageType } from '@/lib/raft/types'

const MESSAGE_TYPES: readonly MessageType[] = [
  'RequestVote',
  'RequestVoteResponse',
  'AppendEntries',
  'AppendEntriesResponse',
  'InstallSnapshot',
  'InstallSnapshotResponse',
]

describe('figure2Citation', () => {
  it('names the right figure for every message type — Figure 2 for the replicated-log RPCs, Figure 13 for snapshots', () => {
    const RPC_NAME: Record<MessageType, string> = {
      RequestVote: 'RequestVote',
      RequestVoteResponse: 'RequestVote',
      AppendEntries: 'AppendEntries',
      AppendEntriesResponse: 'AppendEntries',
      InstallSnapshot: 'InstallSnapshot',
      InstallSnapshotResponse: 'InstallSnapshot',
    }
    for (const type of MESSAGE_TYPES) {
      const citation = figure2Citation(type)
      expect(citation).toContain(type === 'InstallSnapshot' || type === 'InstallSnapshotResponse' ? 'Figure 13' : 'Figure 2')
      expect(citation).toContain(RPC_NAME[type])
    }
  })

  it('is quoted verbatim from the doc comment in lib/raft/types.ts, not paraphrased', () => {
    // These strings are copied by hand from the /** ... */ comments above each
    // Message variant. If a comment there changes, this test is meant to catch the
    // drift, not silently keep passing with stale wording.
    expect(figure2Citation('RequestVote')).toBe('Figure 2, RequestVote RPC, Arguments.')
    expect(figure2Citation('RequestVoteResponse')).toBe('Figure 2, RequestVote RPC, Results.')
    expect(figure2Citation('AppendEntries')).toBe('Figure 2, AppendEntries RPC, Arguments.')
    expect(figure2Citation('InstallSnapshot')).toBe('Figure 13, InstallSnapshot RPC, Arguments.')
  })
})

describe('eventCitation', () => {
  it('cites deliver and drop events, and no others', () => {
    const message = {
      type: 'AppendEntries' as const,
      from: 0,
      to: 1,
      term: 1,
      leaderId: 0,
      prevLogIndex: 0,
      prevLogTerm: 0,
      entries: [],
      leaderCommit: 0,
    }
    expect(eventCitation({ kind: 'deliver', message, isDuplicate: false })).not.toBeNull()
    expect(eventCitation({ kind: 'drop', message, reason: 'network' })).not.toBeNull()
    expect(eventCitation({ kind: 'start' })).toBeNull()
    expect(eventCitation({ kind: 'timer', node: 0, timer: 'election' })).toBeNull()
    expect(eventCitation({ kind: 'heal' })).toBeNull()
  })
})

describe('eventFields', () => {
  it('every field key returned resolves to a real label in both locales', () => {
    const events: TraceEvent[] = [
      { kind: 'start' },
      { kind: 'heal' },
      { kind: 'timer', node: 2, timer: 'heartbeat' },
      { kind: 'crash', node: 1 },
      { kind: 'restart', node: 1 },
      { kind: 'partition', partitionOf: [0, 0, 1, 1, 1] },
      { kind: 'client-request', node: 0, command: 'x', accepted: true, redirectedTo: null },
      { kind: 'client-request', node: 1, command: 'x', accepted: false, redirectedTo: 0 },
      { kind: 'change-configuration', node: 0, servers: [0, 1, 2], accepted: true, redirectedTo: null },
      {
        kind: 'deliver',
        isDuplicate: true,
        message: {
          type: 'RequestVote',
          from: 0,
          to: 1,
          term: 1,
          candidateId: 0,
          lastLogIndex: 0,
          lastLogTerm: 0,
        },
      },
    ]
    for (const locale of LOCALES) {
      const dict = dictionary(locale)
      for (const event of events) {
        for (const field of eventFields(event)) {
          expect(dict.eventDetail[field.key]).toBeTruthy()
        }
      }
    }
  })

  it('names sender, receiver, RPC type and term for a delivered message', () => {
    const fields = eventFields({
      kind: 'deliver',
      isDuplicate: false,
      message: {
        type: 'AppendEntriesResponse',
        from: 2,
        to: 0,
        term: 3,
        success: true,
        matchIndex: 5,
      },
    })
    expect(fields).toEqual([
      { key: 'sender', value: 'n2' },
      { key: 'receiver', value: 'n0' },
      { key: 'rpc', value: 'AppendEntriesResponse' },
      { key: 'term', value: '3' },
    ])
  })

  it('carries no fields for start and heal — there is nothing structural to show', () => {
    expect(eventFields({ kind: 'start' })).toEqual([])
    expect(eventFields({ kind: 'heal' })).toEqual([])
  })
})
