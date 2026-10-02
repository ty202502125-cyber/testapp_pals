export default function TaskCalendarActions({ task, onClose, onEdit, onDelete }) {
  if (!task) return null
  const scheduled = new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(task.dueAt))

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal task-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-task-actions-title" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="modal-close" aria-label="Close task actions" onClick={onClose}>×</button>
      <span className="eyebrow">CALENDAR TASK</span>
      <h2 id="calendar-task-actions-title">{task.title}</h2>
      <p>{scheduled}{task.recurrence?.frequency ? ' · Repeating task' : ''}</p>
      <div className="calendar-task-actions">
        <button type="button" className="primary-button" onClick={() => onEdit(task)}>Edit task</button>
        <button type="button" className="calendar-task-delete" onClick={() => onDelete(task)}>Delete task</button>
        <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
      </div>
    </section>
  </div>
}
