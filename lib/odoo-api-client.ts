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
  is_company: boolean           // Para identificar si es empresa o persona
  parent_id?: number | [number, string]  // ID de la empresa padre si es un contacto
  parent_name?: string          // Nombre de la empresa padre
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
    // Buscamos por nombre del contacto O por nombre de la empresa padre
    const response = await fetch('/api/odoo/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'res.partner',
        method: 'search_read',
        args: [[
          '|', 
          ['name', 'ilike', searchTerm.trim()],
          ['parent_id', 'ilike', searchTerm.trim()]
        ]],
        kwargs: {
          fields: ['id', 'name', 'vat', 'phone', 'street', 'city', 'state_id', 'is_company', 'parent_id'],
          limit: 20,
          order: 'is_company desc, name asc'  // Primero empresas, luego personas alfabéticamente
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
      const contacts: OdooContact[] = result.result.map((partner: any) => {
        const contact: OdooContact = {
          id: partner.id,
          name: partner.name || '',
          vat: partner.vat || '',
          phone: partner.phone || '',
          street: partner.street || '',
          city: partner.city || '',
          state: partner.state_id ? (Array.isArray(partner.state_id) ? partner.state_id[1] : partner.state_id) : '',
          is_company: partner.is_company || false,
          parent_id: partner.parent_id || undefined
        }
        
        // Si tiene parent_id y es un array [id, nombre], extraer el nombre
        if (contact.parent_id && Array.isArray(contact.parent_id)) {
          contact.parent_name = contact.parent_id[1]
        }
        
        console.log(`📋 Contacto procesado: ${contact.name} - ${contact.is_company ? '🏢 Empresa' : '👤 Persona'}${contact.parent_name ? ` (de ${contact.parent_name})` : ''}`)
        
        return contact
      })
      
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

/**
 * Buscar contactos (personas) asociados a una empresa específica
 */
export async function searchContactsByCompany(companyId: number, searchTerm: string = ''): Promise<OdooSearchResult> {
  try {
    console.log(`🔍 Buscando contactos de la empresa ID: ${companyId} con término: "${searchTerm}"`)

    if (!isOdooConfigured()) {
      return {
        success: false,
        contacts: [],
        error: 'Odoo no está configurado'
      }
    }

    // Construir el dominio de búsqueda
    const domain: any[] = [
      ['parent_id', '=', companyId],  // Solo contactos de esta empresa
      ['is_company', '=', false]      // Solo personas, no empresas
    ]

    // Si hay término de búsqueda, agregarlo
    if (searchTerm && searchTerm.trim().length >= 2) {
      domain.push(['name', 'ilike', searchTerm.trim()])
    }

    const response = await fetch('/api/odoo/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'res.partner',
        method: 'search_read',
        args: [domain],
        kwargs: {
          fields: ['id', 'name', 'vat', 'phone', 'street', 'city', 'state_id', 'is_company', 'parent_id'],
          limit: 50,
          order: 'name asc'
        }
      }),
    })

    if (!response.ok) {
      console.error('❌ Error HTTP en búsqueda por empresa:', response.status)
      return {
        success: false,
        contacts: [],
        error: `Error de búsqueda: ${response.status}`
      }
    }

    const result = await response.json()
    
    if (result.result && Array.isArray(result.result)) {
      const contacts: OdooContact[] = result.result.map((partner: any) => {
        const contact: OdooContact = {
          id: partner.id,
          name: partner.name || '',
          vat: partner.vat || '',
          phone: partner.phone || '',
          street: partner.street || '',
          city: partner.city || '',
          state: partner.state_id ? (Array.isArray(partner.state_id) ? partner.state_id[1] : partner.state_id) : '',
          is_company: false,
          parent_id: partner.parent_id || undefined
        }
        
        if (contact.parent_id && Array.isArray(contact.parent_id)) {
          contact.parent_name = contact.parent_id[1]
        }
        
        return contact
      })
      
      console.log(`✅ Encontrados ${contacts.length} contactos de la empresa`)
      return {
        success: true,
        contacts
      }
    } else if (result.error) {
      console.error('❌ Error en búsqueda por empresa:', result.error)
      return {
        success: false,
        contacts: [],
        error: result.error
      }
    }

    return {
      success: false,
      contacts: [],
      error: 'Respuesta inválida del servidor'
    }

  } catch (error) {
    console.error('❌ Error en búsqueda de contactos por empresa:', error)
    return {
      success: false,
      contacts: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Crear un nuevo contacto asociado a una empresa en Odoo
 */
export interface CreateContactParams {
  name: string           // Nombre del contacto
  phone?: string         // Teléfono del contacto
  parent_id: number      // ID de la empresa padre
}

export interface CreateContactResult {
  success: boolean
  contact?: OdooContact
  error?: string
}

export async function createOdooContact(params: CreateContactParams): Promise<CreateContactResult> {
  try {
    console.log('📝 Creando nuevo contacto en Odoo:', params)

    if (!isOdooConfigured()) {
      return {
        success: false,
        error: 'Odoo no está configurado'
      }
    }

    // Validar datos requeridos
    if (!params.name || params.name.trim().length < 2) {
      return {
        success: false,
        error: 'El nombre es requerido (mínimo 2 caracteres)'
      }
    }

    if (!params.parent_id) {
      return {
        success: false,
        error: 'El ID de la empresa padre es requerido'
      }
    }

    // Crear el contacto en Odoo
    const response = await fetch('/api/odoo/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'res.partner',
        method: 'create',
        args: [{
          name: params.name.trim(),
          phone: params.phone?.trim() || false,
          parent_id: params.parent_id,
          is_company: false,
          type: 'contact'
        }]
      }),
    })

    if (!response.ok) {
      console.error('❌ Error HTTP al crear contacto:', response.status)
      return {
        success: false,
        error: `Error al crear contacto: ${response.status}`
      }
    }

    const result = await response.json()
    
    if (result.result && typeof result.result === 'number') {
      const newId = result.result
      console.log(`✅ Contacto creado con ID: ${newId}`)
      
      // Obtener los datos completos del contacto recién creado
      const contactData = await fetch('/api/odoo/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'res.partner',
          method: 'read',
          args: [[newId]],
          kwargs: {
            fields: ['id', 'name', 'vat', 'phone', 'street', 'city', 'state_id', 'is_company', 'parent_id']
          }
        }),
      })

      if (contactData.ok) {
        const dataResult = await contactData.json()
        if (dataResult.result && Array.isArray(dataResult.result) && dataResult.result[0]) {
          const partner = dataResult.result[0]
          const contact: OdooContact = {
            id: partner.id,
            name: partner.name || '',
            vat: partner.vat || '',
            phone: partner.phone || '',
            street: partner.street || '',
            city: partner.city || '',
            state: partner.state_id ? (Array.isArray(partner.state_id) ? partner.state_id[1] : partner.state_id) : '',
            is_company: false,
            parent_id: partner.parent_id || undefined
          }
          
          if (contact.parent_id && Array.isArray(contact.parent_id)) {
            contact.parent_name = contact.parent_id[1]
          }
          
          return {
            success: true,
            contact
          }
        }
      }
      
      // Si no se puede leer, retornar un contacto mínimo
      return {
        success: true,
        contact: {
          id: newId,
          name: params.name,
          vat: '',
          phone: params.phone || '',
          street: '',
          city: '',
          state: '',
          is_company: false,
          parent_id: params.parent_id
        }
      }
      
    } else if (result.error) {
      console.error('❌ Error al crear contacto:', result.error)
      const errorMessage = typeof result.error === 'string' 
        ? result.error 
        : result.error.message || result.error.data?.message || JSON.stringify(result.error)
      return {
        success: false,
        error: errorMessage
      }
    }

    return {
      success: false,
      error: 'Respuesta inválida del servidor'
    }

  } catch (error) {
    console.error('❌ Error creando contacto:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Crear una nueva empresa en Odoo
 */
export interface CreateCompanyParams {
  name: string           // Razón Social
  vat?: string           // CUIT
  phone?: string         // Teléfono
  contactName?: string   // Nombre del contacto principal (opcional)
}

export interface CreateCompanyResult {
  success: boolean
  company?: OdooContact
  contact?: OdooContact  // Contacto principal si se creó
  error?: string
}

export async function createOdooCompany(params: CreateCompanyParams): Promise<CreateCompanyResult> {
  try {
    console.log('🏢 Creando nueva empresa en Odoo:', params)

    if (!isOdooConfigured()) {
      return {
        success: false,
        error: 'Odoo no está configurado'
      }
    }

    // Validar datos requeridos
    if (!params.name || params.name.trim().length < 2) {
      return {
        success: false,
        error: 'La Razón Social es requerida (mínimo 2 caracteres)'
      }
    }

    // Validar CUIT si se proporciona (formato argentino: XX-XXXXXXXX-X)
    if (params.vat) {
      const cleanVat = params.vat.replace(/[-\s]/g, '')
      if (cleanVat.length !== 11 || !/^\d{11}$/.test(cleanVat)) {
        return {
          success: false,
          error: 'El CUIT debe tener 11 dígitos (formato: XX-XXXXXXXX-X)'
        }
      }
    }

    // Crear la empresa en Odoo
    const response = await fetch('/api/odoo/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'res.partner',
        method: 'create',
        args: [{
          name: params.name.trim(),
          vat: params.vat?.trim() || false,
          phone: params.phone?.trim() || false,
          is_company: true,
          type: 'contact'
        }]
      }),
    })

    if (!response.ok) {
      console.error('❌ Error HTTP al crear empresa:', response.status)
      return {
        success: false,
        error: `Error al crear empresa: ${response.status}`
      }
    }

    const result = await response.json()
    
    if (result.result && typeof result.result === 'number') {
      const companyId = result.result
      console.log(`✅ Empresa creada con ID: ${companyId}`)
      
      // Obtener los datos completos de la empresa recién creada
      const companyData = await fetch('/api/odoo/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'res.partner',
          method: 'read',
          args: [[companyId]],
          kwargs: {
            fields: ['id', 'name', 'vat', 'phone', 'street', 'city', 'state_id', 'is_company', 'parent_id']
          }
        }),
      })

      let company: OdooContact | undefined

      if (companyData.ok) {
        const dataResult = await companyData.json()
        if (dataResult.result && Array.isArray(dataResult.result) && dataResult.result[0]) {
          const partner = dataResult.result[0]
          company = {
            id: partner.id,
            name: partner.name || '',
            vat: partner.vat || '',
            phone: partner.phone || '',
            street: partner.street || '',
            city: partner.city || '',
            state: partner.state_id ? (Array.isArray(partner.state_id) ? partner.state_id[1] : partner.state_id) : '',
            is_company: true
          }
        }
      }

      // Si no se pudo leer, crear objeto mínimo
      if (!company) {
        company = {
          id: companyId,
          name: params.name,
          vat: params.vat || '',
          phone: params.phone || '',
          street: '',
          city: '',
          state: '',
          is_company: true
        }
      }

      // Si se proporcionó un nombre de contacto, crear el contacto asociado
      let contact: OdooContact | undefined
      if (params.contactName && params.contactName.trim().length >= 2) {
        console.log(`👤 Creando contacto "${params.contactName}" para la empresa...`)
        const contactResult = await createOdooContact({
          name: params.contactName.trim(),
          phone: params.phone?.trim(),
          parent_id: companyId
        })
        
        if (contactResult.success && contactResult.contact) {
          contact = contactResult.contact
          console.log(`✅ Contacto creado con ID: ${contact.id}`)
        } else {
          console.warn('⚠️ No se pudo crear el contacto:', contactResult.error)
        }
      }

      return {
        success: true,
        company,
        contact
      }
      
    } else if (result.error) {
      console.error('❌ Error al crear empresa:', result.error)
      const errorMessage = typeof result.error === 'string' 
        ? result.error 
        : result.error.message || result.error.data?.message || JSON.stringify(result.error)
      return {
        success: false,
        error: errorMessage
      }
    }

    return {
      success: false,
      error: 'Respuesta inválida del servidor'
    }

  } catch (error) {
    console.error('❌ Error creando empresa:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// Mantener compatibilidad con la API anterior
export const authenticateOdoo = testOdooConnection