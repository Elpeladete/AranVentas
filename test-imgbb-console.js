// Script para probar ImgBB directamente desde la consola del navegador
// Copia y pega esto en la consola de desarrollador (F12)

async function testImgBB() {
  try {
    console.log('🧪 Iniciando test de ImgBB...')
    
    // Imagen de test pequeña (1x1 pixel en base64)
    const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77ZgAAAABJRU5ErkJggg=='
    
    const IMGBB_API_KEY = '2f651ab1858afc2478cb3da0a3b12988'
    const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload'
    
    const formData = new FormData()
    formData.append('key', IMGBB_API_KEY)
    formData.append('image', testImage)
    formData.append('name', 'test-from-console')
    
    console.log('📤 Enviando petición a ImgBB...')
    
    const response = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: formData
    })
    
    console.log('📡 Respuesta recibida - Status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error HTTP:', response.status, errorText)
      return false
    }
    
    const result = await response.json()
    console.log('🔍 Respuesta completa:', result)
    
    if (result.success) {
      console.log('✅ Test exitoso!')
      console.log('URL de la imagen:', result.data.url)
      
      // Crear enlace de WhatsApp de prueba
      const message = `🧪 Test de ImgBB desde ARAN Tecnologías\n\n✅ Imagen de prueba subida exitosamente\n\n🖼️ Ver imagen: ${result.data.url}`
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
      console.log('📱 URL de WhatsApp:', whatsappUrl)
      
      return result.data.url
    } else {
      console.error('❌ Upload falló:', result)
      return false
    }
    
  } catch (error) {
    console.error('❌ Error en test:', error)
    return false
  }
}

// Ejecutar test automáticamente
testImgBB()