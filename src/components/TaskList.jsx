import { formatDue, localDateKey } from '../services/calendarTasks.js'

export default function TaskList({ tasks, setTasks, onAdd, onEdit, onDelete }) {
  const taskIsDone = (task) => task.recurrence?.frequency && task.recurrence.frequency !== 'none'
    ? (task.completedOccurrences || []).includes(localDateKey(new Date(task.dueAt)))
    : task.done
  return <div className="panel full-panel"><div className="panel-heading"><div><h2>All tasks <span className="heading-count">{tasks.filter((task) => !task.done).length}</span></h2><p>Your plans are saved on this device.</p></div></div>
    {tasks.map((task) => <div className="task-row full-task" key={task.id}>
      <button type="button" className={`check-circle ${taskIsDone(task) ? 'checked' : ''}`} aria-label={taskIsDone(task) ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} onClick={() => setTasks((items) => items.map((item) => {
        if (item.id !== task.id) return item
        if (!item.recurrence?.frequency || item.recurrence.frequency === 'none') return { ...item, done: !item.done }
        const date = localDateKey(new Date(item.dueAt))
        const dates = new Set(item.completedOccurrences || [])
        if (dates.has(date)) dates.delete(date); else dates.add(date)
        return { ...item, completedOccurrences: [...dates] }
      }))}>{task.done && '✓'}</button>
      <div className="task-copy"><strong>{task.title}</strong><div className="task-meta">{task.subject || 'Personal'} · {formatDue(task)}{task.recurrence?.frequency && task.recurrence.frequency !== 'none' ? ' · Repeats' : ''}</div>{task.description && <p className="task-description">{task.description}</p>}</div>
      <div className="task-list-actions"><button type="button" onClick={() => onEdit(task)}>Edit</button><button type="button" className="delete-task-action" onClick={() => onDelete(task)}>Delete</button></div>
    </div>)}
    {!tasks.length && <p className="empty-text">Nothing on your list. Enjoy the breathing room!</p>}
    <button className="add-row" type="button" onClick={onAdd}>＋ <span>Add another task</span></button>
  </div>
}
