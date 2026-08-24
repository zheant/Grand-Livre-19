// Export CSV pour le comptable — délimiteur virgule, décimales avec point
// (format universellement lisible par les tableurs et logiciels comptables,
// indépendant de la locale d'affichage de l'appli).

import { centsToNumber } from './money'
import { calculerRemise, type PeriodeDeclaration } from './taxRemittance'
import type { Expense, Invoice, Trip } from '../types'

// BOM UTF-8 : Excel (y compris en français) ne détecte l'encodage sans lui.
const BOM = '﻿'

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function csvRow(fields: Array<string | number>): string {
  return fields.map((f) => csvEscape(String(f))).join(',') + '\r\n'
}

function montant(cents: number): string {
  return centsToNumber(cents).toFixed(2)
}

export function csvDepenses(expenses: Expense[]): string {
  let out = BOM + csvRow(['Date', 'Description', 'Fournisseur', 'Catégorie', 'Montant', 'TPS', 'TVQ'])
  for (const e of [...expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    out += csvRow([
      e.date,
      e.description,
      e.fournisseur,
      e.categorie,
      montant(e.montantCents),
      montant(e.tpsCents),
      montant(e.tvqCents),
    ])
  }
  return out
}

export function csvRevenus(invoices: Invoice[]): string {
  let out = BOM + csvRow(['Date', 'Type', 'Statut', 'Montant hors taxes', 'TPS perçue', 'TVQ perçue'])
  for (const f of [...invoices].sort((a, b) => a.date.localeCompare(b.date))) {
    out += csvRow([f.date, f.type, f.statut, montant(f.montantCents), montant(f.tpsCents), montant(f.tvqCents)])
  }
  return out
}

export function csvKilometrage(trips: Trip[]): string {
  let out = BOM + csvRow(['Date', 'Motif', 'Kilomètres'])
  for (const t of [...trips].sort((a, b) => a.date.localeCompare(b.date))) {
    out += csvRow([t.date, t.motif, t.km])
  }
  return out
}

export function csvTaxes(periodes: PeriodeDeclaration[], invoices: Invoice[], expenses: Expense[]): string {
  let out = BOM + csvRow(['Période', 'Début', 'Fin', 'Échéance', 'TPS perçue', 'CTI', 'TVQ perçue', 'RTI', 'Remise'])
  for (const p of periodes) {
    const r = calculerRemise(p, invoices, expenses)
    out += csvRow([
      p.label,
      p.debut,
      p.fin,
      p.echeance,
      montant(r.tpsPercueCents),
      montant(r.ctiCents),
      montant(r.tvqPercueCents),
      montant(r.rtiCents),
      montant(r.remiseTotaleCents),
    ])
  }
  return out
}
