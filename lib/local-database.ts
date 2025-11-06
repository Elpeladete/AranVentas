/**
 * Sistema de Base de Datos Local para Órdenes de Servicio
 * Funciona como una tabla interna similar a Google Sheets
 * Solo para manejo interno - sin exportación ni carga externa
 */

import { type FormData as AranFormData } from "@/hooks/use-form-data"

// Tipos para la base de datos local
export interface OrderRecord {
  id: string
  numeroOrden: string
  createdAt: Date
  updatedAt: Date
  status: 'draft' | 'completed' | 'pending-offline' | 'sent' | 'archived'
  formData: AranFormData
  imageUrl?: string
  googleFormsSent: boolean
  sentAt?: Date
  notes?: string
}

export interface DatabaseStats {
  total: number
  drafts: number
  completed: number
  pendingOffline: number
  sent: number
  archived: number
  lastUpdate?: Date
}

const DB_STORAGE_KEY = 'aran-local-database'
const MAX_RECORDS = 1000 // Límite para evitar problemas de rendimiento

/**
 * Obtiene todos los registros de la base de datos local
 */
export function getAllOrders(): OrderRecord[] {
  try {
    const stored = localStorage.getItem(DB_STORAGE_KEY)
    if (!stored) return []
    
    const records: OrderRecord[] = JSON.parse(stored)
    
    // Convertir strings de fecha de vuelta a objetos Date
    return records.map(record => ({
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      sentAt: record.sentAt ? new Date(record.sentAt) : undefined
    })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Más recientes primero
  } catch (error) {
    console.error('Error leyendo base de datos local:', error)
    return []
  }
}

/**
 * Guarda todos los registros en LocalStorage
 */
function saveAllOrders(orders: OrderRecord[]): void {
  try {
    // Limitar el número de registros para evitar problemas de rendimiento
    const limitedOrders = orders.slice(0, MAX_RECORDS)
    
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(limitedOrders))
    console.log(`💾 Base de datos actualizada: ${limitedOrders.length} registros`)
  } catch (error) {
    console.error('Error guardando en base de datos local:', error)
    throw new Error('No se pudo guardar en la base de datos local')
  }
}

/**
 * Genera un ID único para cada orden
 */
