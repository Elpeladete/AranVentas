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
 * Verificar si Odoo está configurado.
 * En el navegador no exponemos credenciales: confiamos en que el servidor
 * (rutas /api/odoo/*) tenga las env vars y devuelva el error si faltan.
 */
export function isOdooConfigured(): boolean {
  if (typeof window !== 'undefined') return true
  const url = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL
  const db = process.env.ODOO_DB || process.env.NEXT_PUBLIC_ODOO_DB
  const username = process.env.ODOO_USERNAME || process.env.NEXT_PUBLIC_ODOO_USERNAME
  const password = process.env.ODOO_PASSWORD || process.env.NEXT_PUBLIC_ODOO_PASSWORD
  return !!(url && db && username && password)
}

/**
 * Obtener estado de configuración de Odoo
 */
export function getOdooConfigStatus() {
  const hasUrl = !!(process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL)
  const hasDb = !!(process.env.ODOO_DB || process.env.NEXT_PUBLIC_ODOO_DB)
  const hasUser = !!(process.env.ODOO_USERNAME || process.env.NEXT_PUBLIC_ODOO_USERNAME)
  const hasPwd = !!(process.env.ODOO_PASSWORD || process.env.NEXT_PUBLIC_ODOO_PASSWORD)
  return {
    url: hasUrl,
    db: hasDb,
    username: hasUser,
    password: hasPwd,
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

/**
 * Lee datos extra de un contacto/empresa que no están en OdooContact base:
 * email, mobile, country, contacto adicional.
 */
export interface OdooContactExtra {
  email: string
  mobile: string
  country: string
  child_name: string // primer hijo (contacto) si la empresa tiene
  child_phone: string
}

export async function getContactExtraData(contactId: number): Promise<OdooContactExtra> {
  const empty: OdooContactExtra = { email: '', mobile: '', country: '', child_name: '', child_phone: '' }
  try {
    const response = await fetch('/api/odoo/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'res.partner',
        method: 'read',
        args: [[contactId], ['email', 'mobile', 'country_id', 'child_ids']],
      }),
    })
    if (!response.ok) return empty
    const result = await response.json()
    const row = Array.isArray(result?.result) ? result.result[0] : null
    if (!row) return empty
    const out: OdooContactExtra = {
      email: row.email || '',
      mobile: row.mobile || '',
      country: Array.isArray(row.country_id) ? (row.country_id[1] || '') : '',
      child_name: '',
      child_phone: '',
    }
    const childIds = Array.isArray(row.child_ids) ? row.child_ids : []
    if (childIds.length > 0) {
      const childRes = await fetch('/api/odoo/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'res.partner',
          method: 'read',
          args: [[childIds[0]], ['name', 'phone', 'mobile']],
        }),
      })
      if (childRes.ok) {
        const cd = await childRes.json()
        const cr = Array.isArray(cd?.result) ? cd.result[0] : null
        if (cr) {
          out.child_name = cr.name || ''
          out.child_phone = cr.phone || cr.mobile || ''
        }
      }
    }
    return out
  } catch {
    return empty
  }
}

/**
 * Lee la responsabilidad AFIP (IVA) de un contacto Odoo (localización argentina).
 * Devuelve el nombre del tipo (p.ej. "Responsable Inscripto") o '' si no disponible.
 */
export async function getContactAfipResponsibility(contactId: number): Promise<string> {
  try {
    const response = await fetch('/api/odoo/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'res.partner',
        method: 'read',
        args: [[contactId], ['l10n_ar_afip_responsibility_type_id']],
      }),
    })
    if (!response.ok) return ''
    const result = await response.json()
    const row = Array.isArray(result?.result) ? result.result[0] : null
    const val = row?.l10n_ar_afip_responsibility_type_id
    if (Array.isArray(val) && val.length >= 2) return String(val[1] || '')
    return ''
  } catch {
    return ''
  }
}

