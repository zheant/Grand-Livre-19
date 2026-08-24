import type { ReactNode } from 'react'

export function DetailModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-box detail-box">
        <button type="button" className="modal-close" onClick={onClose}>
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="drow">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}
