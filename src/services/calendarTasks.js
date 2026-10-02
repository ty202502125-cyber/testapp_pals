export const localDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const localDateTime = (dateKey, time) => new Date(`${dateKey}T${time || '09:00'}`).toISOString()

export const dateKeyFromDueAt = (dueAt) => dueAt ? localDateKey(new Date(dueAt)) : ''
export const formatDue = (task) => task.dueAt
  ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(task.dueAt))
  : task.due || 'No date set'

export function saveCalendarTask(tasks, editor, draft, scope, id = `task-${Date.now()}`) {
  const dueAt = localDateTime(draft.date, draft.time)
  if (editor.mode === 'create') {
    const recurrence = draft.recurrence ? { ...draft.recurrence, startDate: draft.date } : null
    return [{ id, title: draft.title, description: draft.description, subject: 'Personal', due: '', dueAt, reminderMinutes: draft.reminderMinutes, recurrence, exceptions: [], overrides: [], completedOccurrences: [], done: false, color: 'blue' }, ...tasks]
  }
  const target = editor.task
  if (scope === 'occurrence' && target.recurrence?.frequency) {
    const occurrenceDate = editor.occurrenceDate
    return tasks.map((item) => item.id !== target.id ? item : {
      ...item,
      overrides: [...(item.overrides || []).filter((entry) => entry.date !== occurrenceDate), { date: occurrenceDate, title: draft.title, description: draft.description, dueAt, reminderMinutes: draft.reminderMinutes }],
    })
  }
  const priorStart = target.recurrence?.startDate || dateKeyFromDueAt(target.dueAt)
  const dateChanged = target.occurrenceDate ? draft.date !== target.occurrenceDate : draft.date !== priorStart
  const seriesStart = draft.recurrence && target.recurrence?.frequency && !dateChanged ? priorStart : draft.date
  const seriesDueAt = draft.recurrence ? localDateTime(seriesStart, draft.time) : dueAt
  return tasks.map((item) => item.id !== target.id ? item : {
    ...item,
    title: draft.title,
    description: draft.description,
    dueAt: seriesDueAt,
    reminderMinutes: draft.reminderMinutes,
    recurrence: draft.recurrence ? { ...draft.recurrence, startDate: seriesStart } : null,
    exceptions: draft.recurrence ? item.exceptions || [] : [],
    overrides: draft.recurrence ? item.overrides || [] : [],
  })
}

export function deleteCalendarTask(tasks, target, scope) {
  if (scope === 'series' || !target.recurrence?.frequency) return tasks.filter((item) => item.id !== target.id)
  if (scope === 'future') {
    const previousDay = new Date(`${target.occurrenceDate}T00:00:00`)
    previousDay.setDate(previousDay.getDate() - 1)
    const endDate = localDateKey(previousDay)
    return tasks.flatMap((item) => {
      if (item.id !== target.id) return [item]
      if (endDate < (item.recurrence.startDate || dateKeyFromDueAt(item.dueAt))) return []
      return [{ ...item, recurrence: { ...item.recurrence, endDate }, overrides: (item.overrides || []).filter((entry) => entry.date < target.occurrenceDate) }]
    })
  }
  return tasks.map((item) => item.id !== target.id ? item : {
    ...item,
    exceptions: [...new Set([...(item.exceptions || []), target.occurrenceDate])],
    overrides: (item.overrides || []).filter((entry) => entry.date !== target.occurrenceDate),
    completedOccurrences: (item.completedOccurrences || []).filter((day) => day !== target.occurrenceDate),
  })
}

export function expandTaskOccurrences(tasks, rangeStart, rangeEnd) {
  const from = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
  const through = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate())
  const occurrences = []
  const seen = new Set()

  tasks.forEach((task) => {
    if (!task.dueAt) return
    const startKey = task.recurrence?.startDate || dateKeyFromDueAt(task.dueAt)
    const startDate = new Date(`${startKey}T00:00:00`)
    const endDate = task.recurrence?.endDate ? new Date(`${task.recurrence.endDate}T23:59:59`) : null
    const hasSeries = Boolean(task.recurrence?.frequency && task.recurrence.frequency !== 'none')
    const startTime = new Date(task.dueAt)
    const time = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`
    const excluded = new Set(task.exceptions || [])
    const overrides = new Map((task.overrides || []).map((item) => [item.date, item]))
    const first = from > startDate ? from : startDate
    const last = endDate && endDate < through ? endDate : through

    if (first > last) return
    for (const day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
      const date = localDateKey(day)
      const elapsedDays = Math.round((day - startDate) / 86400000)
      const elapsedWeeks = Math.floor(elapsedDays / 7)
      const frequency = task.recurrence?.frequency
      const weekdayMatches = task.recurrence?.weekdays?.length
        ? task.recurrence.weekdays.includes(day.getDay())
        : day.getDay() === startDate.getDay()
      const occurs = !hasSeries
        ? date === startKey
        : frequency === 'daily'
          ? true
          : frequency === 'weekly'
            ? weekdayMatches && elapsedWeeks % (task.recurrence.interval || 1) === 0
            : frequency === 'monthly'
              ? day.getDate() === startDate.getDate()
              : frequency === 'weekdays'
                ? day.getDay() >= 1 && day.getDay() <= 5
                : date === startKey
      if (!occurs || (excluded.has(date) && !overrides.has(date))) continue
      const override = overrides.get(date)
      const effective = override ? { ...task, ...override } : task
      const dueAt = override?.dueAt || localDateTime(date, time)
      const occurrence = {
        ...effective,
        series: task,
        id: task.id,
        occurrenceDate: date,
        occurrenceId: `${task.id}@${date}`,
        dueAt,
        recurring: hasSeries,
        done: Boolean((task.completedOccurrences || []).includes(date) || (!hasSeries && task.done)),
      }
      occurrences.push(occurrence)
      seen.add(occurrence.occurrenceId)
    }
    if (hasSeries) overrides.forEach((override, occurrenceDate) => {
      const movedDate = override.dueAt ? new Date(override.dueAt) : null
      if (!movedDate || movedDate < from || movedDate > new Date(through.getFullYear(), through.getMonth(), through.getDate(), 23, 59, 59) || seen.has(`${task.id}@${occurrenceDate}`)) return
      occurrences.push({ ...task, ...override, series: task, id: task.id, occurrenceDate, occurrenceId: `${task.id}@${occurrenceDate}`, dueAt: override.dueAt, recurring: true, done: (task.completedOccurrences || []).includes(occurrenceDate) })
      seen.add(`${task.id}@${occurrenceDate}`)
    })
  })
  return occurrences
}