/**
 * Busca el ID de un estado/provincia en Odoo por nombre (res.country.state).
 * Hace búsqueda ilike y devuelve el primero. Devuelve null si no encuentra.
 */
export async function findOdooStateId(name: string): Promise<number | null> {
  const term = (name || '').trim()
  if (!term) return null
  try {
    const response = await fetch('/api/odoo/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'res.country.state',
        method: 'search_read',
        args: [[['name', 'ilike', term]]],
        kwargs: { fields: ['id', 'name'], limit: 1 },
      }),
    })
    if (!response.ok) return null
    const data = await response.json()
    const row = Array.isArray(data?.result) ? data.result[0] : null
    return row?.id ?? null
  } catch {
    return null
  }
}

/**
 * Busca el ID del Tipo de Responsabilidad ARCA (ex AFIP) por nombre.
 * Acepta 'Responsable Inscripto', 'IVA Responsable Inscripto', 'Monotributo', etc.
 */
export async function findOdooArcaResponsibilityId(name: string): Promise<number | null> {
  const term = (name || '').trim()
  if (!term) return null
  try {
    const response = await fetch('/api/odoo/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'l10n_ar.afip.responsibility.type',
        method: 'search_read',
        args: [[['name', 'ilike', term]]],
        kwargs: { fields: ['id', 'name'], limit: 1 },
      }),
    })
    if (!response.ok) return null
    const data = await response.json()
    const row = Array.isArray(data?.result) ? data.result[0] : null
    return row?.id ?? null
  } catch {
    return null
  }
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
  street?: string        // Domicilio
  city?: string          // Ciudad (raro en AR; preferir state_id)
  state_id?: number      // ID de res.country.state (lo que llamamos "Localidad")
  l10n_ar_afip_responsibility_type_id?: number // ID del Tipo de Responsabilidad ARCA
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
          street: params.street?.trim() || false,
          city: params.city?.trim() || false,
          state_id: params.state_id || false,
          l10n_ar_afip_responsibility_type_id: params.l10n_ar_afip_responsibility_type_id || false,
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

// =====================================================================
// CRM: Oportunidades (crm.lead) + Attachments al chatter
// =====================================================================

export interface OdooLead {
  id: number
  name: string
  partner_id: number | false
  partner_name?: string
  stage_name?: string
  expected_revenue?: number
  probability?: number
  date_open?: string | false
  active: boolean
  type: string // 'opportunity' | 'lead'
  // estado calculado
  status: "open" | "won" | "lost"
}

async function odooExecute<T = any>(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<T> {
  const response = await fetch("/api/odoo/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, method, args, kwargs }),
  })
  if (!response.ok) throw new Error(`Odoo HTTP ${response.status}`)
  const data = await response.json()
  if (data.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error))
  return data.result as T
}

/**
 * Lista oportunidades del CRM relacionadas con un partner (cliente o sus contactos).
 * Incluye won/lost. El llamador puede filtrar por status.
 */
export async function listOdooLeadsForPartner(partnerId: number): Promise<OdooLead[]> {
  if (!partnerId) return []
  // Incluir partners hijos: buscamos por commercial_partner_id si es empresa, o por partner_id directo.
  const domain: any[] = [
    "|",
    ["partner_id", "=", partnerId],
    ["partner_id.commercial_partner_id", "=", partnerId],
  ]
  const rows = await odooExecute<any[]>("crm.lead", "search_read", [domain], {
    fields: ["id", "name", "partner_id", "stage_id", "expected_revenue", "probability", "date_open", "active", "type", "won_status"],
    limit: 200,
    order: "date_open desc, id desc",
    context: { active_test: false }, // incluir lost (archived)
  })
  return (rows || []).map((r) => {
    let status: OdooLead["status"] = "open"
    // En Odoo 17+: won_status existe ('won'|'lost'|'pending'). Fallback: probability/active.
    if (r.won_status === "won" || r.probability === 100) status = "won"
    else if (r.won_status === "lost" || r.active === false) status = "lost"
    return {
      id: r.id,
      name: r.name,
      partner_id: Array.isArray(r.partner_id) ? r.partner_id[0] : r.partner_id,
      partner_name: Array.isArray(r.partner_id) ? r.partner_id[1] : undefined,
      stage_name: Array.isArray(r.stage_id) ? r.stage_id[1] : undefined,
      expected_revenue: r.expected_revenue,
      probability: r.probability,
      date_open: r.date_open,
      active: r.active,
      type: r.type,
      status,
    }
  })
}

