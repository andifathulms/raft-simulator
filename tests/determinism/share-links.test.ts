import { describe, expect, it } from 'vitest'
import { ABLATION_FLAG_NAMES, UNMODIFIED_RAFT } from '@/lib/raft/rules'
import { decodeShare, flagCode } from '@/lib/share'

/**
 * Links into the simulator that switch a rule off are built in three places — the
 * rule cards, the scenario library and the command palette. They must all build the
 * `off=` field the decoder actually reads. The rule cards used to put the flag's
 * full name there, which the decoder ignores: the link opened the right scenario
 * with the rule still on, demonstrating nothing.
 */
describe('share links that switch a rule off', () => {
  it.each(ABLATION_FLAG_NAMES)('off=flagCode(%s) decodes to exactly that rule off', (flag) => {
    const state = decodeShare(`#s=figure-8&off=${flagCode(flag)}`)
    expect(state.flags[flag]).toBe(false)
    for (const other of ABLATION_FLAG_NAMES) {
      if (other !== flag) expect(state.flags[other]).toBe(UNMODIFIED_RAFT[other])
    }
  })

  it('does not accept the full flag name — the form the rule cards used to emit', () => {
    const state = decodeShare('#s=figure-8&off=currentTermCommitRule')
    expect(state.flags.currentTermCommitRule).toBe(true)
  })
})
