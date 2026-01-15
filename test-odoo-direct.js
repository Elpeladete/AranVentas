/**
 * Script de prueba directa de conexión a Odoo
 * Para ejecutar: node test-odoo-direct.js
 */

const fetch = require('node-fetch');

const ODOO_CONFIG = {
  url: 'https://arantecnologias.odoo.com',
  db: 'arantecnologias', 
  user: 'martinaused@arantecnologias.com.ar',
  password: 'AusedM'
}

async function testDirectOdooConnection() {
  try {
    console.log('🔍 Probando conexión directa a Odoo...')
    console.log(`URL: ${ODOO_CONFIG.url}`)
    console.log(`DB: ${ODOO_CONFIG.db}`)
    console.log(`User: ${ODOO_CONFIG.user}`)
    
    const authXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <value><string>${ODOO_CONFIG.db}</string></value>
    <value><string>${ODOO_CONFIG.user}</string></value>
    <value><string>${ODOO_CONFIG.password}</string></value>
    <value><struct></struct></value>
  </params>
</methodCall>`

    console.log('📤 Enviando XML:', authXml)

    const response = await fetch(`${ODOO_CONFIG.url}/xmlrpc/2/common`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
      },
      body: authXml,
    })

    console.log('📊 Status:', response.status)
    console.log('📋 Headers:', Object.fromEntries(response.headers))

    if (!response.ok) {
      console.error('❌ Error HTTP:', response.status, response.statusText)
      return
    }

    const xmlText = await response.text()
    console.log('📄 Respuesta completa:', xmlText)
    
    if (xmlText.includes('<boolean>0</boolean>')) {
      console.log('❌ Autenticación fallida - credenciales incorrectas')
    } else if (xmlText.includes('<int>')) {
      const uidMatch = xmlText.match(/<int>(\d+)<\/int>/)
      if (uidMatch) {
        console.log('✅ Autenticación exitosa - UID:', uidMatch[1])
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// También probar conectividad básica
async function testConnectivity() {
  try {
    console.log('🌐 Probando conectividad básica...')
    const response = await fetch(ODOO_CONFIG.url, { method: 'HEAD' })
    console.log('📊 Conectividad status:', response.status)
  } catch (error) {
    console.error('❌ Error de conectividad:', error.message)
  }
}

async function runTests() {
  await testConnectivity()
  await testDirectOdooConnection()
}

runTests()