function generateOrderId(): string {
  return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Agrega una nueva orden a la base de datos
 */
export function addNewOrder(formData: AranFormData, status: OrderRecord['status'] = 'draft'): string {
  const orders = getAllOrders()
  
  const newOrder: OrderRecord = {
    id: generateOrderId(),
    numeroOrden: formData.numeroOrden || `AUTO-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    status,
    formData: { ...formData }, // Crear copia profunda
    googleFormsSent: false
  }
  
  orders.unshift(newOrder) // Agregar al inicio (más reciente)
  saveAllOrders(orders)
  
  console.log(`📝 Nueva orden agregada: ${newOrder.numeroOrden} (${newOrder.id})`)
  return newOrder.id
}

/**
 * Actualiza una orden existente
 */
export function updateOrder(
  id: string, 
  updates: Partial<Omit<OrderRecord, 'id' | 'createdAt'>>
): boolean {
  const orders = getAllOrders()
  const index = orders.findIndex(order => order.id === id)
  
  if (index === -1) {
    console.warn(`Orden no encontrada: ${id}`)
    return false
  }
  
  // Actualizar campos
  orders[index] = {
    ...orders[index],
    ...updates,
    updatedAt: new Date()
  }
  
  saveAllOrders(orders)
  console.log(`✏️ Orden actualizada: ${orders[index].numeroOrden}`)
  return true
}

/**
 * Obtiene una orden por ID
 */
export function getOrderById(id: string): OrderRecord | null {
  const orders = getAllOrders()
  return orders.find(order => order.id === id) || null
}

/**
 * Obtiene órdenes por número de orden
 */
export function getOrdersByNumber(numeroOrden: string): OrderRecord[] {
  const orders = getAllOrders()
  return orders.filter(order => 
    order.numeroOrden.toLowerCase().includes(numeroOrden.toLowerCase())
  )
}

/**
 * Busca órdenes por texto en múltiples campos
 */
export function searchOrders(query: string): OrderRecord[] {
  if (!query.trim()) return getAllOrders()
  
  const orders = getAllOrders()
  const searchTerm = query.toLowerCase()
  
  return orders.filter(order => {
    const searchableText = [
      order.numeroOrden,
      order.formData.razonSocial || '',
      order.formData.contacto || '',
      order.formData.descripcion || '',
      order.formData.maquina || '',
      order.formData.equipo || '',
      order.notes || ''
    ].join(' ').toLowerCase()
    
    return searchableText.includes(searchTerm)
  })
}

/**
 * Filtra órdenes por estado
 */
export function getOrdersByStatus(status: OrderRecord['status']): OrderRecord[] {
  const orders = getAllOrders()
  return orders.filter(order => order.status === status)
}

/**
 * Filtra órdenes por rango de fechas
 */
export function getOrdersByDateRange(startDate: Date, endDate: Date): OrderRecord[] {
  const orders = getAllOrders()
  return orders.filter(order => {
    const orderDate = order.createdAt
    return orderDate >= startDate && orderDate <= endDate
  })
}

/**
 * Marca una orden como enviada
 */
export function markOrderAsSent(id: string, imageUrl?: string): boolean {
  return updateOrder(id, {
    status: 'sent',
    googleFormsSent: true,
    sentAt: new Date(),
    imageUrl
  })
}

/**
 * Archiva una orden
 */
export function archiveOrder(id: string, notes?: string): boolean {
  return updateOrder(id, {
    status: 'archived',
    notes: notes || undefined
  })
}

/**
 * Obtiene estadísticas de la base de datos
 */
export function getDatabaseStats(): DatabaseStats {
  const orders = getAllOrders()
  
  const stats = orders.reduce(
    (acc, order) => {
      acc.total++
      
      // Mapear estados a propiedades del acumulador
      switch (order.status) {
        case 'draft':
          acc.drafts++
          break
        case 'completed':
          acc.completed++
          break
        case 'pending-offline':
          acc.pendingOffline++
          break
        case 'sent':
          acc.sent++
          break
        case 'archived':
          acc.archived++
          break
      }
      
      if (!acc.lastUpdate || order.updatedAt > acc.lastUpdate) {
        acc.lastUpdate = order.updatedAt
      }
      
      return acc
    },
    { total: 0, drafts: 0, completed: 0, pendingOffline: 0, sent: 0, archived: 0, lastUpdate: undefined as Date | undefined }
  )
  
  return {
    total: stats.total,
    drafts: stats.drafts,
    completed: stats.completed,
    pendingOffline: stats.pendingOffline,
    sent: stats.sent,
    archived: stats.archived,
    lastUpdate: stats.lastUpdate
  }
}

/**
 * Limpia órdenes muy antiguas (solo archivadas)
 */
export function cleanupOldOrders(): number {
  const orders = getAllOrders()
  const now = Date.now()
  const sixMonthsAgo = now - (6 * 30 * 24 * 60 * 60 * 1000) // 6 meses
  
  const beforeCount = orders.length
  const cleaned = orders.filter(order => {
    // Mantener órdenes recientes
    if (order.createdAt.getTime() > sixMonthsAgo) {
      return true
    }
    
    // Mantener órdenes no archivadas aunque sean antiguas
    if (order.status !== 'archived') {
      return true
    }
    
    // Remover solo órdenes archivadas muy antiguas
    console.log(`🧹 Limpiando orden archivada antigua: ${order.numeroOrden}`)
    return false
  })
  
  if (cleaned.length !== orders.length) {
    saveAllOrders(cleaned)
  }
  
  return beforeCount - cleaned.length
}

/**
 * Obtiene resumen por mes
 */
export function getMonthlyStats(): Array<{
  month: string
  year: number
  count: number
  sent: number
}> {
  const orders = getAllOrders()
  const monthlyData = new Map<string, { count: number; sent: number }>()
  
  orders.forEach(order => {
    const date = order.createdAt
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!monthlyData.has(key)) {
      monthlyData.set(key, { count: 0, sent: 0 })
    }
    
    const data = monthlyData.get(key)!
    data.count++
    if (order.status === 'sent') {
      data.sent++
    }
  })
  
  return Array.from(monthlyData.entries())
    .map(([key, data]) => {
      const [year, month] = key.split('-')
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]
      
      return {
        month: monthNames[parseInt(month) - 1],
        year: parseInt(year),
        count: data.count,
        sent: data.sent
      }
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]
      return monthNames.indexOf(b.month) - monthNames.indexOf(a.month)
    })
}

/**
 * Verifica la integridad de la base de datos
 */
export function validateDatabase(): {
  isValid: boolean
  errors: string[]
  repaired: boolean
} {
  try {
    const orders = getAllOrders()
    const errors: string[] = []
    let repaired = false
    
    // Verificar duplicados por número de orden
    const numberCounts = new Map<string, number>()
    orders.forEach(order => {
      const count = numberCounts.get(order.numeroOrden) || 0
      numberCounts.set(order.numeroOrden, count + 1)
    })
    
    numberCounts.forEach((count, numero) => {
      if (count > 1) {
        errors.push(`Número de orden duplicado: ${numero} (${count} veces)`)
      }
    })
    
    // Verificar IDs únicos
    const idCounts = new Map<string, number>()
    orders.forEach(order => {
      const count = idCounts.get(order.id) || 0
      idCounts.set(order.id, count + 1)
    })
    
    idCounts.forEach((count, id) => {
      if (count > 1) {
        errors.push(`ID duplicado: ${id}`)
      }
    })
    
    return {
      isValid: errors.length === 0,
      errors,
      repaired
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [`Error validando base de datos: ${error}`],
      repaired: false
    }
  }
}

/**
 * SOLO PARA DESARROLLO - Limpia completamente la base de datos
 */
export function clearDatabase(): void {
  if (process.env.NODE_ENV === 'development') {
    localStorage.removeItem(DB_STORAGE_KEY)
    console.log('🗑️ Base de datos local completamente limpiada')
  } else {
    console.warn('🚫 clearDatabase() solo disponible en desarrollo')
  }
}