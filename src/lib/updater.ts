import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater'

// L'appli tourne aussi bien dans un navigateur ordinaire (npm run dev) que
// packagée avec Tauri — les API de mise à jour n'existent que côté Tauri.
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

let pendingUpdate: Update | null = null

export interface UpdateCheckResult {
  available: boolean
  version?: string
  notes?: string
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) return { available: false }
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  pendingUpdate = update
  if (!update) return { available: false }
  return { available: true, version: update.version, notes: update.body }
}

export async function installPendingUpdate(onProgress: (pct: number | null) => void): Promise<void> {
  if (!pendingUpdate) throw new Error('Aucune mise à jour vérifiée.')
  let downloaded = 0
  let total = 0
  await pendingUpdate.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? 0
      onProgress(total > 0 ? 0 : null)
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength
      onProgress(total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null)
    }
  })
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}

export async function getAppVersion(): Promise<string | null> {
  if (!isTauriRuntime()) return null
  const { getVersion } = await import('@tauri-apps/api/app')
  return getVersion()
}
