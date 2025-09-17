/**
 * Genera un número de orden de servicio basado en fecha actual + números aleatorios
 * Formato: YYYYMMDD-XXXX (ej: 20250917-9516)
 * YYYY = año, MM = mes, DD = día, XXXX = 4 números aleatorios
 */
export function generateOrderNumber(): string {
  const now = new Date()
  
  // Obtener componentes de fecha
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0') // getMonth() es 0-indexado
  const day = String(now.getDate()).padStart(2, '0')
  
  // Generar 4 números aleatorios
  const randomNumbers = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  
  // Formato: YYYYMMDD-XXXX
  const orderNumber = `${year}${month}${day}-${randomNumbers}`
  
  return orderNumber
}

/**
 * Valida si un número de orden tiene el formato correcto
 * Formato esperado: YYYYMMDD-XXXX (ej: 20250917-9516)
 */
export function isValidOrderNumber(orderNumber: string): boolean {
  // Debe tener formato YYYYMMDD-XXXX
  return /^\d{8}-\d{4}$/.test(orderNumber)
}

/**
 * Genera un número de orden único basado en fecha actual + números aleatorios
 * Si ya existe, genera nuevos números aleatorios
 */
export function generateUniqueOrderNumber(existingNumbers: string[] = []): string {
  let orderNumber = generateOrderNumber()
  
  // Si el número ya existe, regenerar solo la parte aleatoria
  let attempts = 0
  while (existingNumbers.includes(orderNumber) && attempts < 100) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const randomNumbers = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    orderNumber = `${year}${month}${day}-${randomNumbers}`
    attempts++
  }
  
  return orderNumber
}

/**
 * Formatea un número de orden para mostrar
 * El formato ya viene como YYYYMMDD-XXXX, no necesita formateo adicional
 */
export function formatOrderNumber(orderNumber: string): string {
  if (!orderNumber || !isValidOrderNumber(orderNumber)) {
    return orderNumber
  }
  
  // El formato ya es correcto: YYYYMMDD-XXXX
  return orderNumber
}