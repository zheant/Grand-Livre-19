import { describe, expect, it } from 'vitest'
import {
  BACKUP_VERSION,
  exporterSauvegarde,
  importerSauvegarde,
  parseBackupFile,
  type BackupStorageLike,
} from './backup'

class FakeStorage implements BackupStorageLike {
  store = new Map<string, string | Blob>()

  async get(key: string) {
    return this.store.has(key) ? { value: this.store.get(key)! } : null
  }

  async set(key: string, value: string | Blob) {
    this.store.set(key, value)
  }

  async list(prefix = '') {
    return Array.from(this.store.keys())
      .filter((k) => k.startsWith(prefix))
      .sort()
  }
}

describe('exporterSauvegarde', () => {
  it('exporte chaque clé texte et blob avec le bon type', async () => {
    const storage = new FakeStorage()
    await storage.set('geo360:depenses-index', '[{"id":"1"}]')
    await storage.set('geo360:depense-img:1', new Blob(['photo'], { type: 'image/jpeg' }))

    const backup = await exporterSauvegarde(storage)
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(backup.entries).toHaveLength(2)

    const texte = backup.entries.find((e) => e.key === 'geo360:depenses-index')
    expect(texte).toMatchObject({ type: 'text', value: '[{"id":"1"}]' })

    const blob = backup.entries.find((e) => e.key === 'geo360:depense-img:1')
    expect(blob).toMatchObject({ type: 'blob', mediaType: 'image/jpeg' })
  })

  it("n'omet aucune clé, même sur un grand nombre d'entrées", async () => {
    const storage = new FakeStorage()
    for (let i = 0; i < 50; i++) {
      await storage.set(`geo360:depense-img:${i}`, `valeur-${i}`)
    }
    const backup = await exporterSauvegarde(storage)
    expect(backup.entries).toHaveLength(50)
  })
})

describe('parseBackupFile', () => {
  it('accepte une enveloppe valide', () => {
    const file = parseBackupFile({
      exportedAt: '2026-01-01T00:00:00.000Z',
      version: BACKUP_VERSION,
      entries: [{ key: 'a', type: 'text', value: '1' }],
    })
    expect(file.entries).toHaveLength(1)
  })

  it('rejette un fichier sans tableau entries', () => {
    expect(() => parseBackupFile({ version: BACKUP_VERSION })).toThrow()
    expect(() => parseBackupFile(null)).toThrow()
    expect(() => parseBackupFile('texte')).toThrow()
  })

  it('filtre silencieusement les entrées mal formées plutôt que de planter', () => {
    const file = parseBackupFile({
      entries: [
        { key: 'valide', type: 'text', value: '1' },
        { key: 'sans-valeur', type: 'text' },
        { type: 'text', value: 'sans-clé' },
        { key: 'blob-incomplet', type: 'blob', base64: 'abc' }, // mediaType manquant
        'pas-un-objet',
      ],
    })
    expect(file.entries).toEqual([{ key: 'valide', type: 'text', value: '1' }])
  })
})

describe('importerSauvegarde — aller-retour complet (le test critique)', () => {
  it('restaure exactement les données texte ET binaires, y compris sur un stockage déjà occupé', async () => {
    const source = new FakeStorage()
    await source.set('geo360:depenses-index', JSON.stringify([{ id: 'a', montantCents: 4550 }]))
    await source.set('geo360:factures-index', JSON.stringify([{ id: 'f1' }]))
    await source.set('geo360:depense-img:a', new Blob(['contenu binaire du reçu'], { type: 'image/jpeg' }))
    await source.set('manutention:trajets', JSON.stringify([{ id: 't1', km: 42 }]))
    await source.set('taxes-config', JSON.stringify({ inscrit: true }))

    const backup = await exporterSauvegarde(source)
    const serialized = JSON.stringify(backup) // simule l'écriture/lecture du fichier .json réel
    const parsed = parseBackupFile(JSON.parse(serialized))

    // Le stockage de destination contient déjà d'anciennes données qui
    // doivent être écrasées par la restauration.
    const destination = new FakeStorage()
    await destination.set('geo360:depenses-index', '[]')
    await destination.set('taxes-config', JSON.stringify({ inscrit: false }))

    const resultat = await importerSauvegarde(parsed, destination)
    expect(resultat.entreesRestaurees).toBe(5)

    const depenses = await destination.get('geo360:depenses-index')
    expect(JSON.parse(depenses!.value as string)).toEqual([{ id: 'a', montantCents: 4550 }])

    const factures = await destination.get('geo360:factures-index')
    expect(JSON.parse(factures!.value as string)).toEqual([{ id: 'f1' }])

    const trajets = await destination.get('manutention:trajets')
    expect(JSON.parse(trajets!.value as string)).toEqual([{ id: 't1', km: 42 }])

    const config = await destination.get('taxes-config')
    expect(JSON.parse(config!.value as string)).toEqual({ inscrit: true })

    const image = await destination.get('geo360:depense-img:a')
    expect(image!.value).toBeInstanceOf(Blob)
    const blob = image!.value as Blob
    expect(blob.type).toBe('image/jpeg')
    expect(await blob.text()).toBe('contenu binaire du reçu')
  })

  it('préserve fidèlement des octets binaires non textuels (pas seulement du texte encodable)', async () => {
    const source = new FakeStorage()
    const octets = new Uint8Array([0, 255, 128, 1, 254, 17, 200])
    await source.set('geo360:depense-img:x', new Blob([octets], { type: 'image/png' }))

    const backup = await exporterSauvegarde(source)
    const parsed = parseBackupFile(JSON.parse(JSON.stringify(backup)))

    const destination = new FakeStorage()
    await importerSauvegarde(parsed, destination)

    const restored = (await destination.get('geo360:depense-img:x'))!.value as Blob
    const restoredBytes = new Uint8Array(await restored.arrayBuffer())
    expect(Array.from(restoredBytes)).toEqual(Array.from(octets))
  })

  it('un import répété du même fichier est stable (idempotent)', async () => {
    const source = new FakeStorage()
    await source.set('geo360:trajets', JSON.stringify([{ id: 't1', km: 10 }]))
    const backup = await exporterSauvegarde(source)

    const destination = new FakeStorage()
    await importerSauvegarde(backup, destination)
    await importerSauvegarde(backup, destination)

    const trajets = await destination.get('geo360:trajets')
    expect(JSON.parse(trajets!.value as string)).toEqual([{ id: 't1', km: 10 }])
    expect((await destination.list()).length).toBe(1)
  })
})
