import { describe, expect, it } from 'vitest'
import { base64ToBlob, base64ToBytes, blobToBase64, bytesToBase64 } from './base64'

describe('bytesToBase64 / base64ToBytes', () => {
  it('fait un aller-retour exact sur des octets arbitraires', () => {
    const original = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 65, 97])
    const encoded = bytesToBase64(original)
    const decoded = base64ToBytes(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(original))
  })
})

describe('blobToBase64 / base64ToBlob', () => {
  it('fait un aller-retour exact avec le type MIME préservé', async () => {
    const original = new Blob(['contenu de test 123'], { type: 'image/jpeg' })
    const base64 = await blobToBase64(original)
    const restored = base64ToBlob(base64, 'image/jpeg')
    expect(restored.type).toBe('image/jpeg')
    const text = await restored.text()
    expect(text).toBe('contenu de test 123')
  })
})
