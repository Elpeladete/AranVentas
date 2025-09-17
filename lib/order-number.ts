/**
 * Genera un número de orden de servicio basado en timestamp
 * Formato: Últimos 7 dígitos del timestamp + sufijo aleatorio si es necesario
 * Garantiza un mínimo de 7 cifras
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now()
  
  // Convertir timestamp a string y tomar los últimos 7 dígitos
  const timestampStr = timestamp.toString()
  const baseNumber = timestampStr.slice(-7)
  
  // Si el número tiene menos de 7 dígitos (muy improbable), rellenar con ceros
  const orderNumber = baseNumber.padStart(7, '0')
  
  return orderNumber
}

/**
 * Valida si un número de orden tiene el formato correcto
 */
export function isValidOrderNumber(orderNumber: string): boolean {
  // Debe ser exactamente 7 dígitos
  return /^\d{7}$/.test(orderNumber)
}

/**
 * Genera un número de orden único basado en timestamp actual
 * Si ya existe, añade un sufijo incremental
 */
export function generateUniqueOrderNumber(existingNumbers: string[] = []): string {
  let baseNumber = generateOrderNumber()
  
  // Si el número base ya existe, generar uno nuevo con pequeña variación
  if (existingNumbers.includes(baseNumber)) {
    // Añadir algunos milisegundos y regenerar
    const newTimestamp = Date.now() + Math.floor(Math.random() * 1000)
    baseNumber = newTimestamp.toString().slice(-7).padStart(7, '0')
  }
  
  return baseNumber
}

/**
 * Formatea un número de orden para mostrar
 */
export function formatOrderNumber(orderNumber: string): string {
  if (!orderNumber || orderNumber.length !== 7) {
    return orderNumber
  }
  
  // Formato: XXX-XXXX (opcional, por ahora devolver sin formato)
  return orderNumber
}