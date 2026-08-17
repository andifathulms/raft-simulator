export interface ContrastPair {
  readonly fg: string
  readonly bg: string
  readonly kind: 'text' | 'large'
  readonly note: string
}

export interface ContrastResult extends ContrastPair {
  readonly fgHex: string
  readonly bgHex: string
  readonly ratio: number
  readonly threshold: number
  readonly pass: boolean
}

export const PAIRS: readonly ContrastPair[]
export function evaluate(
  pairs: readonly ContrastPair[],
  colors: Readonly<Record<string, string>>,
): ContrastResult[]
export function extractColorsBlock(source: string): string
export function parseColors(block: string): Record<string, string>
export function contrastRatio(hexA: string, hexB: string): number
export function relativeLuminance(hexColor: string): number
