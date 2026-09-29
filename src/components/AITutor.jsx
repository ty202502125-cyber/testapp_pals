import { useRef, useState } from 'react'

export default function AITutor({ account, accessToken, onConnect }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  const send = async (event) => {
    event.preventDefault()
    const question = draft.trim()
    if (!question || loading) return
    if (!accessToken) { setError('Sign in with Google to start your study session.'); return }
    const nextMessages = [...messages.slice(-14), { role: 'user', content: question }]
    setMessages(nextMessages)
    setDraft('')
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messages: nextMessages }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The tutor couldn’t answer just now.')
      setMessages((items) => [...items, { role: 'assistant', content: result.answer }])
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }))
    } catch (sendError) {
      setError(sendError.message || 'Could not reach the tutor. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="panel tutor-panel">
    <div className="tutor-header"><div><div className="eyebrow">CHECK STUDY TUTOR</div><h2>Let’s figure it out together.</h2><p>Ask a question and work through it step by step.</p></div><span className="tutor-badge">✦ Gemini</span></div>
    <div className="tutor-messages" ref={listRef} aria-live="polite">
      {!messages.length && <div className="tutor-welcome"><span>✧</span><strong>What are you learning today?</strong><small>Try: “Can you explain derivatives with a simple example?”</small></div>}
      {messages.map((message, index) => <div className={`tutor-message ${message.role}`} key={`${index}-${message.role}`}><span>{message.role === 'user' ? 'You' : 'Check tutor'}</span><p>{message.content}</p></div>)}
      {loading && <div className="tutor-message assistant"><span>Check tutor</span><p className="thinking">Thinking through it…</p></div>}
    </div>
    {error && <p className="tutor-error" role="alert">{error}</p>}
    <form className="tutor-compose" onSubmit={send}><textarea aria-label="Ask the study tutor" rows="2" maxLength={8000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit() } }} placeholder="Ask your study question…"/><button type="submit" aria-label="Send question" disabled={loading || !draft.trim()}>↑</button></form>
    <div className="tutor-footer"><span>{account ? `Signed in as ${account.email || 'Google account'}` : 'Sign in to use your Gemini study tutor.'}</span>{!account && <button onClick={onConnect}>Connect Google <span>→</span></button>}</div>
  </section>
}
