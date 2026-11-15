import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './pwa.css'
import './responsive.css'
import AITutor from './components/AITutor.jsx'
import AccountDialog from './components/AccountDialog.jsx'
import ScheduleCalendar from './components/ScheduleCalendar.jsx'
import TaskEditor from './components/TaskEditor.jsx'
import TaskDeleteDialog from './components/TaskDeleteDialog.jsx'
import TaskList from './components/TaskList.jsx'
import { expandTaskOccurrences, localDateKey, saveCalendarTask, deleteCalendarTask } from './services/calendarTasks.js'
import { connectGoogle, preloadGoogleIdentity, revokeGoogleToken, saveGoogleData } from './services/googleDrive.js'

const nav = [
  ['Overview', '⌂'],
  ['My schedule', '▦'],
  ['My tasks', '☷'],
  ['Study materials', '▧'],
  ['Flashcards', '▤'],
  ['Study room', '◷'],
  ['Grade tracker', '◉'],
]

const TIMER_PRESETS = [
  { id: 'pomodoro', label: '25m Pomodoro', focus: 25 * 60, rest: 5 * 60 },
  { id: 'deep', label: '50m Deep Work', focus: 50 * 60, rest: 10 * 60 },
  { id: 'sprint', label: '15m Sprint', focus: 15 * 60, rest: 3 * 60 },
]

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

const wipeExistingStudyData = () => {
  const marker = 'check-blank-workspace-v1'
  if (localStorage.getItem(marker)) return
  for (const key of [
    'check-tasks',
    'check-cards',
    'check-note',
    'check-dark',
    'check-reminders-enabled',
    'check-reminder-sound',
    'check-reminder-deliveries',
  ]) {
    localStorage.removeItem(key)
  }
  localStorage.setItem(marker, '1')
}
wipeExistingStudyData()

const today = new Date()
const todayKey = localDateKey(today)
const todayLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(today)
const todayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(today)

const formatDue = (task) => {
  if (!task.dueAt) return task.due || 'Anytime'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(task.dueAt))
}

const formatTimeOnly = (iso) => {
  if (!iso) return ''
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

const cardIsDue = (card) => card.due === true || Boolean(card.dueAt && new Date(card.dueAt).getTime() <= Date.now())

const playSoftChime = (freq = 660, duration = 0.35) => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, ctx.currentTime + duration)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    osc.onended = () => ctx.close()
  } catch {
    /* Audio blocked until user gesture */
  }
}

