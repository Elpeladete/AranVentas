/**
 * Sistema de sincronización automática para formularios pendientes
 * Se ejecuta automáticamente cuando hay conexión a internet
 */

import { type FormData as AranFormData } from "@/hooks/use-form-data"
import { uploadImageToImgBB } from "./imgbb-upload"
import { submitFormToGoogle } from "./google-forms"
import { syncServiceOrderToOdoo } from "./odoo-service"
import { isOdooConfigured } from "./odoo-client"
import { 
  getPendingSubmissions, 
  getSubmissionsReadyForRetry, 
  updateSubmissionStatus,
  cleanupOldSubmissions,
  type PendingFormSubmission 
} from "./offline-storage"
import { getOrdersByNumber, updateOrder } from "./local-database"

export type SyncEventType = 'started' | 'progress' | 'completed' | 'error' | 'form-uploaded'

export interface SyncEvent {
  type: SyncEventType
  submissionId?: string
  processed?: number
  total?: number
  error?: string
  formData?: AranFormData
}

export type SyncEventListener = (event: SyncEvent) => void

/**
 * Clase principal para manejar la sincronización automática
 */
class OfflineSyncManager {
  private listeners: SyncEventListener[] = []
  private isRunning = false
  private syncInterval: NodeJS.Timeout | null = null

