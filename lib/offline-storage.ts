/**
 * Sistema de almacenamiento local para formularios pendientes
 * Usa LocalStorage con fallback para manejar formularios offline
 */

import { type FormData as AranFormData } from "@/hooks/use-form-data"

// Tipos para el almacenamiento local
export interface PendingFormSubmission {
  id: string
  formData: AranFormData
  createdAt: Date
  attempts: number
  lastAttempt?: Date
  status: 'pending' | 'uploading' | 'failed' | 'completed'
  error?: string
}

export interface OfflineStorage {
  pendingSubmissions: PendingFormSubmission[]
  lastSync: Date | null
}

const STORAGE_KEY = 'aran-offline-forms'
const MAX_ATTEMPTS = 3

/**
 * Obtiene todos los formularios almacenados localmente
 */
export function getPendingSubmissions(): PendingFormSubmission[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const data: OfflineStorage = JSON.parse(stored)
    
    // Convertir strings de fecha de vuelta a objetos Date
    return data.pendingSubmissions.map(submission => ({
      ...submission,
      createdAt: new Date(submission.createdAt),
      lastAttempt: submission.lastAttempt ? new Date(submission.lastAttempt) : undefined
    }))
  } catch (error) {
    console.error('Error leyendo formularios pendientes:', error)
    return []
  }
}

/**
 * Guarda los formularios pendientes en LocalStorage
 */
function savePendingSubmissions(submissions: PendingFormSubmission[]): void {
  try {
    const data: OfflineStorage = {
      pendingSubmissions: submissions,
      lastSync: new Date()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Error guardando formularios pendientes:', error)
    throw new Error('No se pudo guardar el formulario localmente')
  }
}

/**
 * Genera un ID único para cada formulario
 */
function generateSubmissionId(): string {
  return `aran-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Agrega un nuevo formulario a la cola de pendientes
 */
export function addPendingSubmission(formData: AranFormData): string {
  const submissions = getPendingSubmissions()
  
  const newSubmission: PendingFormSubmission = {
    id: generateSubmissionId(),
    formData: { ...formData }, // Crear copia para evitar referencias
    createdAt: new Date(),
    attempts: 0,
    status: 'pending'
  }
  
  submissions.push(newSubmission)
  savePendingSubmissions(submissions)
  
  console.log(`💾 Formulario guardado localmente: ${newSubmission.id}`)
  return newSubmission.id
}

/**
 * Actualiza el estado de un formulario pendiente
 */
export function updateSubmissionStatus(
  id: string, 
  status: PendingFormSubmission['status'],
  error?: string
): void {
  const submissions = getPendingSubmissions()
  const index = submissions.findIndex(s => s.id === id)
  
  if (index === -1) {
    console.warn(`Formulario no encontrado: ${id}`)
    return
  }
  
  submissions[index].status = status
  submissions[index].lastAttempt = new Date()
  
  if (status === 'uploading' || status === 'failed') {
    submissions[index].attempts += 1
  }
  
  if (error) {
    submissions[index].error = error
  }
  
  // Si se completó exitosamente o falló demasiadas veces, remover
  if (status === 'completed' || submissions[index].attempts >= MAX_ATTEMPTS) {
    submissions.splice(index, 1)
    console.log(`🗑️ Formulario ${status === 'completed' ? 'enviado' : 'descartado'}: ${id}`)
  }
  
  savePendingSubmissions(submissions)
}

/**
 * Obtiene solo los formularios que están listos para reintento
 */
export function getSubmissionsReadyForRetry(): PendingFormSubmission[] {
  const submissions = getPendingSubmissions()
  
  return submissions.filter(submission => {
    // Solo formularios pendientes o que fallaron
    if (submission.status !== 'pending' && submission.status !== 'failed') {
      return false
    }
    
    // No exceder el máximo de intentos
    if (submission.attempts >= MAX_ATTEMPTS) {
      return false
    }
    
    // Si nunca se ha intentado, está listo
    if (!submission.lastAttempt) {
      return true
    }
    
    // Esperar 5 minutos entre reintentos
    const timeSinceLastAttempt = Date.now() - submission.lastAttempt.getTime()
    return timeSinceLastAttempt > 5 * 60 * 1000 // 5 minutos
  })
}

/**
 * Limpia formularios muy antiguos o completados
 */
export function cleanupOldSubmissions(): void {
  const submissions = getPendingSubmissions()
  const now = Date.now()
  const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000) // 3 días
  
  const cleaned = submissions.filter(submission => {
    // Mantener formularios recientes
    if (submission.createdAt.getTime() > threeDaysAgo) {
      return true
    }
    
    // Mantener formularios pendientes aunque sean antiguos
    if (submission.status === 'pending' || submission.status === 'uploading') {
      return true
    }
    
    // Remover formularios antiguos completados o fallidos
    console.log(`🧹 Limpiando formulario antiguo: ${submission.id}`)
    return false
  })
  
  if (cleaned.length !== submissions.length) {
    savePendingSubmissions(cleaned)
  }
}

/**
 * Obtiene estadísticas de los formularios pendientes
 */
export function getPendingStats(): {
  total: number
  pending: number
  uploading: number
  failed: number
  oldestPending?: Date
} {
  const submissions = getPendingSubmissions()
  
  const stats = submissions.reduce(
    (acc, submission) => {
      acc.total++
      acc[submission.status]++
      
      if (submission.status === 'pending' && submission.createdAt) {
        if (!acc.oldestPending || submission.createdAt < acc.oldestPending) {
          acc.oldestPending = submission.createdAt
        }
      }
      
      return acc
    },
    { total: 0, pending: 0, uploading: 0, failed: 0, completed: 0, oldestPending: undefined as Date | undefined }
  )
  
  return {
    total: stats.total,
    pending: stats.pending,
    uploading: stats.uploading,
    failed: stats.failed,
    oldestPending: stats.oldestPending
  }
}

/**
 * Exporta todos los formularios pendientes para debugging
 */
export function exportPendingSubmissions(): string {
  const submissions = getPendingSubmissions()
  return JSON.stringify(submissions, null, 2)
}

/**
 * Limpia completamente el almacenamiento local (solo para debugging)
 */
export function clearAllPendingSubmissions(): void {
  localStorage.removeItem(STORAGE_KEY)
  console.log('🗑️ Todos los formularios pendientes han sido eliminados')
}