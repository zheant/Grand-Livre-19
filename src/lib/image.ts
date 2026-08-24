export interface CompressedImage {
  blob: Blob
  dataUrl: string
  base64: string
  mediaType: string
}

// Compresse une image côté client (canvas) avant stockage/envoi — évite de
// saturer IndexedDB et de gonfler la requête d'extraction.
export function compressImage(
  file: File | Blob,
  maxWidth = 1100,
  quality = 0.72,
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('lecture_impossible'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('image_invalide'))
      img.onload = () => {
        let w = img.width
        let h = img.height
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w)
          w = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('canvas_indisponible'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('compression_impossible'))
              return
            }
            const dataUrl = canvas.toDataURL('image/jpeg', quality)
            const base64 = dataUrl.split(',')[1] ?? ''
            resolve({ blob, dataUrl, base64, mediaType: 'image/jpeg' })
          },
          'image/jpeg',
          quality,
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('lecture_impossible'))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}
