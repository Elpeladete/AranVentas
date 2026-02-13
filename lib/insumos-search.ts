/**
 * Funcionalidad de búsqueda de insumos desde Google Sheets con soporte offline
 */

import { offlineDataManager, checkConnectivity } from './offline-data-manager'

export interface InsumoData {
  codigo: string
  descripcion: string
  precioEstimado: number
  codigoOriginal: string // Para mantener el código exacto de la sheet
}

let cachedInsumos: InsumoData[] | null = null
let lastFetch = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos en milliseconds

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRGlidz9LeA--m7jkkwI-MBP3n_rfBlX7vG8HgynCrMGMN1sbNF2XAjlDdfY4PGH9-fXG4o9mozx1np/pub?gid=340700628&single=true&output=csv"

/**
 * Obtiene los datos de insumos con soporte offline
 */
export async function fetchInsumosData(): Promise<InsumoData[]> {
  const now = Date.now()
  
  // Usar caché en memoria si está disponible y no ha expirado
  if (cachedInsumos && (now - lastFetch) < CACHE_DURATION) {
    console.log('📦 Usando datos de insumos desde caché en memoria')
    return cachedInsumos
  }

  try {
    // ⚡ Verificación rápida: si estamos offline, ir directo a datos locales
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine ? await checkConnectivity() : false
    
    if (isOnline) {
      // Intentar descargar datos frescos
      console.log('🔄 Descargando datos de insumos desde Google Sheets...')
      const response = await fetch(SHEET_CSV_URL)
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`)
      }
      
      const csvText = await response.text()
      const insumos = parseCSVToInsumos(csvText)
      
      // Actualizar caché en memoria
      cachedInsumos = insumos
      lastFetch = now
      
      console.log(`✅ Datos de insumos cargados desde servidor: ${insumos.length} elementos`)
      return insumos
    } else {
      throw new Error('Sin conexión, usando datos offline')
    }
    
  } catch (error) {
    console.warn('⚠️ Error obteniendo datos online, intentando offline:', error)
    
    // Intentar usar datos offline
    const offlineData = offlineDataManager.getOfflineData('insumos')
    if (offlineData) {
      console.log('📱 Usando datos de insumos offline')
      const insumos = parseCSVToInsumos(offlineData)
      
      // Actualizar caché en memoria
      cachedInsumos = insumos
      lastFetch = now
      
      console.log(`✅ Datos de insumos cargados desde offline: ${insumos.length} elementos`)
      return insumos
    }
    
    // Si hay caché previo en memoria, usarlo como último recurso
    if (cachedInsumos) {
      console.log('🔄 Usando caché anterior en memoria como último recurso')
      return cachedInsumos
    }
    
    // Si no hay datos disponibles, retornar array vacío
    console.warn('⚠️ No se pudieron cargar datos de insumos (sin conexión y sin datos offline)')
    return []
  }
}

/**
 * Parsea el CSV y convierte a array de InsumoData
 */
function parseCSVToInsumos(csvText: string): InsumoData[] {
  const lines = csvText.trim().split('\n')
  const insumos: InsumoData[] = []
  
  // Saltar la primera línea (headers)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // Parsear CSV considerando comillas
    const columns = parseCSVLine(line)
    
    if (columns.length >= 4) {
      const codigoOriginal = columns[0]?.trim() || ''
      const codigoAlt = columns[1]?.trim() || ''
      const descripcion = columns[2]?.trim() || ''
      const precioStr = columns[3]?.trim() || ''
      
      // Usar código original, o alternativo si el original está vacío
      const codigo = codigoOriginal || codigoAlt
      
      // Convertir precio a número (manejar formato "usd X,XXX.XX")
      let precio = 0
      if (precioStr) {
        // Extraer números, comas y puntos del precio
        const numericStr = precioStr.replace(/[^0-9.,]/g, '')
        // Manejar formato americano (comas como separadores de miles)
        const cleanPrice = numericStr.replace(/,(\d{3})/g, '$1')
        precio = parseFloat(cleanPrice) || 0
      }
      
      if (codigo && descripcion) {
        insumos.push({
          codigo: codigo.toLowerCase(), // Para búsqueda case-insensitive
          descripcion: descripcion.replace(/Ã³/g, 'ó').replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ãº/g, 'ú').replace(/Ã±/g, 'ñ'), // Corregir encoding
          precioEstimado: precio,
          codigoOriginal: codigo // Mantener formato original
        })
      }
    }
  }
  
  return insumos
}

/**
 * Parsea una línea CSV considerando comillas y escapado
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0
  
  while (i < line.length) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Comillas escapadas
        current += '"'
        i += 2
        continue
      } else {
        // Toggle estado de comillas
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // Separador de columna
      result.push(current)
      current = ''
    } else {
      current += char
    }
    
    i++
  }
  
  // Agregar la última columna
  result.push(current)
  
  return result
}

/**
 * Busca insumos que coincidan con el código ingresado
 * @param query - Texto de búsqueda (mínimo 3 caracteres)
 * @returns Array de insumos que coinciden
 */
export async function searchInsumos(query: string): Promise<InsumoData[]> {
  if (query.length < 3) {
    return []
  }
  
  const insumos = await fetchInsumosData()
  const queryLower = query.toLowerCase()
  
  // Buscar en las dos primeras columnas (código y descripción)
  return insumos.filter(insumo => 
    insumo.codigo.includes(queryLower) || 
    insumo.descripcion.toLowerCase().includes(queryLower)
  ).slice(0, 10) // Limitar a 10 resultados para performance
}

/**
 * Fuerza la recarga de datos desde Google Sheets
 */
export function refreshInsumosCache(): void {
  cachedInsumos = null
  lastFetch = 0
}