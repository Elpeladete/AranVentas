/**
 * Hook para detectar el estado de la conexión a internet
 * Incluye verificación real de conectividad, no solo si está conectado a red
 */

import { useState, useEffect, useCallback } from 'react'

interface NetworkStatus {
  isOnline: boolean
  isChecking: boolean
  lastChecked: Date | null
}

/**
 * Verifica si realmente hay conexión a internet haciendo una petición de prueba
 * ⚡ OPTIMIZADO: Retorna false inmediatamente si navigator.onLine es false
 */
async function checkRealConnectivity(): Promise<boolean> {
  // ⚡ Verificación instantánea: si el navegador dice offline, no hacer fetch
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false
  }

  try {
    // Usar un endpoint confiable y rápido para verificar conectividad
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
      signal: AbortSignal.timeout(3000)
    })
    return true
  } catch {
    try {
      // Backup: intentar con otro endpoint
      const response = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: AbortSignal.timeout(2000)
      })
      return true
    } catch {
      // ⚡ Si ambos fetch fallan pero navigator.onLine dice true,
      // confiar en el navegador en vez de marcar como offline
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        console.log('🌐 Fetch de verificación falló, pero navigator.onLine es true — confiando en el navegador')
        return true
      }
      return false
    }
  }
}

/**
 * Hook que monitorea el estado de la conexión a internet
 */
export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true, // Default to true on server
    isChecking: false,
    lastChecked: null
  })

  // Función para verificar conectividad real
  const checkConnectivity = useCallback(async () => {
    setNetworkStatus(prev => ({ ...prev, isChecking: true }))
    
    try {
      const isReallyOnline = await checkRealConnectivity()
      setNetworkStatus({
        isOnline: isReallyOnline,
        isChecking: false,
        lastChecked: new Date()
      })
      return isReallyOnline
    } catch {
      setNetworkStatus({
        isOnline: false,
        isChecking: false,
        lastChecked: new Date()
      })
      return false
    }
  }, [])

  // Efectos para monitorear cambios de conectividad
  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return

    // ⚡ Estado inicial rápido basado en navigator.onLine (no bloqueante)
    setNetworkStatus({
      isOnline: navigator.onLine,
      isChecking: navigator.onLine, // Solo marcar como "checking" si parece online
      lastChecked: new Date()
    })

    // Verificación real en background (no bloquea el render)
    if (navigator.onLine) {
      checkConnectivity()
    }

    // Listeners para eventos de red del navegador
    const handleOnline = () => {
      console.log('🌐 Navegador reporta: ONLINE')
      checkConnectivity()
    }

    const handleOffline = () => {
      console.log('🌐 Navegador reporta: OFFLINE')
      setNetworkStatus(prev => ({ 
        ...prev, 
        isOnline: false, 
        lastChecked: new Date() 
      }))
    }

    // Listener para cambio de visibilidad (cuando el usuario vuelve a la pestaña)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkConnectivity()
      }
    }

    // Agregar event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Verificar conectividad periódicamente (cada 30 segundos cuando está online)
    const interval = setInterval(() => {
      if (navigator.onLine) {
        checkConnectivity()
      }
    }, 30000)

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [checkConnectivity])

  return {
    ...networkStatus,
    checkConnectivity
  }
}

/**
 * Hook simplificado que solo retorna si está online o no
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetworkStatus()
  return isOnline
}