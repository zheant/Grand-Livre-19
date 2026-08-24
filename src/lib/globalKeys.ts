// Clés IndexedDB globales (non préfixées par contexte) — les documents
// appartiennent à la personne, pas à un contexte Géo360/Manutention en
// particulier.
export const GLOBAL_KEYS = {
  documentsIndex: 'documents-index',
  settings: 'app-settings',
} as const

export function documentFileKey(id: string): string {
  return `document-file:${id}`
}
