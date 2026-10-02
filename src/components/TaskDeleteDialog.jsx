import { useState } from 'react'

export default function TaskDeleteDialog({ recurring, onClose, onDelete }) {
  const occurrenceDelete = Boolean(recurring.recurrence?.frequency && recurring.occurrenceDate)
  const [scope, setScope] = useState(occurrenceDelete ? 'occurrence' : 'series')
  return <div className="modal-backdrop" onClick={onClose}><section className="modal delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-task-title" onClick={(event) => event.stopPropagation()}>
    <button className="modal-close" type="button" aria-label="Cancel delete" onClick={onClose}>×</button>
    <h2 id="delete-task-title">Delete this task?</h2><p>This will remove “{recurring.title}” from your calendar and reminders.</p>
    {occurrenceDelete && <fieldset className="scope-picker"><legend>Delete</legend><label><input type="radio" name="delete-scope" value="occurrence" checked={scope === 'occurrence'} onChange={() => setScope('occurrence')} />This occurrence only</label><label><input type="radio" name="delete-scope" value="future" checked={scope === 'future'} onChange={() => setScope('future')} />This and future occurrences</label><label><input type="radio" name="delete-scope" value="series" checked={scope === 'series'} onChange={() => setScope('series')} />Entire series</label></fieldset>}
    <div className="delete-actions"><button type="button" className="secondary-action" onClick={onClose}>Cancel</button><button type="button" className="danger-button" onClick={() => onDelete(scope)}>Delete</button></div>
  </section></div>
}
