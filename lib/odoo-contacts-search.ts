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
 */
async function fetchOdooContacts(): Promise<OdooContactOffline[]> {
  const isOnline = await checkConnectivity()
  
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
