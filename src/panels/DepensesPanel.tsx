import { useEffect, useState } from 'react'
import type { AppSettings } from '../hooks/useSettings'
import { compressImage } from '../lib/image'
import { formatCents } from '../lib/money'
import { getParametresFiscauxAvecRepli } from '../lib/parametresFiscaux'
import { uid } from '../lib/uid'
import { useBlobUrl } from '../hooks/useBlobUrl'
import { useListToggle } from '../hooks/useListToggle'
import { ConfirmModal } from '../components/ConfirmModal'
import { DetailModal, DetailRow } from '../components/DetailModal'
import type { ImageAction, useLedger } from '../hooks/useLedger'
import type { Expense } from '../types'

type Ledger = ReturnType<typeof useLedger>

interface FormState {
  date: string
  description: string
  fournisseur: string
  categorie: string
  montant: string
  tps: string
  tvq: string
}

const EMPTY_FORM: FormState = {
  date: '',
  description: '',
  fournisseur: '',
  categorie: '',
  montant: '',
  tps: '',
  tvq: '',
}

export function DepensesPanel({ ledger, settings }: { ledger: Ledger; settings: AppSettings }) {
  const { expenses } = ledger
  const categorieDefaut = settings.categories[settings.categories.length - 1] ?? 'Autre'
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [pendingImage, setPendingImage] = useState<{ blob: Blob; dataUrl: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState<{ text: string; err: boolean } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [summaryMode, setSummaryMode] = useState<'montant' | 'taxes'>('montant')
  const list = useListToggle()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!form.categorie && settings.categories.length) {
      setForm((f) => ({ ...f, categorie: categorieDefaut }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.categories])

  function handleMontantChange(value: string) {
    setForm((f) => {
      const next = { ...f, montant: value }
      if (!settings.taxesInscrit) return next
      const n = parseFloat(value.replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0) return { ...next, tps: '', tvq: '' }
      const annee = (f.date || new Date().toISOString().slice(0, 10)).slice(0, 4)
      const params = getParametresFiscauxAvecRepli(annee)
      if (!params) return next
      return { ...next, tps: (n * params.tps).toFixed(2), tvq: (n * params.tvq).toFixed(2) }
    })
  }

  async function handleFile(file: File | null) {
    if (!file) return
    setStatus({ text: "Lecture de l'image…", err: false })
    try {
      const compressed = await compressImage(file, 1100, 0.72)
      setPendingImage({ blob: compressed.blob, dataUrl: compressed.dataUrl })
      setReviewOpen(true)
      setStatus(null)
    } catch {
      setStatus({ text: "Impossible de lire l'image.", err: true })
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setPendingImage(null)
    setReviewOpen(false)
    setStatus(null)
  }

  async function handleSave() {
    const montantCents = Math.round(parseFloat(form.montant.replace(',', '.')) * 100)
    if (!montantCents || montantCents <= 0) {
      setStatus({ text: 'Le montant doit être supérieur à 0 $.', err: true })
      return
    }
    setSaving(true)
    const record: Expense = {
      id: uid(),
      date: form.date || new Date().toISOString().slice(0, 10),
      description: form.description || '(sans description)',
      fournisseur: form.fournisseur,
      categorie: form.categorie || categorieDefaut,
      montantCents,
      tpsCents: settings.taxesInscrit ? Math.round((parseFloat(form.tps.replace(',', '.')) || 0) * 100) : 0,
      tvqCents: settings.taxesInscrit ? Math.round((parseFloat(form.tvq.replace(',', '.')) || 0) * 100) : 0,
      hasImage: !!pendingImage,
    }
    await ledger.addExpense(record, pendingImage?.blob ?? null)
    setSaving(false)
    resetForm()
  }

  const totalMontant = expenses.reduce((s, e) => s + e.montantCents, 0)
  const totalTaxes = expenses.reduce((s, e) => s + e.tpsCents + e.tvqCents, 0)
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date))
  const shown = sorted.slice(0, list.visible)
  const detailExpense = detailId ? expenses.find((e) => e.id === detailId) : null

  return (
    <section className="panel">
      <h2 className="panel-title">Dépenses</h2>

      <div className="section-summary">
        <div className="ssum-item" style={{ padding: '10px 10px', textAlign: 'center' }}>
          <div
            className="label-row"
            style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <span className="ssum-label">
              {summaryMode === 'montant' ? 'Total dépenses' : 'Total taxes payées'}
            </span>
            <div className="mini-toggle">
              <button
                type="button"
                className={`mt-btn${summaryMode === 'montant' ? ' active' : ''}`}
                onClick={() => setSummaryMode('montant')}
              >
                Dépenses
              </button>
              <button
                type="button"
                className={`mt-btn${summaryMode === 'taxes' ? ' active' : ''}`}
                onClick={() => setSummaryMode('taxes')}
              >
                Taxes
              </button>
            </div>
          </div>
          <span className="ssum-value" style={{ display: 'block', marginTop: 6 }}>
            {formatCents(summaryMode === 'montant' ? totalMontant : totalTaxes)}
          </span>
        </div>
        <div className="ssum-item">
          <span className="ssum-label">Reçus enregistrés</span>
          <span className="ssum-value">{expenses.length}</span>
        </div>
      </div>

      <div className="review-box">
        <div className="rb-title">
          {reviewOpen ? 'Remplis les champs avant d\'enregistrer' : 'Ajoute une dépense'}
        </div>

        <div
          className={`upload-zone${dragOver ? ' dragover' : ''}`}
          style={{ marginBottom: 16 }}
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
          <div className="icon">🧾</div>
          <p>Photo d'une facture papier ou capture d'écran d'une facture numérique</p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <label className="btn secondary" style={{ cursor: 'pointer' }}>
              📁 Choisir une photo
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
        {status && <div className={`status-msg${status.err ? ' err' : ''}`}>{status.text}</div>}

        <div className="review-preview">
          {pendingImage && (
            <div>
              <img src={pendingImage.dataUrl} alt="Aperçu de la facture" />
              <button
                type="button"
                className="btn secondary btn-sm"
                style={{ display: 'block', marginTop: 8 }}
                onClick={() => setPendingImage(null)}
              >
                ✕ Retirer la photo
              </button>
            </div>
          )}
          <div className="review-fields">
            <div className="form-row">
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Montant total ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.montant}
                  onChange={(e) => handleMontantChange(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Description / item</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Fournisseur</label>
                <input
                  type="text"
                  value={form.fournisseur}
                  onChange={(e) => setForm({ ...form, fournisseur: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>TPS payée ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.taxesInscrit ? form.tps : ''}
                  disabled={!settings.taxesInscrit}
                  onChange={(e) => setForm({ ...form, tps: e.target.value })}
                />
              </div>
              <div className="field">
                <label>TVQ payée ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.taxesInscrit ? form.tvq : ''}
                  disabled={!settings.taxesInscrit}
                  onChange={(e) => setForm({ ...form, tvq: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Catégorie</label>
                <select
                  value={form.categorie}
                  onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                >
                  {settings.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!settings.taxesInscrit && (
              <p className="status-msg" style={{ marginTop: -8 }}>
                Non inscrit aux fichiers de taxes (Paramètres ⚙️) — pas de crédit de taxe à réclamer, le montant total (taxes incluses) reste déductible.
              </p>
            )}
            <div className="btn-row">
              <button type="button" className="btn" disabled={saving} onClick={handleSave}>
                {saving ? 'Enregistrement…' : 'Enregistrer la dépense'}
              </button>
              <button type="button" className="btn secondary" onClick={resetForm}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="btn-row" style={{ margin: '6px 0 24px' }}>
        <button type="button" className="btn secondary" onClick={list.toggle}>
          {list.shown ? 'Masquer les dépenses' : 'Voir les dépenses'}
        </button>
      </div>

      {list.shown && (
        <div>
          {expenses.length === 0 ? (
            <div className="empty">
              <span className="icon">📥</span>
              Aucune dépense enregistrée pour l'instant.
            </div>
          ) : (
            <>
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="num">Taxes</th>
                    <th className="num">Montant</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{e.date}</td>
                      <td>{e.description}</td>
                      <td className="mono num">{formatCents(e.tpsCents + e.tvqCents)}</td>
                      <td className="mono num">{formatCents(e.montantCents)}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Détails"
                          onClick={() => setDetailId(e.id)}
                        >
                          🔍
                        </button>
                        <button
                          type="button"
                          className="icon-btn del"
                          title="Supprimer"
                          onClick={() => setDeleteId(e.id)}
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
                  Total dépenses
                  <b>{formatCents(totalMontant)}</b>
                </div>
                <div className="t">
                  Total taxes payées
                  <b>{formatCents(totalTaxes)}</b>
                </div>
                <div className="t">
                  Nombre de reçus
                  <b>{expenses.length}</b>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {detailExpense && (
        <ExpenseDetail
          expense={detailExpense}
          ledger={ledger}
          settings={settings}
          onClose={() => setDetailId(null)}
        />
      )}

      {deleteId && (
        <ConfirmModal
          message="Voulez-vous vraiment supprimer cette dépense ?"
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            ledger.deleteExpense(deleteId)
            setDeleteId(null)
          }}
        />
      )}
    </section>
  )
}

function ExpenseDetail({
  expense,
  ledger,
  settings,
  onClose,
}: {
  expense: Expense
  ledger: Ledger
  settings: AppSettings
  onClose: () => void
}) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (expense.hasImage) {
      ledger.getExpenseImage(expense.id).then((b) => {
        if (!cancelled) setBlob(b)
      })
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense.id])
  const imgUrl = useBlobUrl(blob)

  if (editing) {
    return (
      <ExpenseEditForm
        expense={expense}
        currentImageUrl={imgUrl}
        ledger={ledger}
        settings={settings}
        onCancel={() => setEditing(false)}
        onSaved={onClose}
      />
    )
  }

  return (
    <DetailModal onClose={onClose}>
      <h3 className="detail-title">Détail de la dépense</h3>
      {imgUrl && <img className="detail-img" src={imgUrl} alt="Facture" />}
      <div className="detail-rows">
        <DetailRow label="Date" value={expense.date} />
        <DetailRow label="Description" value={expense.description} />
        <DetailRow label="Fournisseur" value={expense.fournisseur || '—'} />
        <DetailRow label="Catégorie" value={expense.categorie} />
        <DetailRow label="Montant" value={formatCents(expense.montantCents)} />
        <DetailRow label="TPS" value={formatCents(expense.tpsCents)} />
        <DetailRow label="TVQ" value={formatCents(expense.tvqCents)} />
      </div>
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button type="button" className="btn secondary btn-sm" onClick={() => setEditing(true)}>
          ✏️ Modifier
        </button>
      </div>
    </DetailModal>
  )
}

function ExpenseEditForm({
  expense,
  currentImageUrl,
  ledger,
  settings,
  onCancel,
  onSaved,
}: {
  expense: Expense
  currentImageUrl: string | null
  ledger: Ledger
  settings: AppSettings
  onCancel: () => void
  onSaved: () => void
}) {
  const categorieDefaut = settings.categories[settings.categories.length - 1] ?? 'Autre'
  const categorieOptions = settings.categories.includes(expense.categorie)
    ? settings.categories
    : [...settings.categories, expense.categorie]
  const [form, setForm] = useState<FormState>({
    date: expense.date,
    description: expense.description,
    fournisseur: expense.fournisseur,
    categorie: expense.categorie,
    montant: String(expense.montantCents / 100),
    tps: String(expense.tpsCents / 100),
    tvq: String(expense.tvqCents / 100),
  })
  const [imageAction, setImageAction] = useState<ImageAction>({ kind: 'unchanged' })
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleNewPhoto(file: File | null) {
    if (!file) return
    const compressed = await compressImage(file, 1100, 0.72)
    setImageAction({ kind: 'replaced', blob: compressed.blob })
    setNewImagePreview(compressed.dataUrl)
  }

  const displayedImageUrl = imageAction.kind === 'removed' ? null : (newImagePreview ?? currentImageUrl)

  async function handleSave() {
    const montantCents = Math.round(parseFloat(form.montant.replace(',', '.')) * 100)
    if (!montantCents || montantCents <= 0) {
      setError('Le montant doit être supérieur à 0 $.')
      return
    }
    setSaving(true)
    const record: Expense = {
      id: expense.id,
      date: form.date || expense.date,
      description: form.description || '(sans description)',
      fournisseur: form.fournisseur,
      categorie: form.categorie || categorieDefaut,
      montantCents,
      tpsCents: Math.round((parseFloat(form.tps.replace(',', '.')) || 0) * 100),
      tvqCents: Math.round((parseFloat(form.tvq.replace(',', '.')) || 0) * 100),
      hasImage: imageAction.kind === 'removed' ? false : imageAction.kind === 'replaced' ? true : expense.hasImage,
    }
    await ledger.updateExpense(record, imageAction)
    setSaving(false)
    onSaved()
  }

  return (
    <DetailModal onClose={onCancel}>
      <h3 className="detail-title">Modifier la dépense</h3>
      {displayedImageUrl && <img className="detail-img" src={displayedImageUrl} alt="Facture" />}
      <div className="btn-row" style={{ marginBottom: 14 }}>
        {displayedImageUrl ? (
          <button
            type="button"
            className="btn secondary btn-sm"
            onClick={() => {
              setImageAction({ kind: 'removed' })
              setNewImagePreview(null)
            }}
          >
            ✕ Retirer la photo
          </button>
        ) : null}
        <label className="btn secondary btn-sm" style={{ cursor: 'pointer' }}>
          {displayedImageUrl ? 'Remplacer la photo' : 'Ajouter une photo'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleNewPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Date</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="field">
          <label>Montant total ($)</label>
          <input
            type="number"
            step="0.01"
            value={form.montant}
            onChange={(e) => setForm({ ...form, montant: e.target.value })}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Description / item</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Fournisseur</label>
          <input
            type="text"
            value={form.fournisseur}
            onChange={(e) => setForm({ ...form, fournisseur: e.target.value })}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>TPS payée ($)</label>
          <input type="number" step="0.01" value={form.tps} onChange={(e) => setForm({ ...form, tps: e.target.value })} />
        </div>
        <div className="field">
          <label>TVQ payée ($)</label>
          <input type="number" step="0.01" value={form.tvq} onChange={(e) => setForm({ ...form, tvq: e.target.value })} />
        </div>
        <div className="field">
          <label>Catégorie</label>
          <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
            {categorieOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
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
