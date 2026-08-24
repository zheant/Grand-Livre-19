// Export comptable complet : un fichier .zip contenant un classeur Excel
// (une feuille par catégorie) et un dossier de fichiers réels (photos de
// reçus, PDF de factures, documents fiscaux) organisés par catégorie, avec
// chaque ligne du classeur référençant le nom du fichier correspondant.

import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { centsToNumber } from './money'
import type { Expense, Invoice, Trip, TaxDocument } from '../types'

// ---------- Helpers purs (testés) ----------

export function safeFileNameSegment(raw: string, maxLength = 60): string {
  const cleaned = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // enlève les accents pour un nom de fichier robuste partout
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  const truncated = cleaned.slice(0, maxLength).trim()
  return truncated || 'sans-titre'
}

const MEDIA_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

export function extensionForMediaType(mediaType: string): string {
  return MEDIA_TYPE_EXTENSIONS[mediaType] ?? 'bin'
}

export function buildFileName(
  date: string,
  label: string,
  id: string,
  mediaType: string,
): string {
  const idSuffix = id.slice(0, 6)
  return `${date}_${safeFileNameSegment(label)}_${idSuffix}.${extensionForMediaType(mediaType)}`
}

// ---------- Lignes de classeur (testées) ----------

export interface ExpenseRow {
  Date: string
  Description: string
  Fournisseur: string
  Catégorie: string
  'Montant ($)': number
  'TPS ($)': number
  'TVQ ($)': number
  Fichier: string
}

export function buildExpenseRows(expenses: Expense[], fileNames: Map<string, string>): ExpenseRow[] {
  return [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      Date: e.date,
      Description: e.description,
      Fournisseur: e.fournisseur,
      Catégorie: e.categorie,
      'Montant ($)': centsToNumber(e.montantCents),
      'TPS ($)': centsToNumber(e.tpsCents),
      'TVQ ($)': centsToNumber(e.tvqCents),
      Fichier: fileNames.get(e.id) ?? '',
    }))
}

export interface InvoiceRow {
  Date: string
  Type: string
  Statut: string
  'Montant hors taxes ($)': number
  'TPS perçue ($)': number
  'TVQ perçue ($)': number
  Fichier: string
}

export function buildInvoiceRows(invoices: Invoice[], fileNames: Map<string, string>): InvoiceRow[] {
  return [...invoices]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => ({
      Date: f.date,
      Type: f.type,
      Statut: f.statut,
      'Montant hors taxes ($)': centsToNumber(f.montantCents),
      'TPS perçue ($)': centsToNumber(f.tpsCents),
      'TVQ perçue ($)': centsToNumber(f.tvqCents),
      Fichier: fileNames.get(f.id) ?? '',
    }))
}

export interface TripRow {
  Date: string
  Motif: string
  Kilomètres: number
  'Photo avant': string
  'Photo après': string
}

export function buildTripRows(
  trips: Trip[],
  beforeFileNames: Map<string, string>,
  afterFileNames: Map<string, string>,
): TripRow[] {
  return [...trips]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      Date: t.date,
      Motif: t.motif,
      Kilomètres: t.km,
      'Photo avant': beforeFileNames.get(t.id) ?? '',
      'Photo après': afterFileNames.get(t.id) ?? '',
    }))
}

export interface DocumentRow {
  Date: string
  Description: string
  Fichier: string
}

export function buildDocumentRows(
  documents: TaxDocument[],
  fileNames: Map<string, string>,
): DocumentRow[] {
  return [...documents]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      Date: d.date,
      Description: d.description,
      Fichier: fileNames.get(d.id) ?? '',
    }))
}

// ---------- Assemblage complet (IO — non testé unitairement) ----------

export interface AccountantExportSource {
  expenses: Expense[]
  invoices: Invoice[]
  trips: Trip[]
  documents: TaxDocument[]
  getExpenseImage: (id: string) => Promise<Blob | null>
  getInvoiceFile: (id: string) => Promise<Blob | null>
  getTripImage: (id: string, which: 'before' | 'after') => Promise<Blob | null>
  getDocumentFile: (id: string) => Promise<Blob | null>
}

