/**
 * Verify WCAG contrast for every token pair actually used in the app, and write the
 * computed ratios into CLAUDE.md beside the historical numbers it already records.
 *
 * The palette lives in `tailwind.config.ts` and nowhere else — this script reads it
 * from there rather than keeping a second copy, the same reason `generate-sw.mjs`
 * derives its manifest from the real build output instead of a hand-maintained list.
 *
 * Two thresholds, per WCAG 2.1: 4.5:1 for regular text (1.4.3), 3:1 for large text and
 * non-text UI components — graphical fills, borders (1.4.11). The node-id digit is set
 * at 19px bold specifically so the large-text carve-out applies to it; see the ratio
 * for that pair below and the note beside it in NodeRing.tsx.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONFIG_PATH = `${ROOT}/tailwind.config.ts`
const CLAUDE_PATH = `${ROOT}/CLAUDE.md`

const START_MARKER = '<!-- CONTRAST:GENERATED:START -->'
const END_MARKER = '<!-- CONTRAST:GENERATED:END -->'

// ---------------------------------------------------------------------------
// Read the palette out of tailwind.config.ts. Brace-matched, not a fixed-format
// regex, so reordering or reformatting the `colors` block doesn't silently start
// reading nothing.
// ---------------------------------------------------------------------------

function extractColorsBlock(source) {
  const anchor = source.indexOf('colors:')
  if (anchor === -1) throw new Error('tailwind.config.ts: no `colors:` key found')
  const open = source.indexOf('{', anchor)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  throw new Error('tailwind.config.ts: unbalanced braces in `colors:` block')
}

/** Flat and one-level-nested `key: '#hex'` entries, as `stock.pale` / `follower` etc. */
function parseColors(block) {
  const colors = {}
  const hex = /^#[0-9a-fA-F]{6}$/
  const entry = /(\w+):\s*(\{[^}]*\}|'[^']*')/g
  for (const [, key, value] of block.matchAll(entry)) {
    if (value.startsWith("'")) {
      const literal = value.slice(1, -1)
      if (hex.test(literal)) colors[key] = literal
      continue
    }
    for (const [, subKey, subValue] of value.matchAll(/(\w+):\s*'([^']*)'/g)) {
      if (hex.test(subValue)) colors[`${key}.${subKey}`] = subValue
    }
  }
  return colors
}

// ---------------------------------------------------------------------------
// WCAG 2.1 contrast: relative luminance (§1.4.3, formula in the spec's Appendix),
// then (L1 + 0.05) / (L2 + 0.05) with the lighter colour as L1.
// ---------------------------------------------------------------------------

function relativeLuminance(hexColor) {
  const channel = (value) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA)
  const b = relativeLuminance(hexB)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

// ---------------------------------------------------------------------------
// Every pair actually used, grounded in a real class name at a real call site.
// `kind: 'text'` needs 4.5:1; `kind: 'large'` (large text, or a non-text fill or
// border) needs 3:1.
// ---------------------------------------------------------------------------

