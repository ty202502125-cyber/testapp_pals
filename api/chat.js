import { handleChat } from '../server/chatHandler.js'

export default async function chat(req, res) {
  const result = await handleChat(req)
  res.status(result.status).json(result.body)
}
