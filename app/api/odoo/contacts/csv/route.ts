import { NextRequest, NextResponse } from 'next/server'

/**
 * Endpoint para generar CSV de todos los contactos de Odoo
 * Para uso en sistema offline
 */
export async function GET(request: NextRequest) {
  try {
    const odooUrl = process.env.ODOO_URL
    const odooDb = process.env.ODOO_DB
    const odooUsername = process.env.ODOO_USERNAME
    const odooPassword = process.env.ODOO_PASSWORD

    if (!odooUrl || !odooDb || !odooUsername || !odooPassword) {
      return NextResponse.json(
        { error: 'Configuración de Odoo incompleta' },
        { status: 500 }
      )
    }

    // Autenticar
    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: odooUsername,
          password: odooPassword,
        },
      }),
    })

    const authData = await authResponse.json()
    
    if (!authData.result || !authData.result.uid) {
      return NextResponse.json(
        { error: 'Error de autenticación con Odoo' },
        { status: 401 }
      )
    }

    const uid = authData.result.uid

    console.log('📥 Descargando todos los contactos de Odoo...')

    // Obtener todos los contactos
    const execResponse = await fetch(`${odooUrl}/jsonrpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [
            odooDb,
            uid,
            odooPassword,
            'res.partner',
            'search_read',
            [[]], // Sin filtros, todos los contactos
            {
              fields: ['id', 'name', 'vat', 'phone', 'street', 'city', 'state_id', 'is_company', 'parent_id'],
              limit: 10000, // Límite alto para obtener todos
              order: 'name asc'
            }
          ],
        },
        id: Math.floor(Math.random() * 1000000),
      }),
    })

    const execData = await execResponse.json()
    
    if (execData.error) {
      console.error('❌ Error reportado por Odoo:', execData.error)
      return NextResponse.json(execData, { status: 500 })
    }
    
    if (!execData.result || !Array.isArray(execData.result)) {
      return NextResponse.json(
        { error: 'Respuesta inválida de Odoo' },
        { status: 500 }
      )
    }

    console.log(`✅ Obtenidos ${execData.result.length} contactos de Odoo`)

    // Generar CSV
    const csvLines: string[] = []
    
    // Header
    csvLines.push('id,nombre,cuit,telefono,calle,ciudad,provincia,es_empresa,empresa_id,empresa_nombre')
    
    // Datos
    for (const contact of execData.result) {
      const id = contact.id || ''
      const nombre = (contact.name || '').replace(/,/g, ';').replace(/"/g, '""')
      const cuit = (contact.vat || '').replace(/,/g, ';')
      const telefono = (contact.phone || '').replace(/,/g, ';')
      const calle = (contact.street || '').replace(/,/g, ';').replace(/"/g, '""')
      const ciudad = (contact.city || '').replace(/,/g, ';')
      
      // Procesar state_id (puede ser [id, nombre] o false)
      let provincia = ''
      if (contact.state_id) {
        if (Array.isArray(contact.state_id)) {
          provincia = contact.state_id[1] || ''
        } else {
          provincia = String(contact.state_id)
        }
      }
      provincia = provincia.replace(/,/g, ';')
      
      const es_empresa = contact.is_company ? '1' : '0'
      
      // Procesar parent_id (puede ser [id, nombre] o false)
      let empresa_id = ''
      let empresa_nombre = ''
      if (contact.parent_id && Array.isArray(contact.parent_id)) {
        empresa_id = String(contact.parent_id[0] || '')
        empresa_nombre = (contact.parent_id[1] || '').replace(/,/g, ';').replace(/"/g, '""')
      }
      
      csvLines.push(`${id},"${nombre}","${cuit}","${telefono}","${calle}","${ciudad}","${provincia}",${es_empresa},"${empresa_id}","${empresa_nombre}"`)
    }
    
    const csvContent = csvLines.join('\n')
    
    console.log(`📊 CSV generado: ${csvLines.length - 1} contactos, ${csvContent.length} caracteres`)

    // Retornar CSV
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    })

  } catch (error) {
    console.error('❌ Error generando CSV de contactos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
