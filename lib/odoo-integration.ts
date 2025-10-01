/**
 * Integración con Odoo usando XML-RPC
 * Basado en la documentación de integración Odoo con Google Apps Script
 */

// ⚙️ CONFIGURACIÓN DE ODOO
const ODOO_CONFIG = {
  url: process.env.NEXT_PUBLIC_ODOO_URL || '',
  db: process.env.NEXT_PUBLIC_ODOO_DB || '',
  username: process.env.NEXT_PUBLIC_ODOO_USER || '',
  password: process.env.NEXT_PUBLIC_ODOO_PASSWORD || ''
}

// 🔗 INTERFACES
export interface OdooContact {
  id: number
  name: string
  vat?: string // CUIT
  email?: string
  phone?: string
  city?: string
  is_company: boolean
  contact_person?: string
}

export interface OdooSearchResult {
  success: boolean
  contacts: OdooContact[]
  error?: string
}

// 🛠️ FUNCIONES DE UTILIDAD XML-RPC

/**
 * Serializa un valor para XML-RPC
 */
function xmlrpcSerialize(value: any): string {
  if (Array.isArray(value)) {
    return `<param><value><array><data>${value.map(item => xmlrpcSerialize(item)).join('')}</data></array></value></param>`
  } else if (typeof value === 'string') {
    return `<param><value><string>${escapeXml(value)}</string></value></param>`
  } else if (typeof value === 'number') {
    return Number.isInteger(value) ? 
      `<param><value><int>${value}</int></value></param>` :
      `<param><value><double>${value}</double></value></param>`
  } else if (typeof value === 'boolean') {
    return `<param><value><boolean>${value ? 1 : 0}</boolean></value></param>`
  } else {
    return `<param><value><string>${escapeXml(String(value))}</string></value></param>`
  }
}

/**
 * Escapa caracteres XML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Parsea respuesta XML-RPC simple
 */
function xmlrpcParseResponse(xmlResponse: string): any {
  try {
    // Buscar contenido entre tags de valor
    const stringMatch = xmlResponse.match(/<string>([\s\S]*?)<\/string>/)
    const arrayMatch = xmlResponse.match(/<array>[\s\S]*?<\/array>/)
    const faultMatch = xmlResponse.match(/<fault>[\s\S]*?<\/fault>/)
    
    if (faultMatch) {
      throw new Error('Odoo XML-RPC Fault: ' + faultMatch[0])
    }
    
    if (stringMatch) {
      return stringMatch[1]
    }
    
    if (arrayMatch) {
      // Para arrays complejos, necesitaríamos un parser más robusto
      // Por ahora, retornamos el XML para procesamiento manual
      return xmlResponse
    }
    
    // Intentar extraer valores simples
    const valueMatch = xmlResponse.match(/<value><(\w+)>(.*?)<\/\1><\/value>/)
    if (valueMatch) {
      const [, type, content] = valueMatch
      switch (type) {
        case 'int':
          return parseInt(content, 10)
        case 'double':
          return parseFloat(content)
        case 'boolean':
          return content === '1'
        case 'string':
          return content
        default:
          return content
      }
    }
    
    throw new Error('Respuesta XML-RPC no reconocida')
  } catch (error) {
    console.error('Error parseando XML-RPC:', error)
    throw error
  }
}

// 🔐 FUNCIONES DE AUTENTICACIÓN

/**
 * Autentica con Odoo y retorna el UID del usuario
 */
export async function authenticateOdoo(): Promise<number> {
  if (!ODOO_CONFIG.url || !ODOO_CONFIG.db || !ODOO_CONFIG.username || !ODOO_CONFIG.password) {
    throw new Error('Configuración de Odoo incompleta. Verifica las variables de entorno.')
  }

  const endpoint = `${ODOO_CONFIG.url}/xmlrpc/2/common`
  
  const payload = `<?xml version="1.0"?>
  <methodCall>
    <methodName>authenticate</methodName>
    <params>
      <param><value><string>${ODOO_CONFIG.db}</string></value></param>
      <param><value><string>${ODOO_CONFIG.username}</string></value></param>
      <param><value><string>${ODOO_CONFIG.password}</string></value></param>
      <param><value><struct></struct></value></param>
    </params>
  </methodCall>`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'User-Agent': 'AranServices/1.0'
      },
      body: payload
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const responseText = await response.text()
    const uid = xmlrpcParseResponse(responseText)

    if (!uid || uid === false) {
      throw new Error('Credenciales de Odoo inválidas')
    }

    console.log('✅ Autenticación Odoo exitosa, UID:', uid)
    return uid as number
  } catch (error) {
    console.error('❌ Error de autenticación Odoo:', error)
    throw error
  }
}

// 🔍 FUNCIONES DE BÚSQUEDA

/**
 * Ejecuta una llamada XML-RPC a Odoo
 */
async function xmlrpcExecute(
  uid: number,
  model: string,
  method: string,
  args: any[]
): Promise<any> {
  const endpoint = `${ODOO_CONFIG.url}/xmlrpc/2/object`
  
  const payload = `<?xml version="1.0"?>
  <methodCall>
    <methodName>execute_kw</methodName>
    <params>
      <param><value><string>${ODOO_CONFIG.db}</string></value></param>
      <param><value><int>${uid}</int></value></param>
      <param><value><string>${ODOO_CONFIG.password}</string></value></param>
      <param><value><string>${model}</string></value></param>
      <param><value><string>${method}</string></value></param>
      <param><value><array><data>${args.map(arg => xmlrpcSerialize(arg)).join('')}</data></array></value></param>
    </params>
  </methodCall>`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'User-Agent': 'AranServices/1.0'
      },
      body: payload
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const responseText = await response.text()
    
    // Para respuestas complejas como search_read, necesitamos parsear el XML manualmente
    // Por ahora, retornamos una estructura simulada basada en la documentación
    if (method === 'search_read' && model === 'res.partner') {
      // Simulación basada en la estructura esperada
      return parseContactsFromXML(responseText)
    }
    
    return xmlrpcParseResponse(responseText)
  } catch (error) {
    console.error(`❌ Error XML-RPC ${method} en ${model}:`, error)
    throw error
  }
}

