// Test script para probar ImgBB upload
import { uploadImageToImgBB } from './lib/imgbb-upload.js'

// Imagen de test pequeña (1x1 pixel en base64)
const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77ZgAAAABJRU5ErkJggg=='

console.log('🧪 Iniciando test de ImgBB...')

uploadImageToImgBB(testImage, 'test-image')
  .then(result => {
    console.log('✅ Test exitoso!')
    console.log('URL:', result.data.url)
  })
  .catch(error => {
    console.error('❌ Test falló:', error)
  })