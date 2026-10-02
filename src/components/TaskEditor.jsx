import { useState } from 'react'
import { dateKeyFromDueAt, localDateKey } from '../services/calendarTasks.js'

const weekdays = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]]
const inputTime = (dueAt) => dueAt ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(dueAt)) : '09:00'

export default function TaskEditor({ initial, onClose, onSave, onDelete }) {
  const task = initial.task
  const taskDate = initial.occurrenceDate || dateKeyFromDueAt(task?.dueAt) || initial.initialDate || localDateKey(new Date())
  const canEditOccurrence = initial.mode === 'edit' && Boolean(task?.recurrence?.frequency) && Boolean(initial.occurrenceDate)
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [date, setDate] = useState(taskDate)
  const [time, setTime] = useState(inputTime(task?.dueAt))
  const [reminderMinutes, setReminderMinutes] = useState(task?.reminderMinutes == null ? '' : String(task.reminderMinutes))
  const [frequency, setFrequency] = useState(task?.recurrence?.frequency || 'none')
  const monthEnd = (dateKey) => {
    const selected = new Date(`${dateKey}T00:00:00`)
    const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  }
  const [repeatPeriod, setRepeatPeriod] = useState(task?.recurrence?.period || (task?.recurrence?.endDate && task.recurrence.endDate > monthEnd(taskDate) ? 'year' : 'month'))
  const [selectedDays, setSelectedDays] = useState(task?.recurrence?.weekdays || [new Date(`${taskDate}T00:00:00`).getDay()])
  const [scope, setScope] = useState(canEditOccurrence ? 'occurrence' : 'series')

  const toggleDay = (day) => setSelectedDays((days) => days.includes(day) ? days.filter((item) => item !== day) : [...days, day])
  const submit = (event) => {
    event.preventDefault()
    const yearEnd = `${date.slice(0, 4)}-12-31`
    onSave({ title: title.trim(), description: description.trim(), date, time, reminderMinutes: reminderMinutes === '' ? null : Number(reminderMinutes), recurrence: frequency === 'none' ? null : { frequency, startDate: date, endDate: repeatPeriod === 'year' ? yearEnd : monthEnd(date), period: repeatPeriod, weekdays: frequency === 'weekly' ? selectedDays : [] } }, scope)
  }

  return <div className="modal-backdrop" onClick={onClose}><form className="modal task-editor" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
    <button type="button" className="modal-close" aria-label="Close task editor" onClick={onClose}>×</button>
    <span className="modal-icon" aria-hidden="true">{initial.mode === 'edit' ? '✎' : '＋'}</span>
    <h2>{initial.mode === 'edit' ? 'Edit task' : 'Add a calendar task'}</h2>
    <p>Choose when it happens and when Check should remind you.</p>
    <label className="task-field">Task title<input autoFocus required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to get done?" /></label>
    <label className="task-field">Notes <span className="field-optional">Optional</span><textarea rows="3" maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a few details" /></label>
    <div className="reminder-fields"><label>Date<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Time<input type="time" required value={time} onChange={(event) => setTime(event.target.value)} /></label></div>
    <label className="task-field">Remind me
      <select value={reminderMinutes} onChange={(event) => setReminderMinutes(event.target.value)}>
        <option value="">No reminder</option><option value="0">At the time of the task</option><option value="5">5 minutes before</option><option value="10">10 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option>
      </select>
    </label>
    <label className="task-field">Repeat
      <select value={frequency} disabled={canEditOccurrence && scope === 'occurrence'} onChange={(event) => { setFrequency(event.target.value); if (event.target.value === 'weekly' && !selectedDays.length) setSelectedDays([new Date(`${date}T00:00:00`).getDay()]) }}><option value="none">Only this day</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="weekdays">Weekdays</option><option value="monthly">Every month</option></select>
    </label>
    {canEditOccurrence && scope === 'occurrence' && <small className="scope-note">Repeat settings apply to the series.</small>}
    {frequency !== 'none' && <>
      {frequency === 'weekly' && <fieldset className="weekday-picker"><legend>Repeat on</legend>{weekdays.map(([label, day]) => <label key={day}><input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} />{label}</label>)}</fieldset>}
      <label className="task-field">Repeat for<select value={repeatPeriod} onChange={(event) => setRepeatPeriod(event.target.value)}><option value="month">This month only</option><option value="year">Keep repeating through December</option></select></label>
    </>}
    {canEditOccurrence && <fieldset className="scope-picker"><legend>Apply changes to</legend><label><input type="radio" name="task-scope" value="occurrence" checked={scope === 'occurrence'} onChange={() => setScope('occurrence')} />This occurrence only</label><label><input type="radio" name="task-scope" value="series" checked={scope === 'series'} onChange={() => setScope('series')} />Entire series</label></fieldset>}
    <div className="task-editor-actions">{initial.mode === 'edit' && <button className="delete-task-action" type="button" onClick={() => onDelete(initial.task)}>Delete task</button>}<button className="primary-button modal-submit" type="submit">{initial.mode === 'edit' ? 'Save changes' : 'Add task'}</button></div>
  </form></div>
}