export async function buildAccountantExportZip(source: AccountantExportSource): Promise<Blob> {
  const zip = new JSZip()
  const depensesFolder = zip.folder('Dépenses')!
  const facturesFolder = zip.folder('Factures')!
  const kmFolder = zip.folder('Kilométrage')!
  const documentsRoot = zip.folder('Documents')!

  const expenseFileNames = new Map<string, string>()
  for (const e of source.expenses) {
    if (!e.hasImage) continue
    const blob = await source.getExpenseImage(e.id)
    if (!blob) continue
    const name = buildFileName(e.date, e.description, e.id, blob.type)
    expenseFileNames.set(e.id, name)
    depensesFolder.file(name, blob)
  }

  const invoiceFileNames = new Map<string, string>()
  for (const f of source.invoices) {
    if (!f.hasFile) continue
    const blob = await source.getInvoiceFile(f.id)
    if (!blob) continue
    const name = buildFileName(f.date, f.type, f.id, blob.type)
    invoiceFileNames.set(f.id, name)
    facturesFolder.file(name, blob)
  }

  const tripBeforeFileNames = new Map<string, string>()
  const tripAfterFileNames = new Map<string, string>()
  for (const t of source.trips) {
    if (t.hasBefore) {
      const blob = await source.getTripImage(t.id, 'before')
      if (blob) {
        const name = buildFileName(t.date, `avant-${t.motif}`, t.id, blob.type)
        tripBeforeFileNames.set(t.id, name)
        kmFolder.file(name, blob)
      }
    }
    if (t.hasAfter) {
      const blob = await source.getTripImage(t.id, 'after')
      if (blob) {
        const name = buildFileName(t.date, `apres-${t.motif}`, t.id, blob.type)
        tripAfterFileNames.set(t.id, name)
        kmFolder.file(name, blob)
      }
    }
  }

  const documentFileNames = new Map<string, string>()
  for (const d of source.documents) {
    if (!d.hasFile) continue
    const blob = await source.getDocumentFile(d.id)
    if (!blob) continue
    const name = buildFileName(d.date, d.description || 'document', d.id, blob.type)
    documentFileNames.set(d.id, name)
    documentsRoot.file(name, blob)
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Livre d'affaire"
  workbook.created = new Date()

  const wsDepenses = workbook.addWorksheet('Dépenses')
  const depensesRows = buildExpenseRows(source.expenses, expenseFileNames)
  if (depensesRows.length > 0) {
    wsDepenses.columns = Object.keys(depensesRows[0]).map((key) => ({ header: key, key }))
    wsDepenses.addRows(depensesRows)
  }

  const wsFactures = workbook.addWorksheet('Factures')
  const facturesRows = buildInvoiceRows(source.invoices, invoiceFileNames)
  if (facturesRows.length > 0) {
    wsFactures.columns = Object.keys(facturesRows[0]).map((key) => ({ header: key, key }))
    wsFactures.addRows(facturesRows)
  }

  const wsKm = workbook.addWorksheet('Kilométrage')
  const kmRows = buildTripRows(source.trips, tripBeforeFileNames, tripAfterFileNames)
  if (kmRows.length > 0) {
    wsKm.columns = Object.keys(kmRows[0]).map((key) => ({ header: key, key }))
    wsKm.addRows(kmRows)
  }

  const wsDocuments = workbook.addWorksheet('Documents')
  const documentsRows = buildDocumentRows(source.documents, documentFileNames)
  if (documentsRows.length > 0) {
    wsDocuments.columns = Object.keys(documentsRows[0]).map((key) => ({ header: key, key }))
    wsDocuments.addRows(documentsRows)
  }

  for (const ws of [wsDepenses, wsFactures, wsKm, wsDocuments]) {
    ws.getRow(1).font = { bold: true }
  }

  const workbookBuffer = await workbook.xlsx.writeBuffer()
  zip.file('Classeur-comptable.xlsx', workbookBuffer)

  return zip.generateAsync({ type: 'blob' })
}
