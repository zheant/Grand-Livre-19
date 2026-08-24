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
import { isTauriRuntime } from './updater'

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

// ---------- Orchestration navigateur (repli web — hors Tauri) ----------

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

async function autoSaveOnClickWeb(): Promise<AutoSaveResult> {
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

async function tryAutoRestoreOnStartupWeb(): Promise<AutoRestoreResult> {
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
// reconfirmée par un geste utilisateur (navigateur seulement — sous Tauri,
// la restauration native ne redemande jamais).
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

// ---------- Orchestration Tauri (app packagée) ----------
//
// Sous Tauri, on évite complètement l'API File System Access du navigateur
// (WebView2 redemande sa permission « lecture/écriture » à chaque relance de
// l'appli, contrairement à Chrome de bureau). On utilise plutôt les API
// fichier natives de Tauri : l'emplacement du fichier n'est choisi qu'une
// fois (via la boîte de dialogue native), puis retenu comme simple chemin —
// les lectures/écritures suivantes ne redemandent jamais rien.

const BACKUP_PATH_KEY = 'auto-backup-path'

async function getStoredBackupPath(): Promise<string | null> {
  const r = await storage.get(BACKUP_PATH_KEY)
  return r ? (r.value as string) : null
}

async function setStoredBackupPath(path: string): Promise<void> {
  await storage.set(BACKUP_PATH_KEY, path)
}

async function clearStoredBackupPath(): Promise<void> {
  await storage.delete(BACKUP_PATH_KEY)
}

async function autoSaveOnClickTauri(): Promise<AutoSaveResult> {
  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    let path = await getStoredBackupPath()
    if (!path) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const chosen = await save({
        defaultPath: 'livre-affaire-sauvegarde.json',
        filters: [{ name: 'Sauvegarde JSON', extensions: ['json'] }],
      })
      if (!chosen) return 'cancelled'
      path = chosen
      await setStoredBackupPath(path)
    }
    const backup = await exporterSauvegarde(storage)
    await writeTextFile(path, JSON.stringify(backup))
    return 'saved'
  } catch (err) {
    console.error('Sauvegarde automatique échouée', err)
    return 'error'
  }
}

async function tryAutoRestoreOnStartupTauri(): Promise<AutoRestoreResult> {
  try {
    const path = await getStoredBackupPath()
    if (!path) return { kind: 'no-handle' }
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
    if (!(await exists(path))) return { kind: 'no-handle' }
    const text = await readTextFile(path)
    const parsed = parseBackupFile(JSON.parse(text))
    const resultat = await importerSauvegarde(parsed, storage)
    return { kind: 'restored', entreesRestaurees: resultat.entreesRestaurees }
  } catch (err) {
    console.error('Restauration automatique échouée', err)
    return { kind: 'error' }
  }
}

// ---------- Points d'entrée utilisés par l'UI ----------

// Appelé depuis le bouton Enregistrer existant. Première fois : demande où
// sauvegarder (nécessite un geste utilisateur, donc appelé directement dans
// le gestionnaire de clic). Ensuite : réécrit silencieusement le même
// fichier.
export async function autoSaveOnClick(): Promise<AutoSaveResult> {
  return isTauriRuntime() ? autoSaveOnClickTauri() : autoSaveOnClickWeb()
}

// Tenté silencieusement à l'ouverture de l'appli.
export async function tryAutoRestoreOnStartup(): Promise<AutoRestoreResult> {
  return isTauriRuntime() ? tryAutoRestoreOnStartupTauri() : tryAutoRestoreOnStartupWeb()
}

export async function forgetAutoBackupFile(): Promise<void> {
  await clearStoredFileHandle()
  await clearStoredBackupPath()
}
