import { NextRequest, NextResponse } from 'next/server'

/**
 * Escapar caracteres especiales para XML
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
    }
    return c
  })
}

/**
 * Parser manual de contactos para casos donde el parser principal falla
 */
function parseContactsManually(xmlText: string): any[] {
  try {
    const contacts: any[] = []
    
    // Buscar todas las estructuras de contacto
    const structRegex = /<value><struct>(.*?)<\/struct><\/value>/g
    const structMatches = Array.from(xmlText.matchAll(structRegex))
    
    for (const structMatch of structMatches) {
      const structContent = structMatch[1]
      const contact: any = {}
      
      // Extraer cada campo
      const memberRegex = /<member><name>(.*?)<\/name><value>(?:<string>(.*?)<\/string>|<int>(.*?)<\/int>|<boolean>(.*?)<\/boolean>|<array.*?\/array>|<struct.*?\/struct>)<\/value><\/member>/g
      const memberMatches = Array.from(structContent.matchAll(memberRegex))
      
      for (const memberMatch of memberMatches) {
        const fieldName = memberMatch[1]
        const stringValue = memberMatch[2]
        const intValue = memberMatch[3]
        const boolValue = memberMatch[4]
        
        if (stringValue !== undefined) {
          contact[fieldName] = stringValue
        } else if (intValue !== undefined) {
          contact[fieldName] = parseInt(intValue)
        } else if (boolValue !== undefined) {
          contact[fieldName] = boolValue === '1' || boolValue === 'true'
        }
      }
      
      if (contact.name || contact.id) {
        contacts.push(contact)
      }
    }
    
    return contacts
  } catch (error) {
    console.error('❌ Error en parseo manual:', error)
    return []
  }
}

// Configuración de Odoo desde variables de entorno
const ODOO_CONFIG = {
  url: process.env.NEXT_PUBLIC_ODOO_URL || '',
  db: process.env.NEXT_PUBLIC_ODOO_DB || '',
  user: process.env.NEXT_PUBLIC_ODOO_USERNAME || '',
  password: process.env.NEXT_PUBLIC_ODOO_PASSWORD || ''
}

console.log('🔧 Configuración Odoo cargada:', {
  url: ODOO_CONFIG.url,
  db: ODOO_CONFIG.db,
  user: ODOO_CONFIG.user,
  hasPassword: !!ODOO_CONFIG.password
})

/**
 * Construir llamada XML-RPC para Odoo
 */
function buildXmlRpcCall(service: string, method: string, params: any[]): string {
  const encodedParams = params.map(param => {
    if (typeof param === 'string') {
      return `<value><string>${param}</string></value>`
    } else if (typeof param === 'number') {
      return `<value><int>${param}</int></value>`
    } else if (Array.isArray(param)) {
      const arrayValues = param.map(item => {
        if (typeof item === 'string') {
          return `<value><string>${item}</string></value>`
        } else if (typeof item === 'number') {
          return `<value><int>${item}</int></value>`
        }
        return `<value><string>${String(item)}</string></value>`
      }).join('')
      return `<value><array><data>${arrayValues}</data></array></value>`
    } else if (typeof param === 'object' && param !== null) {
      const structMembers = Object.entries(param).map(([key, value]) => {
        let valueXml = `<value><string>${String(value)}</string></value>`
        if (typeof value === 'number') {
          valueXml = `<value><int>${value}</int></value>`
        } else if (typeof value === 'boolean') {
          valueXml = `<value><boolean>${value ? '1' : '0'}</boolean></value>`
        }
        return `<member><name>${key}</name>${valueXml}</member>`
      }).join('')
      return `<value><struct>${structMembers}</struct></value>`
    }
    return `<value><string>${String(param)}</string></value>`
  }).join('')

  return `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <value><string>${ODOO_CONFIG.db}</string></value>
    <value><int>1</int></value>
    <value><string>dummy</string></value>
    <value><string>${service}</string></value>
    <value><string>${method}</string></value>
    ${encodedParams}
  </params>
</methodCall>`
}

/**
 * Parsear respuesta XML-RPC
 */
