export default function ConfirmDialog({ title, body, confirmLabel = 'אישור', onConfirm, onCancel }) {
  return (
    <div
      className="sheet-backdrop middle"
      onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}
    >
      <div className="dialog" role="dialog" aria-modal="true">
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="sheet-actions">
          <button type="button" className="btn-primary" onClick={onConfirm}>{confirmLabel}</button>
          <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        </div>
      </div>
    </div>
  )
}