const getInitialFocusStats = () => {
  const saved = read('check-focus-stats', {
    dateKey: todayKey,
    secondsToday: 0,
    sessionsToday: 0,
    streakDays: 0,
    lastActiveDate: '',
  })
  if (saved.dateKey !== todayKey) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = localDateKey(yesterday)
    const keptStreak = saved.lastActiveDate === yesterdayKey ? saved.streakDays : 0
    return {
      dateKey: todayKey,
      secondsToday: 0,
      sessionsToday: 0,
      streakDays: keptStreak,
      lastActiveDate: saved.lastActiveDate,
    }
  }
  return saved
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function App() {
  const [page, setPage] = useState('Overview')
  const [tasks, setTasks] = useState(() => read('check-tasks', []))
  const [cards, setCards] = useState(() => read('check-cards', []))
  const [gradeItems, setGradeItems] = useState(() => read('check-grades', []))
  const [focusStats, setFocusStats] = useState(getInitialFocusStats)
  const [note, setNote] = useState(() => localStorage.getItem('check-note') || '')
  const [taskEditor, setTaskEditor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [alarmTitle, setAlarmTitle] = useState('Time to check in with yourself.')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installHint, setInstallHint] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const [presetId, setPresetId] = useState('pomodoro')
  const activePreset = useMemo(() => TIMER_PRESETS.find((p) => p.id === presetId) || TIMER_PRESETS[0], [presetId])
  const [seconds, setSeconds] = useState(activePreset.focus)
  const [timerMode, setTimerMode] = useState('focus')
  const [timerOn, setTimerOn] = useState(false)

  const [dark, setDark] = useState(() => read('check-dark', false))
  const [accountDialog, setAccountDialog] = useState(false)
  const [googleAccount, setGoogleAccount] = useState(null)
  const [googleToken, setGoogleToken] = useState('')
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudStatus, setCloudStatus] = useState('local')
  const cloudFileId = useRef(null)
  const [alarm, setAlarm] = useState(false)
  const [toast, setToast] = useState('')
  const [remindersEnabled, setRemindersEnabled] = useState(() => read('check-reminders-enabled', true))
  const [notificationPermission, setNotificationPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const [reminderSoundEnabled, setReminderSoundEnabled] = useState(() => read('check-reminder-sound', true))

  useEffect(() => { localStorage.setItem('check-tasks', JSON.stringify(tasks)) }, [tasks])
  useEffect(() => { localStorage.setItem('check-cards', JSON.stringify(cards)) }, [cards])
  useEffect(() => { localStorage.setItem('check-grades', JSON.stringify(gradeItems)) }, [gradeItems])
  useEffect(() => { localStorage.setItem('check-focus-stats', JSON.stringify(focusStats)) }, [focusStats])
  useEffect(() => { localStorage.setItem('check-note', note) }, [note])
  useEffect(() => { localStorage.setItem('check-dark', JSON.stringify(dark)) }, [dark])
  useEffect(() => { localStorage.setItem('check-reminders-enabled', JSON.stringify(remindersEnabled)) }, [remindersEnabled])
  useEffect(() => { localStorage.setItem('check-reminder-sound', JSON.stringify(reminderSoundEnabled)) }, [reminderSoundEnabled])

  useEffect(() => {
    const refreshPermission = () =>
      setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported')
    document.addEventListener('visibilitychange', refreshPermission)
    return () => document.removeEventListener('visibilitychange', refreshPermission)
  }, [])

  useEffect(() => {
    if (googleClientId) preloadGoogleIdentity().catch(() => {})
  }, [])

  useEffect(() => {
    if (!googleToken || !cloudReady) return undefined
    const timer = window.setTimeout(() => {
      setCloudStatus('syncing')
      saveGoogleData(googleToken, cloudFileId.current, {
        tasks,
        cards,
        gradeItems,
        focusStats,
        note,
        dark,
        updatedAt: new Date().toISOString(),
      })
        .then((id) => {
          cloudFileId.current = id
          setCloudStatus('synced')
        })
        .catch(() => setCloudStatus('error'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [googleToken, cloudReady, tasks, cards, gradeItems, focusStats, note, dark])

  useEffect(() => {
    if (!remindersEnabled || notificationPermission !== 'granted') return undefined
    const checkReminders = () => {
      const now = Date.now()
      const from = new Date(now - 24 * 60 * 60 * 1000)
      const to = new Date(now + 32 * 24 * 60 * 60 * 1000)
      const due = expandTaskOccurrences(
        tasks.filter((task) => task.reminderMinutes != null),
        from,
        to
      )
        .filter((item) => !item.done && Number.isFinite(item.reminderMinutes))
        .map((item) => ({ ...item, reminderAt: new Date(item.dueAt).getTime() - item.reminderMinutes * 60000 }))
        .filter((item) => item.reminderAt <= now && item.reminderAt > now - 24 * 60 * 60 * 1000)
      const delivered = new Set(read('check-reminder-deliveries', []))
      const fresh = due.filter((item) => !delivered.has(`${item.occurrenceId}@${item.dueAt}#${item.reminderMinutes}`))
      if (!fresh.length) return
      fresh.forEach((item) => {
        const dueLabel = new Intl.DateTimeFormat(undefined, {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date(item.dueAt))
        const title = 'Task reminder'
        const options = {
          body: `${item.title}\nDue ${dueLabel}`,
          icon: '/icons/check.svg',
          tag: `task-${item.occurrenceId}`,
          data: { url: '/' },
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then((registration) => registration.showNotification(title, options))
            .catch(() => {})
        } else {
          try {
            new Notification(title, options)
          } catch {
            /* Notifications may be unavailable */
          }
        }
      })
      fresh.forEach((item) => delivered.add(`${item.occurrenceId}@${item.dueAt}#${item.reminderMinutes}`))
      localStorage.setItem('check-reminder-deliveries', JSON.stringify([...delivered].slice(-500)))
      setAlarmTitle(fresh[0].title)
      setAlarm(true)
    }
    checkReminders()
    const interval = window.setInterval(checkReminders, 15000)
    return () => window.clearInterval(interval)
  }, [tasks, remindersEnabled, notificationPermission])

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Countdown + real focus time accumulator
  useEffect(() => {
    if (!timerOn) return undefined
    const id = window.setInterval(() => {
      if (timerMode === 'focus') {
        setFocusStats((prev) => {
          const currentKey = localDateKey(new Date())
          const baseSeconds = prev.dateKey === currentKey ? prev.secondsToday : 0
          const baseSessions = prev.dateKey === currentKey ? prev.sessionsToday : 0
          const nextStreak = prev.lastActiveDate === currentKey ? Math.max(1, prev.streakDays) : prev.streakDays + 1
          return {
            dateKey: currentKey,
            secondsToday: baseSeconds + 1,
            sessionsToday: baseSessions,
            streakDays: nextStreak,
            lastActiveDate: currentKey,
          }
        })
      }

      setSeconds((value) => {
        if (value <= 1) {
          setTimerOn(false)
          playSoftChime(587.33, 0.45)
          if (timerMode === 'focus') {
            setFocusStats((prev) => ({
              ...prev,
              sessionsToday: (prev.dateKey === localDateKey(new Date()) ? prev.sessionsToday : 0) + 1,
            }))
            setTimerMode('break')
            setToast(`Focus complete — ${Math.round(activePreset.rest / 60)}-minute break ready.`)
            return activePreset.rest
          }
          setTimerMode('focus')
          setToast('Break over — ready for another focus block?')
          return activePreset.focus
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerOn, timerMode, activePreset])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!alarm || !reminderSoundEnabled) return undefined
    const id = window.setInterval(() => playSoftChime(740, 0.25), 950)
    return () => clearInterval(id)
  }, [alarm, reminderSoundEnabled])

  // Keyboard shortcuts for quick task creation & flashcard review
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable
      if (reviewing) {
        if (e.code === 'Space' && !isTyping) {
          e.preventDefault()
          setRevealed((v) => !v)
        } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault()
          rateCard(Number(e.key))
        } else if (e.key === 'Escape') {
          setReviewing(false)
        }
        return
      }
      if (!isTyping && !taskEditor && !accountDialog && e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        openTaskEditor()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const completed = tasks.filter((task) => task.done).length
  const activeTasks = tasks.filter((task) => !task.done)
  const dueCards = useMemo(() => cards.filter(cardIsDue), [cards])
  const currentCard = dueCards[0]

  const upcomingSchedule = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    return expandTaskOccurrences(tasks, start, end)
      .filter((item) => !item.done && item.dueAt)
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
      .slice(0, 3)
  }, [tasks])

  const totalDuration = timerMode === 'focus' ? activePreset.focus : activePreset.rest
  const progressDeg = Math.max(0, Math.min(360, (seconds / totalDuration) * 360))
  const timeLabel = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const focusMinutesToday = Math.floor((focusStats.dateKey === todayKey ? focusStats.secondsToday : 0) / 60)

  const selectPreset = (id) => {
    const next = TIMER_PRESETS.find((p) => p.id === id) || TIMER_PRESETS[0]
    setPresetId(next.id)
    setTimerOn(false)
    setTimerMode('focus')
    setSeconds(next.focus)
  }

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      setInstallPrompt(null)
    } else {
      setInstallHint(true)
    }
  }

  const signInWithGoogle = async () => {
    setCloudStatus('connecting')
    try {
      const connection = await connectGoogle(googleClientId)
      setGoogleToken(connection.token)
      setGoogleAccount({ email: connection.user.email, name: connection.user.name, picture: connection.user.picture })
      cloudFileId.current = connection.fileId
      setCloudReady(true)
      setCloudStatus('syncing')
      setToast('Google connected. Your workspace will sync automatically.')
    } catch (error) {
      setCloudStatus('local')
      setToast(error.message || 'Google sign-in did not complete.')
    }
  }

  const signOutGoogle = async () => {
    try {
      await revokeGoogleToken(googleToken)
    } catch {
      /* Clear local session even if offline */
    }
    setGoogleToken('')
    setGoogleAccount(null)
    setCloudReady(false)
    setCloudStatus('local')
    cloudFileId.current = null
    setAccountDialog(false)
    setToast('Signed out. Your data remains saved on this device.')
  }

  const openTaskEditor = (initialDate = localDateKey(new Date())) => setTaskEditor({ mode: 'create', initialDate })
  const setShowAdd = (value) => {
    if (value) openTaskEditor()
    else setTaskEditor(null)
  }
  const editTask = (task) => setTaskEditor({ mode: 'edit', task, occurrenceDate: task.occurrenceDate })

  const toggleTaskOccurrence = (occurrence) =>
    setTasks((items) =>
      items.map((item) => {
        if (item.id !== occurrence.id) return item
        if (!item.recurrence?.frequency || item.recurrence.frequency === 'none') return { ...item, done: !item.done }
        const completedSet = new Set(item.completedOccurrences || [])
        if (completedSet.has(occurrence.occurrenceDate)) completedSet.delete(occurrence.occurrenceDate)
        else completedSet.add(occurrence.occurrenceDate)
        return { ...item, completedOccurrences: [...completedSet] }
      })
    )

  const saveTask = (draft, scope) => {
    if (taskEditor.mode === 'create') {
      setTasks((items) => saveCalendarTask(items, taskEditor, draft, scope))
      setToast('Task added to your workspace.')
    } else if (scope === 'occurrence' && taskEditor.task.recurrence?.frequency) {
      setTasks((items) => saveCalendarTask(items, taskEditor, draft, scope))
      setToast('This occurrence was updated.')
    } else {
      setTasks((items) => saveCalendarTask(items, taskEditor, draft, scope))
      setToast('Task changes saved.')
    }
    setTaskEditor(null)
  }

  const deleteTask = (scope) => {
    const target = deleteTarget
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(async (registration) => {
          const notifications = await registration.getNotifications()
          notifications.forEach((notification) => {
            const prefix = `task-${target.id}@`
            if (!notification.tag?.startsWith(prefix)) return
            const occurrenceDate = notification.tag.slice(prefix.length)
            if (
              scope === 'series' ||
              (scope === 'future' && occurrenceDate >= target.occurrenceDate) ||
              occurrenceDate === target.occurrenceDate
            ) {
              notification.close()
            }
          })
        })
        .catch(() => {})
    }
    setTasks((items) => deleteCalendarTask(items, target, scope))
    setDeleteTarget(null)
    setToast(scope === 'occurrence' ? 'Occurrence removed.' : 'Task removed.')
  }

  const changeNotificationSetting = async () => {
    if (notificationPermission === 'unsupported') {
      setToast('This browser does not support notifications.')
      return
    }
    if (notificationPermission === 'denied') {
      const permission = Notification.permission
      setNotificationPermission(permission)
      if (permission === 'granted') {
        setRemindersEnabled(true)
        setToast('Task reminders are on.')
      } else {
        setToast('Notifications are blocked by your browser. Enable them in site settings.')
      }
      return
    }
    if (notificationPermission === 'default') {
      const permission = await Notification.requestPermission().catch(() => 'denied')
      setNotificationPermission(permission)
      setRemindersEnabled(permission === 'granted')
      setToast(permission === 'granted' ? 'Task reminders are on.' : 'Notifications were not enabled.')
      return
    }
    setRemindersEnabled((enabled) => !enabled)
    setToast(remindersEnabled ? 'Task reminders are paused.' : 'Task reminders are on.')
  }

  const rateCard = (rating) => {
    if (!currentCard) return
    const days = rating <= 1 ? 1 : rating === 2 ? 2 : rating === 3 ? 3 : 6
    const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    setCards((items) =>
      items.map((card) =>
        card.id === currentCard.id
          ? { ...card, due: false, dueAt, nextReview: days === 1 ? 'tomorrow' : `in ${days} days` }
          : card
      )
    )
    setRevealed(false)
    if (!cards.some((card) => cardIsDue(card) && card.id !== currentCard.id)) {
      setReviewing(false)
      setToast('Review complete — nice work!')
    }
  }

  return (
    <div className={`app-shell${dark ? ' dark' : ''}`}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#home"
          onClick={(e) => {
            e.preventDefault()
            setPage('Overview')
          }}
        >
          <span className="brand-mark">
            c<span>.</span>
          </span>
          <span className="brand-name">check</span>
        </a>

        <div className="workspace">
          <div className="avatar">✓</div>
          <div>
            <strong>My workspace</strong>
            <small>
              {focusStats.streakDays > 0
                ? `${focusStats.streakDays}-day study streak`
                : 'Ready when you are'}
            </small>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map(([label, icon]) => (
            <button
              key={label}
              title={label}
              aria-label={label}
              className={`nav-item${page === label ? ' selected' : ''}`}
              onClick={() => setPage(label)}
            >
              <span className="nav-icon" aria-hidden="true">
                {icon}
              </span>
              {label}
              {label === 'My tasks' && activeTasks.length > 0 && (
                <span className="nav-count">{activeTasks.length}</span>
              )}
              {label === 'Flashcards' && dueCards.length > 0 && (
                <span className="nav-count">{dueCards.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-top">
              <span>⚡</span>
              <span className="streak-days">{focusStats.streakDays} day streak</span>
              <span className="streak-mins">{focusMinutesToday}m</span>
            </div>
            <strong>Today’s focus progress</strong>
            <small>
              {focusMinutesToday >= 50
                ? 'Daily 50m goal crushed!'
                : `${Math.max(0, 50 - focusMinutesToday)}m left to reach 50m goal`}
            </small>
            <div className="streak-bars" aria-hidden="true">
              {[10, 20, 30, 40, 50].map((step) => (
                <i key={step} className={focusMinutesToday >= step ? 'active' : ''} />
              ))}
            </div>
          </div>

          <button
            type="button"
            className="nav-item theme-toggle"
            aria-pressed={dark}
            onClick={() => setDark((value) => !value)}
          >
            <span className="nav-icon" aria-hidden="true">
              {dark ? (
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
                </svg>
              )}
            </span>
            <span className="theme-label">{dark ? 'Light appearance' : 'Dark appearance'}</span>
          </button>

          <button className="nav-item install-side" onClick={install}>
            <span className="nav-icon">↓</span>
            <span className="install-label">Install the app</span>
            <span className="install-arrow">↗</span>
          </button>

          <div className="sidebar-foot">
            <span>◌</span> Press <kbd className="kbd-hint">N</kbd> to quick-add a task
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            My workspace <span>/</span> <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="quick-add-pill"
              title="Quick add task (Shortcut: N)"
              onClick={() => setShowAdd(true)}
            >
              <span>＋</span> Quick task
            </button>
            <div className="today-pill" role="status">
              ◷ <span>{todayShort}</span>
            </div>
            <button
              type="button"
              className="avatar small-avatar"
              aria-label="Google account and sync settings"
              title={googleAccount ? `Synced: ${googleAccount.email}` : 'Account and cloud sync'}
              onClick={() => setAccountDialog(true)}
            >
              {googleAccount?.name?.[0]?.toUpperCase() || '✓'}
            </button>
          </div>
        </header>

        <div className="page-content" key={page}>
          {page === 'Overview' ? (
            <>
              <div className="greeting-row anim-rise">
                <div>
                  <div className="eyebrow">
                    {todayLong.toUpperCase()} <span className="sun">☼</span>
                  </div>
                  <h1>
                    Your fresh start <span className="wave">✳</span>
                  </h1>
                  <p className="subheading">Your workspace is ready for what matters to you.</p>
                </div>
                <button className="primary-button" onClick={() => setShowAdd(true)}>
                  <span>＋</span> Add a task
                </button>
              </div>

              <div className="summary-grid">
                <div className="summary-card anim-rise" style={{ '--stagger': 1 }}>
                  <div className="summary-head">
                    Things to do <span className="summary-symbol purple">☷</span>
                  </div>
                  <div className="summary-value">
                    {activeTasks.length}
                    <span> {activeTasks.length === 1 ? 'task' : 'tasks'}</span>
                  </div>
                  <div className="summary-foot">
                    {completed} completed{' '}
                    <span className="tiny-progress">
                      <i style={{ width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%` }} />
                    </span>
                  </div>
                </div>

                <div className="summary-card anim-rise" style={{ '--stagger': 2 }}>
                  <div className="summary-head">
                    Focus time <span className="summary-symbol yellow">◷</span>
                  </div>
                  <div className="summary-value">
                    {focusMinutesToday}
                    <span> min today</span>
                  </div>
                  <div className="summary-foot">
                    {focusStats.sessionsToday} completed {focusStats.sessionsToday === 1 ? 'session' : 'sessions'}
                  </div>
                </div>

                <div className="summary-card anim-rise" style={{ '--stagger': 3 }}>
                  <div className="summary-head">
                    Cards to review <span className="summary-symbol mint">▤</span>
                  </div>
                  <div className="summary-value">
                    {dueCards.length}
                    <span> {dueCards.length === 1 ? 'card' : 'cards'}</span>
                  </div>
                  <button
                    className="inline-link"
                    onClick={() => {
                      if (cards.length === 0) setPage('Flashcards')
                      else {
                        setReviewing(true)
                        setRevealed(false)
                      }
                    }}
                  >
                    {cards.length === 0 ? 'Create your first deck' : 'Start a quick review'} <span>→</span>
                  </button>
                </div>
              </div>

              <div className="content-grid">
                <section className="panel tasks-panel anim-rise" style={{ '--stagger': 4 }}>
                  <div className="panel-heading">
                    <div>
                      <h2>
                        Today’s tasks <span className="heading-count">{activeTasks.length}</span>
                      </h2>
                      <p>A small step is still a step forward.</p>
                    </div>
                    <button className="more-button" onClick={() => setPage('My tasks')}>
                      See all <span>→</span>
                    </button>
                  </div>

                  <div className="task-list">
                    {tasks.slice(0, 4).map((task) => (
                      <div className={`task-row${task.done ? ' task-done' : ''}`} key={task.id}>
                        <button
                          className={`check-circle ${task.done ? 'checked' : ''}`}
                          aria-label={task.done ? 'Mark incomplete' : 'Complete task'}
                          onClick={() =>
                            setTasks((items) =>
                              items.map((item) => (item.id === task.id ? { ...item, done: !item.done } : item))
                            )
                          }
                        >
                          {task.done && '✓'}
                        </button>
                        <div className="task-copy">
                          <strong>{task.title}</strong>
                          <div className="task-meta">
                            <span className={`subject-dot ${task.color}`} />
                            {task.subject}
                            <span className="meta-dot">·</span>
                            {formatDue(task)}
                          </div>
                        </div>
                        <button className="task-more" aria-label="Delete task" onClick={() => setDeleteTarget(task)}>
                          ···
                        </button>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <p className="empty-text">Nothing here yet. Add a task when you’re ready.</p>
                    )}
                  </div>

                  <button className="add-row" onClick={() => setShowAdd(true)}>
                    ＋ <span>Add another task</span>
                  </button>
                </section>

                <section className="panel schedule-panel anim-rise" style={{ '--stagger': 5 }}>
                  <div className="panel-heading">
                    <div>
                      <h2>Coming up</h2>
                      <p>Your next 7 days at a glance.</p>
                    </div>
                    <button
                      className="calendar-button"
                      title="Open full schedule"
                      onClick={() => setPage('My schedule')}
                    >
                      ▦
                    </button>
                  </div>

                  <div className="schedule-date">
                    <span className="date-badge">
                      {new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(today).toUpperCase()}
                      <b>{today.getDate()}</b>
                    </span>
                    <div>
                      <strong>{upcomingSchedule.length ? `${upcomingSchedule.length} upcoming` : 'Today'}</strong>
                      <small>
                        {upcomingSchedule.length
                          ? 'Scheduled tasks on your calendar'
                          : 'Nothing scheduled yet'}
                      </small>
                    </div>
                  </div>

                  {upcomingSchedule.length > 0 ? (
                    <div className="schedule-events">
                      <div className="timeline" aria-hidden="true">
                        {upcomingSchedule.map((item) => (
                          <span key={item.occurrenceId} />
                        ))}
                      </div>
                      <div className="event-list">
                        {upcomingSchedule.map((item) => (
                          <div className="event" key={item.occurrenceId}>
                            <small>
                              {item.occurrenceDate === todayKey ? 'Today' : item.occurrenceDate.slice(5)}{' '}
                              <i>· {formatTimeOnly(item.dueAt)}</i>
                            </small>
                            <strong>{item.title}</strong>
                            <span
                              className={`event-tag ${
                                item.color === 'peach'
                                  ? 'orange-tag'
                                  : item.color === 'lilac'
                                  ? 'purple-tag'
                                  : 'green-tag'
                              }`}
                            >
                              {item.subject || 'Study'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-text">Your calendar is clear.</div>
                  )}

                  <button className="schedule-link" onClick={() => setPage('My schedule')}>
                    Open calendar <span>→</span>
                  </button>
                </section>
              </div>

              <section className="lower-grid">
                <div className="panel focus-panel anim-rise" style={{ '--stagger': 6 }}>
                  <div className="focus-info">
                    <div className="focus-eyebrow">
                      <span>✳</span> {timerMode === 'focus' ? 'FOCUS SESSION' : 'SHORT BREAK'}
                    </div>
                    <h2>
                      A little focus
                      <br />
                      goes a long way.
                    </h2>
                    <p>
                      Put distractions aside and be
                      <br />
                      present with your work.
                    </p>
                    <button className="focus-button" onClick={() => setTimerOn((value) => !value)}>
                      {timerOn
                        ? 'Ⅱ Pause session'
                        : timerMode === 'focus'
                        ? '▶ Start focusing'
                        : '▶ Start break'}
                    </button>
                  </div>

                  <div className="timer-wrap">
                    <div
                      className={`timer-ring${timerOn ? ' running' : ''}`}
                      style={{ '--progress': `${progressDeg}deg` }}
                    >
                      <div className="timer-inner">
                        <span>{timeLabel}</span>
                        <small>
                          {timerOn
                            ? timerMode === 'focus'
                              ? 'FOCUS ON'
                              : 'ON A BREAK'
                            : timerMode === 'focus'
                            ? 'READY TO FOCUS'
                            : 'BREAK READY'}
                        </small>
                      </div>
                    </div>
                    <div className="timer-caption">
                      ✦ &nbsp; {Math.round(activePreset.focus / 60)} min focus <span>·</span>{' '}
                      {Math.round(activePreset.rest / 60)} min break
                    </div>
                  </div>
                  <span className="focus-decor">✳</span>
                </div>

                <div className="panel note-panel anim-rise" style={{ '--stagger': 7 }}>
                  <div className="note-heading">
                    <div className="note-icon">✎</div>
                    <div>
                      <h2>Daily note</h2>
                      <p>Get it out of your head.</p>
                    </div>
                    <span className="note-date">TODAY</span>
                  </div>
                  <textarea
                    aria-label="Daily note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="What’s on your mind today? Write a thought, make a plan, or just start..."
                  />
                  <div className="note-footer">
                    <span>
                      <span className="save-dot" /> Saved automatically
                    </span>
                    <button
                      onClick={() => {
                        setNote('')
                        setToast('Daily note cleared.')
                      }}
                    >
                      Clear note
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <SectionPage
              page={page}
              tasks={tasks}
              setTasks={setTasks}
              cards={cards}
              setCards={setCards}
              gradeItems={gradeItems}
              setGradeItems={setGradeItems}
              setPage={setPage}
              setReviewing={setReviewing}
              setRevealed={setRevealed}
              setShowAdd={setShowAdd}
              setTaskEditor={setTaskEditor}
              setDeleteTarget={setDeleteTarget}
              onEditTask={editTask}
              onToggleTask={toggleTaskOccurrence}
              presetId={presetId}
              selectPreset={selectPreset}
              activePreset={activePreset}
              progressDeg={progressDeg}
              setSeconds={setSeconds}
              timerMode={timerMode}
              setTimerMode={setTimerMode}
              timerOn={timerOn}
              setTimerOn={setTimerOn}
              timeLabel={timeLabel}
              note={note}
              setNote={setNote}
              setToast={setToast}
              remindersEnabled={remindersEnabled}
              reminderSoundEnabled={reminderSoundEnabled}
              onReminderSoundSetting={() => setReminderSoundEnabled((enabled) => !enabled)}
              notificationPermission={notificationPermission}
              onNotificationSetting={changeNotificationSetting}
            />
          )}
          <footer className="page-footer">
            Made with care, for everything you’re becoming. <span>✳</span>
          </footer>
        </div>
      </main>

      {taskEditor && (
        <TaskEditor
          key={`${taskEditor.mode}-${taskEditor.task?.id || 'new'}-${taskEditor.occurrenceDate || ''}`}
          initial={taskEditor}
          onClose={() => setTaskEditor(null)}
          onSave={saveTask}
        />
      )}

      {deleteTarget && (
        <TaskDeleteDialog recurring={deleteTarget} onClose={() => setDeleteTarget(null)} onDelete={deleteTask} />
      )}

      {installHint && (
        <div className="modal-backdrop" onClick={() => setInstallHint(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button
              className="modal-close"
              aria-label="Close install instructions"
              onClick={() => setInstallHint(false)}
            >
              ×
            </button>
            <span className="modal-icon">↓</span>
            <h2>Take Check with you</h2>
            <p>
              Install this site for quick access from your home screen. In your browser menu, choose{' '}
              <strong>“Add to Home Screen”</strong> or <strong>“Install app.”</strong>
            </p>
            <button className="primary-button modal-submit" onClick={() => setInstallHint(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {accountDialog && (
        <AccountDialog
          account={googleAccount}
          status={cloudStatus}
          configured={Boolean(googleClientId)}
          onConnect={signInWithGoogle}
          onDisconnect={signOutGoogle}
          onClose={() => setAccountDialog(false)}
        />
      )}

      {reviewing && (
        <div className="modal-backdrop" onClick={() => setReviewing(false)}>
          <div className="modal review-modal" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              aria-label="Close flashcard review"
              onClick={() => setReviewing(false)}
            >
              ×
            </button>
            <span className="review-count">QUICK REVIEW · {dueCards.length} LEFT</span>

            {currentCard ? (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  className="flashcard-stage"
                  aria-label="Flip flashcard"
                  onClick={() => setRevealed((value) => !value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setRevealed((v) => !v)
                  }}
                >
                  <div className={`flashcard-inner${revealed ? ' flipped' : ''}`}>
                    <div className="flashcard-face front">
                      <span>{currentCard.subject || 'YOUR QUESTION'}</span>
                      <strong>{currentCard.front}</strong>
                      <small>Click or press Space to reveal answer</small>
                    </div>
                    <div className="flashcard-face back">
                      <span>THE ANSWER</span>
                      <strong>{currentCard.back}</strong>
                      <small>Rate recall below (Keys 1–4)</small>
                    </div>
                  </div>
                </div>

                {revealed && (
                  <div className="rating-row">
                    {['Again', 'Hard', 'Good', 'Easy'].map((rating, i) => (
                      <button type="button" key={rating} onClick={() => rateCard(i + 1)}>
                        {rating}
                        <small>{['1d', '2d', '3d', '6d'][i]}</small>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-review">
                <span>✦</span>
                <h2>All caught up!</h2>
                <p>Every due flashcard has been reviewed.</p>
                <button type="button" className="primary-button modal-submit" onClick={() => setReviewing(false)}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {alarm && (
        <div className="alarm-toast">
          <span>◉</span>
          <div>
            <strong>Reminder</strong>
            <small>{alarmTitle}</small>
          </div>
          <button
            onClick={() => {
              setAlarm(false)
              setTimeout(() => {
                setAlarmTitle('Snoozed reminder')
                setAlarm(true)
              }, 5 * 60 * 1000)
            }}
          >
            Snooze 5m
          </button>
          <button aria-label="Dismiss reminder" onClick={() => setAlarm(false)}>
            ×
          </button>
        </div>
      )}

      {toast && <div className="toast">✦ &nbsp;{toast}</div>}
    </div>
  )
}

function SectionPage({
  page,
  tasks,
  setTasks,
  cards,
  setCards,
  gradeItems,
  setGradeItems,
  setPage,
  setReviewing,
  setRevealed,
  setShowAdd,
  setTaskEditor,
  setDeleteTarget,
  onEditTask,
  onToggleTask,
  presetId,
  selectPreset,
  activePreset,
  progressDeg,
  setSeconds,
  timerMode,
  setTimerMode,
  timerOn,
  setTimerOn,
  timeLabel,
  note,
  setNote,
  setToast,
  remindersEnabled,
  reminderSoundEnabled,
  onReminderSoundSetting,
  notificationPermission,
  onNotificationSetting,
}) {
  const [view, setView] = useState(() => (window.matchMedia?.('(max-width: 620px)').matches ? 'Day' : 'Week'))
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [soundName, setSoundName] = useState('')
  const audioRef = useRef(null)
  const soundRef = useRef(null)

  // Flashcard creator state
  const [cardFront, setCardFront] = useState('')
  const [cardBack, setCardBack] = useState('')
  const [cardSubject, setCardSubject] = useState('')

  // Grade tracker state
  const [itemTitle, setItemTitle] = useState('')
  const [itemScore, setItemScore] = useState('')
  const [itemWeight, setItemWeight] = useState('')
  const [targetGrade, setTargetGrade] = useState('90')

  // PDF study material state
  const [file, setFile] = useState(null)
  const [pdfUrl, setPdfUrl] = useState('')
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  const dueCards = cards.filter(cardIsDue)

  const addFlashcard = (e) => {
    e.preventDefault()
    if (!cardFront.trim() || !cardBack.trim()) return
    const nextCard = {
      id: `card-${Date.now()}`,
      front: cardFront.trim(),
      back: cardBack.trim(),
      subject: cardSubject.trim() || 'General',
      due: true,
      nextReview: 'now',
    }
    setCards((prev) => [nextCard, ...prev])
    setCardFront('')
    setCardBack('')
    setToast('Flashcard added to your study queue.')
  }

  const addGradeItem = (e) => {
    e.preventDefault()
    const score = Number(itemScore)
    const weight = Number(itemWeight)
    if (!Number.isFinite(score) || !Number.isFinite(weight) || weight <= 0) return
    setGradeItems((prev) => [
      ...prev,
      {
        id: `grade-${Date.now()}`,
        title: itemTitle.trim() || `Assessment ${prev.length + 1}`,
        score,
        weight,
      },
    ])
    setItemTitle('')
    setItemScore('')
    setItemWeight('')
    setToast('Assessment added.')
  }

  const gradeStats = useMemo(() => {
    const totalWeight = gradeItems.reduce((sum, item) => sum + item.weight, 0)
    const earnedWeighted = gradeItems.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0)
    const currentAvg = totalWeight > 0 ? (earnedWeighted / totalWeight) * 100 : null
    const remainingWeight = Math.max(0, 100 - totalWeight)
    const target = Number(targetGrade)
    const neededOnRemaining =
      remainingWeight > 0 && Number.isFinite(target)
        ? ((target - earnedWeighted) / remainingWeight) * 100
        : null
    const letter =
      currentAvg == null
        ? '—'
        : currentAvg >= 90
        ? 'A'
        : currentAvg >= 80
        ? 'B'
        : currentAvg >= 70
        ? 'C'
        : currentAvg >= 60
        ? 'D'
        : 'F'
    return { totalWeight, earnedWeighted, currentAvg, remainingWeight, neededOnRemaining, letter }
  }, [gradeItems, targetGrade])

  const moveCalendar = (direction) =>
    setCalendarDate((current) => {
      const next = new Date(current)
      if (view === 'Day') next.setDate(next.getDate() + direction)
      else if (view === 'Week') next.setDate(next.getDate() + 7 * direction)
      else {
        next.setDate(1)
        next.setMonth(next.getMonth() + direction)
      }
      return next
    })

  const toggleAmbient = async (name) => {
    if (soundName === name) {
      clearInterval(soundRef.current?.interval)
      audioRef.current?.close()
      audioRef.current = null
      soundRef.current = null
      setSoundName('')
      return
    }
    clearInterval(soundRef.current?.interval)
    audioRef.current?.close()
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      setToast('This browser does not support ambient audio.')
      return
    }
    const context = new AudioContextClass()
    await context.resume()
    const master = context.createGain()
    master.gain.value = 0.09
    master.connect(context.destination)
    if (name === 'White noise' || name === 'Rain') {
      const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
      const samples = buffer.getChannelData(0)
      for (let i = 0; i < samples.length; i += 1) {
        const noise = Math.sin(i * 12.9898) * 43758.5453
        const value = (noise - Math.floor(noise)) * 2 - 1
        samples[i] = value * (name === 'Rain' ? 0.15 + (i % 17) / 34 : 0.7)
      }
      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      if (name === 'Rain') {
        const filter = context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 1500
        source.connect(filter)
        filter.connect(master)
      } else {
        source.connect(master)
      }
      source.start()
      soundRef.current = { source }
    } else {
      const frequencies = [
        [130.81, 164.81, 196],
        [110, 138.59, 164.81],
        [98, 123.47, 146.83],
        [116.54, 146.83, 174.61],
      ]
      const oscillators = frequencies[0].map((frequency) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        gain.gain.value = 0.24
        oscillator.connect(gain)
        gain.connect(master)
        oscillator.start()
        return { oscillator, gain }
      })
      let chord = 0
      const interval = window.setInterval(() => {
        chord = (chord + 1) % frequencies.length
        oscillators.forEach(({ oscillator }, index) => {
          oscillator.frequency.setTargetAtTime(frequencies[chord][index], context.currentTime, 0.45)
        })
      }, 2800)
      soundRef.current = { oscillators, interval }
    }
    audioRef.current = context
    setSoundName(name)
  }

  useEffect(
    () => () => {
      clearInterval(soundRef.current?.interval)
      audioRef.current?.close()
    },
    []
  )

  return (
    <div className="section-page">
      <div className="section-title anim-rise">
        <div>
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h1>{page}</h1>
          <p className="subheading">
            {page === 'My schedule'
              ? 'Make a little room for what matters.'
              : page === 'My tasks'
              ? 'Your plans, one small step at a time.'
              : page === 'Flashcards'
              ? 'Create active-recall cards and master tough concepts.'
              : page === 'Study room'
              ? 'A calmer place to do your best work.'
              : page === 'Study materials'
              ? 'Keep your PDFs, AI tutor prompts, and notes in one desk.'
              : 'Track your weighted course average and target final score.'}
          </p>
        </div>
        {page === 'My tasks' && (
          <button className="primary-button" onClick={() => setShowAdd(true)}>
            ＋ Add a task
          </button>
        )}
      </div>

      {page === 'My schedule' && (
        <ScheduleCalendar
          date={calendarDate}
          view={view}
          onView={setView}
          onMove={moveCalendar}
          onDateSelect={(date) => {
            setCalendarDate(date)
            setView('Day')
          }}
          subjects={[]}
          tasks={tasks}
          onCreateTask={(date) => setTaskEditor({ mode: 'create', initialDate: date })}
          onEditTask={onEditTask}
          onDeleteTask={setDeleteTarget}
          onToggleTask={onToggleTask}
          remindersEnabled={remindersEnabled}
          reminderSoundEnabled={reminderSoundEnabled}
          onReminderSoundSetting={onReminderSoundSetting}
          notificationPermission={notificationPermission}
          onNotificationSetting={onNotificationSetting}
        />
      )}

      {page === 'My tasks' && (
        <TaskList
          tasks={tasks}
          setTasks={setTasks}
          onAdd={() => setShowAdd(true)}
          onEdit={(task) => setTaskEditor({ mode: 'edit', task })}
          onDelete={setDeleteTarget}
        />
      )}

      {page === 'Flashcards' && (
        <div className="flash-layout anim-rise">
          <div className="panel flash-summary">
            <span className="summary-symbol mint">▤</span>
            <h2>{dueCards.length} cards due today</h2>
            <p>
              {cards.length === 0
                ? 'Add your first card on the right to start spaced-repetition practice.'
                : 'Rate recall honestly—harder cards come back sooner automatically.'}
            </p>
            <button
              className="primary-button"
              disabled={dueCards.length === 0}
              onClick={() => {
                setReviewing(true)
                setRevealed(false)
              }}
            >
              Start studying ({dueCards.length}) <span>→</span>
            </button>

            <div className="deck-list">
              {cards.map((card) => (
                <div className="deck-line" key={card.id}>
                  <div className="deck-copy">
                    <strong>{card.front}</strong>
                    <small>
                      {card.subject} · {cardIsDue(card) ? 'Due now' : `Next: ${card.nextReview || 'scheduled'}`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-delete"
                    aria-label="Delete flashcard"
                    onClick={() => {
                      setCards((prev) => prev.filter((c) => c.id !== card.id))
                      setToast('Flashcard deleted.')
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form className="panel study-tip card-creator" onSubmit={addFlashcard}>
            <span className="tip-icon">＋</span>
            <div className="eyebrow">NEW FLASHCARD</div>
            <h2>Add to your deck</h2>
            <label>
              Subject / Tag
              <input
                type="text"
                value={cardSubject}
                onChange={(e) => setCardSubject(e.target.value)}
                placeholder="e.g. Biology, Algorithms"
              />
            </label>
            <label>
              Question (Front)
              <textarea
                rows={2}
                required
                value={cardFront}
                onChange={(e) => setCardFront(e.target.value)}
                placeholder="What is the powerhouse of the cell?"
              />
            </label>
            <label>
              Answer (Back)
              <textarea
                rows={2}
                required
                value={cardBack}
                onChange={(e) => setCardBack(e.target.value)}
                placeholder="Mitochondria — generates most chemical energy (ATP)."
              />
            </label>
            <button type="submit" className="primary-button">
              Save flashcard
            </button>
          </form>
        </div>
      )}

      {page === 'Study room' && (
        <div className="study-room-grid anim-rise">
          <div className="panel room-timer">
            <div className="focus-eyebrow">
              <span>✳</span> {timerMode === 'focus' ? 'YOUR FOCUS SPACE' : 'BREAK TIME'}
            </div>

            <div className="preset-pills" role="group" aria-label="Timer presets">
              {TIMER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={presetId === preset.id ? 'active' : ''}
                  onClick={() => selectPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className={`timer-ring room-ring${timerOn ? ' running' : ''}`} style={{ '--progress': `${progressDeg}deg` }}>
              <div className="timer-inner">
                <span>{timeLabel}</span>
                <small>
                  {timerOn
                    ? timerMode === 'focus'
                      ? 'FOCUS ON'
                      : 'ON A BREAK'
                    : timerMode === 'focus'
                    ? 'READY TO FOCUS'
                    : 'BREAK READY'}
                </small>
              </div>
            </div>

            <h2>Make this moment yours.</h2>
            <p>
              {Math.round(activePreset.focus / 60)} minutes of focus. Then take a{' '}
              {Math.round(activePreset.rest / 60)}-minute breath.
            </p>
            <button className="focus-button" onClick={() => setTimerOn((value) => !value)}>
              {timerOn ? 'Ⅱ Pause session' : '▶ Start focusing'}
            </button>
            <button
              className="reset-timer"
              onClick={() => {
                setTimerOn(false)
                setTimerMode('focus')
                setSeconds(activePreset.focus)
              }}
            >
              Reset timer
            </button>
          </div>

          <div className="panel ambience">
            <div className="note-icon">♫</div>
            <h2>Set the mood</h2>
            <p>Synthesized in your browser—zero external streaming needed.</p>
            <div className="sound-options">
              {[
                ['☂', 'Rain'],
                ['≋', 'White noise'],
                ['♫', 'Lo-fi beats'],
              ].map(([icon, name]) => (
                <button
                  type="button"
                  key={name}
                  className={soundName === name ? 'playing' : ''}
                  aria-pressed={soundName === name}
                  onClick={() =>
                    toggleAmbient(name).catch(() => setToast('Could not start audio in this browser.'))
                  }
                >
                  <span>{icon}</span>
                  {name}
                  {soundName === name && (
                    <span className="eq-bars" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  <small>{soundName === name ? '■ Stop' : '▶ Play'}</small>
                </button>
              ))}
            </div>
            <p className="muted">
              {soundName ? `${soundName} is playing. Tap it again to stop.` : 'Choose an ambient track to focus.'}
            </p>
          </div>
        </div>
      )}

      {page === 'Grade tracker' && (
        <div className="grade-grid anim-rise">
          <div className="panel grade-card">
            <div className="eyebrow">COURSE GRADE TRACKER</div>
            <h2>Add graded assessments</h2>
            <p>Log quizzes, labs, and exams to track your live weighted average.</p>

            <form className="grade-form" onSubmit={addGradeItem}>
              <label>
                Assessment name
                <input
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="e.g. Midterm Exam"
                />
              </label>
              <div className="grade-input-row">
                <label>
                  Score (%)
                  <input
                    type="number"
                    min="0"
                    max="150"
                    step="0.1"
                    required
                    value={itemScore}
                    onChange={(e) => setItemScore(e.target.value)}
                    placeholder="88"
                  />
                </label>
                <label>
                  Weight (%)
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    required
                    value={itemWeight}
                    onChange={(e) => setItemWeight(e.target.value)}
                    placeholder="25"
                  />
                </label>
              </div>
              <button type="submit" className="primary-button">
                ＋ Add grade
              </button>
            </form>

            {gradeItems.length > 0 && (
              <div className="grade-list">
                {gradeItems.map((item) => (
                  <div className="grade-example" key={item.id}>
                    <span className="grade-item-name" title={item.title}>
                      {item.title} <small>({item.weight}%)</small>
                    </span>
                    <div>
                      <i style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }} />
                    </div>
                    <strong>{item.score}%</strong>
                    <button
                      type="button"
                      className="icon-delete"
                      aria-label="Remove grade item"
                      onClick={() => setGradeItems((prev) => prev.filter((g) => g.id !== item.id))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel grades-note">
            <div className="eyebrow">LIVE STANDING & TARGET</div>
            <h2>Current weighted average</h2>
            <div className="grade-result">
              <small>
                WEIGHT ACCOUNTED: {gradeStats.totalWeight.toFixed(0)}% · GRADE {gradeStats.letter}
              </small>
              <strong>{gradeStats.currentAvg != null ? `${gradeStats.currentAvg.toFixed(1)}%` : '—'}</strong>
              <span>
                {gradeStats.totalWeight > 0
                  ? `${gradeStats.earnedWeighted.toFixed(1)} weighted points earned so far`
                  : 'Add at least one graded item to calculate'}
              </span>
            </div>

            <label className="target-label">
              Desired final course grade (%)
              <input
                type="number"
                min="0"
                max="100"
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
              />
            </label>

            <div className="target-callout">
              {gradeStats.remainingWeight <= 0 ? (
                <p>100% of your course weight has been logged.</p>
              ) : gradeStats.neededOnRemaining != null ? (
                <p>
                  You need an average of{' '}
                  <strong>{Math.max(0, gradeStats.neededOnRemaining).toFixed(1)}%</strong> across the remaining{' '}
                  <strong>{gradeStats.remainingWeight.toFixed(0)}%</strong> of your coursework to finish with{' '}
                  <strong>{targetGrade}%</strong>.
                </p>
              ) : (
                <p>Enter a target grade above to see what you need on remaining exams.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {page === 'Study materials' && (
        <div className="materials-grid anim-rise">
          <section className="panel upload-panel">
            <span className="summary-symbol purple">▧</span>
            <h2>Your study materials</h2>
            <p>Preview course PDFs right inside your browser without uploading to any server.</p>
            <label className="upload-zone">
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null
                  setFile(selected)
                  setPdfUrl(selected ? URL.createObjectURL(selected) : '')
                }}
              />
              <span>↑</span>
              <strong>{file ? file.name : 'Choose a PDF to get started'}</strong>
              <small>
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · selected` : 'Click to browse · PDF files'}
              </small>
            </label>
            {file && (
              <button
                className="inline-link"
                onClick={() => {
                  setFile(null)
                  setPdfUrl('')
                }}
              >
                Remove file
              </button>
            )}
          </section>

          <AITutor />

          {file && (
            <section className="panel pdf-panel">
              <div className="panel-heading">
                <div>
                  <h2>{file.name}</h2>
                  <p>PDF preview · rendered by your browser</p>
                </div>
                <a className="inline-link" href={pdfUrl} target="_blank" rel="noreferrer">
                  Open separately ↗
                </a>
              </div>
              <iframe title="PDF study material" src={pdfUrl} />
            </section>
          )}

          <section className="panel quick-note">
            <div className="note-heading">
              <div className="note-icon">✎</div>
              <div>
                <h2>Synced study scratchpad</h2>
                <p>Automatically shares with your Overview daily note.</p>
              </div>
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Jot down a question, a definition, or what you want to remember..."
            />
            <small className="muted">Saved automatically on this device.</small>
          </section>
        </div>
      )}

      <button className="back-link" onClick={() => setPage('Overview')}>
        ← Back to your overview
      </button>
    </div>
  )
}

export default App
