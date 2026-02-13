// Service Worker para PWA de ARAN Tecnologías - VERSIÓN MEJORADA OFFLINE
const CACHE_NAME = 'aran-services-v1.2.2'
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
  console.log('📦 Service Worker: Instalando v1.2.2...')
  console.log('ℹ️ NOTA: IndexedDB (órdenes guardadas) NO se afectará')
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Cacheando archivos críticos...')
      return cache.addAll(STATIC_CACHE).catch((error) => {
        console.error('❌ Error cacheando archivos:', error)
        // No fallar la instalación si algún archivo no se puede cachear
        return Promise.resolve()
      })
    })
  )
  
  // NO activar inmediatamente si hay una actualización
  // Esperar a que el usuario cierre todas las pestañas o haga clic en "Actualizar"
  // Comentado: self.skipWaiting()
  console.log('⏸️ Service Worker instalado, esperando activación manual')
})

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activado v1.2.2')
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

// Intercepción de peticiones - ESTRATEGIA MEJORADA
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
    // Para APIs, intentar fetch directo sin caché
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
  
  // ✅ Para el resto de recursos (HTML, JS, CSS, imágenes)
  // Estrategia: Cache First con Network Fallback
  // ⚡ Para /_next/ assets: SIEMPRE cachear agresivamente (son versionados por hash)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Para assets de Next.js (/_next/), servir desde caché directamente
        // Son inmutables por su hash en el nombre
        if (url.pathname.startsWith('/_next/')) {
          return cachedResponse
        }
        
        console.log('✅ Sirviendo desde caché:', url.pathname)
        return cachedResponse
      }
      
      // Si no está en caché, intentar descargar
      return fetch(request)
        .then((response) => {
          // No cachear respuestas inválidas
          if (!response || response.status !== 200 || response.type === 'error') {
            return response
          }
          
          // Clonar la respuesta para cachearla
          const responseToCache = response.clone()
          
          caches.open(CACHE_NAME).then((cache) => {
            // ⭐ Cachear AGRESIVAMENTE todo lo necesario para funcionar offline
            if (
              url.pathname.startsWith('/_next/') ||       // JS, CSS de Next.js (versionados)
              url.pathname.startsWith('/images/') ||       // Imágenes locales
              url.pathname.endsWith('.js') ||
              url.pathname.endsWith('.css') ||
              url.pathname.endsWith('.png') ||
              url.pathname.endsWith('.svg') ||
              url.pathname.endsWith('.jpg') ||
              url.pathname.endsWith('.webp') ||
              url.pathname.endsWith('.woff') ||            // Fuentes
              url.pathname.endsWith('.woff2') ||           // Fuentes
              url.pathname.endsWith('.ttf') ||             // Fuentes
              url.hostname.includes('fonts.googleapis.com') || // Google Fonts CSS
              url.hostname.includes('fonts.gstatic.com')   // Google Fonts archivos
            ) {
              cache.put(request, responseToCache)
            }
          })
          
          return response
        })
        .catch((error) => {
          console.error('❌ Error en fetch, intentando caché:', error)
          
          // Si es navegación (HTML), retornar la página principal desde caché
          if (request.mode === 'navigate' || request.destination === 'document') {
            return caches.match(OFFLINE_URL).then((response) => {
              if (response) {
                console.log('📱 Modo offline: Sirviendo app desde caché')
                return response
              }
              // Si ni siquiera tenemos la página principal cacheada
              return new Response(
                '<!DOCTYPE html><html><head><title>ARAN - Offline</title></head><body><h1>Aplicación no disponible offline</h1><p>Conecte a internet y recargue la página.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              )
            })
          }
          
          // Para otros recursos, intentar desde caché como último recurso
          return caches.match(request)
        })
    })
  )
})

// Mensajes desde el cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    // Permitir cachear URLs específicas bajo demanda
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls).catch((error) => {
          console.warn('⚠️ Error cacheando URLs bajo demanda:', error)
        })
      })
    )
  }
  
  if (event.data && event.data.type === 'PRECACHE_APP') {
    // ⭐ Pre-cachear TODA la app después del primer load exitoso
    console.log('📦 Pre-cacheando recursos de la app para uso offline...')
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          // Obtener todas las URLs ya cacheadas
          const cachedRequests = await cache.keys()
          const cachedUrls = cachedRequests.map(r => new URL(r.url).pathname)
          
          // Los assets de /_next/ se cachean automáticamente en el fetch handler
          // Aquí nos aseguramos de que la página principal esté actualizada
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
