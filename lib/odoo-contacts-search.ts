/**
 * Sistema de búsqueda de contactos Odoo con soporte offline
 * Permite buscar contactos cuando no hay conexión
 */

import { offlineDataManager, checkConnectivity } from './offline-data-manager'

export interface OdooContactOffline {
  id: number
  nombre: string
  cuit: string
  telefono: string
  calle: string
  ciudad: string
  provincia: string
  es_empresa: boolean
  empresa_id: string
  empresa_nombre: string
}

export interface OdooContactSearchResult {
  id: number
  nombre: string
  cuit: string
  telefono: string
  ciudad: string
  provincia: string
  es_empresa: boolean
  empresa_nombre?: string
  match_score: number
}

/**
 * Parsea el CSV de contactos offline
 */
function parseContactsCSV(csvText: string): OdooContactOffline[] {
  const lines = csvText.split('\n')
  const contacts: OdooContactOffline[] = []
  
  // Saltar header (primera línea)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    try {
      // Parsear CSV considerando comillas
      const values: string[] = []
      let inQuotes = false
      let currentValue = ''
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        
        if (char === '"') {
          if (inQuotes && line[j + 1] === '"') {
            // Comilla doble escapada
            currentValue += '"'
            j++ // Saltar la siguiente comilla
          } else {
            // Toggle estado de comillas
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          // Fin de valor
          values.push(currentValue.trim())
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      // Agregar el último valor
      values.push(currentValue.trim())
      
      if (values.length >= 10) {
        contacts.push({
          id: parseInt(values[0]) || 0,
          nombre: values[1],
          cuit: values[2],
          telefono: values[3],
          calle: values[4],
          ciudad: values[5],
          provincia: values[6],
          es_empresa: values[7] === '1',
          empresa_id: values[8],
          empresa_nombre: values[9]
        })
      }
    } catch (error) {
      console.warn(`⚠️ Error parseando línea ${i}:`, error)
    }
  }
  
  console.log(`✅ Parseados ${contacts.length} contactos de Odoo`)
  return contacts
}

/**
 * Obtiene datos de contactos (online u offline)
 * ⚡ OPTIMIZADO: Verifica navigator.onLine antes de intentar fetch
 */
