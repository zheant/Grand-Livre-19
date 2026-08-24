import type { Invoice } from '../types'

// Les factures enregistrées avant l'ajout de la TPS/TVQ perçues (module
// Taxes) n'ont pas ces champs en base — on les complète à 0 à la lecture
// plutôt que de migrer silencieusement les données stockées.
export function normalizeInvoice(raw: Partial<Invoice> & { id: string }): Invoice {
  return {
    id: raw.id,
    date: raw.date ?? '',
    type: raw.type ?? 'Commission',
    montantCents: raw.montantCents ?? 0,
    tpsCents: raw.tpsCents ?? 0,
    tvqCents: raw.tvqCents ?? 0,
    statut: raw.statut ?? 'Envoyée',
    fileName: raw.fileName ?? null,
    hasFile: raw.hasFile ?? false,
  }
}
