import { useState } from 'react'

const CHATGPT_URL = 'https://chatgpt.com/'

function makeTutorPrompt(question) {
  return `Act as a patient study tutor. Help me understand the topic instead of simply giving me an answer. Explain it in clear steps, use a simple example, and ask a short follow-up question when useful.\n\nMy question: ${question.trim()}`
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const field = document.createElement('textarea')
  field.value = text
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.append(field)
  field.select()
  const copied = document.execCommand('copy')
  field.remove()
  if (!copied) throw new Error('Clipboard access is unavailable in this browser.')
}

export default function AITutor() {
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState('')

  const copyPrompt = async () => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) {
      setStatus('Write a question first.')
      return
    }

    try {
      await copyText(makeTutorPrompt(trimmedQuestion))
      setStatus('Tutor prompt copied. Paste it into ChatGPT.')
    } catch {
      setStatus('Could not copy automatically. Select your question and copy it manually.')
    }
  }

  return <section className="panel tutor-panel">
    <div className="tutor-header">
      <div>
        <div className="eyebrow">FREE CHATGPT HANDOFF</div>
        <h2>Study with ChatGPT</h2>
        <p>Prepare a tutor prompt, then continue in ChatGPT Free in a new tab.</p>
      </div>
      <span className="tutor-badge">ChatGPT Free</span>
    </div>

    <label className="tutor-question-label" htmlFor="tutor-question">What would you like help understanding?</label>
    <textarea
      id="tutor-question"
      className="tutor-question"
      rows="4"
      maxLength={8000}
      value={question}
      onChange={(event) => {
        setQuestion(event.target.value)
        setStatus('')
      }}
      placeholder="For example: Can you explain derivatives with a simple example?"
    />

    <div className="tutor-handoff-actions">
      <button className="primary-button" type="button" onClick={copyPrompt}>Copy tutor prompt</button>
      <a className="tutor-open-chatgpt" href={CHATGPT_URL} target="_blank" rel="noopener noreferrer">Open ChatGPT ↗</a>
    </div>
    <p className="tutor-handoff-status" aria-live="polite">{status || 'No AI account connection is needed here. Sign in to ChatGPT in the new tab if prompted.'}</p>
    <p className="tutor-handoff-note">Your question is copied only when you choose Copy. This app does not connect to your ChatGPT account or read your files. ChatGPT Free has its own usage limits.</p>
  </section>
}
