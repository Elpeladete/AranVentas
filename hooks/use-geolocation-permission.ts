/**
 * Hook para gestionar permisos de geolocalización con verificación diaria
 */

"use client"

import { useState, useEffect, useCallback } from 'react'

const PERMISSION_CHECK_KEY = 'aran-geolocation-last-check'
const PERMISSION_STATUS_KEY = 'aran-geolocation-status'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 horas

interface GeolocationPermissionState {
  status: 'prompt' | 'granted' | 'denied' | 'unknown'
  lastChecked: Date | null
  isChecking: boolean
  needsRecheck: boolean
}

export function useGeolocationPermission() {
  const [permissionState, setPermissionState] = useState<GeolocationPermissionState>({
    status: 'unknown',
    lastChecked: null,
    isChecking: false,
    needsRecheck: false
  })

  /**
   * Verifica si los permisos fueron revisados en las últimas 24 horas
   */
  const shouldCheckPermissions = useCallback((): boolean => {
    const lastCheckStr = localStorage.getItem(PERMISSION_CHECK_KEY)
    
    if (!lastCheckStr) {
      return true // Primera vez, necesita verificar
    }

    const lastCheck = new Date(lastCheckStr)
    const timeSinceCheck = Date.now() - lastCheck.getTime()
    
    return timeSinceCheck >= CHECK_INTERVAL_MS
  }, [])

  /**
   * Verifica el estado actual de los permisos de geolocalización
   */
  const checkPermissionStatus = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    try {
      // Usar la API de Permissions si está disponible
      if ('permissions' in navigator && 'query' in navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
        return result.state as 'granted' | 'denied' | 'prompt'
      }
      
      // Fallback: intentar obtener la ubicación con timeout muy corto
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve('denied')
          return
        }

        const timeoutId = setTimeout(() => {
          resolve('prompt')
        }, 100)

        navigator.geolocation.getCurrentPosition(
          () => {
            clearTimeout(timeoutId)
            resolve('granted')
          },
          (error) => {
            clearTimeout(timeoutId)
            resolve(error.code === 1 ? 'denied' : 'prompt')
          },
          { timeout: 100, maximumAge: Infinity }
        )
      })
    } catch (error) {
      console.error('Error verificando permisos de geolocalización:', error)
      return 'unknown' as any
    }
  }, [])

  /**
   * Solicita permisos de geolocalización al usuario
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      console.error('❌ Geolocalización no soportada en este dispositivo')
      return false
    }

    setPermissionState(prev => ({ ...prev, isChecking: true }))

    try {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ Permiso de geolocalización concedido')
            const now = new Date()
            
            // Guardar estado
            localStorage.setItem(PERMISSION_CHECK_KEY, now.toISOString())
            localStorage.setItem(PERMISSION_STATUS_KEY, 'granted')
            
            setPermissionState({
              status: 'granted',
              lastChecked: now,
              isChecking: false,
              needsRecheck: false
            })
            
            resolve(true)
          },
          (error) => {
            console.error('❌ Permiso de geolocalización denegado:', error.message)
            const now = new Date()
            const status = error.code === 1 ? 'denied' : 'prompt'
            
            // Guardar estado
            localStorage.setItem(PERMISSION_CHECK_KEY, now.toISOString())
            localStorage.setItem(PERMISSION_STATUS_KEY, status)
            
            setPermissionState({
              status,
              lastChecked: now,
              isChecking: false,
              needsRecheck: false
            })
            
            resolve(false)
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 0
          }
        )
      })
    } catch (error) {
      console.error('Error solicitando permisos:', error)
      setPermissionState(prev => ({ ...prev, isChecking: false }))
      return false
    }
  }, [])

  /**
   * Verifica permisos diariamente
   */
  const checkPermissions = useCallback(async () => {
    if (!shouldCheckPermissions()) {
      // Cargar estado guardado
      const savedStatus = localStorage.getItem(PERMISSION_STATUS_KEY) as any
      const lastCheckStr = localStorage.getItem(PERMISSION_CHECK_KEY)
      
      setPermissionState({
        status: savedStatus || 'unknown',
        lastChecked: lastCheckStr ? new Date(lastCheckStr) : null,
        isChecking: false,
        needsRecheck: false
      })
      
      console.log('⏭️ Verificación de permisos no necesaria (última verificación hace menos de 24h)')
      return
    }

    console.log('🔍 Verificando permisos de geolocalización...')
    setPermissionState(prev => ({ ...prev, isChecking: true }))

    const status = await checkPermissionStatus()
    const now = new Date()

    // Guardar el resultado
    localStorage.setItem(PERMISSION_CHECK_KEY, now.toISOString())
    localStorage.setItem(PERMISSION_STATUS_KEY, status)

    setPermissionState({
      status,
      lastChecked: now,
      isChecking: false,
      needsRecheck: status === 'prompt' || status === 'denied'
    })

    if (status === 'granted') {
      console.log('✅ Permisos de geolocalización activos')
    } else if (status === 'denied') {
      console.warn('⚠️ Permisos de geolocalización denegados')
    } else {
      console.log('❓ Permisos de geolocalización pendientes')
    }
  }, [shouldCheckPermissions, checkPermissionStatus])

  /**
   * Reinicia el temporizador de verificación (forzar nueva verificación en 24h)
   */
  const resetCheckTimer = useCallback(() => {
    localStorage.removeItem(PERMISSION_CHECK_KEY)
    setPermissionState(prev => ({ ...prev, needsRecheck: true }))
  }, [])

  // Verificar permisos al montar el componente
  useEffect(() => {
    checkPermissions()

    // Escuchar cambios en el estado de visibilidad para re-verificar cuando la app vuelve al foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldCheckPermissions()) {
        checkPermissions()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkPermissions, shouldCheckPermissions])

  return {
    ...permissionState,
    requestPermission,
    checkPermissions,
    resetCheckTimer,
    hasPermission: permissionState.status === 'granted',
    isPermissionDenied: permissionState.status === 'denied',
    shouldRequestPermission: permissionState.status === 'prompt' || permissionState.needsRecheck
  }
}
