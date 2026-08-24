import { useCallback, useEffect, useState } from 'react'
import { storage } from '../lib/db'
import { ledgerKeys } from '../lib/ledgerKeys'
import { normalizeInvoice } from '../lib/normalize'
import type { ContextId, Expense, Invoice, Trip } from '../types'

// Au-delà, on garde le nom du fichier mais pas son contenu — IndexedDB tolère
// bien plus que le quota localStorage de l'ancien prototype (~5 Mo), mais un
// plafond de bon sens évite qu'un gros PDF ralentisse l'appli.
export const TAILLE_MAX_FICHIER = 20 * 1024 * 1024

// Décrit ce qu'il faut faire de l'image/fichier associé lors d'une
// modification : ne pas y toucher, la retirer, ou la remplacer.
export type ImageAction = { kind: 'unchanged' } | { kind: 'removed' } | { kind: 'replaced'; blob: Blob }

export function useLedger(context: ContextId) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [loaded, setLoaded] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  // Permet de forcer un rechargement depuis la base (ex. après un import)
  // sans dépendre d'un changement de contexte.
  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    ;(async () => {
      const [expRaw, invRaw, tripRaw] = await Promise.all([
        storage.get(ledgerKeys.depensesIndex(context)),
        storage.get(ledgerKeys.facturesIndex(context)),
        storage.get(ledgerKeys.trajets(context)),
      ])
      if (cancelled) return
      setExpenses(expRaw ? (JSON.parse(expRaw.value as string) as Expense[]) : [])
      setInvoices(
        invRaw ? (JSON.parse(invRaw.value as string) as Invoice[]).map(normalizeInvoice) : [],
      )
      setTrips(tripRaw ? (JSON.parse(tripRaw.value as string) as Trip[]) : [])
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [context, reloadToken])

  const persistExpenses = useCallback(
    async (next: Expense[]) => {
      setExpenses(next)
      await storage.set(ledgerKeys.depensesIndex(context), JSON.stringify(next))
    },
    [context],
  )
  const persistInvoices = useCallback(
    async (next: Invoice[]) => {
      setInvoices(next)
      await storage.set(ledgerKeys.facturesIndex(context), JSON.stringify(next))
    },
    [context],
  )
  const persistTrips = useCallback(
    async (next: Trip[]) => {
      setTrips(next)
      await storage.set(ledgerKeys.trajets(context), JSON.stringify(next))
    },
    [context],
  )

  const saveAll = useCallback(async () => {
    await Promise.all([
      storage.set(ledgerKeys.depensesIndex(context), JSON.stringify(expenses)),
      storage.set(ledgerKeys.facturesIndex(context), JSON.stringify(invoices)),
      storage.set(ledgerKeys.trajets(context), JSON.stringify(trips)),
    ])
  }, [context, expenses, invoices, trips])

  // ---------- Dépenses ----------
  const addExpense = useCallback(
    async (record: Expense, image: Blob | null) => {
      if (image) await storage.set(ledgerKeys.depenseImg(context, record.id), image)
      await persistExpenses([record, ...expenses])
    },
    [context, expenses, persistExpenses],
  )
  const updateExpense = useCallback(
    async (record: Expense, imageAction: ImageAction) => {
      if (imageAction.kind === 'replaced') {
        await storage.set(ledgerKeys.depenseImg(context, record.id), imageAction.blob)
      } else if (imageAction.kind === 'removed') {
        await storage.delete(ledgerKeys.depenseImg(context, record.id))
      }
      await persistExpenses(expenses.map((e) => (e.id === record.id ? record : e)))
    },
    [context, expenses, persistExpenses],
  )
  const deleteExpense = useCallback(
    async (id: string) => {
      await persistExpenses(expenses.filter((e) => e.id !== id))
      await storage.delete(ledgerKeys.depenseImg(context, id))
    },
    [context, expenses, persistExpenses],
  )
  const getExpenseImage = useCallback(
    async (id: string): Promise<Blob | null> => {
      const r = await storage.get(ledgerKeys.depenseImg(context, id))
      return r && r.value instanceof Blob ? r.value : null
    },
    [context],
  )

  // ---------- Factures ----------
  const addInvoice = useCallback(
    async (record: Invoice, file: { blob: Blob; name: string } | null) => {
      if (file) await storage.set(ledgerKeys.factureFile(context, record.id), file.blob)
      await persistInvoices([record, ...invoices])
    },
    [context, invoices, persistInvoices],
  )
  const updateInvoice = useCallback(
    async (record: Invoice, fileAction: ImageAction) => {
      if (fileAction.kind === 'replaced') {
        await storage.set(ledgerKeys.factureFile(context, record.id), fileAction.blob)
      } else if (fileAction.kind === 'removed') {
        await storage.delete(ledgerKeys.factureFile(context, record.id))
      }
      await persistInvoices(invoices.map((f) => (f.id === record.id ? record : f)))
    },
    [context, invoices, persistInvoices],
  )
  const deleteInvoice = useCallback(
    async (id: string) => {
      await persistInvoices(invoices.filter((f) => f.id !== id))
      await storage.delete(ledgerKeys.factureFile(context, id))
    },
    [context, invoices, persistInvoices],
  )
  const markInvoicePaid = useCallback(
    async (id: string) => {
      await persistInvoices(
        invoices.map((f) => (f.id === id ? { ...f, statut: 'Payée' as const } : f)),
      )
    },
    [invoices, persistInvoices],
  )
  const getInvoiceFile = useCallback(
    async (id: string): Promise<Blob | null> => {
      const r = await storage.get(ledgerKeys.factureFile(context, id))
      return r && r.value instanceof Blob ? r.value : null
    },
    [context],
  )

  // ---------- Kilométrage ----------
  const addTrip = useCallback(
    async (record: Trip, before: Blob | null, after: Blob | null) => {
      if (before) await storage.set(ledgerKeys.tripImgBefore(context, record.id), before)
      if (after) await storage.set(ledgerKeys.tripImgAfter(context, record.id), after)
      await persistTrips([record, ...trips])
    },
    [context, trips, persistTrips],
  )
  const updateTrip = useCallback(
    async (record: Trip, beforeAction: ImageAction, afterAction: ImageAction) => {
      if (beforeAction.kind === 'replaced') {
        await storage.set(ledgerKeys.tripImgBefore(context, record.id), beforeAction.blob)
      } else if (beforeAction.kind === 'removed') {
        await storage.delete(ledgerKeys.tripImgBefore(context, record.id))
      }
      if (afterAction.kind === 'replaced') {
        await storage.set(ledgerKeys.tripImgAfter(context, record.id), afterAction.blob)
      } else if (afterAction.kind === 'removed') {
        await storage.delete(ledgerKeys.tripImgAfter(context, record.id))
      }
      await persistTrips(trips.map((t) => (t.id === record.id ? record : t)))
    },
    [context, trips, persistTrips],
  )
  const deleteTrip = useCallback(
    async (id: string) => {
      await persistTrips(trips.filter((t) => t.id !== id))
      await storage.delete(ledgerKeys.tripImgBefore(context, id))
      await storage.delete(ledgerKeys.tripImgAfter(context, id))
    },
    [context, trips, persistTrips],
  )
  const getTripImage = useCallback(
    async (id: string, which: 'before' | 'after'): Promise<Blob | null> => {
      const key =
        which === 'before' ? ledgerKeys.tripImgBefore(context, id) : ledgerKeys.tripImgAfter(context, id)
      const r = await storage.get(key)
      return r && r.value instanceof Blob ? r.value : null
    },
    [context],
  )

  return {
    expenses,
    invoices,
    trips,
    loaded,
    reload,
    saveAll,
    addExpense,
    updateExpense,
    deleteExpense,
    getExpenseImage,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    markInvoicePaid,
    getInvoiceFile,
    addTrip,
    updateTrip,
    deleteTrip,
    getTripImage,
  }
}
