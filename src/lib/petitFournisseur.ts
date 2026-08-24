import { storage } from './db'
import { ledgerKeys } from './ledgerKeys'
import { normalizeInvoice } from './normalize'
import type { ContextId, Invoice } from '../types'

// Seuil de petit fournisseur (ARC/Revenu Québec) — l'inscription à la
// TPS/TVQ devient obligatoire au-delà. Dupliqué de parametres-fiscaux.json
// pour rester simple ; ce seuil est stable depuis des années.
export const SEUIL_PETIT_FOURNISSEUR_CENTS = 30_000 * 100

const TOUS_LES_CONTEXTES: ContextId[] = ['geo360', 'manutention']

// Début du trimestre civil contenant `date`, décalé de `offsetQuarters`
// trimestres vers le passé (0 = trimestre courant).
function debutTrimestre(date: Date, offsetQuarters: number): Date {
  const q = Math.floor(date.getMonth() / 3) - offsetQuarters
  const year = date.getFullYear() + Math.floor(q / 4)
  const qNorm = ((q % 4) + 4) % 4
  return new Date(year, qNorm * 3, 1)
}

// Revenus bruts (hors taxes) des 4 derniers trimestres civils consécutifs
// (trimestre courant inclus), tous contextes confondus — c'est la base de
// calcul du seuil de petit fournisseur, qui s'applique à la personne, pas à
// un contexte Géo360/Manutention en particulier.
export async function revenuQuatreTrimestresCents(aujourdhui = new Date()): Promise<number> {
  const debut = debutTrimestre(aujourdhui, 3)
  const debutIso = debut.toISOString().slice(0, 10)

  const parContexte = await Promise.all(
    TOUS_LES_CONTEXTES.map(async (ctx) => {
      const raw = await storage.get(ledgerKeys.facturesIndex(ctx))
      if (!raw) return 0
      const invoices = (JSON.parse(raw.value as string) as Invoice[]).map(normalizeInvoice)
      return invoices
        .filter((f) => f.date >= debutIso)
        .reduce((s, f) => s + f.montantCents, 0)
    }),
  )

  return parContexte.reduce((s, n) => s + n, 0)
}
