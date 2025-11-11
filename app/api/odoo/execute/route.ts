import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { model, method, args, kwargs } = await request.json()
    
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

    // Primero autenticamos para obtener el UID
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

    // Log de la petición para debugging
    console.log('📤 Ejecutando en Odoo:', {
      model,
      method,
      args: JSON.stringify(args),
      kwargs: JSON.stringify(kwargs)
    })

    // Ejecutamos el método usando JSON-RPC con execute_kw
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
            model,
            method,
            args || [],
            kwargs || {}
          ],
        },
        id: Math.floor(Math.random() * 1000000),
      }),
    })

    const execData = await execResponse.json()
    
    // Log detallado para debugging
    console.log('📊 Respuesta de Odoo:', JSON.stringify(execData, null, 2))
    
    if (execData.error) {
      console.error('❌ Error reportado por Odoo:', execData.error)
      return NextResponse.json(execData, { status: 500 })
    }
    
    if (!execResponse.ok) {
      console.error('❌ HTTP Error:', execResponse.status, execData)
      return NextResponse.json(
        { error: execData.error || 'Error al ejecutar método' },
        { status: execResponse.status }
      )
    }

    return NextResponse.json(execData)
  } catch (error) {
    console.error('Error en API de ejecución:', error)
    return NextResponse.json(
      { error: 'Error al ejecutar método en Odoo' },
      { status: 500 }
    )
  }
}
