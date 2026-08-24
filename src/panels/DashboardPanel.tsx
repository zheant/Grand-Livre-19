import { useState } from 'react'
import type { AppSettings } from '../hooks/useSettings'
import { formatCents, formatKm, toCents } from '../lib/money'
import { getTauxKmRepere } from '../lib/parametresFiscaux'
import type { useLedger } from '../hooks/useLedger'

type Ledger = ReturnType<typeof useLedger>

export function DashboardPanel({ ledger, settings }: { ledger: Ledger; settings: AppSettings }) {
  const { expenses, invoices, trips } = ledger
  const [montantsMode, setMontantsMode] = useState<'horsTaxes' | 'avecTaxes'>('horsTaxes')
  const [reservePct, setReservePct] = useState(27)

  const currentYear = new Date().getFullYear().toString()
  const invoicesThisYear = invoices.filter((f) => f.date.slice(0, 4) === currentYear)
  const expensesThisYear = expenses.filter((e) => e.date.slice(0, 4) === currentYear)
  const tripsThisYear = trips.filter((t) => t.date.slice(0, 4) === currentYear)

  const revenuPayeCents = invoicesThisYear
    .filter((f) => f.statut === 'Payée')
    .reduce((s, f) => s + f.montantCents, 0)
  const revenuTotalCents = invoicesThisYear.reduce((s, f) => s + f.montantCents, 0)
  const revenuTaxesCents = invoicesThisYear.reduce((s, f) => s + f.tpsCents + f.tvqCents, 0)
  const revenuEnAttenteCents = revenuTotalCents - revenuPayeCents
  const revenuAfficheCents = montantsMode === 'avecTaxes' ? revenuTotalCents + revenuTaxesCents : revenuTotalCents

  const totalDepensesCents = expensesThisYear.reduce((s, e) => s + e.montantCents, 0)
  const depensesTaxesCents = expensesThisYear.reduce((s, e) => s + e.tpsCents + e.tvqCents, 0)
  const totalDepensesAfficheCents =
    montantsMode === 'avecTaxes' ? totalDepensesCents + depensesTaxesCents : totalDepensesCents
  const kmCetteAnnee = tripsThisYear.reduce((s, t) => s + t.km, 0)
  const tauxKm = getTauxKmRepere(currentYear)
  const kmDeductionCents = tauxKm != null ? toCents(kmCetteAnnee * tauxKm) : 0

  // Le revenu net imposable se calcule toujours hors taxes : la TPS/TVQ
  // perçue n'est pas un revenu (elle est remise à l'État), peu importe le
  // mode d'affichage choisi ci-dessus.
  const netCents = Math.max(0, revenuTotalCents - totalDepensesCents - kmDeductionCents)
  const reserveSimpleCents = Math.round((netCents * reservePct) / 100)

  return (
    <section className="panel">
      <div className="label-row" style={{ marginBottom: 14 }}>
        <h2 className="panel-title" style={{ margin: 0 }}>
          Tableau de bord
        </h2>
        {settings.taxesInscrit && (
          <div className="mini-toggle">
            <button
              type="button"
              className={`mt-btn${montantsMode === 'horsTaxes' ? ' active' : ''}`}
              onClick={() => setMontantsMode('horsTaxes')}
            >
              Hors taxes
            </button>
            <button
              type="button"
              className={`mt-btn${montantsMode === 'avecTaxes' ? ' active' : ''}`}
              onClick={() => setMontantsMode('avecTaxes')}
            >
              Taxes incluses
            </button>
          </div>
        )}
      </div>

      <div className="cards">
        <div className="card income">
          <div className="label">Revenus</div>
          <div className="value mono">{formatCents(revenuAfficheCents)}</div>
          <div className="note">
            {revenuEnAttenteCents > 0
              ? `dont ${formatCents(revenuEnAttenteCents)} en attente (${currentYear})`
              : `${invoicesThisYear.length} facture(s) en ${currentYear}`}
          </div>
        </div>
        <div className="card expense">
          <div className="label">Dépenses reliées au travail</div>
          <div className="value mono">{formatCents(totalDepensesAfficheCents)}</div>
          <div className="note">{expensesThisYear.length} reçu(s) en {currentYear}</div>
        </div>
        <div className="card">
          <div className="label">Kilométrage d'affaires (année)</div>
          <div className="value mono">{formatKm(kmCetteAnnee)}</div>
          <div className="note">
            {tauxKm != null
              ? `≈ ${formatCents(kmDeductionCents)} de dépense de véhicule (repère)`
              : 'Taux de repère non configuré (paramètres fiscaux)'}
          </div>
        </div>
        <div className="card tax">
          <div className="label">Revenu net imposable estimé</div>
          <div className="value mono">{formatCents(netCents)}</div>
          <div className="note">Revenus − dépenses − kilométrage, toujours hors taxes (année en cours)</div>
        </div>
      </div>

      <div className="reserve-box">
        <div>
          <div className="rlabel">À mettre de côté pour l'impôt et les cotisations</div>
          <div className="rslider">
            <span>{reservePct} %</span>
            <input
              type="range"
              min={15}
              max={40}
              value={reservePct}
              onChange={(e) => setReservePct(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="ramount mono">{formatCents(reserveSimpleCents)}</div>
      </div>
    </section>
  )
}
