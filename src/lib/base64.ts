// Conversions base64 <-> Blob sans dépendre de FileReader (indisponible hors
// navigateur) — utilisent Blob.arrayBuffer(), disponible en Node comme dans
// tous les navigateurs modernes. Utilisé par la sauvegarde complète.

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
}

export function base64ToBlob(base64: string, mediaType: string): Blob {
  // Cast : TS infère Uint8Array<ArrayBufferLike> ici, incompatible avec le
  // type BlobPart trop strict — sans risque réel, new Uint8Array(n) n'est
  // jamais adossé à un SharedArrayBuffer.
  return new Blob([base64ToBytes(base64) as BlobPart], { type: mediaType })
}
