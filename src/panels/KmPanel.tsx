import { useEffect, useState } from 'react'
import { compressImage } from '../lib/image'
import { formatKm } from '../lib/money'
import { uid } from '../lib/uid'
import { useBlobUrl } from '../hooks/useBlobUrl'
import { useListToggle } from '../hooks/useListToggle'
import { ConfirmModal } from '../components/ConfirmModal'
import { DetailModal, DetailRow } from '../components/DetailModal'
import type { ImageAction, useLedger } from '../hooks/useLedger'
import type { Trip } from '../types'

type Ledger = ReturnType<typeof useLedger>

export function KmPanel({ ledger }: { ledger: Ledger }) {
  const { trips } = ledger
  const [date, setDate] = useState('')
  const [km, setKm] = useState('')
  const [motif, setMotif] = useState('')
  const [before, setBefore] = useState<Blob | null>(null)
  const [after, setAfter] = useState<Blob | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const list = useListToggle()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handlePhoto(file: File | null, which: 'before' | 'after') {
    if (!file) return
    setPhotoError(null)
    try {
      const compressed = await compressImage(file, 1000, 0.7)
      if (which === 'before') setBefore(compressed.blob)
      else setAfter(compressed.blob)
    } catch {
      setPhotoError('Impossible de lire la photo.')
    }
  }

  const photoStatus = photoError
    ? null
    : before || after
      ? 'Photo(s) prête(s) : ' + [before && 'avant ✓', after && 'après ✓'].filter(Boolean).join(', ')
      : null

  async function handleSave() {
    const kmValue = parseFloat(km.replace(',', '.'))
    if (!kmValue || kmValue <= 0) {
      setError('Le kilométrage doit être supérieur à 0.')
      return
    }
    setError(null)
    const record: Trip = {
      id: uid(),
      date: date || new Date().toISOString().slice(0, 10),
      km: kmValue,
      motif: motif || '(sans motif)',
      hasBefore: !!before,
      hasAfter: !!after,
    }
    await ledger.addTrip(record, before, after)
    setDate('')
    setKm('')
    setMotif('')
    setBefore(null)
    setAfter(null)
    setPhotoError(null)
  }

  const currentYear = new Date().getFullYear().toString()
  const kmThisYear = trips.filter((t) => t.date.slice(0, 4) === currentYear).reduce((s, t) => s + t.km, 0)
  const kmAll = trips.reduce((s, t) => s + t.km, 0)
  const sorted = [...trips].sort((a, b) => b.date.localeCompare(a.date))
  const shown = sorted.slice(0, list.visible)
  const detailTrip = detailId ? trips.find((t) => t.id === detailId) : null

  return (
    <section className="panel">
      <h2 className="panel-title">Kilométrage d'affaires</h2>

      <div className="section-summary">
        <div className="ssum-item">
          <span className="ssum-label">Cette année</span>
          <span className="ssum-value">{formatKm(kmThisYear)}</span>
        </div>
        <div className="ssum-item">
          <span className="ssum-label">Total tous les temps</span>
          <span className="ssum-value">{formatKm(kmAll)}</span>
        </div>
      </div>

      <div className="review-box">
        <div className="rb-title">Ajouter un déplacement</div>
        <div className="form-row">
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Kilomètres</label>
            <input type="number" step="0.1" value={km} onChange={(e) => setKm(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label>Motif du déplacement</label>
            <input
              type="text"
              placeholder="Ex : visite client, tournage 360 à Laval"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
            />
          </div>
        </div>
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            📷 Photo du tableau de bord — avant
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handlePhoto(e.target.files?.[0] ?? null, 'before')}
            />
          </label>
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            📷 Photo du tableau de bord — après
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handlePhoto(e.target.files?.[0] ?? null, 'after')}
            />
          </label>
        </div>
        {photoStatus && <div className="status-msg">{photoStatus}</div>}
        {photoError && <div className="status-msg err">{photoError}</div>}
        {error && <div className="status-msg err">{error}</div>}
        <div className="btn-row">
          <button type="button" className="btn" onClick={handleSave}>
            Ajouter le trajet
          </button>
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 24 }}>
        <button type="button" className="btn secondary" onClick={list.toggle}>
          {list.shown ? 'Masquer les trajets' : 'Voir les trajets'}
        </button>
      </div>

      {list.shown && (
        <div>
          {trips.length === 0 ? (
            <div className="empty">
              <span className="icon">🚗</span>
              Aucun trajet enregistré pour l'instant.
            </div>
          ) : (
            <>
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Motif</th>
                    <th className="num">Km</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{t.date}</td>
                      <td>{t.motif}</td>
                      <td className="mono num">{formatKm(t.km)}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Détails"
                          onClick={() => setDetailId(t.id)}
                        >
                          🔍
                        </button>
                        <button
                          type="button"
                          className="icon-btn del"
                          title="Supprimer"
                          onClick={() => setDeleteId(t.id)}
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
                  Total tous les temps
                  <b>{formatKm(kmAll)}</b>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {detailTrip && <TripDetail trip={detailTrip} ledger={ledger} onClose={() => setDetailId(null)} />}

      {deleteId && (
        <ConfirmModal
          message="Voulez-vous vraiment supprimer ce trajet ?"
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            ledger.deleteTrip(deleteId)
            setDeleteId(null)
          }}
        />
      )}
    </section>
  )
}

