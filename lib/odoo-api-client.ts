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
  const user = process.env.NEXT_PUBLIC_ODOO_USER
  const password = process.env.NEXT_PUBLIC_ODOO_PASSWORD

  return !!(url && db && user && password)
}

/**
 * Obtener estado de configuración de Odoo
 */
export function getOdooConfigStatus() {
  return {
    url: !!process.env.NEXT_PUBLIC_ODOO_URL,
    db: !!process.env.NEXT_PUBLIC_ODOO_DB,
    user: !!process.env.NEXT_PUBLIC_ODOO_USER,
    password: !!process.env.NEXT_PUBLIC_ODOO_PASSWORD,
    configured: isOdooConfigured()
  }
}

/**
 * Probar conexión con Odoo
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

    const response = await fetch('/api/odoo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test'
      }),
    })

    if (!response.ok) {
      console.error('❌ Error HTTP:', response.status)
      return {
        success: false,
        error: `Error de conexión: ${response.status}`
      }
    }

    const result = await response.json()
    
    if (result.success) {
      console.log('✅ Conexión con Odoo exitosa')
      return {
        success: true,
        uid: result.uid
      }
    } else {
      console.error('❌ Error de autenticación:', result.error)
      return {
        success: false,
        error: result.error
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
 * Buscar contactos en Odoo
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

    const response = await fetch('/api/odoo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'search',
        searchTerm: searchTerm.trim()
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
    
    if (result.success) {
      console.log(`✅ Encontrados ${result.contacts.length} contactos`)
      return {
        success: true,
        contacts: result.contacts
      }
    } else {
      console.error('❌ Error en búsqueda:', result.error)
      return {
        success: false,
        contacts: [],
        error: result.error
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