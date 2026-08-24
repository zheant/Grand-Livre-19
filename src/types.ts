export type ContextId = 'geo360' | 'manutention'

export const CONTEXT_NAMES: Record<ContextId, string> = {
  geo360: 'Géo360',
  manutention: 'Manutention',
}

export type TabId = 'dashboard' | 'depenses' | 'factures' | 'km' | 'documents' | 'historique'

export interface TabDef {
  id: TabId
  label: string
}

export const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'factures', label: 'Paie / Factures' },
  { id: 'km', label: 'Kilométrage' },
  { id: 'documents', label: 'Documents' },
  { id: 'historique', label: 'Historique' },
]

export interface Expense {
  id: string
  date: string
  description: string
  fournisseur: string
  categorie: string
  montantCents: number
  tpsCents: number
  tvqCents: number
  hasImage: boolean
}

export type InvoiceType = 'Commission' | 'Taux horaire'
export type InvoiceStatut = 'Envoyée' | 'Payée'

export interface Invoice {
  id: string
  date: string
  type: InvoiceType
  /** Montant hors taxes. */
  montantCents: number
  /** TPS perçue sur ce montant (0 si non inscrit aux fichiers de taxes). */
  tpsCents: number
  /** TVQ perçue sur ce montant (0 si non inscrit aux fichiers de taxes). */
  tvqCents: number
  statut: InvoiceStatut
  fileName: string | null
  hasFile: boolean
}

export interface Trip {
  id: string
  date: string
  km: number
  motif: string
  hasBefore: boolean
  hasAfter: boolean
}

// Documents fiscaux divers, non liés à un contexte (T4/RL-1 d'un autre
// emploi, frais médicaux, preuves de bureau à domicile, etc.).
export interface TaxDocument {
  id: string
  date: string
  description: string
  fileName: string | null
  hasFile: boolean
}
