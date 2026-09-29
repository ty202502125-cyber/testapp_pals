const SYSTEM_PROMPT = `You are Check, a thoughtful academic tutor. Help the student learn rather than simply doing graded work for them. Use short clear explanations, ask one guiding question when useful, break difficult ideas into steps, and adapt to the student's level. Be supportive without being overly casual. If a question is ambiguous, ask for context. Never claim to have read a document unless its text was included in the conversation.`

export async function handleChat(request, apiKey = process.env.GEMINI_API_KEY) {
  if (request.method !== 'POST') return { status: 405, body: { error: 'Use POST to send a tutoring question.' } }
  if (!apiKey) return { status: 503, body: { error: 'Gemini tutoring is not configured on this deployment yet.' } }

  const authorization = request.headers?.authorization || request.headers?.Authorization || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!accessToken) return { status: 401, body: { error: 'Sign in with Google to use the tutor.' } }

  const accountResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!accountResponse.ok) return { status: 401, body: { error: 'Your Google session expired. Sign in again to continue.' } }
  const account = await accountResponse.json()
  const messages = request.body?.messages
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 16) {
    return { status: 400, body: { error: 'Send between 1 and 16 chat messages.' } }
  }
  const contents = []
  for (const message of messages) {
    const role = message.role === 'assistant' || message.role === 'model' ? 'model' : message.role === 'user' ? 'user' : null
    const text = typeof message.content === 'string' ? message.content.trim() : ''
    if (!role || !text || text.length > 8000) return { status: 400, body: { error: 'Each message must contain up to 8,000 characters.' } }
    if (contents.at(-1)?.role === role) contents.at(-1).parts[0].text += `\n${text}`
    else contents.push({ role, parts: [{ text }] })
  }
  if (contents[0]?.role !== 'user') return { status: 400, body: { error: 'Start with a student question.' } }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  let response
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.45, maxOutputTokens: 1200 },
      }),
    })
  } catch {
    return { status: 502, body: { error: 'Could not reach Gemini. Check your connection and try again.' } }
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = result.error?.message || 'Gemini could not answer just now.'
    return { status: response.status === 429 ? 429 : 502, body: { error: message.slice(0, 300) } }
  }
  const answer = result.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim()
  if (!answer) return { status: 502, body: { error: 'Gemini returned an empty reply. Please try again.' } }
  return { status: 200, body: { answer, account: account.email } }
}
