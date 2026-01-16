"use client"

import { useState, useEffect } from 'react'
import { getBuildInfo } from '@/lib/build-info'

const UPDATE_CHECK_KEY = 'aran-last-update-check'
const UPDATE_AVAILABLE_KEY = 'aran-update-available'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 horas

interface UpdateStatus {
  isChecking: boolean
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string | null
  lastChecked: Date | null
  error: string | null
}

export function useUpdateChecker() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    isChecking: false,
    updateAvailable: false,
    currentVersion: getBuildInfo().buildId,
    latestVersion: null,
    lastChecked: null,
    error: null
  })

  const checkForUpdates = async (force: boolean = false) => {
    try {
      // Verificar si ya se revisó recientemente
      const lastCheckStr = localStorage.getItem(UPDATE_CHECK_KEY)
      const lastCheck = lastCheckStr ? new Date(lastCheckStr) : null
      
      if (!force && lastCheck) {
        const timeSinceLastCheck = Date.now() - lastCheck.getTime()
        if (timeSinceLastCheck < CHECK_INTERVAL_MS) {
          console.log('⏭️ Saltando verificación de actualización (ya se revisó hace menos de 24h)')
          
          // Cargar estado guardado si existe
          const savedUpdate = localStorage.getItem(UPDATE_AVAILABLE_KEY)
          if (savedUpdate) {
            const updateData = JSON.parse(savedUpdate)
            setUpdateStatus(prev => ({
              ...prev,
              updateAvailable: updateData.available,
              latestVersion: updateData.latestVersion,
              lastChecked: lastCheck
            }))
          }
          return
        }
      }

      console.log('🔍 Verificando actualizaciones de la aplicación...')
      setUpdateStatus(prev => ({ ...prev, isChecking: true, error: null }))

      const currentBuildInfo = getBuildInfo()
      const currentBuildId = currentBuildInfo.buildId
      
      console.log('📦 Versión actual:', currentBuildId)

      // Consultar el servidor por la versión más reciente
      const response = await fetch('/api/version', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error('Error al obtener versión del servidor')
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Error desconocido')
      }

      const serverBuildId = data.buildInfo.buildId
      console.log('🌐 Versión en servidor:', serverBuildId)

      const updateAvailable = currentBuildId !== serverBuildId
      
      if (updateAvailable) {
        console.log('✨ ¡Actualización disponible!')
        console.log('   Actual:', currentBuildId)
        console.log('   Nueva:', serverBuildId)
      } else {
        console.log('✅ La aplicación está actualizada')
      }

      // Guardar el resultado
      const now = new Date()
      localStorage.setItem(UPDATE_CHECK_KEY, now.toISOString())
      localStorage.setItem(UPDATE_AVAILABLE_KEY, JSON.stringify({
        available: updateAvailable,
        latestVersion: serverBuildId,
        checkedAt: now.toISOString()
      }))

      setUpdateStatus({
        isChecking: false,
        updateAvailable,
        currentVersion: currentBuildId,
        latestVersion: serverBuildId,
        lastChecked: now,
        error: null
      })

    } catch (error) {
      console.error('❌ Error verificando actualizaciones:', error)
      setUpdateStatus(prev => ({
        ...prev,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }))
    }
  }

  const reloadApp = () => {
    console.log('🔄 Recargando aplicación...')
    // Limpiar caché y recargar
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister()
        })
      })
    }
    
    // Limpiar el flag de actualización
    localStorage.removeItem(UPDATE_AVAILABLE_KEY)
    
    // Recargar forzando limpieza de caché
    window.location.reload()
  }

  const dismissUpdate = () => {
    console.log('⏭️ Usuario descartó la actualización')
    localStorage.removeItem(UPDATE_AVAILABLE_KEY)
    setUpdateStatus(prev => ({
      ...prev,
      updateAvailable: false
    }))
  }

  // Verificar automáticamente al montar
  useEffect(() => {
    checkForUpdates()
  }, [])

  return {
    ...updateStatus,
    checkForUpdates,
    reloadApp,
    dismissUpdate
  }
}
