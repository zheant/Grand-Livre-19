import { useCallback, useEffect, useState } from 'react'
import { storage } from '../lib/db'
import { documentFileKey, GLOBAL_KEYS } from '../lib/globalKeys'
import { uid } from '../lib/uid'
import type { TaxDocument } from '../types'

export function useDocuments() {
  const [documents, setDocumentsState] = useState<TaxDocument[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const raw = await storage.get(GLOBAL_KEYS.documentsIndex)
      if (cancelled) return
      setDocumentsState(raw ? (JSON.parse(raw.value as string) as TaxDocument[]) : [])
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: TaxDocument[]) => {
    setDocumentsState(next)
    await storage.set(GLOBAL_KEYS.documentsIndex, JSON.stringify(next))
  }, [])

  const addDocument = useCallback(
    async (record: Omit<TaxDocument, 'id'>, file: { blob: Blob; name: string } | null) => {
      const id = uid()
      if (file) await storage.set(documentFileKey(id), file.blob)
      await persist([{ ...record, id }, ...documents])
    },
    [documents, persist],
  )

  const deleteDocument = useCallback(
    async (id: string) => {
      await persist(documents.filter((d) => d.id !== id))
      await storage.delete(documentFileKey(id))
    },
    [documents, persist],
  )

  const getDocumentFile = useCallback(async (id: string): Promise<Blob | null> => {
    const r = await storage.get(documentFileKey(id))
    return r && r.value instanceof Blob ? r.value : null
  }, [])

  return { documents, loaded, addDocument, deleteDocument, getDocumentFile }
}
