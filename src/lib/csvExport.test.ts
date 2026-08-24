import { describe, expect, it } from 'vitest'
import { csvDepenses, csvKilometrage, csvRevenus, csvTaxes } from './csvExport'
import { genererPeriodes } from './taxRemittance'
import type { Expense, Invoice, Trip } from '../types'

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

describe('csvDepenses', () => {
  it('inclut un BOM UTF-8 et l’en-tête attendu', () => {
    const csv = csvDepenses([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Date,Description,Fournisseur,Catégorie,Montant,TPS,TVQ')
  })

  it('convertit les cents en décimales à deux chiffres', () => {
    const csv = csvDepenses([expense({ montantCents: 12345, tpsCents: 500, tvqCents: 999 })])
    expect(csv).toContain('123.45,5.00,9.99')
  })

  it('échappe les virgules et guillemets dans la description', () => {
    const csv = csvDepenses([expense({ description: 'Essence, "Shell" Laval' })])
    expect(csv).toContain('"Essence, ""Shell"" Laval"')
  })

  it('trie par date croissante', () => {
    const csv = csvDepenses([
      expense({ id: '2', date: '2026-03-01', description: 'B' }),
      expense({ id: '1', date: '2026-01-01', description: 'A' }),
    ])
    const lignes = csv.split('\r\n').filter(Boolean)
    expect(lignes[1]).toContain('A')
    expect(lignes[2]).toContain('B')
  })
})

describe('csvRevenus', () => {
  it('inclut montant hors taxes et TPS/TVQ perçues séparément', () => {
    const csv = csvRevenus([invoice({ montantCents: 100000, tpsCents: 5000, tvqCents: 9975 })])
    expect(csv).toContain('1000.00,50.00,99.75')
  })
})

describe('csvKilometrage', () => {
  it('exporte date, motif et km', () => {
    const trip: Trip = { id: 't', date: '2026-02-15', km: 42.5, motif: 'Client X', hasBefore: false, hasAfter: false }
    const csv = csvKilometrage([trip])
    expect(csv).toContain('2026-02-15,Client X,42.5')
  })
})

describe('csvTaxes', () => {
  it('calcule la remise par période comme le tableau de l’onglet Taxes', () => {
    const periodes = genererPeriodes(2026, 'annuelle')
    const csv = csvTaxes(
      periodes,
      [invoice({ date: '2026-06-01', tpsCents: 1000, tvqCents: 2000 })],
      [expense({ date: '2026-07-01', tpsCents: 300, tvqCents: 600 })],
    )
    // 700 (tps net) + 1400 (tvq net) = 2100 cents = 21.00
    expect(csv).toContain('21.00')
  })
})
