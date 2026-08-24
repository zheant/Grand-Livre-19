import { describe, expect, it } from 'vitest'
import {
  calculerRemise,
  genererPeriodes,
  revenuBrutGlissant4Trimestres,
  statutPeriode,
} from './taxRemittance'
import type { Expense, Invoice } from '../types'

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 'i',
    date: '2026-01-01',
    type: 'Commission',
    montantCents: 0,
    tpsCents: 0,
    tvqCents: 0,
    statut: 'Envoyée',
    fileName: null,
    hasFile: false,
    ...overrides,
  }
}

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'e',
    date: '2026-01-01',
    description: '',
    fournisseur: '',
    categorie: 'Autre',
    montantCents: 0,
    tpsCents: 0,
    tvqCents: 0,
    hasImage: false,
    ...overrides,
  }
}

describe('genererPeriodes', () => {
  it('annuelle : une seule période couvrant l’année, échéance 15 juin suivant', () => {
    const periodes = genererPeriodes(2026, 'annuelle')
    expect(periodes).toHaveLength(1)
    expect(periodes[0]).toMatchObject({ debut: '2026-01-01', fin: '2026-12-31', echeance: '2027-06-15' })
  })

  it('trimestrielle : 4 périodes, échéance = fin du trimestre + 1 mois', () => {
    const periodes = genererPeriodes(2026, 'trimestrielle')
    expect(periodes).toHaveLength(4)
    expect(periodes[0]).toMatchObject({ debut: '2026-01-01', fin: '2026-03-31', echeance: '2026-04-30' })
    expect(periodes[3]).toMatchObject({ debut: '2026-10-01', fin: '2026-12-31', echeance: '2027-01-31' })
  })

  it('mensuelle : 12 périodes couvrant chaque mois civil', () => {
    const periodes = genererPeriodes(2026, 'mensuelle')
    expect(periodes).toHaveLength(12)
    expect(periodes[1]).toMatchObject({ debut: '2026-02-01', fin: '2026-02-28', echeance: '2026-03-31' })
    // décembre -> échéance en janvier de l'année suivante
    expect(periodes[11]).toMatchObject({ debut: '2026-12-01', fin: '2026-12-31', echeance: '2027-01-31' })
  })

  it('gère correctement une année bissextile pour février', () => {
    const periodes = genererPeriodes(2028, 'mensuelle')
    expect(periodes[1].fin).toBe('2028-02-29')
  })
})

describe('calculerRemise', () => {
  it('calcule (TPS perçue - CTI) + (TVQ perçue - RTI) sur la période uniquement', () => {
    const periode = genererPeriodes(2026, 'annuelle')[0]
    const invoices = [
      invoice({ date: '2026-05-01', tpsCents: 1000, tvqCents: 2000 }),
      invoice({ date: '2025-12-31', tpsCents: 9999, tvqCents: 9999 }), // hors période
    ]
    const expenses = [
      expense({ date: '2026-06-01', tpsCents: 300, tvqCents: 600 }),
      expense({ date: '2027-01-01', tpsCents: 9999, tvqCents: 9999 }), // hors période
    ]
    const remise = calculerRemise(periode, invoices, expenses)
    expect(remise.tpsPercueCents).toBe(1000)
    expect(remise.tvqPercueCents).toBe(2000)
    expect(remise.ctiCents).toBe(300)
    expect(remise.rtiCents).toBe(600)
    expect(remise.remiseTpsCents).toBe(700)
    expect(remise.remiseTvqCents).toBe(1400)
    expect(remise.remiseTotaleCents).toBe(2100)
  })

  it('une remise peut être négative (crédit) si les CTI/RTI dépassent les taxes perçues', () => {
    const periode = genererPeriodes(2026, 'annuelle')[0]
    const remise = calculerRemise(
      periode,
      [invoice({ date: '2026-01-15', tpsCents: 100, tvqCents: 100 })],
      [expense({ date: '2026-01-20', tpsCents: 500, tvqCents: 500 })],
    )
    expect(remise.remiseTpsCents).toBe(-400)
    expect(remise.remiseTotaleCents).toBe(-800)
  })
})

describe('revenuBrutGlissant4Trimestres', () => {
  it('additionne les 4 trimestres civils se terminant au trimestre de référence', () => {
    const invoices = [
      { date: '2025-04-15', montantCents: 100000 }, // T2 2025 — inclus (fenêtre T3 2025 à T2 2026)
      { date: '2025-01-15', montantCents: 999999 }, // T1 2025 — exclu
      { date: '2025-08-01', montantCents: 200000 }, // T3 2025
      { date: '2025-11-01', montantCents: 300000 }, // T4 2025
      { date: '2026-02-01', montantCents: 400000 }, // T1 2026
      { date: '2026-05-01', montantCents: 999999 }, // T2 2026 — hors fenêtre (référence = 2026-04-01, dans T2)
    ]
    // Référence au tout début de T2 2026 -> fenêtre = T3 2025, T4 2025, T1 2026, T2 2026
    const total = revenuBrutGlissant4Trimestres(invoices, '2026-04-01')
    expect(total).toBe(200000 + 300000 + 400000 + 999999)
  })

  it('ignore le statut payé/en attente — se base sur toutes les factures émises', () => {
    const invoices = [{ date: '2026-01-10', montantCents: 500000 }]
    expect(revenuBrutGlissant4Trimestres(invoices, '2026-01-15')).toBe(500000)
  })
})

describe('statutPeriode', () => {
  const periode = genererPeriodes(2026, 'trimestrielle')[0] // échéance 2026-04-30

  it('« remise » si une date de remise est enregistrée, peu importe l’échéance', () => {
    expect(statutPeriode(periode, '2026-04-01', '2027-01-01')).toBe('remise')
  })

  it('« en_retard » si l’échéance est dépassée sans remise', () => {
    expect(statutPeriode(periode, null, '2026-05-01')).toBe('en_retard')
  })

  it('« echeance_proche » dans la fenêtre d’alerte', () => {
    expect(statutPeriode(periode, null, '2026-04-20', 14)).toBe('echeance_proche')
  })

  it('« a_venir » en dehors de la fenêtre d’alerte', () => {
    expect(statutPeriode(periode, null, '2026-02-01', 14)).toBe('a_venir')
  })
})
