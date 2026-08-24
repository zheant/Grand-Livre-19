import { useEffect, useState } from 'react'

// Convertit un Blob stocké en IndexedDB en URL affichable (<img src>), et
// libère l'URL quand le composant démonte ou que le blob change.
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return url
}
