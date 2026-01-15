/**
 * INTEGRACIÓN CON ODOO - VERSIÓN API
 * Cliente que usa el API interno para evitar problemas de CORS
 */

// 📋 CONFIGURACIÓN
export interface OdooContact {
  id: number
  name: string
  vat: string
  phone: string
  street: string
  city: string
  state: string
}

export interface OdooSearchResult {
  success: boolean
  contacts: OdooContact[]
  error?: string
}

export interface OdooConnectionResult {
  success: boolean
  uid?: number
  error?: string
}

/**
 * Verificar si Odoo está configurado
 */
export function isOdooConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_ODOO_URL
  const db = process.env.NEXT_PUBLIC_ODOO_DB
  const username = process.env.NEXT_PUBLIC_ODOO_USERNAME
  const password = process.env.NEXT_PUBLIC_ODOO_PASSWORD

  return !!(url && db && username && password)
}

/**
 * Obtener estado de configuración de Odoo
 */
export function getOdooConfigStatus() {
  return {
    url: !!process.env.NEXT_PUBLIC_ODOO_URL,
    db: !!process.env.NEXT_PUBLIC_ODOO_DB,
    username: !!process.env.NEXT_PUBLIC_ODOO_USERNAME,
    password: !!process.env.NEXT_PUBLIC_ODOO_PASSWORD,
    configured: isOdooConfigured()
  }
}

/**
 * Probar conexión con Odoo usando nuestras rutas API
 */
export async function testOdooConnection(): Promise<OdooConnectionResult> {
  try {
    console.log('🔍 Probando conexión con Odoo...')

    if (!isOdooConfigured()) {
      return {
        success: false,
        error: 'Odoo no está configurado correctamente'
      }
    }

    const response = await fetch('/api/odoo/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      console.error('❌ Error HTTP:', response.status)
      return {
        success: false,
        error: `Error de conexión: ${response.status}`
      }
    }

    const result = await response.json()
    
    console.log('📊 Respuesta de /api/odoo/authenticate:', JSON.stringify(result, null, 2))
    
    if (result.result && result.result.uid) {
      console.log('✅ Conexión con Odoo exitosa. UID:', result.result.uid)
      return {
        success: true,
        uid: result.result.uid
      }
    } else if (result.error) {
      console.error('❌ Error de autenticación:', JSON.stringify(result.error, null, 2))
      // Convertir error object a string para evitar React Error #31
      const errorMessage = typeof result.error === 'string' 
        ? result.error 
        : result.error.message || result.error.data?.message || JSON.stringify(result.error)
      return {
        success: false,
        error: errorMessage
      }
    } else {
      return {
        success: false,
        error: 'Respuesta inválida del servidor'
      }
    }

  } catch (error) {
    console.error('❌ Error en conexión:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Buscar contactos en Odoo usando nuestras rutas API
 */
export async function searchOdooContacts(searchTerm: string): Promise<OdooSearchResult> {
  try {
    console.log(`🔍 Buscando contactos con: "${searchTerm}"`)

    if (!isOdooConfigured()) {
      return {
        success: false,
        contacts: [],
        error: 'Odoo no está configurado'
      }
    }

    if (!searchTerm || searchTerm.trim().length < 4) {
      return {
        success: true,
        contacts: []
      }
    }

    // Buscar partners (contactos/clientes) en Odoo usando searchRead
    const response = await fetch('/api/odoo/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'res.partner',
        method: 'search_read',
        args: [[['name', 'ilike', searchTerm.trim()]]],
        kwargs: {
          fields: ['id', 'name', 'vat', 'phone', 'street', 'city', 'state_id'],
          limit: 10
        }
      }),
    })

    if (!response.ok) {
      console.error('❌ Error HTTP en búsqueda:', response.status)
      return {
        success: false,
        contacts: [],
        error: `Error de búsqueda: ${response.status}`
      }
    }

    const result = await response.json()
    
    if (result.result && Array.isArray(result.result)) {
      // Mapear resultados al formato OdooContact
      const contacts: OdooContact[] = result.result.map((partner: any) => ({
        id: partner.id,
        name: partner.name || '',
        vat: partner.vat || '',
        phone: partner.phone || '',
        street: partner.street || '',
        city: partner.city || '',
        state: partner.state_id ? (Array.isArray(partner.state_id) ? partner.state_id[1] : partner.state_id) : ''
      }))
      
      console.log(`✅ Encontrados ${contacts.length} contactos`)
      return {
        success: true,
        contacts
      }
    } else if (result.error) {
      console.error('❌ Error en búsqueda:', result.error)
      return {
        success: false,
        contacts: [],
        error: result.error
      }
    } else {
      return {
        success: false,
        contacts: [],
        error: 'Respuesta inválida del servidor'
      }
    }

  } catch (error) {
    console.error('❌ Error en búsqueda de contactos:', error)
    return {
      success: false,
      contacts: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Función auxiliar para formatear contactos
 */
export function formatOdooContact(contact: OdooContact): {
  razonSocial: string
  cuit: string
  telefono: string
  contacto: string
  localidad: string
} {
  return {
    razonSocial: contact.name || '',
    cuit: contact.vat || '',
    telefono: contact.phone || '',
    contacto: contact.name || '',
    localidad: contact.city || ''
  }
}

// Mantener compatibilidad con la API anterior
export const authenticateOdoo = testOdooConnection