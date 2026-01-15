/**
 * Servicio para búsqueda de técnicos desde Google Sheets con soporte offline
 * Estructura esperada del CSV: Nombre,Email,DNI,Telefono,Cargo
 */

import { offlineDataManager, checkConnectivity } from './offline-data-manager'

export interface TecnicoData {
  nombre: string
  email?: string
  dni?: string
  telefono?: string
  cargo?: string
}

export interface TecnicoSearchResult {
  nombre: string
  email?: string
  dni?: string
  telefono?: string
  cargo?: string
  matchScore: number
}

// URL del CSV de técnicos (hoja "Tecnicos" del mismo spreadsheet)
const TECNICOS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGlidz9LeA--m7jkkwI-MBP3n_rfBlX7vG8HgynCrMGMN1sbNF2XAjlDdfY4PGH9-fXG4o9mozx1np/pub?gid=113521193&single=true&output=csv'

// Cache para evitar múltiples requests
let tecnicosCache: TecnicoData[] | null = null
let lastFetchTime: number | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

/**
 * Obtiene los datos de técnicos con soporte offline
 */
async function fetchTecnicos(): Promise<TecnicoData[]> {
  const now = Date.now()
  
  // Verificar si el cache en memoria es válido
  if (tecnicosCache && lastFetchTime && (now - lastFetchTime < CACHE_DURATION)) {
    console.log('📋 Usando cache de técnicos en memoria')
    return tecnicosCache
  }

  try {
    // Verificar conectividad
    const isOnline = await checkConnectivity()
    
    if (isOnline) {
      // Intentar descargar datos frescos
      console.log('🌐 Descargando técnicos desde Google Sheets...')
      const response = await fetch(TECNICOS_CSV_URL)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const csvText = await response.text()
      const tecnicos = parseTecnicosCsv(csvText)
      
      // Actualizar cache en memoria
      tecnicosCache = tecnicos
      lastFetchTime = now
      
      console.log(`✅ ${tecnicos.length} técnicos cargados desde servidor`)
      return tecnicos
    } else {
      throw new Error('Sin conexión, usando datos offline')
    }
    
  } catch (error) {
    console.warn('⚠️ Error obteniendo datos online, intentando offline:', error)
    
    // Intentar usar datos offline
    const offlineData = offlineDataManager.getOfflineData('tecnicos')
    if (offlineData) {
      console.log('📱 Usando datos de técnicos offline')
      const tecnicos = parseTecnicosCsv(offlineData)
      
      // Actualizar cache en memoria
      tecnicosCache = tecnicos
      lastFetchTime = now
      
      console.log(`✅ ${tecnicos.length} técnicos cargados desde offline`)
      return tecnicos
    }
    
    // Si hay cache previo en memoria, usarlo como último recurso
    if (tecnicosCache) {
      console.log('🔄 Usando cache anterior en memoria como último recurso')
      return tecnicosCache
    }
    
    throw new Error('No se pudieron cargar los datos de técnicos (sin conexión y sin datos offline)')
  }
}

/**
 * Parsea el CSV de técnicos
 */
function parseTecnicosCsv(csvText: string): TecnicoData[] {
  const lines = csvText.trim().split('\n')
  const tecnicos: TecnicoData[] = []
  
  // Procesar cada línea (sin header, directamente los datos)
  lines.forEach((line, index) => {
    try {
      const columns = line.split(',')
      
      if (columns.length >= 1) {
        const nombre = columns[0]?.trim()
        const email = columns[1]?.trim() || ''
        const dni = columns[2]?.trim() || ''
        const telefono = columns[3]?.trim() || ''
        const cargo = columns[4]?.trim() || ''
        
        if (nombre) {
          tecnicos.push({
            nombre,
            email: email || undefined,
            dni: dni || undefined,
            telefono: telefono || undefined,
            cargo: cargo || undefined
          })
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error parseando línea ${index + 1}:`, line, error)
    }
  })
  
  return tecnicos
}

/**
 * Calcula el score de similitud entre dos strings
 */
function calculateMatchScore(input: string, target: string): number {
  const inputLower = input.toLowerCase()
  const targetLower = target.toLowerCase()
  
  // Coincidencia exacta
  if (inputLower === targetLower) return 100
  
  // Coincidencia desde el inicio
  if (targetLower.startsWith(inputLower)) return 80 + (inputLower.length / targetLower.length) * 20
  
  // Contiene la búsqueda
  if (targetLower.includes(inputLower)) return 60 + (inputLower.length / targetLower.length) * 20
  
  // Palabras separadas
  const inputWords = inputLower.split(' ')
  const targetWords = targetLower.split(' ')
  
  let wordMatches = 0
  for (const inputWord of inputWords) {
    for (const targetWord of targetWords) {
      if (targetWord.startsWith(inputWord)) {
        wordMatches++
        break
      }
    }
  }
  
  if (wordMatches > 0) {
    return 40 + (wordMatches / Math.max(inputWords.length, targetWords.length)) * 20
  }
  
  return 0
}

/**
 * Busca técnicos que coincidan con el texto de entrada
 */
export async function searchTecnicos(
  query: string,
  maxResults: number = 10
): Promise<TecnicoSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  try {
    const tecnicos = await fetchTecnicos()
    const results: TecnicoSearchResult[] = []
    
    // Buscar coincidencias
    tecnicos.forEach(tecnico => {
      const score = calculateMatchScore(query, tecnico.nombre)
      
      if (score > 30) { // Filtrar solo coincidencias razonables
        results.push({
          nombre: tecnico.nombre,
          email: tecnico.email,
          dni: tecnico.dni,
          cargo: tecnico.cargo,
          matchScore: score
        })
      }
    })
    
    // Ordenar por score descendente y limitar resultados
    return results
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, maxResults)
      
  } catch (error) {
    console.error('❌ Error en búsqueda de técnicos:', error)
    return []
  }
}

/**
 * Busca un técnico específico por nombre exacto
 */
export async function getTecnicoByName(nombre: string): Promise<TecnicoSearchResult | null> {
  if (!nombre || !nombre.trim()) {
    return null
  }

  try {
    const tecnicos = await fetchTecnicos()
    
    // Buscar coincidencia exacta (case insensitive)
    const match = tecnicos.find(
      tecnico => tecnico.nombre.toLowerCase() === nombre.toLowerCase()
    )
    
    if (match) {
      return {
        nombre: match.nombre,
        email: match.email,
        dni: match.dni,
        cargo: match.cargo,
        matchScore: 100
      }
    }
    
    return null
    
  } catch (error) {
    console.error('❌ Error obteniendo técnico:', error)
    return null
  }
}

/**
 * Obtiene todos los técnicos disponibles
 */
export async function getAllTecnicos(): Promise<TecnicoData[]> {
  try {
    const tecnicos = await fetchTecnicos()
    return tecnicos.sort((a, b) => a.nombre.localeCompare(b.nombre))
    
  } catch (error) {
    console.error('❌ Error obteniendo técnicos:', error)
    return []
  }
}

/**
 * Limpia el cache (útil para testing o actualizaciones forzadas)
 */
export function clearTecnicosCache(): void {
  tecnicosCache = null
  lastFetchTime = null
  console.log('🗑️ Cache de técnicos limpiado')
}
