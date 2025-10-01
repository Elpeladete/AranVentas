/**
 * Script de prueba para verificar conexión con Odoo
 * Ejecutar en la consola del navegador para verificar la integración
 */

// Función para probar la conexión con Odoo
async function testOdooConnection() {
  console.log('🔍 Iniciando prueba de conexión con Odoo...')
  
  try {
    // Importar las funciones necesarias
    const { testOdooConnection, isOdooConfigured, getOdooConfigStatus } = await import('./lib/odoo-integration.js')
    
    console.log('📋 Verificando configuración...')
    const config = getOdooConfigStatus()
    console.log('Configuración:', config)
    
    if (!isOdooConfigured()) {
      console.error('❌ Odoo no está configurado correctamente')
      return false
    }
    
    console.log('🔐 Probando autenticación...')
    const result = await testOdooConnection()
    
    if (result.success) {
      console.log('✅ ¡Conexión exitosa con Odoo!')
      return true
    } else {
      console.error('❌ Error de conexión:', result.error)
      return false
    }
  } catch (error) {
    console.error('❌ Error en prueba:', error)
    return false
  }
}

// Función para probar búsqueda de contactos
async function testOdooSearch(searchTerm = 'test') {
  console.log(`🔍 Probando búsqueda de contactos con: "${searchTerm}"`)
  
  try {
    const { searchOdooContacts } = await import('./lib/odoo-integration.js')
    
    const result = await searchOdooContacts(searchTerm)
    
    if (result.success) {
      console.log(`✅ Búsqueda exitosa: ${result.contacts.length} contactos encontrados`)
      console.log('Contactos:', result.contacts)
      return result.contacts
    } else {
      console.error('❌ Error en búsqueda:', result.error)
      return []
    }
  } catch (error) {
    console.error('❌ Error en búsqueda:', error)
    return []
  }
}

// Función para diagnóstico completo
async function diagnoseOdoo() {
  console.log('🩺 DIAGNÓSTICO COMPLETO DE ODOO')
  console.log('================================')
  
  // 1. Verificar configuración
  console.log('\n📋 1. CONFIGURACIÓN:')
  console.log('URL:', process.env.NEXT_PUBLIC_ODOO_URL || 'No configurada')
  console.log('DB:', process.env.NEXT_PUBLIC_ODOO_DB || 'No configurada')
  console.log('User:', process.env.NEXT_PUBLIC_ODOO_USER || 'No configurado')
  console.log('Password:', process.env.NEXT_PUBLIC_ODOO_PASSWORD ? '***' : 'No configurada')
  
  // 2. Probar conexión
  console.log('\n🔐 2. CONEXIÓN:')
  const connectionOk = await testOdooConnection()
  
  if (connectionOk) {
    // 3. Probar búsqueda
    console.log('\n🔍 3. BÚSQUEDA:')
    await testOdooSearch('martin')
    await testOdooSearch('aran')
    await testOdooSearch('tecnologias')
  }
  
  console.log('\n✅ Diagnóstico completado')
}

// Exportar funciones para uso en consola
window.testOdoo = testOdooConnection
window.searchOdoo = testOdooSearch
window.diagnoseOdoo = diagnoseOdoo

console.log(`
🔧 FUNCIONES DE PRUEBA ODOO DISPONIBLES:
- testOdoo() - Probar conexión básica
- searchOdoo('término') - Probar búsqueda de contactos  
- diagnoseOdoo() - Diagnóstico completo

Ejemplo de uso:
> await testOdoo()
> await searchOdoo('martin')
> await diagnoseOdoo()
`)