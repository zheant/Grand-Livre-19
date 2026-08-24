import type { ContextId } from '../types'

function scoped(context: ContextId, key: string): string {
  return `${context}:${key}`
}

export const ledgerKeys = {
  depensesIndex: (c: ContextId) => scoped(c, 'depenses-index'),
  facturesIndex: (c: ContextId) => scoped(c, 'factures-index'),
  trajets: (c: ContextId) => scoped(c, 'trajets'),
  depenseImg: (c: ContextId, id: string) => scoped(c, `depense-img:${id}`),
  factureFile: (c: ContextId, id: string) => scoped(c, `facture-file:${id}`),
  tripImgBefore: (c: ContextId, id: string) => scoped(c, `trip-img-before:${id}`),
  tripImgAfter: (c: ContextId, id: string) => scoped(c, `trip-img-after:${id}`),
}
