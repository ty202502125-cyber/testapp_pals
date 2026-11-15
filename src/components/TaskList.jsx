import { useState } from 'react'
import { expandTaskOccurrences, formatDue, localDateKey } from '../services/calendarTasks.js'

export default function TaskList({ tasks, setTasks, onAdd, onEdit, onDelete }) {
  const [filter, setFilter] = useState('All')
  // Delete slide-out: the row animates out for 240ms before the dialog opens.
  const [exitingId, setExitingId] = useState(null)
  const handleDelete = (task) => {
    setExitingId(task.id)
    window.setTimeout(() => {
      setExitingId(null)
      onDelete(task)
    }, 240)
  }
  const taskIsDone = (task) => task.recurrence?.frequency && task.recurrence.frequency !== 'none'
    ? (task.completedOccurrences || []).includes(localDateKey(new Date(task.dueAt)))
    : task.done

  const today = new Date()
  const todayKey = localDateKey(today)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const pastStart = new Date(today)
  pastStart.setDate(today.getDate() - 365)
  const todayOccurrences = expandTaskOccurrences(tasks, today, today)
  const pastOccurrences = expandTaskOccurrences(tasks, pastStart, yesterday)
  const todayIds = new Set(todayOccurrences.filter((task) => task.occurrenceDate === todayKey).map((task) => task.id))
  const overdueIds = new Set(pastOccurrences.filter((task) => task.occurrenceDate < todayKey && !task.done && new Date(task.dueAt).getTime() < Date.now()).map((task) => task.id))

  const filters = {
    All: tasks,
    Today: tasks.filter((task) => todayIds.has(task.id)),
    Overdue: tasks.filter((task) => overdueIds.has(task.id)),
    Done: tasks.filter((task) => taskIsDone(task)),
  }
  const emptyText = {
    All: 'Nothing on your list. Enjoy the breathing room!',
    Today: 'Nothing due today.',
    Overdue: 'Nothing overdue — nice.',
    Done: 'Nothing completed yet.',
  }
  const visibleTasks = filters[filter]

  return <div className="panel full-panel">
    <div className="panel-heading"><div><h2>Tasks <span className="heading-count">{visibleTasks.length}</span></h2><p>Your plans are saved on this device.</p></div>
    </div>
    <div className="filter-pills" role="group" aria-label="Filter tasks">
      {['All', 'Today', 'Overdue', 'Done'].map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item} <span className="filter-count">{filters[item].length}</span></button>)}
    </div>

    {/* key={filter} remounts the list on filter switch so rows slide in again. */}
    <div className="task-list-animated" key={filter}>
    {visibleTasks.map((task) => <div className={`task-row full-task${exitingId === task.id ? ' task-row-exiting' : ''}`} key={task.id}>
      <button type="button" className={`check-circle ${taskIsDone(task) ? 'checked' : ''}`} aria-label={taskIsDone
       (task) ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} onClick={() => setTasks((items) => items.map((item) => {
        if (item.id !== task.id) return item
        if (!item.recurrence?.frequency || item.recurrence.frequency === 'none') return { ...item, done: !item.done }

        const date = localDateKey(new Date(item.dueAt))
        const dates = new Set(item.completedOccurrences || [])

        if (dates.has(date)) dates.delete(date); else dates.add(date)
        return { ...item, completedOccurrences: [...dates] }
      }))}>{task.done && '✓'}
      </button>

      <div className="task-copy">
        <strong>{task.title}</strong>
        <div className="task-meta">{task.subject || 'Personal'} · {formatDue(task)}{task.recurrence?.frequency && task.
         recurrence.frequency !== 'none' ? ' · Repeats' : ''}
        </div>{task.description && <p className="task-description">{task.description}</p>}
      </div>

      <div className="task-list-actions">
        <button type="button" onClick={() => onEdit(task)}>Edit</button>
        <button type="button" className="delete-task-action" onClick={() => handleDelete(task)}>Delete</button>
      </div>
    </div>)}

    {!visibleTasks.length && <p className="empty-text">{emptyText[filter]}</p>}
    </div>
    <button className="add-row" type="button" onClick={onAdd}>＋ <span>Add another task</span></button>
  </div>
}
