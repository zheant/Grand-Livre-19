import { openDB, type IDBPDatabase } from 'idb'

// Stockage dédié (hors du store principal, qui ne prend que string|Blob)
// pour le FileSystemFileHandle du fichier de sauvegarde automatique — un
// FileSystemFileHandle est clonable de façon structurée, IndexedDB peut le
// garder directement d'une session à l'autre.
const DB_NAME = 'livre-affaire-backup-handle'
const STORE_NAME = 'handle'
const KEY = 'backup-file-handle'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
      },
    })
  }
  return dbPromise
}

export async function getStoredFileHandle(): Promise<FileSystemFileHandle | null> {
  const db = await getDb()
  const handle = await db.get(STORE_NAME, KEY)
  return (handle as FileSystemFileHandle | undefined) ?? null
}

export async function setStoredFileHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, handle, KEY)
}

export async function clearStoredFileHandle(): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, KEY)
}