/**
 * Parsea contactos desde XML de respuesta (implementación simplificada)
 */
function parseContactsFromXML(xmlResponse: string): OdooContact[] {
  // Esta es una implementación simplificada
  // En producción, necesitarías un parser XML completo
  try {
    // Buscar patrones de datos de contactos en el XML
    const contacts: OdooContact[] = []
    
    // Por ahora, retornamos datos de prueba que simulan la respuesta de Odoo
    // TODO: Implementar parser XML completo
    
    return contacts
  } catch (error) {
    console.error('Error parseando contactos XML:', error)
    return []
  }
}

/**
 * Busca contactos en Odoo por razón social
 */
export async function searchOdooContacts(searchTerm: string): Promise<OdooSearchResult> {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return { success: true, contacts: [] }
  }

  try {
    console.log('🔍 Buscando en Odoo:', searchTerm)
    
    // Verificar configuración
    if (!isOdooConfigured()) {
      return { 
        success: false, 
        contacts: [], 
        error: 'Odoo no está configurado' 
      }
    }

    // Autenticar
    const uid = await authenticateOdoo()
    
    // Búsqueda con múltiples criterios (nombre, VAT/CUIT)
    const domain = [
      ['active', '=', true],
      '|', '|', // Operadores OR
      ['name', 'ilike', searchTerm],
      ['vat', 'ilike', searchTerm],
      ['display_name', 'ilike', searchTerm]
    ]

    // Estrategia progresiva de campos (basada en la documentación)
    const fieldStrategies = [
      ['id', 'name', 'vat', 'email', 'phone', 'city', 'is_company'],
      ['id', 'name', 'vat', 'email', 'phone', 'is_company'],
      ['id', 'name', 'vat', 'email', 'is_company'],
      ['id', 'name', 'is_company']
    ]

    let contacts: OdooContact[] = []

    // Intentar con cada estrategia de campos
    for (const fields of fieldStrategies) {
      try {
        console.log(`📋 Intentando con campos:`, fields)
        
        const result = await xmlrpcExecute(
          uid,
          'res.partner',
          'search_read',
          [domain, fields, 0, 10] // Límite de 10 resultados
        )

        contacts = processOdooContacts(result || [])
        break // Éxito, salir del bucle
      } catch (error) {
        console.warn(`⚠️ Falló estrategia de campos:`, fields, error)
        continue // Intentar siguiente estrategia
      }
    }

    console.log(`✅ Encontrados ${contacts.length} contactos`)
    
    return {
      success: true,
      contacts: contacts
    }

  } catch (error) {
    console.error('❌ Error buscando contactos Odoo:', error)
    return {
      success: false,
      contacts: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Procesa y normaliza contactos de Odoo
 */
function processOdooContacts(rawContacts: any[]): OdooContact[] {
  return rawContacts
    .filter(contact => contact && contact.id)
    .map(contact => ({
      id: contact.id,
      name: contact.name || 'Sin nombre',
      vat: contact.vat || undefined,
      email: contact.email || undefined,
      phone: contact.phone || undefined,
      city: contact.city || undefined,
      is_company: contact.is_company || false,
      contact_person: contact.is_company ? undefined : contact.name
    }))
    .slice(0, 10) // Máximo 10 resultados
}

/**
 * Obtiene detalles completos de un contacto
 */
export async function getOdooContactDetails(contactId: number): Promise<OdooContact | null> {
  try {
    console.log('📋 Obteniendo detalles del contacto:', contactId)
    
    const uid = await authenticateOdoo()
    
    const result = await xmlrpcExecute(
      uid,
      'res.partner',
      'read',
      [contactId, ['id', 'name', 'vat', 'email', 'phone', 'city', 'is_company']]
    )

    if (result && result[0]) {
      return processOdooContacts([result[0]])[0]
    }

    return null
  } catch (error) {
    console.error('❌ Error obteniendo detalles:', error)
    return null
  }
}

// 🔧 FUNCIONES DE UTILIDAD

/**
 * Verifica si Odoo está configurado
 */
export function isOdooConfigured(): boolean {
  return !!(
    ODOO_CONFIG.url &&
    ODOO_CONFIG.db &&
    ODOO_CONFIG.username &&
    ODOO_CONFIG.password
  )
}

/**
 * Obtiene el estado de configuración de Odoo
 */
export function getOdooConfigStatus() {
  return {
    configured: isOdooConfigured(),
    hasUrl: !!ODOO_CONFIG.url,
    hasDb: !!ODOO_CONFIG.db,
    hasUsername: !!ODOO_CONFIG.username,
    hasPassword: !!ODOO_CONFIG.password
  }
}

/**
 * Función de prueba de conexión
 */
export async function testOdooConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isOdooConfigured()) {
      return { success: false, error: 'Odoo no está configurado' }
    }

    const uid = await authenticateOdoo()
    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error de conexión' 
    }
  }
}