// Sauvegarde complète — le seul filet de sécurité puisque toutes les
// données vivent en local (IndexedDB). Exporte CHAQUE clé (index JSON +
// images/fichiers en Blob) dans un unique fichier JSON, et sait la
// restaurer intégralement. Traité comme critique : voir backup.test.ts.

import { base64ToBlob, blobToBase64 } from './base64'

export interface BackupEntryText {
  key: string
  type: 'text'
  value: string
}

export interface BackupEntryBlob {
  key: string
  type: 'blob'
  mediaType: string
  base64: string
}

export type BackupEntry = BackupEntryText | BackupEntryBlob

export interface BackupFile {
  exportedAt: string
  version: string
  entries: BackupEntry[]
}

export interface BackupStorageLike {
  get: (key: string) => Promise<{ value: string | Blob } | null>
  set: (key: string, value: string | Blob) => Promise<void>
  list: (prefix?: string) => Promise<string[]>
}

export const BACKUP_VERSION = 'livre-affaire-backup-v1'

export async function exporterSauvegarde(storage: BackupStorageLike): Promise<BackupFile> {
  const keys = await storage.list()
  const entries: BackupEntry[] = []

  for (const key of keys) {
    const result = await storage.get(key)
    if (!result) continue

    if (result.value instanceof Blob) {
      const base64 = await blobToBase64(result.value)
      entries.push({
        key,
        type: 'blob',
        mediaType: result.value.type || 'application/octet-stream',
        base64,
      })
    } else {
      entries.push({ key, type: 'text', value: result.value })
    }
  }

  return { exportedAt: new Date().toISOString(), version: BACKUP_VERSION, entries }
}

function isValidEntry(raw: unknown): raw is BackupEntry {
  if (!raw || typeof raw !== 'object') return false
  const entry = raw as Record<string, unknown>
  if (typeof entry.key !== 'string' || entry.key.length === 0) return false
  if (entry.type === 'text') return typeof entry.value === 'string'
  if (entry.type === 'blob') {
    return typeof entry.base64 === 'string' && typeof entry.mediaType === 'string'
  }
  return false
}

export function parseBackupFile(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object') {
    throw new Error('fichier_invalide')
  }
  const candidate = raw as Record<string, unknown>
  if (!Array.isArray(candidate.entries)) {
    throw new Error('fichier_invalide')
  }
  const entries = candidate.entries.filter(isValidEntry)
  return {
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
    version: typeof candidate.version === 'string' ? candidate.version : '',
    entries,
  }
}

export interface ImportSauvegardeResultat {
  entreesRestaurees: number
}

// Restauration complète : chaque clé du fichier écrase la valeur actuelle
// (une sauvegarde doit reproduire exactement l'état capturé, pas fusionner
// avec ce qui existe déjà — contrairement à l'importateur du prototype).
export async function importerSauvegarde(
  file: BackupFile,
  storage: BackupStorageLike,
): Promise<ImportSauvegardeResultat> {
  let entreesRestaurees = 0

  for (const entry of file.entries) {
    if (entry.type === 'blob') {
      await storage.set(entry.key, base64ToBlob(entry.base64, entry.mediaType))
    } else {
      await storage.set(entry.key, entry.value)
    }
    entreesRestaurees += 1
  }

  return { entreesRestaurees }
}
