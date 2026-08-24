import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

/**
 * Remplace window.storage (API propre aux artifacts Claude) par une couche
 * IndexedDB locale, avec la même forme d'appel (get/set/delete/list) pour
 * que le portage de la logique du prototype reste mécanique.
 *
 * Deux object stores :
 * - records : index JSON légers (chaînes) — ex. depenses-index, factures-index
 * - blobs   : images/fichiers en Blob (pas en base64, qui gonfle de 33 %)
 *
 * La route vers l'un ou l'autre store se fait automatiquement selon le type
 * de la valeur passée à set() : string -> records, Blob -> blobs.
 */

interface LivreDB extends DBSchema {
  records: { key: string; value: string }
  blobs: { key: string; value: Blob }
}

export type StorageValue = string | Blob

export interface StorageEntry<T extends StorageValue = StorageValue> {
  value: T
}

const DB_NAME = 'livre-affaire'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<LivreDB>> | null = null

function getDb(): Promise<IDBPDatabase<LivreDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LivreDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('records')) db.createObjectStore('records')
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
      },
    })
  }
  return dbPromise
}

function storeFor(value: StorageValue): 'records' | 'blobs' {
  return value instanceof Blob ? 'blobs' : 'records'
}

export async function get<T extends StorageValue = StorageValue>(
  key: string,
): Promise<StorageEntry<T> | null> {
  const db = await getDb()
  const fromRecords = await db.get('records', key)
  if (fromRecords !== undefined) return { value: fromRecords as T }
  const fromBlobs = await db.get('blobs', key)
  if (fromBlobs !== undefined) return { value: fromBlobs as T }
  return null
}

export async function set(key: string, value: StorageValue): Promise<void> {
  const db = await getDb()
  const store = storeFor(value)
  const other = store === 'records' ? 'blobs' : 'records'
  const tx = db.transaction([store, other], 'readwrite')
  await tx.objectStore(store).put(value as never, key)
  // Efface l'ancienne entrée dans l'autre store si le type a changé pour cette clé.
  await tx.objectStore(other).delete(key)
  await tx.done
}

async function del(key: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['records', 'blobs'], 'readwrite')
  await tx.objectStore('records').delete(key)
  await tx.objectStore('blobs').delete(key)
  await tx.done
}

export async function list(prefix = ''): Promise<string[]> {
  const db = await getDb()
  const recordKeys = await db.getAllKeys('records')
  const blobKeys = await db.getAllKeys('blobs')
  const all = new Set<string>([...recordKeys, ...blobKeys])
  return Array.from(all)
    .filter((key) => key.startsWith(prefix))
    .sort()
}

export const storage = { get, set, delete: del, list }
