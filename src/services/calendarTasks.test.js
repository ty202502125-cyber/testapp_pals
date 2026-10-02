import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteCalendarTask, expandTaskOccurrences, localDateTime, saveCalendarTask } from './calendarTasks.js'

const range = (from, to) => [new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`)]
const task = (recurrence, dueAt = localDateTime('2026-10-05', '09:30')) => ({ id: 'one', title: 'Study React', dueAt, reminderMinutes: 10, recurrence })

test('one-off tasks only appear on their selected day', () => {
  const result = expandTaskOccurrences([task(null)], ...range('2026-10-04', '2026-10-06'))
  assert.deepEqual(result.map((item) => item.occurrenceDate), ['2026-10-05'])
})

test('daily recurrence expands through its end date', () => {
  const result = expandTaskOccurrences([task({ frequency: 'daily', startDate: '2026-10-05', endDate: '2026-10-07' })], ...range('2026-10-01', '2026-10-10'))
  assert.deepEqual(result.map((item) => item.occurrenceDate), ['2026-10-05', '2026-10-06', '2026-10-07'])
})

test('weekly recurrence respects selected weekdays without duplicates', () => {
  const result = expandTaskOccurrences([task({ frequency: 'weekly', startDate: '2026-10-05', endDate: '2026-10-20', weekdays: [1] })], ...range('2026-10-01', '2026-10-31'))
  assert.deepEqual(result.map((item) => item.occurrenceDate), ['2026-10-05', '2026-10-12', '2026-10-19'])
})

test('weekly series without an explicit weekday repeats on its start weekday', () => {
  const result = expandTaskOccurrences([task({ frequency: 'weekly', startDate: '2026-10-05', endDate: '2026-10-20' })], ...range('2026-10-01', '2026-10-31'))
  assert.deepEqual(result.map((item) => item.occurrenceDate), ['2026-10-05', '2026-10-12', '2026-10-19'])
})

test('monthly recurrence, deleted dates, and occurrence overrides stay distinct', () => {
  const series = task({ frequency: 'monthly', startDate: '2026-10-05', endDate: '2026-12-31' })
  series.exceptions = ['2026-11-05']
  series.overrides = [{ date: '2026-11-05', title: 'Project review', dueAt: localDateTime('2026-11-06', '11:00'), reminderMinutes: 30 }]
  const result = expandTaskOccurrences([series], ...range('2026-10-01', '2026-12-31'))
  assert.deepEqual(result.map((item) => item.occurrenceDate), ['2026-10-05', '2026-11-05', '2026-12-05'])
  assert.equal(result[1].title, 'Project review')
  assert.equal(result[1].reminderMinutes, 30)
  assert.equal(result[1].occurrenceId, 'one@2026-11-05')
  const moved = expandTaskOccurrences([series], ...range('2026-11-06', '2026-11-06'))
  assert.equal(moved.length, 1)
  assert.equal(moved[0].title, 'Project review')
})

test('completed dates are reflected on individual repeated occurrences', () => {
  const series = task({ frequency: 'daily', startDate: '2026-10-05', endDate: '2026-10-06' })
  series.completedOccurrences = ['2026-10-06']
  const result = expandTaskOccurrences([series], ...range('2026-10-05', '2026-10-06'))
  assert.deepEqual(result.map((item) => item.done), [false, true])
})

test('creating and editing tasks does not produce duplicate records', () => {
  const existing = task({ frequency: 'daily', startDate: '2026-10-05', endDate: '2026-10-07' })
  const edited = saveCalendarTask([existing], { mode: 'edit', task: existing }, { title: 'Updated', description: 'Notes', date: '2026-10-05', time: '10:15', reminderMinutes: 5, recurrence: existing.recurrence }, 'series')
  assert.equal(edited.length, 1)
  assert.equal(edited[0].title, 'Updated')
  assert.equal(new Date(edited[0].dueAt).getHours(), 10)
  const created = saveCalendarTask(edited, { mode: 'create' }, { title: 'New', description: '', date: '2026-10-09', time: '08:00', reminderMinutes: null, recurrence: null }, 'series', 'two')
  assert.equal(created.length, 2)
})

test('editing one occurrence creates a scoped override while preserving the series', () => {
  const existing = task({ frequency: 'daily', startDate: '2026-10-05', endDate: '2026-10-07' })
  const occurrence = expandTaskOccurrences([existing], ...range('2026-10-06', '2026-10-06'))[0]
  const updated = saveCalendarTask([existing], { mode: 'edit', task: occurrence, occurrenceDate: occurrence.occurrenceDate }, { title: 'Exam review', description: 'Chapter 3', date: occurrence.occurrenceDate, time: '11:00', reminderMinutes: 30, recurrence: existing.recurrence }, 'occurrence')
  assert.equal(updated.length, 1)
  assert.equal(updated[0].title, existing.title)
  assert.equal(updated[0].overrides.length, 1)
  const result = expandTaskOccurrences(updated, ...range('2026-10-05', '2026-10-07'))
  assert.deepEqual(result.map((item) => item.title), ['Study React', 'Exam review', 'Study React'])
})

test('deleting one occurrence, future occurrences, or a series affects only the selected scope', () => {
  const series = task({ frequency: 'daily', startDate: '2026-10-05', endDate: '2026-10-08' })
  const other = { ...series, id: 'other', title: 'Other' }
  const occurrence = { ...series, occurrenceDate: '2026-10-06' }
  const one = deleteCalendarTask([series, other], occurrence, 'occurrence')
  assert.deepEqual(expandTaskOccurrences(one, ...range('2026-10-05', '2026-10-08')).filter((item) => item.id === 'one').map((item) => item.occurrenceDate), ['2026-10-05', '2026-10-07', '2026-10-08'])
  assert.equal(one.length, 2)
  const future = deleteCalendarTask([series, other], occurrence, 'future')
  assert.equal(future.length, 2)
  assert.equal(future[0].recurrence.endDate, '2026-10-05')
  const entire = deleteCalendarTask([series, other], occurrence, 'series')
  assert.deepEqual(entire.map((item) => item.id), ['other'])
})
