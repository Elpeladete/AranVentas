/**
 * Servicio de gestión de datos offline para CSVs
 * Descarga y almacena los datos localmente para uso sin conexión
 */

export interface OfflineDataConfig {
  key: string
  url: string
  description: string
  lastUpdate?: number
  retryCount?: number
}

export interface OfflineDataStatus {
  key: string
  isAvailable: boolean
  lastUpdate: number | null
  size: number
  error?: string
}

// Configuración de datasets a descargar
export const OFFLINE_DATASETS: OfflineDataConfig[] = [
  {
    key: 'insumos',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGlidz9LeA--m7jkkwI-MBP3n_rfBlX7vG8HgynCrMGMN1sbNF2XAjlDdfY4PGH9-fXG4o9mozx1np/pub?gid=340700628&single=true&output=csv',
    description: 'Base de datos de insumos y equipos'
  },
  {
    key: 'localidades',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGlidz9LeA--m7jkkwI-MBP3n_rfBlX7vG8HgynCrMGMN1sbNF2XAjlDdfY4PGH9-fXG4o9mozx1np/pub?gid=0&single=true&output=csv',
    description: 'Listado de localidades y provincias'
  }
]

// Constantes de tiempo
const ONE_DAY_MS = 24 * 60 * 60 * 1000 // 24 horas en millisegundos
const RETRY_DELAY_MS = 30 * 1000 // 30 segundos entre reintentos
const MAX_RETRIES = 3

class OfflineDataManager {
  private isInitialized = false
  private syncInProgress = false
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Inicializa el gestor de datos offline
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('🔄 Inicializando gestor de datos offline...')
    
