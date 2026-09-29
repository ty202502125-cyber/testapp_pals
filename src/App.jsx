import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './pwa.css'
import AITutor from './components/AITutor.jsx'
import AccountDialog from './components/AccountDialog.jsx'
import ScheduleCalendar from './components/ScheduleCalendar.jsx'
import { connectGoogle, preloadGoogleIdentity, revokeGoogleToken, saveGoogleData } from './services/googleDrive.js'

const nav = [ ['Overview','⌂'], ['My schedule','▦'], ['My tasks','☷'], ['Study materials','▧'], ['Flashcards','▤'], ['Study room','◷'], ['Grade tracker','◉'] ]
const seedTasks = [
  { id: 1, title: 'Read chapter 4: Cell biology', subject: 'Biology', due: 'Today, 2:00 PM', done: false, color: 'mint' },
  { id: 2, title: 'Problem set — integration', subject: 'Mathematics', due: 'Today, 5:30 PM', done: false, color: 'lilac' },
  { id: 3, title: 'Outline research paper', subject: 'Literature', due: 'Tomorrow', done: true, color: 'peach' },
]
const initialCards = [
  { front: 'What is the powerhouse of the cell?', back: 'The mitochondrion, which produces most of the cell’s ATP.', due: true },
  { front: 'What does ∫ f(x) dx represent?', back: 'The family of antiderivatives of f(x), plus a constant.', due: true },
]
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const today = new Date()
const todayLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(today)
const todayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(today)
const formatDue = (task) => {
  if (!task.dueAt) return task.due
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(task.dueAt))
}
const cardIsDue = (card) => card.due === true || Boolean(card.dueAt && new Date(card.dueAt).getTime() <= Date.now())
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function App() {
  const [page, setPage] = useState('Overview')
  const [tasks, setTasks] = useState(() => read('check-tasks', seedTasks))
  const [cards, setCards] = useState(() => read('check-cards', initialCards))
  const [note, setNote] = useState(() => localStorage.getItem('check-note') || '')
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newTaskDate, setNewTaskDate] = useState('')
  const [newTaskTime, setNewTaskTime] = useState('')
  const [alarmTitle, setAlarmTitle] = useState('Time to check in with yourself.')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installHint, setInstallHint] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [seconds, setSeconds] = useState(25 * 60)
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

  useEffect(() => { localStorage.setItem('check-tasks', JSON.stringify(tasks)) }, [tasks])
  useEffect(() => { localStorage.setItem('check-cards', JSON.stringify(cards)) }, [cards])
  useEffect(() => { localStorage.setItem('check-note', note) }, [note])
  useEffect(() => { localStorage.setItem('check-dark', JSON.stringify(dark)) }, [dark])
  useEffect(() => { if (googleClientId) preloadGoogleIdentity().catch(() => {}) }, [])
  useEffect(() => {
    if (!googleToken || !cloudReady) return undefined
    const timer = window.setTimeout(() => {
      setCloudStatus('syncing')
      saveGoogleData(googleToken, cloudFileId.current, { tasks, cards, note, dark, updatedAt: new Date().toISOString() })
        .then((id) => { cloudFileId.current = id; setCloudStatus('synced') })
        .catch(() => setCloudStatus('error'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [googleToken, cloudReady, tasks, cards, note, dark])
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return undefined
    const checkReminders = () => {
      const now = Date.now()
      const due = tasks.filter((task) => task.dueAt && !task.done && !task.notifiedAt && new Date(task.dueAt).getTime() <= now)
      if (!due.length) return
      setAlarmTitle(due[0].title)
      setAlarm(true)
      due.forEach((task) => {
        const title = `Check reminder: ${task.title}`
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((registration) => registration.showNotification(title, { body: 'Your task is due now.', icon: '/icons/check.svg', tag: `task-${task.id}`, data: { url: '/' } })).catch(() => {})
        } else {
          try { new Notification(title, { body: 'Your task is due now.', icon: '/icons/check.svg', tag: `task-${task.id}` }) } catch { /* Notifications may be unavailable in this browser. */ }
        }
      })
      const ids = new Set(due.map((task) => task.id))
      setTasks((items) => items.map((task) => ids.has(task.id) ? { ...task, notifiedAt: new Date().toISOString() } : task))
    }
    checkReminders()
    const interval = window.setInterval(checkReminders, 15000)
    return () => window.clearInterval(interval)
  }, [tasks])
  useEffect(() => {
    const handler = (event) => { event.preventDefault(); setInstallPrompt(event) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  useEffect(() => {
    if (!timerOn) return undefined
    const id = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) {
        setTimerOn(false)
        setTimerMode((mode) => { const next = mode === 'focus' ? 'break' : 'focus'; setToast(next === 'break' ? 'Focus complete — your 5-minute break is ready.' : 'Break over — ready for another focus session?'); return next })
        return timerMode === 'focus' ? 5 * 60 : 25 * 60
      }
      return value - 1
    }), 1000)
    return () => window.clearInterval(id)
  }, [timerOn, timerMode])
  useEffect(() => { if (!toast) return undefined; const id = setTimeout(() => setToast(''), 3200); return () => clearTimeout(id) }, [toast])
  useEffect(() => { if (!alarm) return undefined; const id = window.setInterval(() => { try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 740; gain.gain.value = .08; osc.start(); osc.stop(ctx.currentTime + .25); osc.onended = () => ctx.close() } catch { /* Audio may be unavailable until the user interacts. */ } }, 950); return () => clearInterval(id) }, [alarm])

  const completed = tasks.filter((task) => task.done).length
  const activeTasks = tasks.filter((task) => !task.done)
  const currentCard = useMemo(() => cards.find(cardIsDue), [cards])
  const timeLabel = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const install = async () => {
    if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null) }
    else setInstallHint(true)
  }
  const signInWithGoogle = async () => {
    setCloudStatus('connecting')
    try {
      const connection = await connectGoogle(googleClientId)
      setGoogleToken(connection.token)
      setGoogleAccount({ email: connection.user.email, name: connection.user.name, picture: connection.user.picture })
      cloudFileId.current = connection.fileId
      if (connection.data && typeof connection.data === 'object') {
        if (Array.isArray(connection.data.tasks)) setTasks(connection.data.tasks)
        if (Array.isArray(connection.data.cards)) setCards(connection.data.cards)
        if (typeof connection.data.note === 'string') setNote(connection.data.note)
        if (typeof connection.data.dark === 'boolean') setDark(connection.data.dark)
      }
      setCloudReady(true)
      setCloudStatus(connection.data ? 'synced' : 'syncing')
      setToast(connection.data ? 'Your study data is back on this device.' : 'Google connected. Your study data will sync here.')
    } catch (error) {
      setCloudStatus('local')
      setToast(error.message || 'Google sign-in did not complete.')
    }
  }
  const signOutGoogle = async () => {
    try { await revokeGoogleToken(googleToken) } catch { /* Clear the local session even if Google revocation is offline. */ }
    setGoogleToken('')
    setGoogleAccount(null)
    setCloudReady(false)
    setCloudStatus('local')
    cloudFileId.current = null
    setAccountDialog(false)
    setToast('Signed out. Your data is still saved on this device.')
  }
  const addTask = (event) => {
    event.preventDefault()
    if (!newTask.trim()) return
    if (Boolean(newTaskDate) !== Boolean(newTaskTime)) { setToast('Choose both a date and a time for the reminder.'); return }
    const dueAt = newTaskDate && newTaskTime ? new Date(`${newTaskDate}T${newTaskTime}`).toISOString() : undefined
    if (dueAt && new Date(dueAt).getTime() <= Date.now()) { setToast('Choose a reminder time in the future.'); return }
    const create = () => {
      setTasks((items) => [{ id: Date.now(), title: newTask.trim(), subject: 'Personal', due: dueAt ? '' : 'No reminder', dueAt, done: false, color: 'blue' }, ...items])
      setNewTask(''); setNewTaskDate(''); setNewTaskTime(''); setShowAdd(false)
      setToast(dueAt ? 'Task saved. Check will notify you at the set time while the app is open.' : 'Task added to your list.')
    }
    if (dueAt && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(() => create()).catch(() => create())
    } else create()
  }
  const rateCard = (rating) => {
    const days = rating <= 1 ? 1 : rating === 2 ? 2 : rating === 3 ? 3 : 6
    const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    setCards((items) => items.map((card) => card === currentCard ? { ...card, due: false, dueAt, nextReview: days === 1 ? 'tomorrow' : `in ${days} days` } : card))
    setRevealed(false)
    if (!cards.some((card) => cardIsDue(card) && card !== currentCard)) { setReviewing(false); setToast('Review complete — nice work!') }
  }

  return (
    <div className={`app-shell${dark ? ' dark' : ''}`}>
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={(e) => { e.preventDefault(); setPage('Overview') }}><span className="brand-mark">c<span>.</span></span><span className="brand-name">check</span></a>
        <div className="workspace"><div className="avatar">A</div><div><strong>Alex Morgan</strong><small>Spring semester ’25</small></div><span className="chevron">⌄</span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">{nav.map(([label, icon]) => <button key={label} title={label} aria-label={label} className={`nav-item${page === label ? ' selected' : ''}`} onClick={() => setPage(label)}><span className="nav-icon" aria-hidden="true">{icon}</span>{label}{label === 'My tasks' && <span className="nav-count">{activeTasks.length}</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="streak-card"><div className="streak-top"><span>✳</span><span className="streak-days">4 day streak</span><span>↗</span></div><strong>You’re on a roll!</strong><small>A little progress adds up.</small><div className="streak-bars">{[1, 1, 1, 1, 0, 0, 0].map((active, i) => <i key={i} className={active ? 'active' : ''} />)}</div></div><button className="nav-item" onClick={() => setDark((value) => !value)}><span className="nav-icon">◐</span>{dark ? 'Light appearance' : 'Dark appearance'}</button><button className="nav-item install-side" onClick={install}><span className="nav-icon">↓</span>Install the app<span className="install-arrow">↗</span></button><div className="sidebar-foot"><span>◌</span> Made for your next big thing</div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumbs">My workspace <span>/</span> <strong>{page}</strong></div><div className="top-actions"><button type="button" className="icon-button" aria-label="Create a timed reminder" title="Create a timed reminder" onClick={() => setShowAdd(true)}>♧</button><div className="today-pill" role="status">◷ <span>{todayShort}</span></div><button type="button" className="avatar small-avatar" aria-label="Google account and sync settings" title="Account and sync" onClick={() => setAccountDialog(true)}>{googleAccount?.name?.[0]?.toUpperCase() || 'A'}</button></div></header>
        <div className="page-content">
          {page === 'Overview' ? <>
            <div className="greeting-row"><div><div className="eyebrow">{todayLong.toUpperCase()} <span className="sun">☼</span></div><h1>Good morning, Alex <span className="wave">✳</span></h1><p className="subheading">A fresh day, a fresh chance to make it count.</p></div><button className="primary-button" onClick={() => setShowAdd(true)}><span>＋</span> Add a task</button></div>
            <div className="summary-grid"><div className="summary-card"><div className="summary-head">Things to do <span className="summary-symbol purple">☷</span></div><div className="summary-value">{activeTasks.length}<span> tasks</span></div><div className="summary-foot">{completed} completed today <span className="tiny-progress"><i style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></span></div></div><div className="summary-card"><div className="summary-head">Focus time <span className="summary-symbol yellow">◷</span></div><div className="summary-value">2<span>h </span>40<span>m</span></div><div className="summary-foot">↑ 35 min <span className="muted">vs. last week</span></div></div><div className="summary-card"><div className="summary-head">Cards to review <span className="summary-symbol mint">▤</span></div><div className="summary-value">{cards.filter(cardIsDue).length}<span> cards</span></div><button className="inline-link" onClick={() => { setReviewing(true); setRevealed(false) }}>Start a quick review <span>→</span></button></div></div>
            <div className="content-grid"><section className="panel tasks-panel"><div className="panel-heading"><div><h2>Today’s tasks <span className="heading-count">{activeTasks.length}</span></h2><p>A small step is still a step forward.</p></div><button className="more-button" onClick={() => setPage('My tasks')}>See all <span>→</span></button></div><div className="task-list">{tasks.slice(0, 4).map((task) => <div className={`task-row${task.done ? ' task-done' : ''}`} key={task.id}><button className={`check-circle ${task.done ? 'checked' : ''}`} aria-label={task.done ? 'Mark incomplete' : 'Complete task'} onClick={() => setTasks((items) => items.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}>{task.done && '✓'}</button><div className="task-copy"><strong>{task.title}</strong><div className="task-meta"><span className={`subject-dot ${task.color}`} />{task.subject}<span className="meta-dot">·</span>{formatDue(task)}</div></div><button className="task-more" aria-label="Task options" onClick={() => setTasks((items) => items.filter((item) => item.id !== task.id))}>···</button></div>)}</div><button className="add-row" onClick={() => setShowAdd(true)}>＋ <span>Add another task</span></button></section>
              <section className="panel schedule-panel"><div className="panel-heading"><div><h2>Coming up</h2><p>You’ve got this.</p></div><button className="calendar-button" onClick={() => setPage('My schedule')}>▦</button></div><div className="schedule-date"><span className="date-badge">{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(today).toUpperCase()}<b>{today.getDate()}</b></span><div><strong>Today</strong><small>3 things on your schedule</small></div></div><div className="schedule-events"><div className="timeline"><span /><span /><span /></div><div className="event-list"><div className="event"><small>09:00 <i>—</i> 10:30</small><strong>Biology lecture</strong><span className="event-tag green-tag">Room 204 · Science</span></div><div className="event"><small>11:00 <i>—</i> 12:00</small><strong>Study block</strong><span className="event-tag purple-tag">Library · Quiet zone</span></div><div className="event"><small>14:30 <i>—</i> 15:30</small><strong>Calculus tutorial</strong><span className="event-tag orange-tag">Online · Zoom</span></div></div></div><button className="schedule-link" onClick={() => setPage('My schedule')}>View full schedule <span>→</span></button></section>
            </div>
            <section className="lower-grid"><div className="panel focus-panel"><div className="focus-info"><div className="focus-eyebrow"><span>✳</span> {timerMode === 'focus' ? 'FOCUS SESSION' : 'SHORT BREAK'}</div><h2>A little focus<br />goes a long way.</h2><p>Put distractions aside and be<br />present with your work.</p><button className="focus-button" onClick={() => setTimerOn((value) => !value)}>{timerOn ? 'Ⅱ Pause session' : timerMode === 'focus' ? '▶ Start focusing' : '▶ Start break'}</button></div><div className="timer-wrap"><div className={`timer-ring${timerOn ? ' running' : ''}`}><div className="timer-inner"><span>{timeLabel}</span><small>{timerOn ? (timerMode === 'focus' ? 'FOCUS ON' : 'ON A BREAK') : (timerMode === 'focus' ? 'READY TO FOCUS' : 'BREAK READY')}</small></div></div><div className="timer-caption">✦ &nbsp; 25 min focus <span>·</span> 5 min break</div></div><span className="focus-decor">✳</span></div><div className="panel note-panel"><div className="note-heading"><div className="note-icon">✎</div><div><h2>Daily note</h2><p>Get it out of your head.</p></div><span className="note-date">TODAY</span></div><textarea aria-label="Daily note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What’s on your mind today? Write a thought, make a plan, or just start..."/><div className="note-footer"><span><span className="save-dot" /> Saved automatically</span><button onClick={() => { setNote(''); setToast('Daily note cleared.') }}>Clear note</button></div></div></section>
          </> : <SectionPage page={page} tasks={tasks} setTasks={setTasks} cards={cards} setCards={setCards} setPage={setPage} setReviewing={setReviewing} setRevealed={setRevealed} setShowAdd={setShowAdd} setSeconds={setSeconds} timerMode={timerMode} setTimerMode={setTimerMode} timerOn={timerOn} setTimerOn={setTimerOn} timeLabel={timeLabel} note={note} setNote={setNote} setToast={setToast} googleAccount={googleAccount} googleToken={googleToken} setAccountDialog={setAccountDialog} />}
          <footer className="page-footer">Made with care, for everything you’re becoming. <span>✳</span></footer>
        </div>
      </main>
      {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><form className="modal" onSubmit={addTask} onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowAdd(false)}>×</button><span className="modal-icon">＋</span><h2>Add a task</h2><p>One thing at a time. Set a reminder to get a notification when it’s due.</p><input autoFocus required value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="What do you need to do?"/><div className="reminder-fields"><label>Date<input type="date" value={newTaskDate} onChange={(event) => setNewTaskDate(event.target.value)} min={new Date().toLocaleDateString('en-CA')}/></label><label>Time<input type="time" value={newTaskTime} onChange={(event) => setNewTaskTime(event.target.value)}/></label></div><small className="reminder-help">Choose both date and time. Allow notifications when your device asks.</small><button className="primary-button modal-submit" type="submit">Add task and reminder <span>→</span></button></form></div>}
      {installHint && <div className="modal-backdrop" onClick={() => setInstallHint(false)}><div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close install instructions" onClick={() => setInstallHint(false)}>×</button><span className="modal-icon">↓</span><h2>Take Check with you</h2><p>Install this site for quick access from your home screen. In your browser menu, choose <strong>“Add to Home Screen”</strong> or <strong>“Install app.”</strong></p><button className="primary-button modal-submit" onClick={() => setInstallHint(false)}>Got it</button></div></div>}
      {accountDialog && <AccountDialog account={googleAccount} status={cloudStatus} configured={Boolean(googleClientId)} onConnect={signInWithGoogle} onDisconnect={signOutGoogle} onClose={() => setAccountDialog(false)} />}
      {reviewing && <div className="modal-backdrop" onClick={() => setReviewing(false)}><div className="modal review-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" aria-label="Close flashcard review" onClick={() => setReviewing(false)}>×</button><span className="review-count">QUICK REVIEW · {cards.filter(cardIsDue).length} LEFT</span>{currentCard ? <><button type="button" className="flashcard" aria-label="Flip flashcard" onClick={() => setRevealed((value) => !value)}><span>{revealed ? 'THE ANSWER' : 'YOUR QUESTION'}</span><strong>{revealed ? currentCard.back : currentCard.front}</strong><small>Click to {revealed ? 'see question' : 'reveal answer'}</small></button>{revealed && <div className="rating-row">{['Again','Hard','Good','Easy'].map((rating, i) => <button type="button" key={rating} onClick={() => rateCard(i + 1)}>{rating}<small>{['1d', '2d', '3d', '6d'][i]}</small></button>)}</div>}</> : <div className="empty-review"><span>✦</span><h2>All caught up!</h2><p>Your next review is scheduled. Take a well-earned breather.</p><button type="button" className="primary-button modal-submit" onClick={() => setReviewing(false)}>Done</button></div>}</div></div>}
      {alarm && <div className="alarm-toast"><span>◉</span><div><strong>Reminder</strong><small>{alarmTitle}</small></div><button onClick={() => { setAlarm(false); setTimeout(() => { setAlarmTitle('Snoozed reminder'); setAlarm(true) }, 5 * 60 * 1000) }}>Snooze 5m</button><button aria-label="Dismiss reminder" onClick={() => setAlarm(false)}>×</button></div>}
      {toast && <div className="toast">✦ &nbsp;{toast}</div>}
    </div>
  )
}

