import { describe, expect, it } from 'vitest'
import {
  buildDocumentRows,
  buildExpenseRows,
  buildFileName,
  buildInvoiceRows,
  buildTripRows,
  extensionForMediaType,
  safeFileNameSegment,
} from './accountantExport'
import type { Expense, Invoice, TaxDocument, Trip } from '../types'

describe('safeFileNameSegment', () => {
  it('enlève les accents', () => {
    expect(safeFileNameSegment('Réparation véhicule à Montréal')).toBe(
      'Reparation vehicule a Montreal',
    )
  })

  it('remplace les caractères interdits dans un nom de fichier', () => {
    expect(safeFileNameSegment('Essence, "Shell" / Laval : 45$')).toBe('Essence, -Shell- - Laval - 45$')
  })

  it('tronque à la longueur maximale', () => {
    const long = 'a'.repeat(100)
    expect(safeFileNameSegment(long, 10)).toHaveLength(10)
  })

  it('retourne "sans-titre" pour une chaîne vide', () => {
    expect(safeFileNameSegment('')).toBe('sans-titre')
    expect(safeFileNameSegment('   ')).toBe('sans-titre')
  })
})

describe('extensionForMediaType', () => {
  it('mappe les types MIME courants', () => {
    expect(extensionForMediaType('image/jpeg')).toBe('jpg')
    expect(extensionForMediaType('image/png')).toBe('png')
    expect(extensionForMediaType('application/pdf')).toBe('pdf')
  })

  it('retourne "bin" pour un type inconnu', () => {
    expect(extensionForMediaType('application/x-mystery')).toBe('bin')
  })
})

describe('buildFileName', () => {
  it('combine date, étiquette nettoyée, id court et extension', () => {
    const name = buildFileName('2026-03-15', 'Essence Shell', 'abcdef123456', 'image/jpeg')
    expect(name).toBe('2026-03-15_Essence Shell_abcdef.jpg')
  })
})

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'e1234567',
    date: '2026-01-01',
    description: 'Essence',
    fournisseur: 'Shell',
    categorie: 'Essence et transport',
    montantCents: 4550,
    tpsCents: 200,
    tvqCents: 400,
    hasImage: false,
    ...overrides,
  }
}

describe('buildExpenseRows', () => {
  it('convertit les cents en dollars et trie par date', () => {
    const rows = buildExpenseRows(
      [
        expense({ id: 'b', date: '2026-03-01', montantCents: 1000 }),
        expense({ id: 'a', date: '2026-01-01', montantCents: 2000 }),
      ],
      new Map(),
    )
    expect(rows[0].Date).toBe('2026-01-01')
    expect(rows[0]['Montant ($)']).toBe(20)
    expect(rows[1]['Montant ($)']).toBe(10)
  })

  it('référence le nom de fichier fourni, ou une chaîne vide sinon', () => {
    const rows = buildExpenseRows(
      [expense({ id: 'x' })],
      new Map([['x', '2026-01-01_Essence_x123.jpg']]),
    )
    expect(rows[0].Fichier).toBe('2026-01-01_Essence_x123.jpg')

    const rowsSansFichier = buildExpenseRows([expense({ id: 'y' })], new Map())
    expect(rowsSansFichier[0].Fichier).toBe('')
  })
})

describe('buildInvoiceRows', () => {
  it('inclut montant hors taxes et taxes séparément', () => {
    const invoice: Invoice = {
      id: 'f1',
      date: '2026-02-01',
      type: 'Commission',
      montantCents: 100000,
      tpsCents: 5000,
      tvqCents: 9975,
      statut: 'Envoyée',
      fileName: null,
      hasFile: false,
    }
    const rows = buildInvoiceRows([invoice], new Map())
    expect(rows[0]).toMatchObject({
      'Montant hors taxes ($)': 1000,
      'TPS perçue ($)': 50,
      'TVQ perçue ($)': 99.75,
    })
  })
})

describe('buildTripRows', () => {
  it('référence les photos avant et après indépendamment', () => {
    const trip: Trip = {
      id: 't1',
      date: '2026-01-05',
      km: 42,
      motif: 'Client X',
      hasBefore: true,
      hasAfter: true,
    }
    const rows = buildTripRows(
      [trip],
      new Map([['t1', 'avant.jpg']]),
      new Map([['t1', 'apres.jpg']]),
    )
    expect(rows[0]['Photo avant']).toBe('avant.jpg')
    expect(rows[0]['Photo après']).toBe('apres.jpg')
  })
})

describe('buildDocumentRows', () => {
  it('référence le fichier correspondant', () => {
    const doc: TaxDocument = {
      id: 'd1',
      date: '2026-04-01',
      description: 'Reçus dentiste',
      fileName: 'recus.pdf',
      hasFile: true,
    }
    const rows = buildDocumentRows([doc], new Map([['d1', '2026-04-01_Recus-dentiste_d12345.pdf']]))
    expect(rows[0].Description).toBe('Reçus dentiste')
    expect(rows[0].Fichier).toBe('2026-04-01_Recus-dentiste_d12345.pdf')
  })
})
