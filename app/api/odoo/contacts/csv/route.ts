import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel: extender el timeout (Hobby=10s, Pro=hasta 300s)
export const maxDuration = 60

const BATCH_SIZE = 1000

async function odooAuth(odooUrl: string, odooDb: string, login: string, password: string) {
  const res = await fetch(`${odooUrl}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: odooDb, login, password },
    }),
  })
  const data = await res.json()
  return data?.result?.uid as number | undefined
}

async function odooSearchRead(
  odooUrl: string,
  odooDb: string,
  uid: number,
  password: string,
  offset: number,
  limit: number,
) {
  const res = await fetch(`${odooUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          odooDb,
          uid,
          password,
          'res.partner',
          'search_read',
          [[]],
          {
            fields: ['id', 'name', 'vat', 'phone', 'street', 'city', 'state_id', 'is_company', 'parent_id'],
            limit,
            offset,
            order: 'id asc',
          },
        ],
      },
      id: Math.floor(Math.random() * 1_000_000),
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} desde Odoo`)
  const data = await res.json()
  if (data.error) throw new Error(`Odoo error: ${JSON.stringify(data.error)}`)
  if (!Array.isArray(data.result)) throw new Error('Respuesta invalida de Odoo')
  return data.result as Array<Record<string, unknown>>
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined || v === false) return ''
  return String(v).replace(/"/g, '""').replace(/[\r\n]+/g, ' ')
}

export async function GET(_request: NextRequest) {
  try {
    const odooUrl = process.env.ODOO_URL
    const odooDb = process.env.ODOO_DB
    const odooUsername = process.env.ODOO_USERNAME
    const odooPassword = process.env.ODOO_PASSWORD

    if (!odooUrl || !odooDb || !odooUsername || !odooPassword) {
      return NextResponse.json({ error: 'Configuracion de Odoo incompleta' }, { status: 500 })
    }

    const uid = await odooAuth(odooUrl, odooDb, odooUsername, odooPassword)
    if (!uid) {
      return NextResponse.json({ error: 'Error de autenticacion con Odoo' }, { status: 401 })
    }

    const csvLines: string[] = []
    csvLines.push('id,nombre,cuit,telefono,calle,ciudad,provincia,es_empresa,empresa_id,empresa_nombre')

    let offset = 0
    let total = 0
    // Tope de seguridad para no quedar en bucle
    while (offset < 50000) {
      const batch = await odooSearchRead(odooUrl, odooDb, uid, odooPassword, offset, BATCH_SIZE)
      if (batch.length === 0) break
      for (const c of batch) {
        const id = (c as any).id ?? ''
        const nombre = csvEscape((c as any).name)
        const cuit = csvEscape((c as any).vat)
        const telefono = csvEscape((c as any).phone)
        const calle = csvEscape((c as any).street)
        const ciudad = csvEscape((c as any).city)
        const stateRaw = (c as any).state_id
        const provincia = csvEscape(Array.isArray(stateRaw) ? stateRaw[1] : '')
        const esEmpresa = (c as any).is_company ? '1' : '0'
        const parentRaw = (c as any).parent_id
        const empresaId = Array.isArray(parentRaw) ? parentRaw[0] : ''
        const empresaNombre = csvEscape(Array.isArray(parentRaw) ? parentRaw[1] : '')
        csvLines.push(
          `${id},"${nombre}","${cuit}","${telefono}","${calle}","${ciudad}","${provincia}",${esEmpresa},"${empresaId}","${empresaNombre}"`,
        )
      }
      total += batch.length
      offset += batch.length
      if (batch.length < BATCH_SIZE) break
    }

    const csvContent = csvLines.join('\n')
    console.log(`CSV contactos generado: ${total} filas, ${csvContent.length} caracteres`)

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error generando CSV de contactos:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
