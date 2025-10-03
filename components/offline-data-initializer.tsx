"use client"

import { useEffect } from 'react'
import { offlineDataManager } from '@/lib/offline-data-manager'

/**
 * Componente que inicializa el sistema de datos offline
 * Se ejecuta automáticamente al cargar la aplicación
 */
export function OfflineDataInitializer() {
  useEffect(() => {
    // Inicializar el gestor de datos offline
    offlineDataManager.initialize()
      .then(() => {
        console.log('✅ Sistema offline inicializado correctamente')
      })
      .catch((error) => {
        console.error('❌ Error inicializando sistema offline:', error)
      })
  }, [])

  // Este componente no renderiza nada visible
  return null
}