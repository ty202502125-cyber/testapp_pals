import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { handleChat } from './server/chatHandler.js'

function localTutor(env) {
  return {
    name: 'check-local-tutor',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        let raw = ''
        for await (const chunk of req) {
          raw += chunk
          if (raw.length > 100_000) {
            res.statusCode = 413
            res.end(JSON.stringify({ error: 'Message is too large.' }))
            return
          }
        }
        let body = {}
        try { body = raw ? JSON.parse(raw) : {} } catch {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid request data.' }))
          return
        }
        const result = await handleChat({ method: req.method, headers: req.headers, body }, env.GEMINI_API_KEY)
        res.statusCode = result.status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(result.body))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), localTutor(env)] }
})