function SectionPage({ page, tasks, setTasks, cards, setCards, setPage, setReviewing, setRevealed, setShowAdd, setSeconds, timerMode, setTimerMode, timerOn, setTimerOn, timeLabel, note, setNote, setToast, googleAccount, googleToken, setAccountDialog }) {
  const [view, setView] = useState('Week')
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [soundName, setSoundName] = useState('')
  const audioRef = useRef(null)
  const soundRef = useRef(null)
  const [grade, setGrade] = useState('')
  const [weight, setWeight] = useState('')
  const [file, setFile] = useState(null)
  const [pdfUrl, setPdfUrl] = useState('')
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])
  const dueCards = cards.filter(cardIsDue)
  const moveCalendar = (direction) => setCalendarDate((current) => {
    const next = new Date(current)
    if (view === 'Day') next.setDate(next.getDate() + direction)
    else if (view === 'Week') next.setDate(next.getDate() + 7 * direction)
    else { next.setDate(1); next.setMonth(next.getMonth() + direction) }
    return next
  })
  const toggleAmbient = async (name) => {
    if (soundName === name) {
      clearInterval(soundRef.current?.interval)
      audioRef.current?.close()
      audioRef.current = null; soundRef.current = null; setSoundName('')
      return
    }
    clearInterval(soundRef.current?.interval)
    audioRef.current?.close()
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) { setToast('This browser does not support ambient audio.'); return }
    const context = new AudioContextClass()
    await context.resume()
    const master = context.createGain(); master.gain.value = 0.09; master.connect(context.destination)
    if (name === 'White noise' || name === 'Rain') {
      const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
      const samples = buffer.getChannelData(0)
      for (let i = 0; i < samples.length; i += 1) {
        const noise = Math.sin(i * 12.9898) * 43758.5453
        const value = (noise - Math.floor(noise)) * 2 - 1
        samples[i] = value * (name === 'Rain' ? (0.15 + (i % 17) / 34) : 0.7)
      }
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true
      if (name === 'Rain') { const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1500; source.connect(filter); filter.connect(master) }
      else source.connect(master)
      source.start(); soundRef.current = { source }
    } else {
      const frequencies = [[130.81, 164.81, 196], [110, 138.59, 164.81], [98, 123.47, 146.83], [116.54, 146.83, 174.61]]
      const oscillators = frequencies[0].map((frequency) => { const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = 0.24; oscillator.connect(gain); gain.connect(master); oscillator.start(); return { oscillator, gain } })
      let chord = 0
      const interval = window.setInterval(() => { chord = (chord + 1) % frequencies.length; oscillators.forEach(({ oscillator }, index) => { oscillator.frequency.setTargetAtTime(frequencies[chord][index], context.currentTime, 0.45) }) }, 2800)
      soundRef.current = { oscillators, interval }
    }
    audioRef.current = context; setSoundName(name)
  }
  useEffect(() => () => { clearInterval(soundRef.current?.interval); audioRef.current?.close() }, [])
  const subjects = [{ at: '09:00', title: 'Biology lecture', day: 2, start: 1, tone: 'green' }, { at: '11:00', title: 'Study block', day: 2, start: 3, tone: 'purple' }, { at: '14:30', title: 'Calculus tutorial', day: 2, start: 6, tone: 'orange' }, { at: '10:00', title: 'Literature seminar', day: 4, start: 2, tone: 'pink' }, { at: '13:00', title: 'Biology lab', day: 4, start: 5, tone: 'green' }, { at: '09:30', title: 'Calculus practice', day: 1, start: 1, tone: 'orange' }]
  return <div className="section-page"><div className="section-title"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>{page}</h1><p className="subheading">{page === 'My schedule' ? 'Make a little room for what matters.' : page === 'My tasks' ? 'Your plans, one small step at a time.' : page === 'Flashcards' ? 'Build knowledge that sticks.' : page === 'Study room' ? 'A calmer place to do your best work.' : 'See how your effort adds up.'}</p></div>{page === 'My tasks' && <button className="primary-button" onClick={() => setShowAdd(true)}>＋ Add a task</button>}</div>
    {page === 'My schedule' && <ScheduleCalendar date={calendarDate} view={view} onView={setView} onMove={moveCalendar} onDateSelect={(date) => { setCalendarDate(date); setView('Day') }} subjects={subjects} />}{page === 'My tasks' && <div className="panel full-panel"><div className="panel-heading"><div><h2>All tasks <span className="heading-count">{tasks.filter((task) => !task.done).length}</span></h2><p>Your to-do list is saved on this device.</p></div></div>{tasks.map((task) => <div className="task-row full-task" key={task.id}><button className={`check-circle ${task.done ? 'checked' : ''}`} onClick={() => setTasks((items) => items.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}>{task.done && '✓'}</button><div className="task-copy"><strong>{task.title}</strong><div className="task-meta">{task.subject} · {formatDue(task)}</div></div><button className="task-more" onClick={() => setTasks((items) => items.filter((item) => item.id !== task.id))}>×</button></div>)}{!tasks.length && <p className="empty-text">Nothing on your list. Enjoy the breathing room!</p>}<button className="add-row" onClick={() => setShowAdd(true)}>＋ <span>Add another task</span></button></div>}
    {page === 'Flashcards' && <div className="flash-layout"><div className="panel flash-summary"><span className="summary-symbol mint">▤</span><h2>{dueCards.length} cards due today</h2><p>Little and often is the way to remember. Your progress is saved right here.</p><button className="primary-button" onClick={() => { setReviewing(true); setRevealed(false) }}>Start studying <span>→</span></button><div className="deck-line"><span>Biology essentials</span><span>{cards.length} cards</span></div><div className="deck-line"><span>Mathematics · Calculus</span><span>{cards.filter((card) => card.front.includes('∫')).length} cards</span></div><button className="inline-link" onClick={() => setCards((items) => [...items, { front: 'What topic do you want to remember?', back: 'Break it into a simple question and answer, then review it often.', due: true }])}>＋ Add a sample card</button></div><div className="panel study-tip"><span className="tip-icon">✳</span><div className="eyebrow">A FRIENDLY REMINDER</div><h2>Remembering takes practice.</h2><p>Rate each card by how it felt to recall. Check will bring the harder ones back sooner.</p><div className="rating-preview">{['Again', 'Hard', 'Good', 'Easy'].map((x) => <span key={x}>{x}</span>)}</div></div></div>}
    {page === 'Study room' && <div className="study-room-grid"><div className="panel room-timer"><div className="focus-eyebrow"><span>✳</span> YOUR FOCUS SPACE</div><div className="timer-ring room-ring"><div className="timer-inner"><span>{timeLabel}</span><small>{timerOn ? (timerMode === 'focus' ? 'FOCUS ON' : 'ON A BREAK') : (timerMode === 'focus' ? 'READY TO FOCUS' : 'BREAK READY')}</small></div></div><h2>Make this moment yours.</h2><p>25 minutes of focus. Then take a breath.</p><button className="focus-button" onClick={() => setTimerOn((value) => !value)}>{timerOn ? 'Ⅱ Pause session' : '▶ Start focusing'}</button><button className="reset-timer" onClick={() => { setTimerOn(false); setTimerMode('focus'); setSeconds(25 * 60) }}>Reset timer</button></div><div className="panel ambience"><div className="note-icon">♫</div><h2>Set the mood</h2><p>A little background can help quiet the noise.</p><div className="sound-options">{[['☂', 'Rain'], ['≋', 'White noise'], ['♫', 'Lo-fi beats']].map(([icon, name]) => <button type="button" key={name} className={soundName === name ? 'playing' : ''} aria-pressed={soundName === name} onClick={() => toggleAmbient(name).catch(() => setToast('Could not start audio in this browser.'))}><span>{icon}</span>{name}<small>{soundName === name ? '■ Stop' : '▶ Play'}</small></button>)}</div><p className="muted">{soundName ? `${soundName} is playing. Tap it again to stop.` : 'Choose a sound to play or tap it again to stop.'}</p></div></div>}
    {page === 'Grade tracker' && <div className="grade-grid"><div className="panel grade-card"><div className="eyebrow">GRADE CALCULATOR</div><h2>What are you aiming for?</h2><p>Add your current score and its weight to see a running estimate.</p><label>Current score (%)<input type="number" min="0" max="100" value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="e.g. 86"/></label><label>Category weight (%)<input type="number" min="0" max="100" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="e.g. 30"/></label><div className="grade-result"><small>WEIGHTED SCORE</small><strong>{grade && weight ? `${(Number(grade) * Number(weight) / 100).toFixed(1)}%` : '—'}</strong><span>based on the score and weight above</span></div><small className="muted">This is a quick estimate. Add all course categories for a full projection.</small></div><div className="panel grades-note"><span className="tip-icon">✦</span><h2>Progress over perfection.</h2><p>A grade is a snapshot, not the whole story. Keep showing up and doing your best.</p><div className="grade-example"><span>Biology</span><div><i style={{ width: '78%' }} /></div><strong>78%</strong></div><div className="grade-example"><span>Calculus</span><div><i style={{ width: '84%' }} /></div><strong>84%</strong></div><div className="grade-example"><span>Literature</span><div><i style={{ width: '91%' }} /></div><strong>91%</strong></div></div></div>}
    {page === 'Study materials' && <div className="materials-grid"><section className="panel upload-panel"><span className="summary-symbol purple">▧</span><h2>Your study materials</h2><p>Keep your course PDFs close by. Your files stay in this browser session.</p><label className="upload-zone"><input type="file" accept="application/pdf" onChange={(event) => { const selected = event.target.files?.[0] || null; setFile(selected); setPdfUrl(selected ? URL.createObjectURL(selected) : '') }}/><span>↑</span><strong>{file ? file.name : 'Choose a PDF to get started'}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · selected` : 'Click to browse · PDF files'}</small></label>{file && <button className="inline-link" onClick={() => { setFile(null); setPdfUrl('') }}>Remove file</button>}</section><AITutor account={googleAccount} accessToken={googleToken} onConnect={() => setAccountDialog(true)} />{file && <section className="panel pdf-panel"><div className="panel-heading"><div><h2>{file.name}</h2><p>PDF preview · rendered by your browser</p></div><a className="inline-link" href={pdfUrl} target="_blank" rel="noreferrer">Open separately ↗</a></div><iframe title="PDF study material" src={pdfUrl} /></section>}<section className="panel quick-note"><div className="note-heading"><div className="note-icon">✎</div><div><h2>Study notes</h2><p>Everything starts with one thought.</p></div></div><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Jot down a question, a definition, or what you want to remember..."/><small className="muted">Saved automatically on this device.</small></section></div>}
    <button className="back-link" onClick={() => setPage('Overview')}>← Back to your overview</button>
  </div>
}

export default App
