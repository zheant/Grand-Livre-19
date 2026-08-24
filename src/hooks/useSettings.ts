import { useCallback, useEffect, useState } from 'react'
import categoriesDefaut from '../config/categories.json'
import { storage } from '../lib/db'
import { GLOBAL_KEYS } from '../lib/globalKeys'
import { CONTEXT_NAMES, type ContextId } from '../types'

export interface AppSettings {
  userName: string
  taxesInscrit: boolean
  contextNames: Record<ContextId, string>
  categories: string[]
}

const DEFAULT_SETTINGS: AppSettings = {
  userName: 'Tristan Haese',
  // Préserve le comportement historique de l'appli (autofill TPS/TVQ
  // toujours actif) tant que l'utilisateur n'a pas explicitement précisé
  // son statut d'inscription dans les paramètres.
  taxesInscrit: true,
  contextNames: { ...CONTEXT_NAMES },
  categories: [...categoriesDefaut],
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    storage.get(GLOBAL_KEYS.settings).then((r) => {
      if (cancelled) return
      if (r) {
        const parsed = JSON.parse(r.value as string) as Partial<AppSettings>
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          contextNames: { ...DEFAULT_SETTINGS.contextNames, ...parsed.contextNames },
          categories: parsed.categories?.length ? parsed.categories : DEFAULT_SETTINGS.categories,
        })
      }
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback(
    async (partial: Partial<AppSettings>) => {
      const next = { ...settings, ...partial }
      setSettings(next)
      await storage.set(GLOBAL_KEYS.settings, JSON.stringify(next))
    },
    [settings],
  )

  return { settings, loaded, update }
}
