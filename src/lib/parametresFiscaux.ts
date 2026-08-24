import data from '../config/parametres-fiscaux.json'

export interface PalierImposition {
  jusqua: number | null
  taux: number
}

export interface ParametresRrq {
  tauxTravailleurAutonome: number | null
  maximumGainsAdmissibles: number | null
  exemptionBase: number | null
}

export interface ParametresRqap {
  taux: number | null
  maximumRevenuAssurable: number | null
}

export interface ParametresRamq {
  taux: number | null
  seuilExemption: number | null
  cotisationMaximale: number | null
}

export interface ParametresFiscauxAnnee {
  tps: number
  tvq: number
  seuilInscriptionTaxes: number
  paliersFederal: PalierImposition[]
  paliersQuebec: PalierImposition[]
  abattementQuebec: number
  creditPersonnelFederal: number | null
  creditPersonnelQuebec: number | null
  rrq: ParametresRrq
  rqap: ParametresRqap
  ramq: ParametresRamq
  tauxKmRepere: number
}

const parametresParAnnee = data as unknown as Record<string, ParametresFiscauxAnnee>

export function getParametresFiscaux(annee: string): ParametresFiscauxAnnee | null {
  if (annee.startsWith('_')) return null
  return parametresParAnnee[annee] ?? null
}

function anneesConfigurees(): string[] {
  return Object.keys(parametresParAnnee)
    .filter((a) => !a.startsWith('_'))
    .sort()
}

// Repli sur l'année configurée la plus récente si l'année demandée n'y figure
// pas encore — évite d'afficher « non configuré » pour l'année en cours
// simplement parce que le fichier n'a pas été mis à jour.
export function getParametresFiscauxAvecRepli(annee: string): ParametresFiscauxAnnee | null {
  const direct = getParametresFiscaux(annee)
  if (direct) return direct
  const annees = anneesConfigurees()
  const derniere = annees[annees.length - 1]
  return derniere ? getParametresFiscaux(derniere) : null
}

export function getTauxKmRepere(annee: string): number | null {
  return getParametresFiscauxAvecRepli(annee)?.tauxKmRepere ?? null
}
