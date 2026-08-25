// Déclenche le téléchargement d'un fichier généré côté client — aucune
// dépendance serveur, tout reste local.

import { isTauriRuntime } from './updater'

// Ouvre un fichier (reçu, PDF de facture, etc.) dans une visionneuse externe.
// Sous Tauri, un lien <a target="_blank"> vers une blob: URL ne fait rien —
// la webview n'a pas de notion d'« onglet », et une blob: URL n'est de toute
// façon valide que dans le contexte qui l'a créée. On écrit donc une copie
// temporaire du fichier sur disque puis on demande au système de l'ouvrir
// avec l'application par défaut (visionneuse PDF, etc.).
export async function openFileExternally(blob: Blob, fileName: string): Promise<void> {
  if (isTauriRuntime()) {
    const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    const { openPath } = await import('@tauri-apps/plugin-opener')
    const { tempDir, join } = await import('@tauri-apps/api/path')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const safeName = `grand-livre-${Date.now()}-${fileName.replace(/[\\/:*?"<>|]/g, '_')}`
    // Écrit via BaseDirectory.Temp (résolution interne à Tauri) plutôt que
    // via un chemin absolu assemblé à la main — évite un chemin qui ne
    // correspond pas exactement à ce que la portée `$TEMP` autorise (ex.
    // forme courte 8.3 ou casse différente du chemin temp sur Windows).
    await writeFile(safeName, bytes, { baseDir: BaseDirectory.Temp })
    const path = await join(await tempDir(), safeName)
    await openPath(path)
    return
  }
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain'): void {
  downloadBlob(filename, new Blob([content], { type: mimeType }))
}

export type SaveWithPickerResult = 'saved' | 'cancelled' | 'unsupported-fallback'

// Propose un sélecteur d'emplacement natif (comme le bouton « Enregistrer »)
// plutôt que de tomber directement dans Téléchargements. Si l'API n'est pas
// supportée, retombe sur le téléchargement classique.
export async function saveBlobWithPicker(
  suggestedName: string,
  blob: Blob,
  filePickerType: { description: string; accept: Record<string, `.${string}`[]> },
): Promise<SaveWithPickerResult> {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [filePickerType],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      throw err
    }
  }
  downloadBlob(suggestedName, blob)
  return 'unsupported-fallback'
}
