// Tous les montants sont stockés en cents (entiers) — jamais en flottants.
// Le formatage en devise ne se fait qu'à l'affichage.

export function toCents(input: number | string): number {
  const n = typeof input === 'string' ? parseFloat(input.replace(',', '.')) : input
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function centsToNumber(cents: number): number {
  return (cents || 0) / 100
}

const currencyFormatter = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' })

export function formatCents(cents: number): string {
  return currencyFormatter.format(centsToNumber(cents))
}

const integerFormatter = new Intl.NumberFormat('fr-CA')

export function formatKm(km: number): string {
  return `${integerFormatter.format(km || 0)} km`
}
