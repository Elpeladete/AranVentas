/**
 * Servicio para búsqueda de localidades y provincias desde Google Sheets
 * Estructura esperada del CSV: Municipio,Provincia,País,Extra,Número
 */

export interface LocalidadData {
  municipio: string
  provincia: string
  pais: string
  extra?: string
  numero?: string
}

export interface LocalidadSearchResult {
  municipio: string
  provincia: string
  pais: string
  matchScore: number
}

// URL del CSV de localidades argentinas, uruguayas y paraguayas
const LOCALIDADES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGlidz9LeA--m7jkkwI-MBP3n_rfBlX7vG8HgynCrMGMN1sbNF2XAjlDdfY4PGH9-fXG4o9mozx1np/pub?gid=0&single=true&output=csv'

// Cache para evitar múltiples requests
let localidadesCache: LocalidadData[] | null = null
let lastFetchTime: number | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

/**
 * Obtiene los datos de localidades desde Google Sheets con caché
 */
async function fetchLocalidades(): Promise<LocalidadData[]> {
  const now = Date.now()
  
  // Verificar si el cache es válido
  if (localidadesCache && lastFetchTime && (now - lastFetchTime < CACHE_DURATION)) {
    console.log('📋 Usando cache de localidades')
    return localidadesCache
  }

  try {
    console.log('🌐 Descargando localidades desde Google Sheets...')
    const response = await fetch(LOCALIDADES_CSV_URL)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const csvText = await response.text()
    const localidades = parseLocalidadesCsv(csvText)
    
    // Actualizar cache
    localidadesCache = localidades
    lastFetchTime = now
    
    console.log(`✅ ${localidades.length} localidades cargadas exitosamente`)
    return localidades
    
  } catch (error) {
    console.error('❌ Error descargando localidades:', error)
    
    // Si hay cache previo, usarlo como fallback
    if (localidadesCache) {
      console.log('🔄 Usando cache anterior como fallback')
      return localidadesCache
    }
    
    throw new Error('No se pudieron cargar los datos de localidades')
  }
}

/**
 * Parsea el CSV de localidades
 */
function parseLocalidadesCsv(csvText: string): LocalidadData[] {
  const lines = csvText.trim().split('\n')
  const localidades: LocalidadData[] = []
  
  // Procesar cada línea (sin header, directamente los datos)
  lines.forEach((line, index) => {
    try {
      const columns = line.split(',')
      
      if (columns.length >= 2) {
        const municipio = columns[0]?.trim()
        const provincia = columns[1]?.trim()
        const pais = columns[2]?.trim() || 'Argentina'
        const extra = columns[3]?.trim() || ''
        const numero = columns[4]?.trim() || ''
        
        if (municipio && provincia) {
          localidades.push({
            municipio,
            provincia,
            pais,
            extra,
            numero
          })
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error parseando línea ${index + 1}:`, line, error)
    }
  })
  
  return localidades
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
 * Busca localidades que coincidan con el texto de entrada
 */
export async function searchLocalidades(
  query: string,
  maxResults: number = 10
): Promise<LocalidadSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  try {
    const localidades = await fetchLocalidades()
    const results: LocalidadSearchResult[] = []
    
    // Buscar coincidencias
    localidades.forEach(localidad => {
      const score = calculateMatchScore(query, localidad.municipio)
      
      if (score > 30) { // Filtrar solo coincidencias razonables
        results.push({
          municipio: localidad.municipio,
          provincia: localidad.provincia,
          pais: localidad.pais,
          matchScore: score
        })
      }
    })
    
    // Ordenar por score descendente y limitar resultados
    return results
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, maxResults)
      
  } catch (error) {
    console.error('❌ Error en búsqueda de localidades:', error)
    return []
  }
}

/**
 * Busca una localidad específica por nombre exacto
 */
export async function getLocalidadByName(municipio: string): Promise<LocalidadSearchResult | null> {
  if (!municipio || !municipio.trim()) {
    return null
  }

  try {
    const localidades = await fetchLocalidades()
    
    // Buscar coincidencia exacta (case insensitive)
    const match = localidades.find(
      localidad => localidad.municipio.toLowerCase() === municipio.toLowerCase()
    )
    
    if (match) {
      return {
        municipio: match.municipio,
        provincia: match.provincia,
        pais: match.pais,
        matchScore: 100
      }
    }
    
    return null
    
  } catch (error) {
    console.error('❌ Error obteniendo localidad:', error)
    return null
  }
}

/**
 * Obtiene todas las provincias únicas disponibles
 */
export async function getProvincias(): Promise<string[]> {
  try {
    const localidades = await fetchLocalidades()
    const provincias = [...new Set(localidades.map(l => l.provincia))]
    return provincias.sort()
    
  } catch (error) {
    console.error('❌ Error obteniendo provincias:', error)
    return []
  }
}

/**
 * Limpia el cache (útil para testing o actualizaciones forzadas)
 */
export function clearLocalidadesCache(): void {
  localidadesCache = null
  lastFetchTime = null
  console.log('🗑️ Cache de localidades limpiado')
}