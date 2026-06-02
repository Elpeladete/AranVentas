'use client'

/**
 * Componente que registra el Service Worker para funcionalidad PWA
 * Maneja actualizaciones preservando datos de IndexedDB
 */

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // En desarrollo: desregistrar SW y limpiar caches para evitar servir versiones viejas con HMR
      if (process.env.NODE_ENV !== 'production') {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister())
        })
        if ('caches' in window) {
          caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
        }
        return
      }

      // Registrar el Service Worker
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker registrado:', registration.scope)
          console.log('📦 IndexedDB (órdenes) está protegido y NO se borrará')
          
          // ⭐ Pre-cachear todos los assets después del primer load exitoso
          // Esto asegura que la app funcione completamente offline
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_APP' })
          } else {
            // Si es la primera vez, esperar a que el SW tome control
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_APP' })
              }
            }, { once: true })
          }
          
          // Verificar actualizaciones cada hora
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // 1 hora
          
          // Detectar cuando hay una nueva versión instalada
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              console.log('🔄 Nueva versión del Service Worker detectada')
              
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('✨ Nueva versión lista para activar')
                  console.log('ℹ️ Los datos locales (órdenes) se mantendrán intactos')
                  
                  // NO mostrar confirm aquí, el componente UpdateNotification lo manejará
                  // Solo notificar que hay actualización disponible
                  window.dispatchEvent(new CustomEvent('sw-update-available'))
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('❌ Error registrando Service Worker:', error)
        })

      // Escuchar cambios en el Service Worker
      // Esto se dispara cuando se activa un nuevo SW (después de SKIP_WAITING)
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          console.log('🔄 Nuevo Service Worker tomó control, recargando...')
          console.log('✅ Datos de órdenes (IndexedDB) preservados')
          refreshing = true
          window.location.reload()
        }
      })
    }
  }, [])

  return null // Este componente no renderiza nada
}
