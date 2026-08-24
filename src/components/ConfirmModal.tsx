export function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="modal-box">
        <p>{message}</p>
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onCancel}>
            Non
          </button>
          <button type="button" className="btn" onClick={onConfirm}>
            Oui
          </button>
        </div>
      </div>
    </div>
  )
}
