import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

/**
 * Semantic tokens only. See PRD §10.
 * `vermilion` is reserved exclusively for safety violations.
 *
 * Colour means state, never decoration: ink and stock carry every structural job —
 * text, rules, buttons, emphasis — and the five chromatic tokens appear only where
 * they say something about Raft. Any colour on screen is information.
 *
 * Both themes are written here as hex and nowhere else. The plugin below turns them
 * into CSS custom properties, and every Tailwind colour reads its variable, so a
 * component never knows which theme it is in. `scripts/contrast.mjs` reads these two
 * blocks directly and gates both.
 */
const LIGHT = {
  stock: {
    // The page: a cool account-paper, lighter and cleaner than the first edition so
    // a surface can sit above it and a well can sit below it.
    DEFAULT: '#EEF1EC',
    // A well: disagreement rows, hovered controls, the crashed node's empty fill.
    deep: '#E3E8E1',
    // Inputs, chips, the node detail panel — just under a surface.
    pale: '#F6F8F4',
    // A surface: the panel you act on. Three clear levels — page, surface, well —
    // so an object reads as an object rather than as an outline.
    raised: '#FCFDFB',
  },
  ink: {
    DEFAULT: '#141917',
    soft: '#434C47',
    // The most-used secondary text colour, so it clears AA on every surface.
    faint: '#59635D',
    // Decorative ruling only: the ledger grid, section separators.
    rule: '#D5DBD2',
    // Borders of interactive components, which need 3:1 under WCAG 1.4.11.
    edge: '#78837A',
    // The node-id digit on a follower or candidate fill. Equal to ink in light, but
    // its own token because in dark the fills go light and the digit must go dark.
    role: '#141917',
  },
  // Three roles spread in lightness — light, mid, dark — so the cluster reads even in
  // greyscale and the follower, the most common node on screen, stops being the
  // dimmest thing on it.
  follower: '#A4AEA8',
  candidate: '#D49B2C',
  leader: '#2A5CA8',
  committed: '#2A7548',
  vermilion: '#B5341F',
}

/**
 * Dark: the bench with the lights down. Not an inversion — the role fills are
 * re-derived so each still separates from the others and from the ground, and the
 * digit on a fill flips to dark ink, because the fills are now the light things.
 */
const DARK = {
  stock: {
    DEFAULT: '#0E1211',
    deep: '#0A0D0C',
    pale: '#121715',
    raised: '#161B19',
  },
  ink: {
    DEFAULT: '#E8ECE8',
    soft: '#B4BDB7',
    faint: '#8F9993',
    rule: '#28302C',
    edge: '#6B7770',
    role: '#0E1211',
  },
  follower: '#7D8983',
  candidate: '#E3A53A',
  leader: '#6B9BEA',
  committed: '#52B47D',
  vermilion: '#F2664B',
}

type Palette = typeof LIGHT

/** `stock.deep` → `--c-stock-deep`; `stock.DEFAULT` → `--c-stock`. */
function variableName(group: string, key?: string): string {
  return key === undefined || key === 'DEFAULT' ? `--c-${group}` : `--c-${group}-${key}`
}

function channels(hex: string): string {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')
}

function variables(palette: Palette): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [group, value] of Object.entries(palette)) {
    if (typeof value === 'string') out[variableName(group)] = channels(value)
    else for (const [key, hex] of Object.entries(value)) out[variableName(group, key)] = channels(hex)
  }
  return out
}

/** The Tailwind side: every token resolves to its variable, opacity modifiers intact. */
function tokens(palette: Palette): Record<string, string | Record<string, string>> {
  const out: Record<string, string | Record<string, string>> = {}
  const ref = (name: string) => `rgb(var(${name}) / <alpha-value>)`
  for (const [group, value] of Object.entries(palette)) {
    if (typeof value === 'string') out[group] = ref(variableName(group))
    else {
      const nested: Record<string, string> = {}
      for (const key of Object.keys(value)) nested[key] = ref(variableName(group, key))
      out[group] = nested
    }
  }
  return out
}

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: tokens(LIGHT),
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      /**
       * A named scale: each name says what the size is *for*, so the choice is a
       * decision about role rather than about pixels. Display sizes are set tight —
       * Source Serif at large optical sizes wants negative tracking to hold together.
       */
      fontSize: {
        micro: ['0.75rem', { lineHeight: '1.1rem' }],
        label: ['0.8125rem', { lineHeight: '1.2rem' }],
        data: ['0.8125rem', { lineHeight: '1.3rem' }],
        body: ['1rem', { lineHeight: '1.65' }],
        lede: ['1.125rem', { lineHeight: '1.6' }],
        panel: ['1.25rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        title: ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        headline: ['2.5rem', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        display: ['3.75rem', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
      },
      /**
       * Radii by role, not by size. The ledger's cells stay square — the ruled grid
       * is the metaphor — but the objects you pick up and press are softened.
       */
      borderRadius: {
        control: '6px',
        panel: '12px',
        stage: '16px',
      },
      boxShadow: {
        // A surface resting on the page.
        card: '0 1px 0 0 rgb(20 25 23 / 0.04), 0 4px 14px -8px rgb(20 25 23 / 0.14)',
        // Something that floats above everything else: the command palette, a popover.
        lift: '0 2px 4px 0 rgb(20 25 23 / 0.06), 0 18px 40px -12px rgb(20 25 23 / 0.32)',
      },
      maxWidth: {
        // A measure prose can actually be read at — roughly 68 characters at 16px.
        prose: '36rem',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...variables(LIGHT), 'color-scheme': 'light' },
      })
      // DARK is declared and measured here (see scripts/contrast.mjs) but not yet
      // emitted: it is switched on as its own step so the light palette can land and
      // be checked on its own first.
      void DARK
    }),
  ],
}

export default config
