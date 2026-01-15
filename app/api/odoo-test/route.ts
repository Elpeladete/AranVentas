/**
 * Endpoint de prueba para probar diferentes configuraciones de Odoo
 */

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

export async function POST(request: NextRequest) {
  try {
    const { testType = 'default' } = await request.json()

    const realPassword = 'cEiSa?f^E!rKf+2'
    
    // Configuraciones de prueba
    const configs = {
      default: {
        url: 'https://arantecnologias.odoo.com',
        db: 'arantecnologias',
        user: 'martinaused@arantecnologias.com.ar',
        password: realPassword
      },
      
      // Probar con usuario sin dominio
      simple: {
        url: 'https://arantecnologias.odoo.com',
        db: 'arantecnologias',
        user: 'martinaused',
        password: realPassword
      },
      
      // Probar con db sin guión
      dbnoguion: {
        url: 'https://arantecnologias.odoo.com',
        db: 'arantecnologias',
        user: 'martinaused@arantecnologias.com.ar',
        password: realPassword
      },

      // Probar con email sin arroba
      emailsimple: {
        url: 'https://arantecnologias.odoo.com',
        db: 'arantecnologias',
        user: 'martinaused@arantecnologias.com.ar',
        password: realPassword
      },

      // Probar admin (usuario por defecto)
      admin: {
        url: 'https://arantecnologias.odoo.com',
        db: 'arantecnologias',
        user: 'admin',
        password: realPassword
      }
    }

    const config = configs[testType as keyof typeof configs] || configs.default
    
    console.log(`🧪 Probando configuración ${testType}:`, {
      url: config.url,
      db: config.db,
      user: config.user,
      password: '***'
    })

    const authXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <value><string>${escapeXml(config.db)}</string></value>
    <value><string>${escapeXml(config.user)}</string></value>
    <value><string>${escapeXml(config.password)}</string></value>
    <value><struct></struct></value>
  </params>
</methodCall>`

    console.log('📤 XML enviado:', authXml)

    const response = await fetch(`${config.url}/xmlrpc/2/common`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
      },
      body: authXml,
    })

    console.log('📊 Response status:', response.status)
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        config: config
      })
    }

    const xmlText = await response.text()
    console.log('📄 Respuesta XML completa:', xmlText)

    // Analizar la respuesta
    let result = 'unknown'
    if (xmlText.includes('<boolean>0</boolean>')) {
      result = 'auth_failed'
    } else if (xmlText.includes('<boolean>1</boolean>')) {
      result = 'auth_success_boolean'
    } else if (xmlText.includes('<int>')) {
      const uidMatch = xmlText.match(/<int>(\d+)<\/int>/)
      if (uidMatch) {
        result = `auth_success_uid_${uidMatch[1]}`
      }
    } else if (xmlText.includes('fault')) {
      result = 'fault_error'
    }

    return NextResponse.json({
      success: true,
      config: config,
      responseStatus: response.status,
      xmlResponse: xmlText,
      analysis: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error en test:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de prueba de Odoo',
    usage: 'POST con { "testType": "default|simple|dbtest" }'
  })
}