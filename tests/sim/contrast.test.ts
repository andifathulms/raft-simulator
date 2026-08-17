import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import {
  PAIRS,
  contrastRatio,
  evaluate,
  extractColorsBlock,
  parseColors,
  relativeLuminance,
} from '../../scripts/contrast.mjs'

/**
 * DESIGN-REWORK.md §6: every token pair actually used must clear 4.5:1 (text) or 3:1
 * (large text / non-text UI). This is the gate — CI can fail a palette change that
 * quietly drops a pair below its threshold, the same way the fuzz suite gates a
 * change that quietly breaks a safety property.
 */
describe('contrast', () => {
  it('computes known WCAG reference ratios correctly', () => {
    // Black on white and white on black are both exactly 21:1 by definition.
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })

  it('parses the live tailwind.config.ts palette', async () => {
    const source = await readFile(new URL('../../tailwind.config.ts', import.meta.url), 'utf8')
    const colors = parseColors(extractColorsBlock(source))
    expect(colors['stock.DEFAULT']).toBe('#E9EDE4')
    expect(colors['ink.faint']).toBe('#5C6560')
    expect(colors.follower).toBe('#6B7770')
    expect(colors.vermilion).toBe('#B03A2E')
  })

  it('every pair the app actually uses clears its threshold against the live palette', async () => {
    const source = await readFile(new URL('../../tailwind.config.ts', import.meta.url), 'utf8')
    const colors = parseColors(extractColorsBlock(source))
    const results = evaluate(PAIRS, colors)
    const failing = results.filter((r) => !r.pass)
    expect(failing, JSON.stringify(failing, null, 2)).toEqual([])
  })

  it('flags a pair that falls below its threshold — the gate actually gates', () => {
    // ink-edge on stock-deep is a real, passing *border* pair at the 3:1 threshold.
    // Re-classified as body text, needing 4.5:1, it must fail: this is what a
    // regression would look like, so the check has to be able to say so.
    const colors = { 'ink.edge': '#727E6B', 'stock.deep': '#DCE2D5' }
    const results = evaluate([{ fg: 'ink.edge', bg: 'stock.deep', kind: 'text', note: 'test' }], colors)
    expect(results[0]?.pass).toBe(false)
  })
})
