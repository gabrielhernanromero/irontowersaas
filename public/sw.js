// Iron Tower OS — Service Worker
// Estrategias: cache-first (estáticos), stale-while-revalidate (páginas), network-first (API)

const STATIC_CACHE  = 'it-static-v3'
const PAGES_CACHE   = 'it-pages-v3'
const API_CACHE     = 'it-api-v3'
const KNOWN_CACHES  = [STATIC_CACHE, PAGES_CACHE, API_CACHE]

// URLs de páginas a pre-cachear en install
const PRECACHE_PAGES = [
  '/tecnico/home',
  '/tecnico/libro-guardia',
  '/tecnico/ronda',
  '/tecnico/elementos',
]

// Patrones de assets estáticos (Next.js los hashea → nunca cambian)
const STATIC_RE = /^\/_next\/static\//

// Mensaje desde el cliente para forzar activación de nueva versión
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // No hacer skipWaiting automático — el usuario decide cuándo actualizar (PWAUpdatePrompt)
  event.waitUntil(
    caches.open(PAGES_CACHE)
      .then(cache => Promise.allSettled(PRECACHE_PAGES.map(url => cache.add(url))))
  )
})

// ── Activate — purga caches viejos ──────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !KNOWN_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  )
})

// ── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo interceptar mismo origen
  if (url.origin !== self.location.origin) return

  // No cachear mutaciones ni rutas de auth
  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/api/auth/')) return
  if (url.pathname.startsWith('/_next/webpack-hmr')) return

  // Assets estáticos: cache-first (hashed filenames → eternamente válidos)
  if (STATIC_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Fuentes e ícono
  if (/\.(woff2?|ttf|otf|ico)$/.test(url.pathname) || url.pathname === '/icon') {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // API GETs: network-first con fallback a caché (máx 60 s)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstAPI(request))
    return
  }

  // Páginas HTML: stale-while-revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }
})

// ── Background Sync ──────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(notifyClientsToSync())
  }
})

// ── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data    = event.data?.json() ?? {}
  const title   = data.title ?? 'Iron Tower'
  const options = {
    body:    data.body    ?? '',
    icon:    '/icon',
    badge:   '/icon',
    vibrate: [200, 100, 200],
    data:    { url: data.url ?? '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes(self.location.origin) && 'focus' in w) {
          w.navigate(url)
          return w.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

// ── Estrategias de caché ─────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Not found', { status: 404 })
  }
}

async function networkFirstAPI(request) {
  const MAX_AGE_MS = 60_000 // 60 s
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(API_CACHE)
      // Guardar con timestamp para expiración
      const headers = new Headers(response.headers)
      headers.set('x-sw-cached-at', String(Date.now()))
      const body = await response.arrayBuffer()
      cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }))
      // Devolver una response fresca (el original ya fue consumido)
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('x-sw-cached-at') ?? '0', 10)
      if (Date.now() - cachedAt < MAX_AGE_MS) return cached
    }
    return new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
      status:  503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(PAGES_CACHE)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request)
    .then(res => { if (res.ok) cache.put(request, res.clone()); return res })
    .catch(() => null)

  return cached ?? (await fetchPromise) ?? offlinePage()
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function offlinePage() {
  return new Response(
    `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión — Iron Tower</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f9fafb;color:#1a1a2e;padding:24px}
  .card{background:#fff;border-radius:20px;padding:40px 24px;text-align:center;max-width:320px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .icon{font-size:52px;margin-bottom:16px}
  h1{font-size:1.4rem;font-weight:800;margin-bottom:8px}
  p{color:#6b7280;font-size:.9rem;line-height:1.5;margin-bottom:24px}
  button{background:#E8721C;color:#fff;border:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:1rem;cursor:pointer;width:100%}
</style>
</head>
<body>
<div class="card">
  <div class="icon">📡</div>
  <h1>Sin conexión</h1>
  <p>Verificá tu conexión a internet.<br>Los datos guardados offline se enviarán automáticamente al reconectarse.</p>
  <button onclick="location.reload()">Reintentar</button>
</div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

async function notifyClientsToSync() {
  const wins = await clients.matchAll({ type: 'window' })
  for (const w of wins) w.postMessage({ type: 'SYNC_QUEUE' })
}
