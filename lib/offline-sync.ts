/**
 * Sistema de sincronización automática para formularios pendientes
 * Se ejecuta automáticamente cuando hay conexión a internet
 */

import { type FormData as AranFormData } from "@/hooks/use-form-data"
import { uploadImageToImgBB } from "./imgbb-upload"
import { submitFormToGoogle } from "./google-forms"
import { 
  getPendingSubmissions, 
  getSubmissionsReadyForRetry, 
  updateSubmissionStatus,
  cleanupOldSubmissions,
  type PendingFormSubmission 
} from "./offline-storage"

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
   * Ejecuta una sincronización manual
   */
  async syncPendingSubmissions(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Sincronización ya en progreso, omitiendo...')
      return
    }

    try {
      this.isRunning = true
      
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
   * Procesa un formulario individual: sube firmas y envía a Google Forms
   */
  private async processSubmission(submission: PendingFormSubmission): Promise<void> {
    let processedFormData = { ...submission.formData }

    // Procesar firmas base64 si las hay
    if (submission.formData.tecnicoFirma?.startsWith('data:image')) {
      console.log(`🔄 Subiendo firma del técnico (${submission.id})`)
      try {
        const result = await uploadImageToImgBB(
          submission.formData.tecnicoFirma,
          `firma-tecnico-${submission.formData.numeroOrden}-${submission.id}`
        )
        processedFormData.tecnicoFirma = result.data.url
        console.log(`✅ Firma del técnico subida: ${result.data.url}`)
      } catch (error) {
        console.warn(`⚠️ Error subiendo firma del técnico:`, error)
        processedFormData.tecnicoFirma = "[Firma digital del técnico - Error al subir]"
      }
    }

    if (submission.formData.clienteFirma?.startsWith('data:image')) {
      console.log(`🔄 Subiendo firma del cliente (${submission.id})`)
      try {
        const result = await uploadImageToImgBB(
          submission.formData.clienteFirma,
          `firma-cliente-${submission.formData.numeroOrden}-${submission.id}`
        )
        processedFormData.clienteFirma = result.data.url
        console.log(`✅ Firma del cliente subida: ${result.data.url}`)
      } catch (error) {
        console.warn(`⚠️ Error subiendo firma del cliente:`, error)
        processedFormData.clienteFirma = "[Firma digital del cliente - Error al subir]"
      }
    }

    // Enviar a Google Forms
    console.log(`📤 Enviando formulario a Google Forms (${submission.id})`)
    const result = await submitFormToGoogle(processedFormData)
    
    if (!result.success) {
      throw new Error(result.error || 'Error enviando a Google Forms')
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