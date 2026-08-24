import { useMemo, useRef, useState } from 'react'
import { storage } from '../lib/db'
import { saveBlobWithPicker } from '../lib/download'
import { formatCents, formatKm, toCents } from '../lib/money'
import { getTauxKmRepere } from '../lib/parametresFiscaux'
import { importerSauvegarde, parseBackupFile, type BackupFile } from '../lib/backup'
import { ConfirmModal } from '../components/ConfirmModal'
import type { useLedger } from '../hooks/useLedger'
import type { useDocuments } from '../hooks/useDocuments'
import type { Expense, Invoice, Trip } from '../types'

type Ledger = ReturnType<typeof useLedger>
type DocumentsHook = ReturnType<typeof useDocuments>

function computeTotals(invY: Invoice[], expY: Expense[], tripY: Trip[], annee: string) {
  const revenuPayeCents = invY.filter((f) => f.statut === 'Payée').reduce((s, f) => s + f.montantCents, 0)
  const revenuTotalCents = invY.reduce((s, f) => s + f.montantCents, 0)
  const depensesCents = expY.reduce((s, e) => s + e.montantCents, 0)
  const km = tripY.reduce((s, t) => s + t.km, 0)
  const tauxKm = getTauxKmRepere(annee)
  const kmDeductionCents = tauxKm != null ? toCents(km * tauxKm) : 0
  const netCents = Math.max(0, revenuPayeCents - depensesCents - kmDeductionCents)
  return {
    revenuPayeCents,
    revenuTotalCents,
    depensesCents,
    km,
    netCents,
    nbFactures: invY.length,
    nbDepenses: expY.length,
    tauxConfigure: tauxKm != null,
  }
}

function formatMoisLabel(moisStr: string): string {
  const [annee, mois] = moisStr.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric' }).format(
    new Date(annee, mois - 1, 1),
  )
}