function parseXmlRpcResponse(xmlText: string): any {
  try {
    // Buscar el contenido dentro de <value>
    const valueRegex = /<value>(.*?)<\/value>/g
    const matches = Array.from(xmlText.matchAll(valueRegex))
    
    if (matches.length === 0) {
      console.error('❌ No se encontraron valores en la respuesta XML')
      return null
    }

    const firstValue = matches[0][1]
    
    // Si es un array
    if (firstValue.includes('<array>')) {
      const arrayRegex = /<array><data>(.*?)<\/data><\/array>/
      const arrayMatch = firstValue.match(arrayRegex)
      if (arrayMatch) {
        const arrayContent = arrayMatch[1]
        const itemMatches = Array.from(arrayContent.matchAll(valueRegex))
        return itemMatches.map(match => {
          const itemContent = match[1]
          if (itemContent.includes('<struct>')) {
            return parseStruct(itemContent)
          } else if (itemContent.includes('<string>')) {
            return itemContent.match(/<string>(.*?)<\/string>/)?.[1] || ''
          } else if (itemContent.includes('<int>')) {
            return parseInt(itemContent.match(/<int>(.*?)<\/int>/)?.[1] || '0')
          }
          return itemContent
        })
      }
    }
    
    // Si es un struct
    if (firstValue.includes('<struct>')) {
      return parseStruct(firstValue)
    }
    
    // Si es un string simple
    if (firstValue.includes('<string>')) {
      return firstValue.match(/<string>(.*?)<\/string>/)?.[1] || ''
    }
    
    // Si es un número
    if (firstValue.includes('<int>')) {
      return parseInt(firstValue.match(/<int>(.*?)<\/int>/)?.[1] || '0')
    }
    
    return firstValue
  } catch (error) {
    console.error('❌ Error parseando XML-RPC:', error)
    return null
  }
}

function parseStruct(structContent: string): any {
  const result: any = {}
  const memberRegex = /<member><name>(.*?)<\/name><value>(.*?)<\/value><\/member>/g
  const members = Array.from(structContent.matchAll(memberRegex))
  
  for (const member of members) {
    const key = member[1]
    const valueContent = member[2]
    
    if (valueContent.includes('<string>')) {
      result[key] = valueContent.match(/<string>(.*?)<\/string>/)?.[1] || ''
    } else if (valueContent.includes('<int>')) {
      result[key] = parseInt(valueContent.match(/<int>(.*?)<\/int>/)?.[1] || '0')
    } else if (valueContent.includes('<boolean>')) {
      const boolValue = valueContent.match(/<boolean>(.*?)<\/boolean>/)?.[1]
      result[key] = boolValue === '1' || boolValue === 'true'
    } else {
      result[key] = valueContent
    }
  }
  
  return result
}

/**
 * Autenticar con Odoo
 */
