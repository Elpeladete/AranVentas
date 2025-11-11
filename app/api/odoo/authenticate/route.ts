import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
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

    const response = await fetch(`${odooUrl}/web/session/authenticate`, {
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

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error en API de autenticación:', error)
    return NextResponse.json(
      { error: 'Error al conectar con Odoo' },
      { status: 500 }
    )
  }
}
