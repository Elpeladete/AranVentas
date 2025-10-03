import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Función para formatear fecha de YYYY-MM-DD a DD-MM-YYYY
export function formatDateForDisplay(dateString: string): string {
  if (!dateString || dateString.trim() === '') return ''
  
  // Si ya está en formato DD-MM-YYYY, devolverlo tal como está
  if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
    return dateString
  }
  
  // Convertir de YYYY-MM-DD a DD-MM-YYYY
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-')
    return `${day}-${month}-${year}`
  }
  
  // Si no coincide con ningún formato esperado, devolver tal como está
  return dateString
}

// Función para convertir fecha de DD-MM-YYYY a YYYY-MM-DD (para guardar)
export function formatDateForStorage(dateString: string): string {
  if (!dateString || dateString.trim() === '') return ''
  
  // Si ya está en formato YYYY-MM-DD, devolverlo tal como está
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString
  }
  
  // Convertir de DD-MM-YYYY a YYYY-MM-DD
  if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
    const [day, month, year] = dateString.split('-')
    return `${year}-${month}-${day}`
  }
  
  // Si no coincide con ningún formato esperado, devolver tal como está
  return dateString
}
