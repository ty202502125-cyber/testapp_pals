import { useState } from 'react'
import { dateKeyFromDueAt } from '../services/calendarTasks.js'

const weekdays = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]]
const inputTime = (dueAt) => dueAt ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(dueAt)) : '09:00'

export default function TaskEditor({ initial, onClose, onSave }) {
  const task = initial.task
  const taskDate = initial.occurrenceDate || dateKeyFromDueAt(task?.dueAt) || initial.initialDate
  const canEditOccurrence = initial.mode === 'edit' && Boolean(task?.recurrence?.frequency) && Boolean(initial.occurrenceDate)
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [date, setDate] = useState(taskDate)
  const [time, setTime] = useState(inputTime(task?.dueAt))
  const [reminderMinutes, setReminderMinutes] = useState(task?.reminderMinutes == null ? '' : String(task.reminderMinutes))
  const [frequency, setFrequency] = useState(task?.recurrence?.frequency || 'none')
  const monthEnd = new Date(`${taskDate}T00:00:00`)
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0)
  const defaultEndDate = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`
  const [endDate, setEndDate] = useState(task?.recurrence?.endDate || (initial.mode === 'create' ? defaultEndDate : taskDate))
  const [selectedDays, setSelectedDays] = useState(task?.recurrence?.weekdays || [new Date(`${taskDate}T00:00:00`).getDay()])
  const [scope, setScope] = useState(canEditOccurrence ? 'occurrence' : 'series')

  const toggleDay = (day) => setSelectedDays((days) => days.includes(day) ? days.filter((item) => item !== day) : [...days, day])
  const submit = (event) => {
    event.preventDefault()
    onSave({ title: title.trim(), description: description.trim(), date, time, reminderMinutes: reminderMinutes === '' ? null : Number(reminderMinutes), recurrence: frequency === 'none' ? null : { frequency, startDate: date, endDate: endDate || date, weekdays: frequency === 'weekly' ? selectedDays : [] } }, scope)
  }

  return <div className="modal-backdrop" onClick={onClose}><form className="modal task-editor" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
    <button type="button" className="modal-close" aria-label="Close task editor" onClick={onClose}>×</button>
    <span className="modal-icon" aria-hidden="true">{initial.mode === 'edit' ? '✎' : '＋'}</span>
    <h2>{initial.mode === 'edit' ? 'Edit task' : 'Add a calendar task'}</h2>
    <p>Choose when it happens and when Check should remind you.</p>
    <label className="task-field">Task title<input autoFocus required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to get done?" /></label>
    <label className="task-field">Notes <span className="field-optional">Optional</span><textarea rows="3" maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a few details" /></label>
    <div className="reminder-fields"><label>Date<input type="date" required value={date} onChange={(event) => { setDate(event.target.value); if (frequency !== 'none') setEndDate((end) => end < event.target.value ? event.target.value : end) }} /></label><label>Time<input type="time" required value={time} onChange={(event) => setTime(event.target.value)} /></label></div>
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
      <label className="task-field">Repeat through<input type="date" required min={date} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
    </>}
    {canEditOccurrence && <fieldset className="scope-picker"><legend>Apply changes to</legend><label><input type="radio" name="task-scope" value="occurrence" checked={scope === 'occurrence'} onChange={() => setScope('occurrence')} />This occurrence only</label><label><input type="radio" name="task-scope" value="series" checked={scope === 'series'} onChange={() => setScope('series')} />Entire series</label></fieldset>}
    <button className="primary-button modal-submit" type="submit">{initial.mode === 'edit' ? 'Save changes' : 'Add task'}</button>
  </form></div>
}
