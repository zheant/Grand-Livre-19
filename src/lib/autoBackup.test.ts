import { describe, expect, it } from 'vitest'
import {
  ensureReadWritePermission,
  readAndImportFromHandle,
  writeBackupToHandle,
  type BackupFileHandle,
} from './autoBackup'
import type { BackupStorageLike } from './backup'

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

class FakeFileHandle implements BackupFileHandle {
  content = ''
  permission: PermissionState = 'granted'
  requestedPermission: PermissionState = 'granted'
  writeCalls: string[] = []

  async queryPermission() {
    return this.permission
  }

  async requestPermission() {
    return this.requestedPermission
  }

  async getFile() {
    return new Blob([this.content], { type: 'application/json' })
  }

  async createWritable() {
    return {
      write: async (data: string) => {
        this.writeCalls.push(data)
        this.content = data
      },
      close: async () => {},
    }
  }
}

describe('ensureReadWritePermission', () => {
  it('retourne true sans redemander si déjà accordée', async () => {
    const handle = new FakeFileHandle()
    handle.permission = 'granted'
    const ok = await ensureReadWritePermission(handle, false)
    expect(ok).toBe(true)
  })

  it('retourne false sans redemander en mode non interactif si non accordée', async () => {
    const handle = new FakeFileHandle()
    handle.permission = 'prompt'
    const ok = await ensureReadWritePermission(handle, false)
    expect(ok).toBe(false)
  })

  it('redemande la permission en mode interactif et respecte la réponse', async () => {
    const handle = new FakeFileHandle()
    handle.permission = 'prompt'
    handle.requestedPermission = 'granted'
    expect(await ensureReadWritePermission(handle, true)).toBe(true)

    const refused = new FakeFileHandle()
    refused.permission = 'prompt'
    refused.requestedPermission = 'denied'
    expect(await ensureReadWritePermission(refused, true)).toBe(false)
  })
})

describe('writeBackupToHandle', () => {
  it('écrit un JSON exportant toutes les clés du stockage source', async () => {
    const source = new FakeStorage()
    await source.set('geo360:depenses-index', JSON.stringify([{ id: 'a' }]))
    const handle = new FakeFileHandle()

    await writeBackupToHandle(handle, source)

    expect(handle.writeCalls).toHaveLength(1)
    const written = JSON.parse(handle.writeCalls[0])
    expect(written.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'geo360:depenses-index', type: 'text' }),
      ]),
    )
  })
})

describe('readAndImportFromHandle', () => {
  it('lit le fichier et restaure son contenu dans le stockage cible', async () => {
    const handle = new FakeFileHandle()
    handle.content = JSON.stringify({
      exportedAt: '2026-01-01T00:00:00.000Z',
      version: 'livre-affaire-backup-v1',
      entries: [{ key: 'geo360:trajets', type: 'text', value: JSON.stringify([{ id: 't1' }]) }],
    })

    const target = new FakeStorage()
    const resultat = await readAndImportFromHandle(handle, target)

    expect(resultat.entreesRestaurees).toBe(1)
    const restored = await target.get('geo360:trajets')
    expect(JSON.parse(restored!.value as string)).toEqual([{ id: 't1' }])
  })

  it('un aller-retour écriture puis lecture restaure exactement les mêmes données', async () => {
    const source = new FakeStorage()
    await source.set('geo360:depenses-index', JSON.stringify([{ id: 'x', montantCents: 500 }]))
    await source.set('taxes-config', 'ignoré-mais-présent')
    const handle = new FakeFileHandle()

    await writeBackupToHandle(handle, source)

    const target = new FakeStorage()
    await readAndImportFromHandle(handle, target)

    expect(await target.get('geo360:depenses-index')).toEqual(await source.get('geo360:depenses-index'))
    expect(await target.get('taxes-config')).toEqual(await source.get('taxes-config'))
  })
})
