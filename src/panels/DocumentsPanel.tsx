import { useEffect, useState } from 'react'
import { openFileExternally } from '../lib/download'
import { TAILLE_MAX_FICHIER } from '../hooks/useLedger'
import { useBlobUrl } from '../hooks/useBlobUrl'
import { useListToggle } from '../hooks/useListToggle'
import { ConfirmModal } from '../components/ConfirmModal'
import { DetailModal, DetailRow } from '../components/DetailModal'
import type { useDocuments } from '../hooks/useDocuments'
import type { TaxDocument } from '../types'

type DocumentsHook = ReturnType<typeof useDocuments>

interface PendingFile {
  blob: Blob
  name: string
  tooLarge: boolean
}

export function DocumentsPanel({ documentsHook }: { documentsHook: DocumentsHook }) {
  const { documents, addDocument, deleteDocument, getDocumentFile } = documentsHook
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [fileStatus, setFileStatus] = useState<{ text: string; err: boolean } | null>(null)
  const [dragOver, setDragOver] = useState(false)
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

  async function handleSave() {
    await addDocument(
      {
        date: date || new Date().toISOString().slice(0, 10),
        description,
        fileName: pendingFile?.name ?? null,
        hasFile: !!(pendingFile && !pendingFile.tooLarge),
      },
      pendingFile && !pendingFile.tooLarge ? { blob: pendingFile.blob, name: pendingFile.name } : null,
    )
    setDescription('')
    clearFile()
  }

  const sorted = [...documents].sort((a, b) => b.date.localeCompare(a.date))
  const shown = sorted.slice(0, list.visible)
  const detailDocument = detailId ? documents.find((d) => d.id === detailId) : null

  return (
    <section className="panel">
      <h2 className="panel-title">Documents</h2>

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
        <div className="icon">🗂️</div>
        <p>Glisse un document ici ou choisis-le sur ton ordinateur (PDF, image, etc.)</p>
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
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label>Description</label>
          <input
            type="text"
            placeholder="Ex : T4 employeur X 2026, reçus dentiste janvier-juin"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <div className="btn-row" style={{ marginBottom: 22 }}>
        <button type="button" className="btn" onClick={handleSave}>
          Enregistrer le document
        </button>
      </div>

      <div className="btn-row" style={{ marginBottom: 24 }}>
        <button type="button" className="btn secondary" onClick={list.toggle}>
          {list.shown ? 'Masquer les documents' : 'Voir les documents'}
        </button>
      </div>

      {list.shown && (
        <div>
          {documents.length === 0 ? (
            <div className="empty">
              <span className="icon">📥</span>
              Aucun document enregistré pour l'instant.
            </div>
          ) : (
            <>
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((d) => (
                    <tr key={d.id}>
                      <td className="mono">{d.date}</td>
                      <td>{d.description || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Détails"
                          onClick={() => setDetailId(d.id)}
                        >
                          🔍
                        </button>
                        <button
                          type="button"
                          className="icon-btn del"
                          title="Supprimer"
                          onClick={() => setDeleteId(d.id)}
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
            </>
          )}
        </div>
      )}

      {detailDocument && (
        <DocumentDetail
          document={detailDocument}
          getDocumentFile={getDocumentFile}
          onClose={() => setDetailId(null)}
        />
      )}

      {deleteId && (
        <ConfirmModal
          message="Voulez-vous vraiment supprimer ce document ?"
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            deleteDocument(deleteId)
            setDeleteId(null)
          }}
        />
      )}
    </section>
  )
}

function DocumentDetail({
  document: doc,
  getDocumentFile,
  onClose,
}: {
  document: TaxDocument
  getDocumentFile: (id: string) => Promise<Blob | null>
  onClose: () => void
}) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    if (doc.hasFile) {
      getDocumentFile(doc.id).then((b) => {
        if (!cancelled) setBlob(b)
      })
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])
  const fileUrl = useBlobUrl(blob)
  const isImage = blob?.type.startsWith('image/')

  return (
    <DetailModal onClose={onClose}>
      <h3 className="detail-title">Détail du document</h3>
      {fileUrl && isImage && <img className="detail-img" src={fileUrl} alt="Document" />}
      <div className="detail-rows">
        <DetailRow label="Date" value={doc.date} />
        <DetailRow label="Description" value={doc.description || '—'} />
        <DetailRow label="Fichier" value={doc.fileName ?? '—'} />
      </div>
      {blob && !isImage && (
        <p style={{ marginTop: 14 }}>
          <button
            type="button"
            className="file-link"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            onClick={() => {
              setOpenError(null)
              openFileExternally(blob, doc.fileName ?? 'document').catch((err) =>
                setOpenError(err instanceof Error ? err.message : String(err)),
              )
            }}
          >
            Ouvrir le fichier
          </button>
          {openError && (
            <span className="status-msg err" style={{ marginLeft: 8 }}>
              Impossible d'ouvrir le fichier : {openError}
            </span>
          )}
        </p>
      )}
      {!fileUrl && doc.fileName && !doc.hasFile && (
        <p className="status-msg err" style={{ marginTop: 14 }}>
          Fichier trop volumineux — non sauvegardé, seul le nom a été conservé.
        </p>
      )}
    </DetailModal>
  )
}
