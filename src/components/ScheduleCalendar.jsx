import { useEffect, useState } from 'react'
import { expandTaskOccurrences, localDateKey } from '../services/calendarTasks.js'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const weekIndex = (date) => (date.getDay() + 6) % 7
const sameDay = (a, b) => a.toDateString() === b.toDateString()
const slots = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)
const timeLabel = (date) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)

export default function ScheduleCalendar({ date, view, onView, onMove, onDateSelect, subjects, tasks, onCreateTask, onEditTask, onDeleteTask, onToggleTask, remindersEnabled, reminderSoundEnabled, onReminderSoundSetting, notificationPermission, onNotificationSetting }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const id = window.setInterval(update, 60000)
    return () => window.clearInterval(id)
  }, [])
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const monthGridStart = new Date(monthStart)
  monthGridStart.setDate(monthStart.getDate() - weekIndex(monthStart))
  const monthDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(monthGridStart)
    day.setDate(monthGridStart.getDate() + index)
    return day
  })
  const monday = new Date(date)
  monday.setDate(date.getDate() - weekIndex(date))
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return day
  })
  const visibleDays = view === 'Day' ? [date] : weekDays
  const rangeStart = view === 'Month' ? monthGridStart : view === 'Day' ? date : weekDays[0]
  const rangeEnd = view === 'Month' ? new Date(monthGridStart.getFullYear(), monthGridStart.getMonth(), monthGridStart.getDate() + 41) : view === 'Day' ? date : weekDays[6]
  const taskOccurrences = expandTaskOccurrences(tasks, rangeStart, rangeEnd)
  const label = view === 'Day'
    ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(date)
    : view === 'Month'
      ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
      : `${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(weekDays[0])} – ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(weekDays[6])}`
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const isRecurring = (task) => Boolean(task.recurrence?.frequency && task.recurrence.frequency !== 'none')
  const renderTask = (task) => {
    const dueDate = new Date(task.dueAt)
    const overdue = !task.done && now > 0 && dueDate.getTime() < now
    return <button type="button" key={task.occurrenceId} className={`calendar-event task-event${task.done ? ' completed' : ''}${overdue ? ' overdue' : ''}${isRecurring(task) ? ' recurring' : ''}`} onClick={() => onEditTask(task)} aria-label={`Edit ${task.title}, ${timeLabel(dueDate)}${task.done ? ', completed' : ''}`} title={`${task.title} · ${timeLabel(dueDate)}${task.reminderMinutes == null ? '' : ' · reminder set'}${isRecurring(task) ? ' · recurring' : ''}`}>
      <strong>{task.title}</strong><small>{timeLabel(dueDate)}{task.reminderMinutes != null ? ' · ◷' : ''}{isRecurring(task) ? ' · ↻' : ''}</small>
    </button>
  }
  const monthDayTasks = (day) => taskOccurrences.filter((task) => localDateKey(new Date(task.dueAt)) === localDateKey(day))
  const monthClassCount = (day) => subjects.filter((item) => item.day === weekIndex(day)).length
  const dayTasks = taskOccurrences.filter((task) => localDateKey(new Date(task.dueAt)) === localDateKey(date)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))

  return <>
    <div className="calendar-tools">
      <button className="primary-button" type="button" onClick={() => onCreateTask(localDateKey(date))}>＋ Add task</button>
      <div className="notification-control"><span>{notificationPermission === 'denied' ? 'Notifications blocked in browser settings' : notificationPermission === 'unsupported' ? 'Notifications unavailable in this browser' : remindersEnabled && notificationPermission === 'granted' ? 'Task reminders are on' : 'Task reminders are off'}</span><button type="button" onClick={onNotificationSetting}>{notificationPermission === 'granted' ? remindersEnabled ? 'Pause reminders' : 'Turn on reminders' : 'Enable notifications'}</button><button type="button" aria-pressed={reminderSoundEnabled} onClick={onReminderSoundSetting}>Sound {reminderSoundEnabled ? 'on' : 'off'}</button></div>
    </div>
    {notificationPermission === 'denied' && <p className="notification-help" role="status">Allow notifications for this site in your browser settings, then return here to use reminders.</p>}
    <p className="notification-limit">Reminders are checked while Check is open. Closed-app delivery requires server-backed Web Push.</p>
    <div className="view-switch" aria-label="Calendar view">
      {['Day', 'Week', 'Month'].map((item) => <button type="button" key={item} className={view === item ? 'active' : ''} aria-pressed={view === item} onClick={() => onView(item)}>{item}</button>)}
      <span>{label}</span>
      <button type="button" aria-label={`Previous ${view.toLowerCase()}`} onClick={() => onMove(-1)}>‹</button>
      <button type="button" aria-label={`Next ${view.toLowerCase()}`} onClick={() => onMove(1)}>›</button>
    </div>
    {view === 'Month' ? <div className="panel month-panel"><div className="month-grid">
      {weekdays.map((day) => <strong className="month-weekday" key={day}>{day}</strong>)}
      {monthDays.map((day) => {
        const count = monthDayTasks(day).length + monthClassCount(day)
        const taskLabels = monthDayTasks(day).slice(0, 2).map((task) => task.title)
        return <button type="button" key={day.toISOString()} className={`month-day${day.getMonth() !== date.getMonth() ? ' outside-month' : ''}${sameDay(day, new Date()) ? ' today' : ''}${monthDayTasks(day).length ? ' has-tasks' : ''}`} onClick={() => onDateSelect(day)} aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(day)}, ${monthDayTasks(day).length} tasks and ${monthClassCount(day)} classes`}>
          <span>{day.getDate()}</span>{taskLabels.map((title, index) => <small className="month-task-label" key={`${title}-${index}`}>{title}</small>)}{count > taskLabels.length && <small className="month-more">+{count - taskLabels.length} more</small>}
        </button>
      })}
    </div></div> : <div className={`panel calendar-panel${view === 'Day' ? ' day-view' : ''}`}>
      <div className="calendar-head" style={{ gridTemplateColumns: `54px repeat(${visibleDays.length}, minmax(92px, 1fr))` }}>
        <span>{timezone}</span>{visibleDays.map((day) => <strong className={sameDay(day, new Date()) ? 'today-column' : ''} key={day.toISOString()}>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)} <b>{day.getDate()}</b></strong>)}
      </div>
      <div className="calendar-body">
        {slots.map((slot, hour) => <div className="calendar-row" key={slot}><small>{slot}</small><div className="calendar-slots" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(92px, 1fr))` }}>
          {visibleDays.map((day) => {
            const dateKey = localDateKey(day)
            const classes = subjects.filter((item) => item.day === weekIndex(day) && item.start + 8 === hour)
            const events = taskOccurrences.filter((task) => localDateKey(new Date(task.dueAt)) === dateKey && new Date(task.dueAt).getHours() === hour)
            return <div className={`calendar-slot${sameDay(day, new Date()) ? ' today-column' : ''}`} key={dateKey}>
              {classes.map((item) => <div key={item.title} className={`calendar-event ${item.tone}`}><strong>{item.title}</strong><small>{item.at}</small></div>)}
              {events.map(renderTask)}
            </div>
          })}
        </div></div>)}
      </div>
    </div>}
    {view === 'Day' && <section className="panel day-task-list"><div className="panel-heading"><div><h2>Tasks for this day</h2><p>{dayTasks.length ? `${dayTasks.length} scheduled` : 'Nothing planned yet.'}</p></div></div>
      {dayTasks.map((task) => <article className={`day-task-row${task.done ? ' completed' : ''}`} key={task.occurrenceId}><div className="day-task-time">{timeLabel(new Date(task.dueAt))}</div><div className="day-task-copy"><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<small>{task.reminderMinutes == null ? 'No reminder' : task.reminderMinutes === 0 ? 'Reminder at task time' : `Reminder ${task.reminderMinutes} minutes before`}{isRecurring(task) ? ' · Repeats' : ''}{task.done ? ' · Completed' : ''}</small></div><div className="day-task-actions"><button type="button" onClick={() => onToggleTask(task)}>{task.done ? 'Undo' : 'Complete'}</button><button type="button" onClick={() => onEditTask(task)}>Edit</button><button type="button" className="delete-task-action" onClick={() => onDeleteTask(task)}>Delete</button></div></article>)}
      {!dayTasks.length && <button type="button" className="add-row" onClick={() => onCreateTask(localDateKey(date))}>＋ <span>Add a task to this day</span></button>}
    </section>}
  </>
}
