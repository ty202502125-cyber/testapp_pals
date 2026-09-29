const timeSlots = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM']
const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const mondayIndex = (date) => (date.getDay() + 6) % 7
const sameDay = (left, right) => left.toDateString() === right.toDateString()

export default function ScheduleCalendar({ date, view, onView, onMove, onDateSelect, subjects }) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const monthGridStart = new Date(monthStart)
  monthGridStart.setDate(monthStart.getDate() - mondayIndex(monthStart))
  const monthDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(monthGridStart)
    day.setDate(monthGridStart.getDate() + index)
    return day
  })
  const monday = new Date(date)
  monday.setDate(date.getDate() - mondayIndex(date))
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return day
  })
  const visibleDays = view === 'Day' ? [date] : weekDays
  const label = view === 'Day'
    ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(date)
    : view === 'Month'
      ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
      : `${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(weekDays[0])} – ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(weekDays[6])}`
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return <>
    <div className="view-switch" aria-label="Calendar view">
      {['Day', 'Week', 'Month'].map((item) => <button type="button" key={item} className={view === item ? 'active' : ''} aria-pressed={view === item} onClick={() => onView(item)}>{item}</button>)}
      <span>{label}</span>
      <button type="button" aria-label={`Previous ${view.toLowerCase()}`} onClick={() => onMove(-1)}>‹</button>
      <button type="button" aria-label={`Next ${view.toLowerCase()}`} onClick={() => onMove(1)}>›</button>
    </div>
    {view === 'Month' ? <div className="panel month-panel">
      <div className="month-grid">
        {weekdayLabels.map((day) => <strong className="month-weekday" key={day}>{day}</strong>)}
        {monthDays.map((day) => {
          const eventCount = subjects.filter((item) => item.day === mondayIndex(day)).length
          return <button type="button" key={day.toISOString()} className={`month-day${day.getMonth() !== date.getMonth() ? ' outside-month' : ''}${sameDay(day, new Date()) ? ' today' : ''}`} onClick={() => onDateSelect(day)} aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(day)}, ${eventCount} scheduled classes`}>
            <span>{day.getDate()}</span>{eventCount > 0 && <small>{eventCount} {eventCount === 1 ? 'class' : 'classes'}</small>}
          </button>
        })}
      </div>
    </div> : <div className={`panel calendar-panel${view === 'Day' ? ' day-view' : ''}`}>
      <div className="calendar-head" style={{ gridTemplateColumns: `55px repeat(${visibleDays.length}, minmax(90px, 1fr))` }}>
        <span>{timezone}</span>{visibleDays.map((day) => <strong className={sameDay(day, new Date()) ? 'today-column' : ''} key={day.toISOString()}>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)} <b>{day.getDate()}</b></strong>)}
      </div>
      <div className="calendar-body">
        {timeSlots.map((hour, index) => <div className="calendar-row" key={hour}><small>{hour}</small><div className="calendar-slots" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(90px, 1fr))` }}>
          {visibleDays.map((day) => <div className={`calendar-slot${sameDay(day, new Date()) ? ' today-column' : ''}`} key={day.toISOString()}>
            {subjects.filter((item) => item.day === mondayIndex(day) && item.start === index).map((item) => <div key={item.title} className={`calendar-event ${item.tone}`}><strong>{item.title}</strong><small>{item.at}</small></div>)}
          </div>)}
        </div></div>)}
      </div>
    </div>}
  </>
}
