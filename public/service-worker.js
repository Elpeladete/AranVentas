// Service Worker para PWA de ARAN Tecnologías - VERSIÓN MEJORADA OFFLINE
const CACHE_NAME = 'aran-services-v1.5.0'
const OFFLINE_URL = '/'

// Archivos críticos a cachear en la instalación
const STATIC_CACHE = [
  '/',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
  '/images/orden-servicio-aran.png', // ⭐ IMPORTANTE: Imagen de fondo para formularios
  '/site.webmanifest',
]

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker: Instalando v1.3.0...')
  console.log('ℹ️ NOTA: IndexedDB (órdenes guardadas) NO se afectará')
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Cacheando archivos críticos...')
      return cache.addAll(STATIC_CACHE).catch((error) => {
        console.error('❌ Error cacheando archivos:', error)
        return Promise.resolve()
      })
    })
  )
  
  // Activar inmediatamente para evitar servir chunks desactualizados
  self.skipWaiting()
})

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activado v1.3.0')
  console.log('📦 Limpiando cachés antiguos (manteniendo IndexedDB intacto)')
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Eliminando cache antiguo:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  
  // Tomar control inmediatamente de todas las páginas
  return self.clients.claim()
})

// Intercepción de peticiones - ESTRATEGIA CORREGIDA
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Solo cachear peticiones GET
  if (request.method !== 'GET') return
  
  // ❌ NO cachear APIs externas (estas necesitan conexión)
  if (
    url.hostname.includes('api.imgbb.com') ||
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('vercel-insights') ||
    url.hostname.includes('wazzup24.com') ||
    url.hostname.includes('va.vercel-scripts.com') ||
    url.pathname.startsWith('/api/odoo')
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Sin conexión', offline: true }), 
          { 
            status: 503, 
            headers: { 'Content-Type': 'application/json' } 
          }
        )
      })
    )
    return
  }
  
  // ──────────────────────────────────────────────────────────
  // NAVEGACIÓN (HTML) → Network First con fallback a caché
  // Esto asegura que siempre se cargue el HTML más reciente
  // con las referencias correctas a los chunks del último deploy
  // ──────────────────────────────────────────────────────────
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
          }
          return response
        })
        .catch(() => {
          console.log('📱 Modo offline: Sirviendo HTML desde caché')
          return caches.match(OFFLINE_URL).then((cached) => {
            if (cached) return cached
            return new Response(
              '<!DOCTYPE html><html><head><title>ARAN - Offline</title></head><body><h1>Aplicación no disponible offline</h1><p>Conecte a internet y recargue la página.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            )
          })
        })
    )
    return
  }
  
  // ──────────────────────────────────────────────────────────
  // ASSETS /_next/static/ → Cache First (son inmutables por hash)
  // Si no están en caché, descargar y cachear
  // ──────────────────────────────────────────────────────────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse
        
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
          }
          return response
        })
      })
    )
    return
  }
  
  // ──────────────────────────────────────────────────────────
  // OTROS RECURSOS (imágenes, fuentes, etc.) → Stale While Revalidate
  // Servir de caché inmediatamente, pero actualizar en segundo plano
  // ──────────────────────────────────────────────────────────
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              if (
                url.pathname.startsWith('/images/') ||
                url.pathname.endsWith('.js') ||
                url.pathname.endsWith('.css') ||
                url.pathname.endsWith('.png') ||
                url.pathname.endsWith('.svg') ||
                url.pathname.endsWith('.jpg') ||
                url.pathname.endsWith('.webp') ||
                url.pathname.endsWith('.woff') ||
                url.pathname.endsWith('.woff2') ||
                url.pathname.endsWith('.ttf') ||
                url.pathname.endsWith('.ico') ||
                url.pathname.endsWith('.webmanifest') ||
                url.hostname.includes('fonts.googleapis.com') ||
                url.hostname.includes('fonts.gstatic.com')
              ) {
                cache.put(request, responseToCache)
              }
            })
          }
          return response
        })
        .catch(() => cachedResponse || new Response('', { status: 503 }))
      
      return cachedResponse || fetchPromise
    })
  )
})

// Mensajes desde el cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls).catch((error) => {
          console.warn('⚠️ Error cacheando URLs bajo demanda:', error)
        })
      })
    )
  }
  
  if (event.data && event.data.type === 'CLEAR_NEXT_CACHE') {
    // Limpiar chunks viejos de /_next/ cuando hay un nuevo deploy
    console.log('🧹 Limpiando chunks viejos de /_next/...')
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedRequests = await cache.keys()
        let removed = 0
        for (const req of cachedRequests) {
          const pathname = new URL(req.url).pathname
          if (pathname.startsWith('/_next/')) {
            await cache.delete(req)
            removed++
          }
        }
        console.log(`🧹 ${removed} chunks viejos eliminados`)
      })
    )
  }
  
  if (event.data && event.data.type === 'PRECACHE_APP') {
    console.log('📦 Pre-cacheando recursos de la app para uso offline...')
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const cachedRequests = await cache.keys()
          const cachedUrls = cachedRequests.map(r => new URL(r.url).pathname)
          
          if (!cachedUrls.includes('/')) {
            const response = await fetch('/')
            if (response.ok) {
              await cache.put('/', response)
              console.log('✅ Página principal cacheada para offline')
            }
          }
          
          console.log(`📦 Total de recursos en caché: ${cachedUrls.length}`)
        } catch (error) {
          console.warn('⚠️ Error durante pre-cache:', error)
        }
      })
    )
  }
})
