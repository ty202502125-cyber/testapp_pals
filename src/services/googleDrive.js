const DRIVE_FILE = 'check-student-data.json'
const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata'

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]')
    const script = existing || document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('Google sign-in could not load. Check your connection and try again.'))
    if (!existing) document.head.appendChild(script)
  })
}

export function preloadGoogleIdentity() {
  return loadGoogleIdentity()
}

export async function connectGoogle(clientId) {
  if (!clientId) throw new Error('Google sign-in needs VITE_GOOGLE_CLIENT_ID. See the setup steps in README.md.')
  const google = window.google?.accounts?.oauth2 ? window.google : await loadGoogleIdentity()
  const token = await new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => response.error ? reject(new Error(response.error_description || 'Google sign-in was not completed.')) : resolve(response.access_token),
      error_callback: () => reject(new Error('The Google sign-in window was closed.')),
    })
    client.requestAccessToken({ prompt: 'select_account' })
  })

  const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } })
  if (!userResponse.ok) throw new Error('Could not read the signed-in Google account.')
  const user = await userResponse.json()
  const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q: `name='${DRIVE_FILE}' and 'appDataFolder' in parents and trashed=false`, spaces: 'appDataFolder', fields: 'files(id,name)', pageSize: '1' })}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!listResponse.ok) throw new Error('Google Drive could not be opened. Check that Drive API is enabled for your project.')
  const { files = [] } = await listResponse.json()
  let data = null
  if (files[0]) {
    const dataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${files[0].id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })
    if (!dataResponse.ok) throw new Error('Could not load your Check data from Google Drive.')
    data = await dataResponse.json()
  }
  return { token, user, fileId: files[0]?.id || null, data }
}

export async function saveGoogleData(token, fileId, data) {
  const metadata = { name: DRIVE_FILE, mimeType: 'application/json', ...(fileId ? {} : { parents: ['appDataFolder'] }) }
  const body = new FormData()
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  body.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }), DRIVE_FILE)
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id'
  const response = await fetch(endpoint, { method: fileId ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${token}` }, body })
  if (!response.ok) throw new Error('Cloud sync failed. Sign in again to reconnect your Google Drive.')
  return (await response.json()).id
}

export async function revokeGoogleToken(token) {
  if (window.google?.accounts?.oauth2 && token) {
    await new Promise((resolve) => window.google.accounts.oauth2.revoke(token, resolve))
  }
}
