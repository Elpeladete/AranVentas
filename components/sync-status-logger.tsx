'use client'

/**
 * Componente que registra automáticamente el estado de sincronización en consola
 * Para debugging y monitoreo del sistema offline
 */

import { useEffect } from 'react'
import { useSyncManager } from '@/lib/offline-sync'
import { getPendingStats } from '@/lib/offline-storage'
import { useNetworkStatus } from '@/hooks/use-network-status'

export function SyncStatusLogger() {
  const { addListener } = useSyncManager()
  const networkStatus = useNetworkStatus()

  useEffect(() => {
    // Log inicial del estado
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🚀 SISTEMA DE SINCRONIZACIÓN OFFLINE INICIADO')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const stats = getPendingStats()
    console.log('📊 Estado inicial:')
    console.log(`   📋 Formularios pendientes: ${stats.total}`)
    console.log(`   ⏳ Pendientes: ${stats.pending}`)
    console.log(`   📤 Subiendo: ${stats.uploading}`)
    console.log(`   ❌ Fallidos: ${stats.failed}`)
    
    if (stats.oldestPending) {
      const age = Math.floor((Date.now() - stats.oldestPending.getTime()) / 60000)
      console.log(`   🕐 Más antiguo: ${age} minutos`)
    }
    
    console.log(`   🌐 Red: ${networkStatus.isOnline ? 'ONLINE ✅' : 'OFFLINE ⚠️'}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Listener para eventos de sincronización
    const removeListener = addListener((event) => {
      switch (event.type) {
        case 'started':
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('🔄 SINCRONIZACIÓN INICIADA')
          console.log(`   📋 Total a sincronizar: ${event.total}`)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          break

        case 'progress':
          console.log(`📤 Progreso: ${event.processed}/${event.total} formularios`)
          break

        case 'form-uploaded':
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('✅ FORMULARIO SINCRONIZADO EXITOSAMENTE')
          console.log(`   📋 Orden: ${event.formData?.numeroOrden}`)
          console.log(`   🆔 ID: ${event.submissionId}`)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          break

        case 'completed':
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('🎉 SINCRONIZACIÓN COMPLETADA')
          console.log(`   ✅ Exitosos: ${event.processed}/${event.total}`)
          console.log(`   ❌ Fallidos: ${(event.total || 0) - (event.processed || 0)}`)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          
          // Mostrar estado actualizado
          const newStats = getPendingStats()
          if (newStats.total > 0) {
            console.log('📊 Formularios restantes:')
            console.log(`   📋 Total: ${newStats.total}`)
            console.log(`   ⏳ Pendientes: ${newStats.pending}`)
            console.log(`   ❌ Fallidos: ${newStats.failed}`)
          }
          break

        case 'error':
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('❌ ERROR EN SINCRONIZACIÓN')
          console.log(`   🆔 ID: ${event.submissionId || 'General'}`)
          console.log(`   ⚠️ Error: ${event.error}`)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          break
      }
    })

    // Log periódico del estado (cada 5 minutos)
    const statusInterval = setInterval(() => {
      const currentStats = getPendingStats()
      
      if (currentStats.total > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📊 ESTADO ACTUAL DEL SISTEMA')
        console.log(`   📋 Formularios pendientes: ${currentStats.total}`)
        console.log(`   ⏳ Pendientes: ${currentStats.pending}`)
        console.log(`   📤 Subiendo: ${currentStats.uploading}`)
        console.log(`   ❌ Fallidos: ${currentStats.failed}`)
        
        if (currentStats.oldestPending) {
          const age = Math.floor((Date.now() - currentStats.oldestPending.getTime()) / 60000)
          console.log(`   🕐 Más antiguo: ${age} minutos`)
        }
        
        console.log(`   🌐 Red: ${networkStatus.isOnline ? 'ONLINE ✅' : 'OFFLINE ⚠️'}`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      }
    }, 5 * 60 * 1000) // 5 minutos

    return () => {
      removeListener()
      clearInterval(statusInterval)
    }
  }, [addListener, networkStatus.isOnline])

  // Log cuando cambia el estado de red
  useEffect(() => {
    console.log(`🌐 Estado de red cambió: ${networkStatus.isOnline ? 'ONLINE ✅' : 'OFFLINE ⚠️'}`)
    
    if (networkStatus.isOnline) {
      const stats = getPendingStats()
      if (stats.total > 0) {
        console.log(`   📋 Hay ${stats.total} formularios pendientes de sincronización`)
        console.log(`   ⏳ La sincronización automática intentará enviarlos en breve...`)
      }
    }
  }, [networkStatus.isOnline])

  return null // Este componente no renderiza nada
}
