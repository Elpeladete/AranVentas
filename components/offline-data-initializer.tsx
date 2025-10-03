"use client"

import { useEffect, useState } from 'react'
import { offlineDataManager } from '@/lib/offline-data-manager'

/**
 * Componente que inicializa el sistema de datos offline
 * Se ejecuta automáticamente al cargar la aplicación
 */
export function OfflineDataInitializer() {
  const [isClient, setIsClient] = useState(false)

  // Verificar que estamos en el cliente
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Inicializar el gestor de datos offline (solo en cliente)
  useEffect(() => {
    if (!isClient) return

    // Inicializar el gestor de datos offline
    offlineDataManager.initialize()
      .then(() => {
        console.log('✅ Sistema offline inicializado correctamente')
      })
      .catch((error) => {
        console.error('❌ Error inicializando sistema offline:', error)
      })
  }, [isClient])

  // Este componente no renderiza nada visible
  return null
}