    try {
      // Verificar si necesitamos actualizar datos
      await this.checkAndUpdateData()
      
      // Programar verificaciones automáticas cada hora
      setInterval(() => {
        this.checkAndUpdateData()
      }, 60 * 60 * 1000) // Cada hora

      this.isInitialized = true
      console.log('✅ Gestor de datos offline inicializado')
      
    } catch (error) {
      console.error('❌ Error inicializando gestor offline:', error)
    }
  }

  /**
   * Verifica y actualiza los datos si es necesario
   */
  private async checkAndUpdateData(): Promise<void> {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return
    
    if (this.syncInProgress) return

    const now = Date.now()
    
    for (const dataset of OFFLINE_DATASETS) {
      try {
        const lastUpdate = this.getLastUpdateTime(dataset.key)
        const needsUpdate = !lastUpdate || (now - lastUpdate) > ONE_DAY_MS

        if (needsUpdate) {
          console.log(`📥 Dataset ${dataset.key} necesita actualización`)
          await this.downloadDataset(dataset)
        } else {
          console.log(`✅ Dataset ${dataset.key} está actualizado`)
        }
      } catch (error) {
        console.error(`❌ Error verificando dataset ${dataset.key}:`, error)
        this.scheduleRetry(dataset)
      }
    }
  }

  /**
   * Descarga un dataset específico
   */
  private async downloadDataset(config: OfflineDataConfig): Promise<void> {
    const { key, url, description } = config

    try {
      console.log(`🌐 Descargando ${description}...`)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.text()
      
      if (!data || data.trim().length === 0) {
        throw new Error('Respuesta vacía del servidor')
      }

      // Guardar en localStorage con metadata
      const offlineData = {
        data,
        lastUpdate: Date.now(),
        size: data.length,
        url
      }

      // Solo guardar si estamos en el cliente
      if (typeof window !== 'undefined') {
        localStorage.setItem(`offline_${key}`, JSON.stringify(offlineData))
      }
      
      console.log(`✅ ${description} descargado exitosamente (${data.length} caracteres)`)
      
      // Limpiar reintentos si los había
      this.clearRetry(key)
      
    } catch (error) {
      console.error(`❌ Error descargando ${description}:`, error)
      this.scheduleRetry(config)
      throw error
    }
  }

  /**
   * Programa un reintento para un dataset
   */
  private scheduleRetry(config: OfflineDataConfig): void {
    const retryCount = (config.retryCount || 0) + 1
    
    if (retryCount <= MAX_RETRIES) {
      console.log(`⏰ Programando reintento ${retryCount}/${MAX_RETRIES} para ${config.key} en ${RETRY_DELAY_MS/1000}s`)
      
      const timeout = setTimeout(() => {
        this.downloadDataset({ ...config, retryCount })
      }, RETRY_DELAY_MS)
      
      this.retryTimeouts.set(config.key, timeout)
    } else {
      console.error(`❌ Máximo de reintentos alcanzado para ${config.key}`)
    }
  }

  /**
   * Limpia los reintentos programados para un dataset
   */
  private clearRetry(key: string): void {
    const timeout = this.retryTimeouts.get(key)
    if (timeout) {
      clearTimeout(timeout)
      this.retryTimeouts.delete(key)
    }
  }

  /**
   * Obtiene la última fecha de actualización de un dataset
   */
  private getLastUpdateTime(key: string): number | null {
    // Verificar si estamos en el cliente
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const stored = localStorage.getItem(`offline_${key}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed.lastUpdate || null
      }
    } catch (error) {
      console.warn(`⚠️ Error leyendo metadata de ${key}:`, error)
    }
    return null
  }

  /**
   * Obtiene los datos offline de un dataset
   */
  getOfflineData(key: string): string | null {
    // Verificar si estamos en el cliente
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const stored = localStorage.getItem(`offline_${key}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed.data || null
      }
    } catch (error) {
      console.warn(`⚠️ Error leyendo datos offline de ${key}:`, error)
    }
    return null
  }

  /**
   * Verifica si un dataset está disponible offline
   */
  isDatasetAvailable(key: string): boolean {
    const data = this.getOfflineData(key)
    return data !== null && data.length > 0
  }

  /**
   * Obtiene el estado de todos los datasets
   */
  getDatasetStatus(): OfflineDataStatus[] {
    return OFFLINE_DATASETS.map(config => {
      const data = this.getOfflineData(config.key)
      const lastUpdate = this.getLastUpdateTime(config.key)
      
      return {
        key: config.key,
        isAvailable: data !== null,
        lastUpdate,
        size: data?.length || 0
      }
    })
  }

  /**
   * Fuerza la actualización de todos los datasets
   */
  async forceUpdateAll(): Promise<void> {
    if (this.syncInProgress) {
      console.log('⏳ Sincronización ya en progreso')
      return
    }

    this.syncInProgress = true
    
    try {
      console.log('🔄 Forzando actualización de todos los datasets...')
      
      for (const dataset of OFFLINE_DATASETS) {
        await this.downloadDataset(dataset)
      }
      
      console.log('✅ Todos los datasets actualizados')
      
    } catch (error) {
      console.error('❌ Error en actualización forzada:', error)
      throw error
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Fuerza la actualización de un dataset específico
   */
  async forceUpdateDataset(key: string): Promise<void> {
    const config = OFFLINE_DATASETS.find(d => d.key === key)
    if (!config) {
      throw new Error(`Dataset ${key} no encontrado`)
    }

    await this.downloadDataset(config)
  }

  /**
   * Limpia todos los datos offline
   */
  clearAllData(): void {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') {
      console.warn('⚠️ Intentando limpiar datos offline en servidor - omitiendo')
      return
    }

    console.log('🗑️ Limpiando todos los datos offline...')
    
    for (const dataset of OFFLINE_DATASETS) {
      localStorage.removeItem(`offline_${dataset.key}`)
      this.clearRetry(dataset.key)
    }
    
    console.log('✅ Datos offline limpiados')
  }

  /**
   * Obtiene información detallada sobre el almacenamiento
   */
  getStorageInfo(): { totalSize: number; datasets: { key: string; size: number }[] } {
    let totalSize = 0
    const datasets: { key: string; size: number }[] = []

    for (const config of OFFLINE_DATASETS) {
      const data = this.getOfflineData(config.key)
      const size = data?.length || 0
      totalSize += size
      datasets.push({ key: config.key, size })
    }

    return { totalSize, datasets }
  }
}

// Instancia singleton del gestor
export const offlineDataManager = new OfflineDataManager()

/**
 * Hook para inicializar automáticamente el gestor offline
 */
import { useState, useEffect } from 'react'

export function useOfflineDataManager() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    offlineDataManager.initialize()
      .then(() => {
        setIsInitialized(true)
        setError(null)
      })
      .catch((err) => {
        console.error('Error inicializando offline manager:', err)
        setError(err.message)
      })
  }, [])

  return { isInitialized, error }
}

// Función de utilidad para verificar conectividad
export async function checkConnectivity(): Promise<boolean> {
  if (!navigator.onLine) {
    return false
  }

  try {
    // Intentar un HEAD request rápido a Google
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: AbortSignal.timeout(5000)
    })
    return true
  } catch {
    return false
  }
}