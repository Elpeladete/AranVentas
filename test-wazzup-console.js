/**
 * Script de prueba para Wazzup API
 * Usar en la consola del navegador para diagnosticar problemas
 */

async function testWazzupSetup() {
  console.log('🧪 Iniciando diagnóstico de Wazzup...')
  
  // 1. Verificar configuración
  const apiKey = 'YOUR_WAZZUP_API_KEY' // Reemplazar con tu API key real
  const baseUrl = 'https://api.wazzup24.com'
  
  console.log('🔑 API Key configurada:', apiKey !== 'YOUR_WAZZUP_API_KEY' ? '✅ Sí' : '❌ No')
  
  if (apiKey === 'YOUR_WAZZUP_API_KEY') {
    console.error('❌ CONFIGURACIÓN REQUERIDA: Edita este script y coloca tu API key real de Wazzup')
    return false
  }
  
  // 2. Probar endpoint de mensaje de texto
  const testPhone = '5491123456789' // Reemplazar con un número real para pruebas
  const testMessage = '🧪 Test de Wazzup API - ARAN Tecnologías'
  
  try {
    console.log('📤 Probando envío de texto...')
    
    const textResponse = await fetch(`${baseUrl}/v3/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        chatId: testPhone + '@c.us',
        text: testMessage
      })
    })
    
    console.log('📡 Respuesta de texto - Status:', textResponse.status)
    
    const textResult = await textResponse.json()
    console.log('📋 Respuesta de texto completa:', textResult)
    
    if (textResponse.ok) {
      console.log('✅ Envío de texto: EXITOSO')
    } else {
      console.error('❌ Envío de texto: FALLÓ')
      return false
    }
    
    // 3. Probar envío de imagen (usando ImgBB de prueba)
    const testImageUrl = 'https://i.ibb.co/9HNjBf7/test-image.png' // URL de prueba
    
    console.log('📤 Probando envío de imagen...')
    
    const imageResponse = await fetch(`${baseUrl}/v3/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        chatId: testPhone + '@c.us',
        file: testImageUrl,
        caption: 'Test de imagen desde ARAN Tecnologías'
      })
    })
    
    console.log('📡 Respuesta de imagen - Status:', imageResponse.status)
    
    const imageResult = await imageResponse.json()
    console.log('🖼️ Respuesta de imagen completa:', imageResult)
    
    if (imageResponse.ok) {
      console.log('✅ Envío de imagen: EXITOSO')
      console.log('🎉 ¡Wazzup está configurado correctamente!')
      return true
    } else {
      console.error('❌ Envío de imagen: FALLÓ')
      return false
    }
    
  } catch (error) {
    console.error('❌ Error en prueba de Wazzup:', error)
    return false
  }
}

// Función para probar con datos reales de una orden
async function testWazzupWithOrder() {
  console.log('🧪 Probando con datos de orden real...')
  
  // Datos de prueba que simula una orden real
  const testOrder = {
    numeroOrden: 'TEST-001',
    fecha: '2025-01-01',
    razonSocial: 'Empresa Test SRL',
    contacto: 'Juan Pérez',
    telefono: '5491123456789', // Reemplazar con número real
    descripcion: 'Servicio de prueba para testing de Wazzup API'
  }
  
  // URL de imagen de prueba (reemplazar con una real)
  const testImageUrl = 'https://i.ibb.co/9HNjBf7/test-image.png'
  
  try {
    // Simular la función real (ya que estamos en consola)
    const orderText = `🔧 *ORDEN DE SERVICIO - ARAN TECNOLOGÍAS*

📋 *Orden N°:* ${testOrder.numeroOrden}
📅 *Fecha:* ${testOrder.fecha}

👤 *Cliente:*
• Razón Social: ${testOrder.razonSocial}
• Contacto: ${testOrder.contacto}
• Teléfono: ${testOrder.telefono}

🔧 *Servicio:*
${testOrder.descripcion}

---
🏢 *ARAN Tecnologías*
Sistema de Órdenes de Servicio`

    console.log('📱 Enviando orden de prueba...')
    console.log('💬 Mensaje que se enviará:', orderText)
    console.log('🖼️ Imagen que se enviará:', testImageUrl)
    
    // Aquí llamarías a tu función real cuando esté configurada
    console.log('ℹ️ Para probar realmente, configura Wazzup y usa: sendServiceOrderToWhatsApp()')
    
    return true
    
  } catch (error) {
    console.error('❌ Error en prueba de orden:', error)
    return false
  }
}

// Ejecutar diagnóstico automáticamente
console.log('🚀 Iniciando diagnóstico automático de Wazzup...')
console.log('')
console.log('📝 INSTRUCCIONES:')
console.log('1. Edita este archivo y coloca tu API key real de Wazzup')
console.log('2. Coloca un número de teléfono real para pruebas') 
console.log('3. Ejecuta: testWazzupSetup()')
console.log('4. Si funciona, ejecuta: testWazzupWithOrder()')
console.log('')
console.log('🔧 Para usar en tu aplicación:')
console.log('• Configura NEXT_PUBLIC_WAZZUP_API_KEY en .env.local')
console.log('• El sistema automáticamente enviará texto + imagen por WhatsApp')
console.log('')

// Mostrar configuración actual
const currentApiKey = 'YOUR_WAZZUP_API_KEY' // Placeholder
console.log('⚙️ Estado actual de configuración:')
console.log('• API Key:', currentApiKey === 'YOUR_WAZZUP_API_KEY' ? '❌ No configurada' : '✅ Configurada')
console.log('')
console.log('💡 TIP: Si ves "❌ No configurada", edita wazzup-api.ts y coloca tu API key real')
