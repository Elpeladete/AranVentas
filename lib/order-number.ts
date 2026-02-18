/**
 * Genera un número de orden de servicio basado en fecha y hora actual
 * Formato: YYYYMMDD-HHMMSS (ej: 20250922-175704)
 * YYYY = año, MM = mes, DD = día, HH = hora, MM = minutos, SS = segundos
 */
export function generateOrderNumber(): string {
  const now = new Date()
  
  // Obtener componentes de fecha
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0') // getMonth() es 0-indexado
  const day = String(now.getDate()).padStart(2, '0')
  
  // Obtener componentes de hora
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  
  // Formato: YYYYMMDD-HHMMSS
  const orderNumber = `${year}${month}${day}-${hours}${minutes}${seconds}`
  
  return orderNumber
}

/**
 * Obtiene la parte de fecha (YYYYMMDD) de un número de orden
 */
export function getOrderDatePart(orderNumber: string): string {
  if (!orderNumber || !isValidOrderNumber(orderNumber)) return ''
  return orderNumber.split('-')[0]
}

/**
 * Obtiene la fecha actual en formato YYYYMMDD
 */
export function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Verifica si un número de orden corresponde al día de hoy.
 * Si no corresponde, indica que debe regenerarse.
 */
export function shouldRegenerateOrderNumber(currentOrderNumber: string): boolean {
  if (!currentOrderNumber || !isValidOrderNumber(currentOrderNumber)) return true
  const orderDate = getOrderDatePart(currentOrderNumber)
  const today = getTodayDateString()
  return orderDate !== today
}

/**
 * Valida si un número de orden tiene el formato correcto
 * Formato esperado: YYYYMMDD-HHMMSS (ej: 20250922-175704)
 */
export function isValidOrderNumber(orderNumber: string): boolean {
  // Debe tener formato YYYYMMDD-HHMMSS
  return /^\d{8}-\d{6}$/.test(orderNumber)
}

/**
 * Genera un número de orden único basado en fecha y hora actual
 * Con el formato de fecha-hora es muy improbable que haya duplicados,
 * pero se mantiene la lógica por compatibilidad
 */
export function generateUniqueOrderNumber(existingNumbers: string[] = []): string {
  let orderNumber = generateOrderNumber()
  
  // Si el número ya existe (muy improbable), esperar un segundo y regenerar
  let attempts = 0
  while (existingNumbers.includes(orderNumber) && attempts < 10) {
    // Esperar un momento para que la hora cambie
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    orderNumber = `${year}${month}${day}-${hours}${minutes}${seconds}`
    attempts++
  }
  
  return orderNumber
}

/**
 * Formatea un número de orden para mostrar
 * El formato ya viene como YYYYMMDD-HHMMSS, no necesita formateo adicional
 */
export function formatOrderNumber(orderNumber: string): string {
  if (!orderNumber || !isValidOrderNumber(orderNumber)) {
    return orderNumber
  }
  
  // El formato ya es correcto: YYYYMMDD-HHMMSS
  return orderNumber
}