async function fetchOdooContacts(): Promise<OdooContactOffline[]> {
  // ⚡ Verificación rápida: si estamos offline, ir directo a datos locales
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine ? await checkConnectivity() : false
  
  if (isOnline) {
    try {
      console.log('🌐 Obteniendo contactos desde API...')
      const response = await fetch('/api/odoo/contacts/csv', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (response.ok) {
        const csvText = await response.text()
        return parseContactsCSV(csvText)
      }
    } catch (error) {
      console.warn('⚠️ Error obteniendo contactos online, usando offline:', error)
    }
  }
  
  // Usar datos offline
  console.log('📱 Usando datos offline de contactos Odoo')
  const offlineData = offlineDataManager.getOfflineData('odoo-contacts')
  
  if (offlineData) {
    return parseContactsCSV(offlineData)
  }
  
  console.warn('⚠️ No hay datos offline disponibles para contactos Odoo')
  return []
}

/**
 * Calcula score de similitud para búsqueda
 */
function calculateMatchScore(contact: OdooContactOffline, searchTerm: string): number {
  const term = searchTerm.toLowerCase().trim()
  const nombre = contact.nombre.toLowerCase()
  const empresa = contact.empresa_nombre.toLowerCase()
  
  let score = 0
  
  // Match exacto en nombre (peso máximo)
  if (nombre === term) {
    score += 100
  } else if (nombre.startsWith(term)) {
    score += 80
  } else if (nombre.includes(term)) {
    score += 60
  }
  
  // Match en empresa
  if (empresa && empresa === term) {
    score += 90
  } else if (empresa && empresa.startsWith(term)) {
    score += 70
  } else if (empresa && empresa.includes(term)) {
    score += 50
  }
  
  // Match en CUIT
  if (contact.cuit && contact.cuit.includes(term)) {
    score += 40
  }
  
  // Match en teléfono
  if (contact.telefono && contact.telefono.includes(term)) {
    score += 30
  }
  
  // Match en ciudad
  if (contact.ciudad && contact.ciudad.toLowerCase().includes(term)) {
    score += 20
  }
  
  return score
}

/**
 * Normaliza texto para comparación: quita tildes, pasa a minúsculas, elimina puntuación
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[.\-,\/\\()]/g, ' ')   // puntuación → espacios
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calcula distancia de Levenshtein entre dos strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // eliminación
        matrix[i][j - 1] + 1,      // inserción
        matrix[i - 1][j - 1] + cost // sustitución
      )
    }
  }
  
  return matrix[a.length][b.length]
}

/**
 * Calcula score de similitud difusa entre dos textos (0-100)
 */
function fuzzyScore(searchTerm: string, target: string): number {
  const normSearch = normalizeText(searchTerm)
  const normTarget = normalizeText(target)
  
  if (!normSearch || !normTarget) return 0
  
  // Match exacto normalizado
  if (normTarget === normSearch) return 100
  
  // Contiene el término
  if (normTarget.includes(normSearch)) return 85
  
  // Comparar palabras individuales
  const searchWords = normSearch.split(' ').filter(w => w.length >= 2)
  const targetWords = normTarget.split(' ').filter(w => w.length >= 2)
  
  if (searchWords.length === 0 || targetWords.length === 0) return 0
  
  let wordMatches = 0
  let partialWordScore = 0
  
  for (const sw of searchWords) {
    let bestWordScore = 0
    
    for (const tw of targetWords) {
      // Palabra exacta
      if (tw === sw) {
        bestWordScore = Math.max(bestWordScore, 1)
        continue
      }
      
      // Palabra empieza con el término
      if (tw.startsWith(sw) || sw.startsWith(tw)) {
        bestWordScore = Math.max(bestWordScore, 0.8)
        continue
      }
      
      // Levenshtein para palabras similares (solo si longitudes son parecidas)
      const maxLen = Math.max(sw.length, tw.length)
      if (Math.abs(sw.length - tw.length) <= 3) {
        const dist = levenshteinDistance(sw, tw)
        const similarity = 1 - dist / maxLen
        if (similarity >= 0.6) { // al menos 60% similar
          bestWordScore = Math.max(bestWordScore, similarity * 0.7)
        }
      }
    }
    
    if (bestWordScore >= 0.8) wordMatches++
    partialWordScore += bestWordScore
  }
  
  // Score basado en proporción de palabras matcheadas
  const wordMatchRatio = wordMatches / searchWords.length
  const partialRatio = partialWordScore / searchWords.length
  
  // Si al menos la mitad de las palabras coinciden, dar buen score
  if (wordMatchRatio >= 0.5) {
    return Math.round(50 + wordMatchRatio * 30 + partialRatio * 10)
  }
  
  // Levenshtein global para strings cortos
  if (normSearch.length <= 15 && normTarget.length <= 30) {
    const dist = levenshteinDistance(normSearch, normTarget.substring(0, normSearch.length + 5))
    const maxLen = Math.max(normSearch.length, normTarget.substring(0, normSearch.length + 5).length)
    const similarity = 1 - dist / maxLen
    if (similarity >= 0.5) {
      return Math.round(similarity * 60)
    }
  }
  
  // Score parcial mínimo
  if (partialRatio > 0.3) {
    return Math.round(partialRatio * 40)
  }
  
  return 0
}

/**
 * Busca contactos similares (fuzzy) cuando la búsqueda exacta no encuentra resultados.
 * Usa distancia de Levenshtein y comparación por palabras para sugerir nombres parecidos.
 */
export async function searchSimilarContacts(
  searchTerm: string,
  limit: number = 5
): Promise<OdooContactSearchResult[]> {
  if (!searchTerm || searchTerm.trim().length < 3) {
    return []
  }
  
  try {
    const contacts = await fetchOdooContacts()
    
    if (contacts.length === 0) return []
    
    const scored: { contact: OdooContactOffline; score: number }[] = []
    
    for (const contact of contacts) {
      // Calcular fuzzy score contra nombre y empresa
      const nameScore = fuzzyScore(searchTerm, contact.nombre)
      const companyScore = contact.empresa_nombre 
        ? fuzzyScore(searchTerm, contact.empresa_nombre) 
        : 0
      
      const bestScore = Math.max(nameScore, companyScore)
      
      // Umbral mínimo de similitud: 25
      if (bestScore >= 25) {
        scored.push({ contact, score: bestScore })
      }
    }
    
    // Ordenar por score descendente
    scored.sort((a, b) => b.score - a.score)
    
    // Deduplicar por nombre (quedarse con el de mayor score)
    const seen = new Set<string>()
    const unique = scored.filter(s => {
      const key = normalizeText(s.contact.es_empresa ? s.contact.nombre : (s.contact.empresa_nombre || s.contact.nombre))
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    
    const results = unique.slice(0, limit).map(s => ({
      id: s.contact.id,
      nombre: s.contact.nombre,
      cuit: s.contact.cuit,
      telefono: s.contact.telefono,
      ciudad: s.contact.ciudad,
      provincia: s.contact.provincia,
      es_empresa: s.contact.es_empresa,
      empresa_nombre: s.contact.empresa_nombre || undefined,
      match_score: s.score
    }))
    
    console.log(`🔍 Búsqueda similar "${searchTerm}": ${results.length} sugerencias`)
    
    return results
    
  } catch (error) {
    console.error('❌ Error buscando contactos similares:', error)
    return []
  }
}

/**
 * Busca contactos de Odoo offline
 */
export async function searchOdooContactsOffline(
  searchTerm: string,
  limit: number = 10
): Promise<OdooContactSearchResult[]> {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return []
  }
  
  try {
    const contacts = await fetchOdooContacts()
    
    if (contacts.length === 0) {
      console.warn('⚠️ No hay contactos disponibles')
      return []
    }
    
    // Buscar y calcular scores
    const matches: OdooContactSearchResult[] = []
    
    for (const contact of contacts) {
      const score = calculateMatchScore(contact, searchTerm)
      
      if (score > 0) {
        matches.push({
          id: contact.id,
          nombre: contact.nombre,
          cuit: contact.cuit,
          telefono: contact.telefono,
          ciudad: contact.ciudad,
          provincia: contact.provincia,
          es_empresa: contact.es_empresa,
          empresa_nombre: contact.empresa_nombre || undefined,
          match_score: score
        })
      }
    }
    
    // Ordenar por score descendente
    matches.sort((a, b) => b.match_score - a.match_score)
    
    // Limitar resultados
    const results = matches.slice(0, limit)
    
    console.log(`🔍 Búsqueda "${searchTerm}": ${results.length} resultados`)
    
    return results
    
  } catch (error) {
    console.error('❌ Error buscando contactos offline:', error)
    return []
  }
}

/**
 * Obtiene un contacto específico por ID
 */
export async function getOdooContactById(id: number): Promise<OdooContactOffline | null> {
  try {
    const contacts = await fetchOdooContacts()
    const contact = contacts.find(c => c.id === id)
    return contact || null
  } catch (error) {
    console.error('❌ Error obteniendo contacto por ID:', error)
    return null
  }
}

/**
 * Obtiene todos los contactos de una empresa
 */
export async function getContactsByCompany(companyId: string): Promise<OdooContactSearchResult[]> {
  try {
    const contacts = await fetchOdooContacts()
    
    const companyContacts = contacts
      .filter(c => c.empresa_id === companyId)
      .map(c => ({
        id: c.id,
        nombre: c.nombre,
        cuit: c.cuit,
        telefono: c.telefono,
        ciudad: c.ciudad,
        provincia: c.provincia,
        es_empresa: c.es_empresa,
        empresa_nombre: c.empresa_nombre || undefined,
        match_score: 100
      }))
    
    return companyContacts
    
  } catch (error) {
    console.error('❌ Error obteniendo contactos de empresa:', error)
    return []
  }
}
