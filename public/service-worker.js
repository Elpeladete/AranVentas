// Service Worker para PWA de ARAN Tecnologías
const CACHE_NAME = 'aran-services-v1.0.0'
const OFFLINE_URL = '/'

// Archivos a cachear en la instalación
const STATIC_CACHE = [
  '/',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
]

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker: Instalando...')
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Archivos estáticos cacheados')
      return cache.addAll(STATIC_CACHE)
    })
  )
  
  // Activar inmediatamente
  self.skipWaiting()
})

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activado')
  
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
  
  // Tomar control inmediatamente
  return self.clients.claim()
})

// Intercepción de peticiones
self.addEventListener('fetch', (event) => {
  // Solo cachear peticiones GET
  if (event.request.method !== 'GET') return
  
  // No cachear peticiones a APIs externas
  if (
    event.request.url.includes('api.imgbb.com') ||
    event.request.url.includes('docs.google.com') ||
    event.request.url.includes('vercel')
  ) {
    return
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retornar del cache si existe
      if (response) {
        return response
      }
      
      // Sino, hacer fetch y cachear la respuesta
      return fetch(event.request).then((response) => {
        // No cachear respuestas inválidas
        if (!response || response.status !== 200 || response.type === 'error') {
          return response
        }
        
        // Clonar la respuesta
        const responseToCache = response.clone()
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })
        
        return response
      })
    }).catch(() => {
      // Si no hay red, retornar página offline
      return caches.match(OFFLINE_URL)
    })
  )
})

// Mensajes desde el cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