async function authenticate(): Promise<number | null> {
  try {
    const authXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <value><string>${escapeXml(ODOO_CONFIG.db)}</string></value>
    <value><string>${escapeXml(ODOO_CONFIG.user)}</string></value>
    <value><string>${escapeXml(ODOO_CONFIG.password)}</string></value>
    <value><struct></struct></value>
  </params>
</methodCall>`

    console.log('🔐 Autenticando con Odoo...')
    console.log('📋 Configuración:', {
      url: ODOO_CONFIG.url,
      db: ODOO_CONFIG.db,
      user: ODOO_CONFIG.user,
      password: ODOO_CONFIG.password ? '***' + ODOO_CONFIG.password.slice(-3) : 'NO_PASSWORD'
    })
    
    const response = await fetch(`${ODOO_CONFIG.url}/xmlrpc/2/common`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
      },
      body: authXml,
    })

    if (!response.ok) {
      console.error('❌ Error HTTP en autenticación:', response.status)
      return null
    }

    const xmlText = await response.text()
    console.log('📋 Respuesta de autenticación:', xmlText.substring(0, 200) + '...')
    
    const uid = parseXmlRpcResponse(xmlText)
    console.log('👤 UID obtenido:', uid)
    
    return typeof uid === 'number' ? uid : null
  } catch (error) {
    console.error('❌ Error en autenticación:', error)
    return null
  }
}

/**
 * Buscar contactos en Odoo (versión simplificada)
 */
async function searchContacts(searchTerm: string, uid: number): Promise<any[]> {
  try {
    console.log(`🔍 Buscando contactos con término: "${searchTerm}"`)
    
    // Usar solo búsqueda básica por nombre
    const searchXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <value><string>${escapeXml(ODOO_CONFIG.db)}</string></value>
    <value><int>${uid}</int></value>
    <value><string>${escapeXml(ODOO_CONFIG.password)}</string></value>
    <value><string>res.partner</string></value>
    <value><string>search_read</string></value>
    <value><array><data>
      <value><array><data>
        <value><array><data>
          <value><string>name</string></value>
          <value><string>ilike</string></value>
          <value><string>${escapeXml(searchTerm)}</string></value>
        </data></array></value>
      </data></array></value>
    </data></array></value>
    <value><struct>
      <member>
        <name>fields</name>
        <value><array><data>
          <value><string>name</string></value>
          <value><string>vat</string></value>
          <value><string>phone</string></value>
          <value><string>city</string></value>
          <value><string>state_id</string></value>
        </data></array></value>
      </member>
      <member>
        <name>limit</name>
        <value><int>10</int></value>
      </member>
    </struct></value>
  </params>
</methodCall>`

    console.log('📤 XML de búsqueda:', searchXml.substring(0, 200) + '...')

    const searchResponse = await fetch(`${ODOO_CONFIG.url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
      },
      body: searchXml,
    })

    if (!searchResponse.ok) {
      console.error(`❌ Error HTTP en búsqueda: ${searchResponse.status}`)
      return []
    }

    const searchXmlText = await searchResponse.text()
    console.log(`📋 Respuesta de búsqueda:`, searchXmlText.substring(0, 300) + '...')
    
    // Verificar si hay fault
    if (searchXmlText.includes('<fault>')) {
      console.error('❌ Fault en búsqueda:', searchXmlText)
      return []
    }
    
    const searchContacts = parseXmlRpcResponse(searchXmlText)
    
    console.log('🔍 Resultado del parser:', searchContacts)
    console.log('🔍 Tipo de resultado:', typeof searchContacts, Array.isArray(searchContacts))
    console.log('🔍 ¿Contiene <struct>?', searchXmlText.includes('<struct>'))
    
    if (Array.isArray(searchContacts) && searchContacts.length > 0) {
      console.log(`✅ Encontrados ${searchContacts.length} contactos`)
      return searchContacts
    }
    
    // Intentar parsear manualmente SIEMPRE que tengamos XML con struct y el parser principal falle
    if (searchXmlText.includes('<struct>') && (!Array.isArray(searchContacts) || searchContacts.length === 0)) {
      console.log('🛠️ Intentando parseo manual...')
      console.log('📜 XML completo:', searchXmlText)
      
      // Parser manual mejorado - buscar todas las estructuras
      const contacts: any[] = []
      
      // Buscar cada struct individual
      const structMatches = searchXmlText.match(/<struct>[\s\S]*?<\/struct>/g)
      
      if (structMatches) {
        console.log(`🔍 Encontradas ${structMatches.length} estructuras`)
        
        structMatches.forEach((structXml, index) => {
          console.log(`📋 Procesando estructura ${index + 1}:`, structXml.substring(0, 200))
          
          const contact: any = {}
          
          // Extraer campos con regex mejorados que manejen diferentes tipos de valores
          const idMatch = structXml.match(/<member>[\s\S]*?<name>id<\/name>[\s\S]*?<value><int>(\d+)<\/int><\/value>[\s\S]*?<\/member>/)
          const nameMatch = structXml.match(/<member>[\s\S]*?<name>name<\/name>[\s\S]*?<value><string>(.*?)<\/string><\/value>[\s\S]*?<\/member>/)
          const vatMatch = structXml.match(/<member>[\s\S]*?<name>vat<\/name>[\s\S]*?<value><string>(.*?)<\/string><\/value>[\s\S]*?<\/member>/)
          // Para phone, manejar tanto string como boolean
          const phoneStringMatch = structXml.match(/<member>[\s\S]*?<name>phone<\/name>[\s\S]*?<value><string>(.*?)<\/string><\/value>[\s\S]*?<\/member>/)
          const phoneBoolMatch = structXml.match(/<member>[\s\S]*?<name>phone<\/name>[\s\S]*?<value><boolean>([01])<\/boolean><\/value>[\s\S]*?<\/member>/)
          const cityMatch = structXml.match(/<member>[\s\S]*?<name>city<\/name>[\s\S]*?<value><string>(.*?)<\/string><\/value>[\s\S]*?<\/member>/)
          // state_id es un array [id, nombre] en Odoo - buscar el segundo elemento
          const stateArrayMatch = structXml.match(/<member>[\s\S]*?<name>state_id<\/name>[\s\S]*?<value><array><data>[\s\S]*?<value><string>(.*?)<\/string><\/value>[\s\S]*?<\/data><\/array><\/value>[\s\S]*?<\/member>/)
          
          if (idMatch) {
            contact.id = parseInt(idMatch[1])
            console.log(`✅ ID encontrado: ${contact.id}`)
          }
          if (nameMatch) {
            contact.name = nameMatch[1]
            console.log(`✅ Nombre encontrado: ${contact.name}`)
          }
          if (vatMatch) {
            contact.vat = vatMatch[1]
            console.log(`✅ VAT encontrado: ${contact.vat}`)
          }
          // Procesar teléfono con ambos tipos
          if (phoneStringMatch && phoneStringMatch[1] && phoneStringMatch[1] !== 'false' && phoneStringMatch[1] !== '0') {
            contact.phone = phoneStringMatch[1]
            console.log(`✅ Teléfono encontrado: ${contact.phone}`)
          } else {
            console.log(`ℹ️ Sin teléfono válido`)
          }
          if (cityMatch) {
            contact.city = cityMatch[1]
            console.log(`✅ Ciudad encontrada: ${contact.city}`)
          }
          // Extraer el nombre de la provincia del array state_id
          if (stateArrayMatch) {
            // Guardar en state_id para mantener consistencia con el mapeo
            contact.state_id = stateArrayMatch[1]
            console.log(`✅ Provincia encontrada: ${contact.state_id}`)
          } else {
            console.log(`⚠️ No se encontró state_id en el XML`)
          }
          
          if (contact.id && contact.name) {
            contacts.push(contact)
            console.log(`✅ Contacto agregado:`, contact)
          }
        })
      }
      
      if (contacts.length > 0) {
        console.log(`✅ Parser manual encontró ${contacts.length} contactos:`, contacts)
        return contacts
      } else {
        console.log('❌ Parser manual no encontró contactos válidos')
      }
    }
    
    console.log('ℹ️ No se encontraron contactos')
    return []

  } catch (error) {
    console.error('❌ Error en búsqueda de contactos:', error)
    return []
  }
}

/**
 * Endpoint POST para operaciones con Odoo
 */
export async function POST(request: NextRequest) {
  try {
    const { action, searchTerm } = await request.json()

    console.log(`🚀 API Odoo - Acción: ${action}`)

    // Verificar configuración
    if (!ODOO_CONFIG.url || !ODOO_CONFIG.db || !ODOO_CONFIG.user || !ODOO_CONFIG.password) {
      console.error('❌ Configuración de Odoo incompleta')
      return NextResponse.json({
        success: false,
        error: 'Configuración de Odoo incompleta'
      })
    }

    // Autenticar
    const uid = await authenticate()
    if (!uid) {
      console.error('❌ Fallo en autenticación')
      return NextResponse.json({
        success: false,
        error: 'Error de autenticación con Odoo'
      })
    }

    console.log('✅ Autenticación exitosa, UID:', uid)

    // Manejar acciones
    if (action === 'test') {
      return NextResponse.json({
        success: true,
        message: 'Conexión exitosa con Odoo',
        uid
      })
    }

    if (action === 'search' && searchTerm) {
      const contacts = await searchContacts(searchTerm, uid)
      
      return NextResponse.json({
        success: true,
        contacts: contacts.map(contact => ({
          id: contact.id || 0,
          name: contact.name || '',
          vat: contact.vat || '',
          phone: contact.phone || '',
          street: contact.street || '',
          city: contact.city || '',
          state: contact.state_id ? (Array.isArray(contact.state_id) ? contact.state_id[1] : contact.state_id) : ''
        }))
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Acción no válida'
    })

  } catch (error) {
    console.error('❌ Error en API Odoo:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    })
  }
}

/**
 * Endpoint GET para verificar estado
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'API Odoo funcionando',
    config: {
      url: !!ODOO_CONFIG.url,
      db: !!ODOO_CONFIG.db,
      user: !!ODOO_CONFIG.user,
      password: !!ODOO_CONFIG.password
    }
  })
}