/**
 * Crea una nueva oportunidad asociada al partner.
 */
export async function createOdooLead(params: { name: string; partner_id: number; expected_revenue?: number }): Promise<number> {
  const vals: any = {
    name: params.name,
    partner_id: params.partner_id,
    type: "opportunity",
  }
  if (params.expected_revenue && params.expected_revenue > 0) vals.expected_revenue = params.expected_revenue
  const id = await odooExecute<number>("crm.lead", "create", [vals])
  return id
}

/**
 * Adjunta un archivo (base64) al chatter de un crm.lead y publica un mensaje.
 * `dataBase64` debe ser sólo el contenido base64 (sin prefijo "data:...;base64,").
 */
export async function attachFileToLead(params: {
  leadId: number
  filename: string
  mimetype: string
  dataBase64: string
  message?: string
}): Promise<{ attachmentId: number; messageId: number }> {
  const attachmentId = await odooExecute<number>("ir.attachment", "create", [
    {
      name: params.filename,
      datas: params.dataBase64,
      res_model: "crm.lead",
      res_id: params.leadId,
      mimetype: params.mimetype,
      type: "binary",
    },
  ])
  const body = params.message || `Adjunto: ${params.filename}`
  const messageId = await odooExecute<number>("crm.lead", "message_post", [[params.leadId]], {
    body,
    attachment_ids: [attachmentId],
    message_type: "comment",
    subtype_xmlid: "mail.mt_note",
  })
  return { attachmentId, messageId }
}

// ============================================================================
// Productos (product.product) - usado en Nota de Venta
// ============================================================================

export interface OdooProduct {
  id: number
  default_code: string // código interno
  name: string
  list_price: number // precio de lista
  uom_name?: string
}

export async function searchOdooProducts(term: string, limit = 20): Promise<OdooProduct[]> {
  const t = term.trim()
  if (t.length < 2) return []
  const domain: any[] = ["|", ["default_code", "ilike", t], ["name", "ilike", t]]
  const rows = await odooExecute<any[]>("product.product", "search_read", [domain], {
    fields: ["id", "default_code", "name", "list_price", "uom_name"],
    limit,
    order: "default_code asc, name asc",
  })
  return (rows || []).map((r) => ({
    id: r.id,
    default_code: r.default_code || "",
    name: r.name || "",
    list_price: typeof r.list_price === "number" ? r.list_price : 0,
    uom_name: r.uom_name || undefined,
  }))
}

// ============================================================================
// Empleados (hr.employee) - usado para Asesor comercial
// ============================================================================

export interface OdooEmployee {
  id: number
  name: string
  work_email?: string
  job_title?: string
}

let _employeesCache: { ts: number; rows: OdooEmployee[] } | null = null

export async function listOdooEmployees(forceRefresh = false): Promise<OdooEmployee[]> {
  const now = Date.now()
  if (!forceRefresh && _employeesCache && now - _employeesCache.ts < 5 * 60_000) {
    return _employeesCache.rows
  }
  const rows = await odooExecute<any[]>("hr.employee", "search_read", [[["active", "=", true]]], {
    fields: ["id", "name", "work_email", "job_title"],
    limit: 500,
    order: "name asc",
  })
  const list = (rows || []).map((r) => ({
    id: r.id,
    name: r.name || "",
    work_email: r.work_email || undefined,
    job_title: r.job_title || undefined,
  }))
  _employeesCache = { ts: now, rows: list }
  return list
}