  /**
   * Agrega un listener para eventos de sincronización
   */
  addListener(listener: SyncEventListener): () => void {
    this.listeners.push(listener)
    
    // Retorna función para remover el listener
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Emite un evento a todos los listeners
   */
  private emit(event: SyncEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error en listener de sincronización:', error)
      }
    })
  }

  /**
   * Inicia la sincronización automática
   */
  startAutoSync(intervalMs: number = 60000): void {
    if (this.syncInterval) {
      this.stopAutoSync()
    }

    // Sincronización inmediata
    this.syncPendingSubmissions()

    // Configurar sincronización periódica
    this.syncInterval = setInterval(() => {
      this.syncPendingSubmissions()
    }, intervalMs)

    console.log(`🔄 Sincronización automática iniciada (cada ${intervalMs/1000}s)`)
  }

  /**
   * Detiene la sincronización automática
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('⏹️ Sincronización automática detenida')
    }
  }

  /**
   * Verifica si realmente hay conectividad antes de intentar sincronizar
   */
  private async checkRealConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return true
    } catch {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        
        const response = await fetch('https://httpbin.org/status/200', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        return true
      } catch {
        return false
      }
    }
  }

  /**
   * Ejecuta una sincronización manual
   */
  async syncPendingSubmissions(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Sincronización ya en progreso, omitiendo...')
      return
    }

    try {
      this.isRunning = true
      
      // PASO 0: Verificar conectividad REAL antes de intentar nada
      if (!navigator.onLine) {
        console.log('⚠️ Sin conexión (navigator.onLine = false), omitiendo sincronización')
        return
      }
      
      console.log('🔍 Verificando conectividad real...')
      const hasRealConnectivity = await this.checkRealConnectivity()
      
      if (!hasRealConnectivity) {
        console.log('⚠️ Sin conectividad real, omitiendo sincronización (se reintentará en 60s)')
        return
      }
      
      console.log('✅ Conectividad confirmada, procediendo con sincronización')
      
      // Limpiar formularios antiguos primero
      cleanupOldSubmissions()
      
      // Obtener formularios listos para reintento
      const readySubmissions = getSubmissionsReadyForRetry()
      
      if (readySubmissions.length === 0) {
        return // No hay nada que sincronizar
      }

      console.log(`🔄 Iniciando sincronización de ${readySubmissions.length} formularios`)
      this.emit({ 
        type: 'started', 
        total: readySubmissions.length,
        processed: 0
      })

      let processed = 0

      for (const submission of readySubmissions) {
        try {
          console.log(`📤 Procesando formulario: ${submission.id}`)
          
          // Marcar como en proceso
          updateSubmissionStatus(submission.id, 'uploading')
          
          // Procesar el formulario
          await this.processSubmission(submission)
          
          // Marcar como completado
          updateSubmissionStatus(submission.id, 'completed')
          
          processed++
          this.emit({
            type: 'form-uploaded',
            submissionId: submission.id,
            formData: submission.formData
          })

          this.emit({
            type: 'progress',
            processed,
            total: readySubmissions.length,
            submissionId: submission.id
          })

          console.log(`✅ Formulario enviado exitosamente: ${submission.id}`)
          
          // Pausa breve entre envíos para no saturar
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (error) {
          console.error(`❌ Error procesando formulario ${submission.id}:`, error)
          
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
          updateSubmissionStatus(submission.id, 'failed', errorMessage)
          
          this.emit({
            type: 'error',
            submissionId: submission.id,
            error: errorMessage
          })
        }
      }

      console.log(`✅ Sincronización completada: ${processed}/${readySubmissions.length} formularios`)
      this.emit({
        type: 'completed',
        processed,
        total: readySubmissions.length
      })

    } catch (error) {
      console.error('❌ Error en sincronización:', error)
      this.emit({
        type: 'error',
        error: error instanceof Error ? error.message : 'Error en sincronización'
      })
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Procesa un formulario individual: sube firmas e imágenes a ImgBB, luego envía a Google Forms
   */
  private async processSubmission(submission: PendingFormSubmission): Promise<void> {
    let processedFormData = { ...submission.formData }

    // PASO 1: Procesar imagen del formulario (aux1) si está en base64
    if (submission.formData.aux1?.startsWith('data:image')) {
      console.log(`🖼️ Subiendo imagen del formulario (${submission.id})`)
      try {
        const base64Data = submission.formData.aux1.split(',')[1]
        const result = await uploadImageToImgBB(
          base64Data,
          `orden-${submission.formData.numeroOrden}-${submission.id}`
        )
        processedFormData.aux1 = result.data.url
        console.log(`✅ Imagen del formulario subida: ${result.data.url}`)
      } catch (error) {
        console.warn(`⚠️ Error subiendo imagen del formulario:`, error)
        // Mantener base64 si falla la subida
        processedFormData.aux1 = "[Imagen del formulario - Error al subir]"
      }
    }

    // PASO 2: Procesar firma del técnico si está en base64
    if (submission.formData.tecnicoFirma?.startsWith('data:image')) {
      console.log(`🔄 Subiendo firma del técnico (${submission.id})`)
      try {
        const base64Data = submission.formData.tecnicoFirma.split(',')[1]
        const result = await uploadImageToImgBB(
          base64Data,
          `firma-tecnico-${submission.formData.numeroOrden}-${submission.id}`
        )
        processedFormData.tecnicoFirma = result.data.url
        console.log(`✅ Firma del técnico subida: ${result.data.url}`)
      } catch (error) {
        console.warn(`⚠️ Error subiendo firma del técnico:`, error)
        processedFormData.tecnicoFirma = "[Firma digital del técnico - Error al subir]"
      }
    }

    // PASO 3: Procesar firma del cliente si está en base64
    if (submission.formData.clienteFirma?.startsWith('data:image')) {
      console.log(`🔄 Subiendo firma del cliente (${submission.id})`)
      try {
        const base64Data = submission.formData.clienteFirma.split(',')[1]
        const result = await uploadImageToImgBB(
          base64Data,
          `firma-cliente-${submission.formData.numeroOrden}-${submission.id}`
        )
        processedFormData.clienteFirma = result.data.url
        console.log(`✅ Firma del cliente subida: ${result.data.url}`)
      } catch (error) {
        console.warn(`⚠️ Error subiendo firma del cliente:`, error)
        processedFormData.clienteFirma = "[Firma digital del cliente - Error al subir]"
      }
    }

    // PASO 4: Enviar a Google Forms con todas las URLs procesadas
    console.log(`📤 Enviando formulario a Google Forms (${submission.id})`)
    console.log(`📋 Datos procesados:`, {
      aux1: processedFormData.aux1?.substring(0, 50) + '...',
      tecnicoFirma: processedFormData.tecnicoFirma?.substring(0, 50) + '...',
      clienteFirma: processedFormData.clienteFirma?.substring(0, 50) + '...'
    })
    
    const result = await submitFormToGoogle(processedFormData)
    
    if (!result.success) {
      throw new Error(result.error || 'Error enviando a Google Forms')
    }
    
    console.log(`✅ Formulario enviado exitosamente a Google Forms (${submission.id})`)
    
    // PASO 5: Sincronizar con Odoo FSM (si está configurado)
    if (isOdooConfigured()) {
      console.log(`🔄 Sincronizando con Odoo FSM (${submission.id})`)
      try {
        const odooResult = await syncServiceOrderToOdoo(processedFormData)
        
        if (odooResult.success) {
          console.log(`✅ Orden sincronizada con Odoo FSM: ID ${odooResult.orderId}`)
        } else {
          console.warn(`⚠️ Error sincronizando con Odoo FSM:`, odooResult.error)
          // No fallar la sincronización completa si Odoo falla
        }
      } catch (odooError) {
        console.warn(`⚠️ Error en sincronización con Odoo:`, odooError)
        // No fallar la sincronización completa si Odoo falla
      }
    } else {
      console.log('ℹ️ Odoo no configurado, omitiendo sincronización FSM')
    }
    
    // PASO 6: Actualizar estado en BD local a 'sent'
    try {
      const orders = getOrdersByNumber(submission.formData.numeroOrden || '')
      const pendingOrder = orders.find(order => order.status === 'pending-offline')
      
      if (pendingOrder) {
        updateOrder(pendingOrder.id, {
          status: 'sent',
          googleFormsSent: true,
          sentAt: new Date(),
          imageUrl: processedFormData.aux1 // URL final de ImgBB
        })
        console.log(`🗃️ BD Local actualizada: ${pendingOrder.id} -> sent`)
      }
    } catch (dbError) {
      console.warn('⚠️ Error actualizando BD local después del envío:', dbError)
      // No es crítico, el envío ya fue exitoso
    }
  }

  /**
   * Verifica si hay formularios pendientes
   */
  hasPendingSubmissions(): boolean {
    const pending = getPendingSubmissions()
    return pending.length > 0
  }

  /**
   * Obtiene el estado actual de la sincronización
   */
  getStatus(): {
    isRunning: boolean
    hasPending: boolean
    autoSyncEnabled: boolean
  } {
    return {
      isRunning: this.isRunning,
      hasPending: this.hasPendingSubmissions(),
      autoSyncEnabled: this.syncInterval !== null
    }
  }
}

// Instancia singleton del manager
export const syncManager = new OfflineSyncManager()

/**
 * Hook para usar el sistema de sincronización en componentes React
 */
export function useSyncManager() {
  return {
    syncManager,
    startAutoSync: (interval?: number) => syncManager.startAutoSync(interval),
    stopAutoSync: () => syncManager.stopAutoSync(),
    syncNow: () => syncManager.syncPendingSubmissions(),
    addListener: (listener: SyncEventListener) => syncManager.addListener(listener),
    getStatus: () => syncManager.getStatus(),
    hasPending: () => syncManager.hasPendingSubmissions()
  }
}

/**
 * Función utilitaria para inicializar la sincronización automática
 * Se debe llamar una vez al cargar la aplicación
 */
export function initializeOfflineSync(): void {
  // Verificar si hay formularios pendientes al iniciar
  const pendingCount = getPendingSubmissions().length
  if (pendingCount > 0) {
    console.log(`📋 Se encontraron ${pendingCount} formularios pendientes`)
  }

  // Iniciar sincronización automática cada minuto
  syncManager.startAutoSync(60000)
  
  console.log('🚀 Sistema de sincronización offline inicializado')
}