const PAIRS = [
  // Body and secondary text on every panel/page background it appears on.
  { fg: 'ink.DEFAULT', bg: 'stock.DEFAULT', kind: 'text', note: "body { color: ink }, globals.css" },
  { fg: 'ink.faint', bg: 'stock.DEFAULT', kind: 'text', note: 'field-label / faint captions on the page background' },
  { fg: 'ink.faint', bg: 'stock.deep', kind: 'text', note: 'field-label / faint captions on stock-deep' },
  { fg: 'ink.faint', bg: 'stock.pale', kind: 'text', note: 'NodeDetail dt labels, NodeRing.tsx' },
  { fg: 'ink.faint', bg: 'stock.raised', kind: 'text', note: 'faint captions inside a .card' },
  { fg: 'ink.soft', bg: 'stock.DEFAULT', kind: 'text', note: 'text-ink-soft on the page background' },
  { fg: 'ink.soft', bg: 'stock.deep', kind: 'text', note: 'text-ink-soft on stock-deep' },
  { fg: 'ink.soft', bg: 'stock.pale', kind: 'text', note: 'text-ink-soft inside a chip / node detail panel' },
  { fg: 'ink.soft', bg: 'stock.raised', kind: 'text', note: 'text-ink-soft inside a .card' },
  // Borders — never text — so the 3:1 non-text threshold, not 4.5:1.
  { fg: 'ink.edge', bg: 'stock.DEFAULT', kind: 'large', note: '.btn border on the page background' },
  { fg: 'ink.edge', bg: 'stock.deep', kind: 'large', note: '.btn border on stock-deep' },
  { fg: 'ink.edge', bg: 'stock.pale', kind: 'large', note: '.btn border on stock-pale' },
  { fg: 'ink.edge', bg: 'stock.raised', kind: 'large', note: '.btn border, bg-stock-raised — the common case' },
  // The node-id digit: large text (19px bold) by construction, so 3:1 applies.
  { fg: 'ink.DEFAULT', bg: 'follower', kind: 'large', note: 'node-id digit on the follower fill, NodeRing.tsx' },
  { fg: 'ink.DEFAULT', bg: 'candidate', kind: 'large', note: 'node-id digit on the candidate fill, NodeRing.tsx' },
  { fg: 'stock.pale', bg: 'leader', kind: 'large', note: 'node-id digit on the leader fill, NodeRing.tsx' },
  // committed — as text, and as a fill/border.
  { fg: 'committed', bg: 'stock.pale', kind: 'text', note: 'text-committed term chip, MajorityDiagram.tsx / LogLedger.tsx' },
  { fg: 'committed', bg: 'stock.raised', kind: 'text', note: 'text-committed inside a .card, AblationPanel.tsx' },
  { fg: 'committed', bg: 'stock.DEFAULT', kind: 'text', note: 'text-committed on the page background' },
  { fg: 'committed', bg: 'stock.raised', kind: 'large', note: 'border-committed / bg-committed swatch, non-text' },
  { fg: 'stock.pale', bg: 'committed', kind: 'text', note: 'text-stock-pale on bg-committed indicator, InvariantPanel.tsx' },
  // vermilion — reserved for violations, but still has to clear the same bars.
  { fg: 'vermilion', bg: 'stock.pale', kind: 'text', note: 'text-vermilion, InvariantPanel.tsx' },
  { fg: 'vermilion', bg: 'stock.raised', kind: 'text', note: 'text-vermilion inside the error box, Simulator.tsx' },
  { fg: 'vermilion', bg: 'stock.DEFAULT', kind: 'text', note: 'text-vermilion, home page route card' },
  { fg: 'vermilion', bg: 'stock.raised', kind: 'large', note: 'border-vermilion / bg-vermilion, non-text' },
  { fg: 'stock.pale', bg: 'vermilion', kind: 'text', note: 'text-stock-pale on bg-vermilion, AblationPanel.tsx / .btn-violation' },
]

const THRESHOLD = { text: 4.5, large: 3.0 }

/** Pure: pairs + palette in, pass/fail-annotated results out. What the tests exercise. */
export function evaluate(pairs, colors) {
  return pairs.map((pair) => {
    const fgHex = colors[pair.fg]
    const bgHex = colors[pair.bg]
    if (fgHex === undefined || bgHex === undefined) {
      throw new Error(`Unknown token in pair ${pair.fg} / ${pair.bg} — check tailwind.config.ts`)
    }
    const ratio = contrastRatio(fgHex, bgHex)
    const threshold = THRESHOLD[pair.kind]
    return { ...pair, fgHex, bgHex, ratio, threshold, pass: ratio >= threshold }
  })
}

export { PAIRS, extractColorsBlock, parseColors, contrastRatio, relativeLuminance }

// ---------------------------------------------------------------------------

async function main() {
  const configSource = await readFile(CONFIG_PATH, 'utf8')
  const colors = parseColors(extractColorsBlock(configSource))
  const results = evaluate(PAIRS, colors)
  const failures = results.filter((r) => !r.pass)

  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL'
    console.log(
      `${status}  ${r.ratio.toFixed(2)}:1  (need ${r.threshold}:1)  ${r.fg} on ${r.bg}  — ${r.note}`,
    )
  }

  const table = [
    '| Pair | Usage | Ratio | Needs | Result |',
    '|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| \`${r.fg}\` on \`${r.bg}\` | ${r.note} | ${r.ratio.toFixed(2)}:1 | ${r.threshold}:1 | ${r.pass ? '✓' : '✗ FAIL'} |`,
    ),
  ].join('\n')

  const block = [
    START_MARKER,
    '',
    '_Computed by `scripts/contrast.mjs` from the live `tailwind.config.ts` palette — never hand-edited._',
    '',
    table,
    '',
    END_MARKER,
  ].join('\n')

  const claudeSource = await readFile(CLAUDE_PATH, 'utf8')
  const startIndex = claudeSource.indexOf(START_MARKER)
  const endIndex = claudeSource.indexOf(END_MARKER)
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`CLAUDE.md is missing ${START_MARKER} / ${END_MARKER} markers`)
  }
  const updated =
    claudeSource.slice(0, startIndex) + block + claudeSource.slice(endIndex + END_MARKER.length)
  if (updated !== claudeSource) {
    await writeFile(CLAUDE_PATH, updated)
    console.log('\nCLAUDE.md updated with the current ratios.')
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} pair(s) below threshold.`)
    process.exitCode = 1
  }
}

// Only run as a script — importing this module (the test suite does) must not touch
// the filesystem or set an exit code as a side effect of import.
const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`
if (isMain) await main()
