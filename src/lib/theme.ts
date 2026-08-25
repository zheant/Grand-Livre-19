export type ThemeId =
  | 'classique'
  | 'vegas'
  | 'royal'
  | 'slots'
  | 'blackjack'
  | 'bubblegum'
  | 'natural'
  | 'quebec'
  | 'cosmos'
  | 'zaza'

const STORAGE_KEY = 'livre-affaire-theme'

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'classique', label: 'Classique' },
  { id: 'vegas', label: 'Vegas néon' },
  { id: 'royal', label: 'Casino royal' },
  { id: 'slots', label: 'Machine à sous' },
  { id: 'blackjack', label: 'Blackjack' },
  { id: 'bubblegum', label: 'Bubble gum' },
  { id: 'natural', label: 'Naturel' },
  { id: 'quebec', label: 'Québec indépendant' },
  { id: 'cosmos', label: 'Cosmos' },
  { id: 'zaza', label: 'Zaza' },
]

export function getStoredTheme(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY)
  return THEMES.some((t) => t.id === stored) ? (stored as ThemeId) : 'classique'
}

export function applyTheme(theme: ThemeId) {
  if (theme === 'classique') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = theme
  }
  localStorage.setItem(STORAGE_KEY, theme)
}
