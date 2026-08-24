import { useEffect, useState } from 'react'
import type { AppSettings } from '../hooks/useSettings'
import { formatCents } from '../lib/money'
import { getParametresFiscauxAvecRepli } from '../lib/parametresFiscaux'
import { uid } from '../lib/uid'
import { useBlobUrl } from '../hooks/useBlobUrl'
import { useListToggle } from '../hooks/useListToggle'
import { TAILLE_MAX_FICHIER } from '../hooks/useLedger'
import { ConfirmModal } from '../components/ConfirmModal'
import { DetailModal, DetailRow } from '../components/DetailModal'
import type { ImageAction, useLedger } from '../hooks/useLedger'
import type { Invoice, InvoiceType } from '../types'

type Ledger = ReturnType<typeof useLedger>

interface PendingFile {
  blob: Blob
  name: string
  tooLarge: boolean
}

export function FacturesPanel({ ledger, settings }: { ledger: Ledger; settings: AppSettings }) {
  const { invoices } = ledger
  const [date, setDate] = useState('')
  const [type, setType] = useState<InvoiceType>('Commission')
  const [montant, setMontant] = useState('')
  const [tps, setTps] = useState('')
  const [tvq, setTvq] = useState('')
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [fileStatus, setFileStatus] = useState<{ text: string; err: boolean } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const list = useListToggle()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function handleFile(file: File | null) {
    if (!file) return
    if (file.size > TAILLE_MAX_FICHIER) {
      setPendingFile({ blob: file, name: file.name, tooLarge: true })
      setFileStatus({
        text: `« ${file.name} » est trop volumineux (>20 Mo) — seul le nom sera conservé.`,
        err: true,
      })
      return
    }
    setPendingFile({ blob: file, name: file.name, tooLarge: false })
    setFileStatus({ text: `Fichier prêt : ${file.name}`, err: false })
  }

  function clearFile() {
    setPendingFile(null)
    setFileStatus(null)
  }

  function handleMontantChange(value: string) {
    setMontant(value)
    const n = parseFloat(value.replace(',', '.'))
    if (!settings.taxesInscrit || !Number.isFinite(n) || n <= 0) {
      setTps('')
      setTvq('')
      return
    }
    const annee = (date || new Date().toISOString().slice(0, 10)).slice(0, 4)
    const params = getParametresFiscauxAvecRepli(annee)
    if (params) {
      setTps((n * params.tps).toFixed(2))
      setTvq((n * params.tvq).toFixed(2))
    }
  }

  async function handleSave() {
    const montantCents = Math.round(parseFloat(montant.replace(',', '.')) * 100)
    if (!montantCents || montantCents <= 0) {
      setSaveError('Le montant doit être supérieur à 0 $.')
      return
    }
    setSaveError(null)
    const record: Invoice = {
      id: uid(),
      date: date || new Date().toISOString().slice(0, 10),
      type,
      montantCents,
      tpsCents: settings.taxesInscrit ? Math.round((parseFloat(tps.replace(',', '.')) || 0) * 100) : 0,
      tvqCents: settings.taxesInscrit ? Math.round((parseFloat(tvq.replace(',', '.')) || 0) * 100) : 0,
      statut: 'Envoyée',
      fileName: pendingFile?.name ?? null,
      hasFile: !!(pendingFile && !pendingFile.tooLarge),
    }
    await ledger.addInvoice(record, pendingFile && !pendingFile.tooLarge ? { blob: pendingFile.blob, name: pendingFile.name } : null)
    setDate('')
    setMontant('')
    setTps('')
    setTvq('')
    setType('Commission')
    clearFile()
  }

  const montantCentsPreview = Math.round((parseFloat(montant.replace(',', '.')) || 0) * 100)
  const tpsCentsPreview = settings.taxesInscrit ? Math.round((parseFloat(tps.replace(',', '.')) || 0) * 100) : 0
  const tvqCentsPreview = settings.taxesInscrit ? Math.round((parseFloat(tvq.replace(',', '.')) || 0) * 100) : 0
  const totalAvecTaxesPreview = montantCentsPreview + tpsCentsPreview + tvqCentsPreview

  const totalTout = invoices.reduce((s, f) => s + f.montantCents, 0)
  const totalToutAvecTaxes = invoices.reduce((s, f) => s + f.montantCents + f.tpsCents + f.tvqCents, 0)
  const totalPaye = invoices.filter((f) => f.statut === 'Payée').reduce((s, f) => s + f.montantCents, 0)
  const pending = invoices.filter((f) => f.statut !== 'Payée').sort((a, b) => b.date.localeCompare(a.date))
  const totalAttente = pending.reduce((s, f) => s + f.montantCents, 0)
  const sorted = [...invoices].sort((a, b) => b.date.localeCompare(a.date))
  const shown = sorted.slice(0, list.visible)
  const detailInvoice = detailId ? invoices.find((f) => f.id === detailId) : null

  return (
    <section className="panel">
      <h2 className="panel-title">Paie / Factures</h2>

      <div className="section-summary">
        <div className="ssum-item">
          <span className="ssum-label">Total en attente (pas encore payé)</span>
          <span className="ssum-value">{formatCents(totalTout - totalPaye)}</span>
        </div>
        <div className="ssum-item">
          <span className="ssum-label">Total payé</span>
          <span className="ssum-value">{formatCents(totalPaye)}</span>
        </div>
      </div>

      <div className="review-box">
        <div className="rb-title">Ajouter une facture</div>
        <div
          className={`upload-zone${dragOver ? ' dragover' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragOver(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFile(e.dataTransfer.files[0] ?? null)
          }}
        >
          <div className="icon">📄</div>
          <p>Glisse un fichier ici ou choisis-le sur ton ordinateur (PDF, image, etc.)</p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <label className="btn secondary" style={{ cursor: 'pointer' }}>
              📁 Choisir un fichier
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {pendingFile && (
              <button type="button" className="btn secondary" onClick={clearFile}>
                Retirer le fichier
              </button>
            )}
          </div>
        </div>
        {fileStatus && <div className={`status-msg${fileStatus.err ? ' err' : ''}`}>{fileStatus.text}</div>}

        <div className="form-row">
          <div className="field">
            <label>Date de la facture</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as InvoiceType)}>
              <option value="Commission">Commission</option>
              <option value="Taux horaire">Taux horaire</option>
            </select>
          </div>
          <div className="field">
            <label>Montant hors taxes ($)</label>
            <input type="number" step="0.01" value={montant} onChange={(e) => handleMontantChange(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>TPS perçue ($)</label>
            <input
              type="number"
              step="0.01"
              value={settings.taxesInscrit ? tps : ''}
              disabled={!settings.taxesInscrit}
              onChange={(e) => setTps(e.target.value)}
            />
          </div>
          <div className="field">
            <label>TVQ perçue ($)</label>
            <input
              type="number"
              step="0.01"
              value={settings.taxesInscrit ? tvq : ''}
              disabled={!settings.taxesInscrit}
              onChange={(e) => setTvq(e.target.value)}
            />
          </div>
        </div>
        {!settings.taxesInscrit && (
          <p className="status-msg" style={{ marginTop: -8 }}>
            Non inscrit aux fichiers de taxes (Paramètres ⚙️) — aucune TPS/TVQ à charger.
          </p>
        )}
        {montantCentsPreview > 0 && (
          <p className="status-msg" style={{ marginTop: -8 }}>
            Total à facturer (taxes incluses) : <b className="mono">{formatCents(totalAvecTaxesPreview)}</b>
          </p>
        )}
        {saveError && <div className="status-msg err">{saveError}</div>}
        <div className="btn-row">
          <button type="button" className="btn" onClick={handleSave}>
            Enregistrer la facture
          </button>
        </div>
      </div>

      <div className="attente-box">
        <div className="attente-header">
          <span>En attente de paiement</span>
          <span className="mono">{formatCents(totalAttente)}</span>
        </div>
        {pending.length === 0 ? (
          <p className="status-msg" style={{ margin: '2px 0 0' }}>
            Aucune facture en attente de paiement.
          </p>
        ) : (
          pending.map((f) => (
            <div className="attente-row" key={f.id}>
              <div className="ar-info">
                <span className="mono">{f.date}</span> — {f.type} —{' '}
                <span className="mono">{formatCents(f.montantCents)}</span>
              </div>
              <div className="ar-actions">
                <button
                  type="button"
                  className="btn secondary btn-sm"
                  onClick={() => ledger.markInvoicePaid(f.id)}
                >
                  Payé
                </button>
                <button type="button" className="icon-btn" title="Détails" onClick={() => setDetailId(f.id)}>
                  🔍
                </button>
                <button
                  type="button"
                  className="icon-btn del"
                  title="Supprimer"
                  onClick={() => setDeleteId(f.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="btn-row" style={{ marginBottom: 24 }}>
        <button type="button" className="btn secondary" onClick={list.toggle}>
          {list.shown ? 'Masquer les factures' : 'Voir les factures'}
        </button>
      </div>

      {list.shown && (
        <div>
          {invoices.length === 0 ? (
            <div className="empty">
              <span className="icon">📥</span>
              Aucune facture enregistrée pour l'instant.
            </div>
          ) : (
            <>
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Statut</th>
                    <th className="num">Montant</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((f) => (
                    <tr key={f.id}>
                      <td className="mono">{f.date}</td>
                      <td>{f.type}</td>
                      <td>
                        <span className={`tag ${f.statut === 'Payée' ? 'payee' : 'envoyee'}`}>
                          {f.statut}
                        </span>
                      </td>
                      <td className="mono num">{formatCents(f.montantCents)}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Détails"
                          onClick={() => setDetailId(f.id)}
                        >
                          🔍
                        </button>
                        <button
                          type="button"
                          className="icon-btn del"
                          title="Supprimer"
                          onClick={() => setDeleteId(f.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="btn-row" style={{ marginTop: 14 }}>
                {sorted.length > list.visible && (
                  <button type="button" className="btn secondary" onClick={list.showMore}>
                    Voir 10 de plus
                  </button>
                )}
              </div>
              <div className="totals-strip">
                <div className="t">
                  Total facturé (hors taxes)
                  <b>{formatCents(totalTout)}</b>
                </div>
                <div className="t">
                  Total facturé (taxes incluses)
                  <b>{formatCents(totalToutAvecTaxes)}</b>
                </div>
                <div className="t">
                  Total payé
                  <b>{formatCents(totalPaye)}</b>
                </div>
                <div className="t">
                  En attente
                  <b>{formatCents(totalTout - totalPaye)}</b>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {detailInvoice && (
        <InvoiceDetail invoice={detailInvoice} ledger={ledger} onClose={() => setDetailId(null)} />
      )}

      {deleteId && (
        <ConfirmModal
          message="Voulez-vous vraiment supprimer cette facture ?"
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            ledger.deleteInvoice(deleteId)
            setDeleteId(null)
          }}
        />
      )}
    </section>
  )
}

function InvoiceDetail({
  invoice,
  ledger,
  onClose,
}: {
  invoice: Invoice
  ledger: Ledger
  onClose: () => void
}) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (invoice.hasFile) {
      ledger.getInvoiceFile(invoice.id).then((b) => {
        if (!cancelled) setBlob(b)
      })
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id])
  const fileUrl = useBlobUrl(blob)
  const isImage = blob?.type.startsWith('image/')

  if (editing) {
    return (
      <InvoiceEditForm invoice={invoice} ledger={ledger} onCancel={() => setEditing(false)} onSaved={onClose} />
    )
  }

  return (
    <DetailModal onClose={onClose}>
      <h3 className="detail-title">Détail de la facture</h3>
      {fileUrl && isImage && <img className="detail-img" src={fileUrl} alt="Facture" />}
      <div className="detail-rows">
        <DetailRow label="Date" value={invoice.date} />
        <DetailRow label="Type" value={invoice.type} />
        <DetailRow label="Statut" value={invoice.statut} />
        <DetailRow label="Montant hors taxes" value={formatCents(invoice.montantCents)} />
        {(invoice.tpsCents > 0 || invoice.tvqCents > 0) && (
          <>
            <DetailRow label="TPS perçue" value={formatCents(invoice.tpsCents)} />
            <DetailRow label="TVQ perçue" value={formatCents(invoice.tvqCents)} />
            <DetailRow
              label="Total facturé (taxes incluses)"
              value={formatCents(invoice.montantCents + invoice.tpsCents + invoice.tvqCents)}
            />
          </>
        )}
        <DetailRow label="Fichier" value={invoice.fileName ?? '—'} />
      </div>
      {fileUrl && !isImage && (
        <p style={{ marginTop: 14 }}>
          <a className="file-link" href={fileUrl} target="_blank" rel="noopener noreferrer">
            Ouvrir le fichier dans un nouvel onglet
          </a>
        </p>
      )}
      {!fileUrl && invoice.fileName && !invoice.hasFile && (
        <p className="status-msg err" style={{ marginTop: 14 }}>
          Fichier trop volumineux — non sauvegardé, seul le nom a été conservé.
        </p>
      )}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button type="button" className="btn secondary btn-sm" onClick={() => setEditing(true)}>
          ✏️ Modifier
        </button>
      </div>
    </DetailModal>
  )
}

function InvoiceEditForm({
  invoice,
  ledger,
  onCancel,
  onSaved,
}: {
  invoice: Invoice
  ledger: Ledger
  onCancel: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(invoice.date)
  const [type, setType] = useState<InvoiceType>(invoice.type)
  const [montant, setMontant] = useState(String(invoice.montantCents / 100))
  const [tps, setTps] = useState(String(invoice.tpsCents / 100))
  const [tvq, setTvq] = useState(String(invoice.tvqCents / 100))
  const [fileAction, setFileAction] = useState<ImageAction>({ kind: 'unchanged' })
  const [newFileName, setNewFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function handleNewFile(file: File | null) {
    if (!file) return
    if (file.size > TAILLE_MAX_FICHIER) {
      setError(`« ${file.name} » est trop volumineux (>20 Mo).`)
      return
    }
    setError(null)
    setFileAction({ kind: 'replaced', blob: file })
    setNewFileName(file.name)
  }

  const displayedFileName =
    fileAction.kind === 'removed' ? null : (newFileName ?? (invoice.hasFile ? invoice.fileName : null))

  const montantCentsPreview = Math.round((parseFloat(montant.replace(',', '.')) || 0) * 100)
  const tpsCentsPreview = Math.round((parseFloat(tps.replace(',', '.')) || 0) * 100)
  const tvqCentsPreview = Math.round((parseFloat(tvq.replace(',', '.')) || 0) * 100)
  const totalAvecTaxesPreview = montantCentsPreview + tpsCentsPreview + tvqCentsPreview

  async function handleSave() {
    const montantCents = Math.round(parseFloat(montant.replace(',', '.')) * 100)
    if (!montantCents || montantCents <= 0) {
      setError('Le montant doit être supérieur à 0 $.')
      return
    }
    setSaving(true)
    const record: Invoice = {
      id: invoice.id,
      date: date || invoice.date,
      type,
      montantCents,
      tpsCents: Math.round((parseFloat(tps.replace(',', '.')) || 0) * 100),
      tvqCents: Math.round((parseFloat(tvq.replace(',', '.')) || 0) * 100),
      statut: invoice.statut,
      fileName:
        fileAction.kind === 'removed' ? null : (newFileName ?? invoice.fileName),
      hasFile: fileAction.kind === 'removed' ? false : fileAction.kind === 'replaced' ? true : invoice.hasFile,
    }
    await ledger.updateInvoice(record, fileAction)
    setSaving(false)
    onSaved()
  }

  return (
    <DetailModal onClose={onCancel}>
      <h3 className="detail-title">Modifier la facture</h3>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        {displayedFileName && (
          <span className="status-msg" style={{ margin: 0 }}>
            Fichier : {displayedFileName}
          </span>
        )}
        {displayedFileName && (
          <button
            type="button"
            className="btn secondary btn-sm"
            onClick={() => {
              setFileAction({ kind: 'removed' })
              setNewFileName(null)
            }}
          >
            ✕ Retirer le fichier
          </button>
        )}
        <label className="btn secondary btn-sm" style={{ cursor: 'pointer' }}>
          {displayedFileName ? 'Remplacer le fichier' : 'Ajouter un fichier'}
          <input type="file" style={{ display: 'none' }} onChange={(e) => handleNewFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Date de la facture</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as InvoiceType)}>
            <option value="Commission">Commission</option>
            <option value="Taux horaire">Taux horaire</option>
          </select>
        </div>
        <div className="field">
          <label>Montant hors taxes ($)</label>
          <input type="number" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>TPS perçue ($)</label>
          <input type="number" step="0.01" value={tps} onChange={(e) => setTps(e.target.value)} />
        </div>
        <div className="field">
          <label>TVQ perçue ($)</label>
          <input type="number" step="0.01" value={tvq} onChange={(e) => setTvq(e.target.value)} />
        </div>
      </div>
      {montantCentsPreview > 0 && (
        <p className="status-msg" style={{ marginTop: -8 }}>
          Total à facturer (taxes incluses) : <b className="mono">{formatCents(totalAvecTaxesPreview)}</b>
        </p>
      )}
      {error && <div className="status-msg err">{error}</div>}
      <div className="btn-row">
        <button type="button" className="btn" disabled={saving} onClick={handleSave}>
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </DetailModal>
  )
}
