// Sauvegarde automatique hybride : sur les navigateurs qui supportent l'API
// File System Access (Chrome/Edge/Opera de bureau), le bouton « Enregistrer »
// écrit directement dans un fichier choisi une fois par l'utilisateur, et
// l'appli tente de le relire automatiquement à l'ouverture. Sur les autres
// navigateurs (Firefox, Safari, mobile), le bouton persiste seulement dans
// IndexedDB — aucun fichier de sauvegarde n'est écrit automatiquement.

import { storage } from './db'
import {
  exporterSauvegarde,
  importerSauvegarde,
  parseBackupFile,
  type BackupStorageLike,
  type ImportSauvegardeResultat,
} from './backup'
import { clearStoredFileHandle, getStoredFileHandle, setStoredFileHandle } from './fileHandleStore'

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

// Interface structurelle minimale — un vrai FileSystemFileHandle la
// satisfait déjà, et un faux handle de test aussi, sans cast.
export interface BackupFileHandle {
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
  getFile(): Promise<Blob>
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
}

// ---------- Logique testable (pas d'appel direct à window.*) ----------

export async function ensureReadWritePermission(
  handle: BackupFileHandle,
  interactive: boolean,
): Promise<boolean> {
  const current = await handle.queryPermission({ mode: 'readwrite' })
  if (current === 'granted') return true
  if (!interactive) return false
  const requested = await handle.requestPermission({ mode: 'readwrite' })
  return requested === 'granted'
}

export async function writeBackupToHandle(
  handle: BackupFileHandle,
  source: BackupStorageLike = storage,
): Promise<void> {
  const backup = await exporterSauvegarde(source)
  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(backup))
  await writable.close()
}

export async function readAndImportFromHandle(
  handle: BackupFileHandle,
  target: BackupStorageLike = storage,
): Promise<ImportSauvegardeResultat> {
  const file = await handle.getFile()
  const text = await file.text()
  const parsed = parseBackupFile(JSON.parse(text))
  return importerSauvegarde(parsed, target)
}

// ---------- Orchestration navigateur ----------

const PICKER_OPTIONS = {
  suggestedName: 'livre-affaire-sauvegarde.json',
  types: [
    {
      description: "Sauvegarde Livre d'affaire (JSON)",
      accept: { 'application/json': ['.json'] as `.${string}`[] },
    },
  ],
}

export type AutoSaveResult = 'saved' | 'unsupported' | 'cancelled' | 'permission-denied' | 'error'

// Appelé depuis le bouton Enregistrer existant. Première fois : demande où
// sauvegarder (nécessite un geste utilisateur, donc appelé directement dans
// le gestionnaire de clic). Ensuite : réécrit silencieusement le même
// fichier tant que la permission tient.
export async function autoSaveOnClick(): Promise<AutoSaveResult> {
  if (!isFileSystemAccessSupported()) return 'unsupported'
  try {
    let handle = await getStoredFileHandle()
    if (handle) {
      const ok = await ensureReadWritePermission(handle, true)
      if (!ok) return 'permission-denied'
    } else {
      handle = await window.showSaveFilePicker(PICKER_OPTIONS)
      await setStoredFileHandle(handle)
    }
    await writeBackupToHandle(handle)
    return 'saved'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    console.error('Sauvegarde automatique échouée', err)
    return 'error'
  }
}

export type AutoRestoreResult =
  | { kind: 'restored'; entreesRestaurees: number }
  | { kind: 'permission-needed' }
  | { kind: 'no-handle' }
  | { kind: 'unsupported' }
  | { kind: 'error' }

// Tenté silencieusement à l'ouverture de l'appli — aucune interaction requise
// tant que le navigateur se souvient de la permission accordée.
export async function tryAutoRestoreOnStartup(): Promise<AutoRestoreResult> {
  if (!isFileSystemAccessSupported()) return { kind: 'unsupported' }
  try {
    const handle = await getStoredFileHandle()
    if (!handle) return { kind: 'no-handle' }
    const ok = await ensureReadWritePermission(handle, false)
    if (!ok) return { kind: 'permission-needed' }
    const resultat = await readAndImportFromHandle(handle)
    return { kind: 'restored', entreesRestaurees: resultat.entreesRestaurees }
  } catch (err) {
    console.error('Restauration automatique échouée', err)
    return { kind: 'error' }
  }
}

// Pour le bandeau « clique pour autoriser » quand la permission doit être
// reconfirmée par un geste utilisateur.
export async function requestPermissionAndRestore(): Promise<AutoRestoreResult> {
  try {
    const handle = await getStoredFileHandle()
    if (!handle) return { kind: 'no-handle' }
    const ok = await ensureReadWritePermission(handle, true)
    if (!ok) return { kind: 'permission-needed' }
    const resultat = await readAndImportFromHandle(handle)
    return { kind: 'restored', entreesRestaurees: resultat.entreesRestaurees }
  } catch (err) {
    console.error('Restauration échouée', err)
    return { kind: 'error' }
  }
}

export async function forgetAutoBackupFile(): Promise<void> {
  await clearStoredFileHandle()
}