export function HistoriquePanel({
  ledger,
  documentsHook,
}: {
  ledger: Ledger
  documentsHook: DocumentsHook
}) {
  const { expenses, invoices, trips, getExpenseImage, getInvoiceFile, getTripImage } = ledger
  const { documents, getDocumentFile } = documentsHook
  const [mode, setMode] = useState<'annee' | 'mois' | 'date'>('annee')
  const [year, setYear] = useState(() => new Date().getFullYear().toString())
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [dateAsOf, setDateAsOf] = useState(() => new Date().toISOString().slice(0, 10))

  const [exportDebut, setExportDebut] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [exportFin, setExportFin] = useState(() => new Date().toISOString().slice(0, 10))
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'error'>('idle')

  const [restorePending, setRestorePending] = useState<BackupFile | null>(null)
  const [restoreState, setRestoreState] = useState<
    { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string } | { kind: 'done'; count: number }
  >({ kind: 'idle' })
  const restoreInputRef = useRef<HTMLInputElement>(null)

  async function handleRestoreFileSelected(file: File | null) {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseBackupFile(JSON.parse(text))
      if (parsed.entries.length === 0) {
        setRestoreState({ kind: 'error', message: 'Ce fichier ne contient aucune donnée reconnaissable.' })
        return
      }
      setRestorePending(parsed)
    } catch (err) {
      console.error('Lecture du fichier de sauvegarde échouée', err)
      setRestoreState({ kind: 'error', message: 'Fichier de sauvegarde invalide ou corrompu.' })
    } finally {
      if (restoreInputRef.current) restoreInputRef.current.value = ''
    }
  }

  async function confirmerRestauration() {
    if (!restorePending) return
    setRestoreState({ kind: 'busy' })
    try {
      const resultat = await importerSauvegarde(restorePending, storage)
      setRestoreState({ kind: 'done', count: resultat.entreesRestaurees })
    } catch (err) {
      console.error('Restauration de la sauvegarde échouée', err)
      setRestoreState({ kind: 'error', message: 'La restauration a échoué — aucune donnée locale garantie intacte.' })
    } finally {
      setRestorePending(null)
    }
  }

  async function handleExport() {
    setExportState('busy')
    try {
      const dansPeriode = (date: string) => date >= exportDebut && date <= exportFin
      const { buildAccountantExportZip } = await import('../lib/accountantExport')
      const blob = await buildAccountantExportZip({
        expenses: expenses.filter((e) => dansPeriode(e.date)),
        invoices: invoices.filter((f) => dansPeriode(f.date)),
        trips: trips.filter((t) => dansPeriode(t.date)),
        documents: documents.filter((d) => dansPeriode(d.date)),
        getExpenseImage,
        getInvoiceFile,
        getTripImage,
        getDocumentFile,
      })
      await saveBlobWithPicker(`donnees-${exportDebut}-au-${exportFin}.zip`, blob, {
        description: 'Export comptable (.zip)',
        accept: { 'application/zip': ['.zip'] },
      })
      setExportState('idle')
    } catch (err) {
      console.error("Échec de l'export des données", err)
      setExportState('error')
    }
  }

  const years = useMemo(() => {
    const set = new Set<string>()
    invoices.forEach((f) => set.add(f.date.slice(0, 4)))
    expenses.forEach((e) => set.add(e.date.slice(0, 4)))
    trips.forEach((t) => set.add(t.date.slice(0, 4)))
    set.add(new Date().getFullYear().toString())
    return Array.from(set).sort().reverse()
  }, [invoices, expenses, trips])

  const selectedYear = years.includes(year) ? year : (years[0] ?? year)

  const stats = useMemo(() => {
    if (mode === 'annee') {
      const invY = invoices.filter((f) => f.date.slice(0, 4) === selectedYear)
      const expY = expenses.filter((e) => e.date.slice(0, 4) === selectedYear)
      const tripY = trips.filter((t) => t.date.slice(0, 4) === selectedYear)
      return computeTotals(invY, expY, tripY, selectedYear)
    }
    if (mode === 'mois') {
      const annee = month.slice(0, 4)
      const invY = invoices.filter((f) => f.date.slice(0, 7) === month)
      const expY = expenses.filter((e) => e.date.slice(0, 7) === month)
      const tripY = trips.filter((t) => t.date.slice(0, 7) === month)
      return computeTotals(invY, expY, tripY, annee)
    }
    const annee = dateAsOf.slice(0, 4)
    const invY = invoices.filter((f) => f.date.slice(0, 4) === annee && f.date <= dateAsOf)
    const expY = expenses.filter((e) => e.date.slice(0, 4) === annee && e.date <= dateAsOf)
    const tripY = trips.filter((t) => t.date.slice(0, 4) === annee && t.date <= dateAsOf)
    return computeTotals(invY, expY, tripY, annee)
  }, [mode, selectedYear, month, dateAsOf, invoices, expenses, trips])

  const periodeLabel =
    mode === 'annee' ? selectedYear : mode === 'mois' ? formatMoisLabel(month) : dateAsOf

  const revenuNote =
    mode === 'date' ? `Du 1er janvier au ${dateAsOf}` : `${stats.nbFactures} facture(s) en ${periodeLabel}`
  const depensesNote =
    mode === 'date'
      ? `Cumulé depuis janvier ${dateAsOf.slice(0, 4)}`
      : `${stats.nbDepenses} reçu(s) en ${periodeLabel}`
  const kmNote = mode === 'date' ? `Cumulé depuis janvier ${dateAsOf.slice(0, 4)}` : periodeLabel
  const netNote =
    mode === 'date' ? `Cumulé au ${dateAsOf}` : `Revenus payés − dépenses − km (${periodeLabel})`

  return (
    <section className="panel">
      <div className="label-row" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 12 }}>
        <h2 className="panel-title" style={{ margin: 0 }}>
          Historique financier
        </h2>
        <div className="field" style={{ flex: '0 0 auto', minWidth: 150, gap: 3 }}>
          <label>{mode === 'annee' ? 'Année' : mode === 'mois' ? 'Mois' : "Jusqu'au"}</label>
          {mode === 'annee' && (
            <select value={selectedYear} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          {mode === 'mois' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}
          {mode === 'date' && (
            <input type="date" value={dateAsOf} onChange={(e) => setDateAsOf(e.target.value)} />
          )}
        </div>
      </div>

      <div className="mini-toggle" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={`mt-btn${mode === 'annee' ? ' active' : ''}`}
          onClick={() => setMode('annee')}
        >
          Par année
        </button>
        <button
          type="button"
          className={`mt-btn${mode === 'mois' ? ' active' : ''}`}
          onClick={() => setMode('mois')}
        >
          Par mois
        </button>
        <button
          type="button"
          className={`mt-btn${mode === 'date' ? ' active' : ''}`}
          onClick={() => setMode('date')}
        >
          À une date précise
        </button>
      </div>

      <div className="cards">
        <div className="card income">
          <div className="label">Revenus (factures payées)</div>
          <div className="value mono">{formatCents(stats.revenuPayeCents)}</div>
          <div className="note">{revenuNote}</div>
        </div>
        <div className="card expense">
          <div className="label">Dépenses</div>
          <div className="value mono">{formatCents(stats.depensesCents)}</div>
          <div className="note">{depensesNote}</div>
        </div>
        <div className="card">
          <div className="label">Kilométrage</div>
          <div className="value mono">{formatKm(stats.km)}</div>
          <div className="note">{stats.tauxConfigure ? kmNote : `${kmNote} — taux de repère non configuré`}</div>
        </div>
        <div className="card tax">
          <div className="label">Revenu net estimé</div>
          <div className="value mono">{formatCents(stats.netCents)}</div>
          <div className="note">{netNote}</div>
        </div>
      </div>

      <div className="review-box" style={{ marginTop: 20 }}>
        <div className="rb-title">Exporter les données</div>
        <div className="form-row">
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Du</label>
            <input type="date" value={exportDebut} onChange={(e) => setExportDebut(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Au</label>
            <input type="date" value={exportFin} onChange={(e) => setExportFin(e.target.value)} />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button type="button" className="btn" disabled={exportState === 'busy'} onClick={handleExport}>
              {exportState === 'busy' ? 'Préparation du fichier…' : '📦 Exporter les données'}
            </button>
          </div>
        </div>
        {exportState === 'error' && (
          <p className="status-msg err">
            L'export a échoué — réessaie, et si ça persiste, vérifie la console du navigateur.
          </p>
        )}
      </div>

      <h3
        style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: 'var(--forest)', margin: '30px 0 10px' }}
      >
        Restaurer une sauvegarde
      </h3>
      <div className="btn-row" style={{ marginBottom: 8 }}>
        <label className="btn secondary btn-sm" style={{ cursor: 'pointer' }}>
          ⬆️ Restaurer une sauvegarde
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            disabled={restoreState.kind === 'busy'}
            onChange={(e) => handleRestoreFileSelected(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {restoreState.kind === 'error' && <p className="status-msg err">{restoreState.message}</p>}
      {restoreState.kind === 'done' && (
        <div className="status-msg" style={{ fontStyle: 'normal' }}>
          <p style={{ margin: '8px 0 6px', fontWeight: 600 }}>
            {restoreState.count} élément(s) restauré(s) avec succès.
          </p>
          <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>
            Recharger l'appli pour voir les données restaurées
          </button>
        </div>
      )}

      {restorePending && (
        <ConfirmModal
          message={`Restaurer cette sauvegarde (${restorePending.entries.length} élément(s)${
            restorePending.exportedAt ? `, exportée le ${restorePending.exportedAt.slice(0, 10)}` : ''
          }) remplacera immédiatement toutes les données actuelles portant les mêmes clés. Cette action ne peut pas être annulée. Continuer ?`}
          onCancel={() => setRestorePending(null)}
          onConfirm={confirmerRestauration}
        />
      )}
    </section>
  )
}
