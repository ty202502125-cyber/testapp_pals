const CACHE = 'check-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.json', '/icons/check.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && (request.destination === 'script' || request.destination === 'style' || request.destination === 'document')) {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  }).catch(async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') return caches.match('/index.html')
    return Response.error()
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const appClient = clients.find((client) => 'focus' in client)
    return appClient ? appClient.focus() : self.clients.openWindow('/')
  }))
})