function TripDetail({ trip, ledger, onClose }: { trip: Trip; ledger: Ledger; onClose: () => void }) {
  const [beforeBlob, setBeforeBlob] = useState<Blob | null>(null)
  const [afterBlob, setAfterBlob] = useState<Blob | null>(null)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (trip.hasBefore) ledger.getTripImage(trip.id, 'before').then((b) => !cancelled && setBeforeBlob(b))
    if (trip.hasAfter) ledger.getTripImage(trip.id, 'after').then((b) => !cancelled && setAfterBlob(b))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id])
  const beforeUrl = useBlobUrl(beforeBlob)
  const afterUrl = useBlobUrl(afterBlob)

  if (editing) {
    return (
      <TripEditForm
        trip={trip}
        currentBeforeUrl={beforeUrl}
        currentAfterUrl={afterUrl}
        ledger={ledger}
        onCancel={() => setEditing(false)}
        onSaved={onClose}
      />
    )
  }

  return (
    <DetailModal onClose={onClose}>
      <h3 className="detail-title">Détail du trajet</h3>
      {(beforeUrl || afterUrl) && (
        <div className="detail-imgs-row">
          {beforeUrl && (
            <div>
              <div className="status-msg" style={{ margin: '0 0 4px' }}>
                Avant
              </div>
              <img src={beforeUrl} alt="Avant" />
            </div>
          )}
          {afterUrl && (
            <div>
              <div className="status-msg" style={{ margin: '0 0 4px' }}>
                Après
              </div>
              <img src={afterUrl} alt="Après" />
            </div>
          )}
        </div>
      )}
      <div className="detail-rows">
        <DetailRow label="Date" value={trip.date} />
        <DetailRow label="Kilomètres" value={formatKm(trip.km)} />
        <DetailRow label="Motif" value={trip.motif} />
      </div>
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button type="button" className="btn secondary btn-sm" onClick={() => setEditing(true)}>
          ✏️ Modifier
        </button>
      </div>
    </DetailModal>
  )
}

function PhotoActionControls({
  label,
  currentUrl,
  action,
  onChange,
}: {
  label: string
  currentUrl: string | null
  action: ImageAction
  onChange: (action: ImageAction) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const displayedUrl = action.kind === 'removed' ? null : (preview ?? currentUrl)

  async function handleFile(file: File | null) {
    if (!file) return
    const compressed = await compressImage(file, 1000, 0.7)
    setPreview(compressed.dataUrl)
    onChange({ kind: 'replaced', blob: compressed.blob })
  }

  return (
    <div>
      <div className="status-msg" style={{ margin: '0 0 4px' }}>
        {label}
      </div>
      {displayedUrl && <img src={displayedUrl} alt={label} style={{ width: 160, borderRadius: 8, border: '1px solid var(--line)' }} />}
      <div className="btn-row" style={{ marginTop: 6 }}>
        {displayedUrl && (
          <button
            type="button"
            className="btn secondary btn-sm"
            onClick={() => {
              setPreview(null)
              onChange({ kind: 'removed' })
            }}
          >
            ✕ Retirer
          </button>
        )}
        <label className="btn secondary btn-sm" style={{ cursor: 'pointer' }}>
          {displayedUrl ? 'Remplacer' : 'Ajouter'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  )
}

function TripEditForm({
  trip,
  currentBeforeUrl,
  currentAfterUrl,
  ledger,
  onCancel,
  onSaved,
}: {
  trip: Trip
  currentBeforeUrl: string | null
  currentAfterUrl: string | null
  ledger: Ledger
  onCancel: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(trip.date)
  const [km, setKm] = useState(String(trip.km))
  const [motif, setMotif] = useState(trip.motif)
  const [beforeAction, setBeforeAction] = useState<ImageAction>({ kind: 'unchanged' })
  const [afterAction, setAfterAction] = useState<ImageAction>({ kind: 'unchanged' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const kmValue = parseFloat(km.replace(',', '.'))
    if (!kmValue || kmValue <= 0) {
      setError('Le kilométrage doit être supérieur à 0.')
      return
    }
    setSaving(true)
    const record: Trip = {
      id: trip.id,
      date: date || trip.date,
      km: kmValue,
      motif: motif || '(sans motif)',
      hasBefore: beforeAction.kind === 'removed' ? false : beforeAction.kind === 'replaced' ? true : trip.hasBefore,
      hasAfter: afterAction.kind === 'removed' ? false : afterAction.kind === 'replaced' ? true : trip.hasAfter,
    }
    await ledger.updateTrip(record, beforeAction, afterAction)
    setSaving(false)
    onSaved()
  }

  return (
    <DetailModal onClose={onCancel}>
      <h3 className="detail-title">Modifier le trajet</h3>
      <div className="detail-imgs-row">
        <PhotoActionControls
          label="Avant"
          currentUrl={currentBeforeUrl}
          action={beforeAction}
          onChange={setBeforeAction}
        />
        <PhotoActionControls
          label="Après"
          currentUrl={currentAfterUrl}
          action={afterAction}
          onChange={setAfterAction}
        />
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Kilomètres</label>
          <input type="number" step="0.1" value={km} onChange={(e) => setKm(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Motif du déplacement</label>
          <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)} />
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
