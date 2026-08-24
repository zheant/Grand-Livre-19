// Déclenche le téléchargement d'un fichier généré côté client — aucune
// dépendance serveur, tout reste local.

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
