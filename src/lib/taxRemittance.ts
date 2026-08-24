// Logique pure du module TPS/TVQ : périodes de déclaration, calcul de la
// remise, seuil d'inscription obligatoire (revenus sur 4 trimestres
// glissants). Les échéances de déclaration sont des estimations basées sur
// les règles générales de l'ARC/Revenu Québec (fin de période + 1 mois pour
// les déclarants mensuels/trimestriels, 15 juin de l'année suivante pour les
// déclarants annuels avec revenus d'entreprise) — à confirmer avec un
// comptable ou directement auprès de Revenu Québec.

import type { Expense, Invoice } from '../types'

export type FrequenceDeclaration = 'annuelle' | 'trimestrielle' | 'mensuelle'

export interface PeriodeDeclaration {
  id: string
  label: string
  debut: string // AAAA-MM-JJ
  fin: string
  echeance: string
}

const MOIS_LABELS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dernierJourDuMois(annee: number, mois: number): number {
  // new Date(annee, mois, 0) recule d'un jour depuis le 1er du mois suivant
  // (mois est ici 1-indexé, mais le constructeur Date attend un index 0-indexé
  // pour le mois suivant) — donne donc le dernier jour du mois `mois`.
  return new Date(annee, mois, 0).getDate()
}

function ajouterMois(annee: number, mois: number, delta: number): { annee: number; mois: number } {
  const total = annee * 12 + (mois - 1) + delta
  return { annee: Math.floor(total / 12), mois: (((total % 12) + 12) % 12) + 1 }
}

function finDeMoisSuivant(annee: number, mois: number): string {
  const { annee: a, mois: m } = ajouterMois(annee, mois, 1)
  return `${a}-${pad(m)}-${pad(dernierJourDuMois(a, m))}`
}

export function genererPeriodes(annee: number, frequence: FrequenceDeclaration): PeriodeDeclaration[] {
  if (frequence === 'mensuelle') {
    return Array.from({ length: 12 }, (_, i) => {
      const mois = i + 1
      const debut = `${annee}-${pad(mois)}-01`
      const fin = `${annee}-${pad(mois)}-${pad(dernierJourDuMois(annee, mois))}`
      return {
        id: `${annee}-M${pad(mois)}`,
        label: `${MOIS_LABELS[mois - 1]} ${annee}`,
        debut,
        fin,
        echeance: finDeMoisSuivant(annee, mois),
      }
    })
  }

  if (frequence === 'trimestrielle') {
    return [1, 2, 3, 4].map((t) => {
      const moisDebut = (t - 1) * 3 + 1
      const moisFin = t * 3
      const debut = `${annee}-${pad(moisDebut)}-01`
      const fin = `${annee}-${pad(moisFin)}-${pad(dernierJourDuMois(annee, moisFin))}`
      return {
        id: `${annee}-T${t}`,
        label: `T${t} ${annee}`,
        debut,
        fin,
        echeance: finDeMoisSuivant(annee, moisFin),
      }
    })
  }

  // annuelle
  return [
    {
      id: `${annee}`,
      label: `Année ${annee}`,
      debut: `${annee}-01-01`,
      fin: `${annee}-12-31`,
      echeance: `${annee + 1}-06-15`,
    },
  ]
}

export interface RemiseCalculee {
  tpsPercueCents: number
  ctiCents: number
  tvqPercueCents: number
  rtiCents: number
  remiseTpsCents: number
  remiseTvqCents: number
  remiseTotaleCents: number
}

export function calculerRemise(
  periode: PeriodeDeclaration,
  invoices: Invoice[],
  expenses: Expense[],
): RemiseCalculee {
  const invoicesPeriode = invoices.filter((f) => f.date >= periode.debut && f.date <= periode.fin)
  const expensesPeriode = expenses.filter((e) => e.date >= periode.debut && e.date <= periode.fin)

  const tpsPercueCents = invoicesPeriode.reduce((s, f) => s + f.tpsCents, 0)
  const tvqPercueCents = invoicesPeriode.reduce((s, f) => s + f.tvqCents, 0)
  const ctiCents = expensesPeriode.reduce((s, e) => s + e.tpsCents, 0)
  const rtiCents = expensesPeriode.reduce((s, e) => s + e.tvqCents, 0)

  const remiseTpsCents = tpsPercueCents - ctiCents
  const remiseTvqCents = tvqPercueCents - rtiCents

  return {
    tpsPercueCents,
    ctiCents,
    tvqPercueCents,
    rtiCents,
    remiseTpsCents,
    remiseTvqCents,
    remiseTotaleCents: remiseTpsCents + remiseTvqCents,
  }
}

function trimestreDe(dateStr: string): { annee: number; t: number } {
  const [y, m] = dateStr.split('-').map(Number)
  return { annee: y, t: Math.ceil(m / 3) }
}

function trimestresPrecedents(annee: number, t: number, count: number): { annee: number; t: number }[] {
  const out: { annee: number; t: number }[] = []
  let a = annee
  let tt = t
  for (let i = 0; i < count; i++) {
    out.push({ annee: a, t: tt })
    tt -= 1
    if (tt < 1) {
      tt = 4
      a -= 1
    }
  }
  return out
}

// Revenus bruts (facturés, peu importe le statut payé/en attente — la base
// fiscale est l'exercice, pas l'encaissement) sur les 4 trimestres civils
// glissants se terminant au trimestre de `dateReference`. Sert à surveiller
// l'approche du seuil d'inscription obligatoire (30 000 $ pour un petit
// fournisseur).
export function revenuBrutGlissant4Trimestres(
  invoices: Pick<Invoice, 'date' | 'montantCents'>[],
  dateReference: string,
): number {
  const { annee, t } = trimestreDe(dateReference)
  const fenetre = new Set(
    trimestresPrecedents(annee, t, 4).map(({ annee: a, t: tt }) => `${a}-Q${tt}`),
  )
  return invoices.reduce((sum, inv) => {
    const { annee: a, t: tt } = trimestreDe(inv.date)
    return fenetre.has(`${a}-Q${tt}`) ? sum + inv.montantCents : sum
  }, 0)
}

export type StatutPeriode = 'a_venir' | 'echeance_proche' | 'en_retard' | 'remise'

function diffEnJours(dateCible: string, dateRef: string): number {
  const a = new Date(`${dateCible}T00:00:00`)
  const b = new Date(`${dateRef}T00:00:00`)
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

export function statutPeriode(
  periode: PeriodeDeclaration,
  remiseLe: string | null,
  aujourdHui: string,
  joursAlerte = 14,
): StatutPeriode {
  if (remiseLe) return 'remise'
  const diffJours = diffEnJours(periode.echeance, aujourdHui)
  if (diffJours < 0) return 'en_retard'
  if (diffJours <= joursAlerte) return 'echeance_proche'
  return 'a_venir'
}
