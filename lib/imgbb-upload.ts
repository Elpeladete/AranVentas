/**
 * Servicio para subir imágenes a ImgBB
 * Documentación: https://api.imgbb.com/
 */

const IMGBB_API_KEY = '2f651ab1858afc2478cb3da0a3b12988'
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload'

export interface ImgBBResponse {
  data: {
    id: string
    title: string
    url_viewer: string
    url: string
    display_url: string
    width: number
    height: number
    size: number
    time: number
    expiration: number
    image: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    thumb: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    medium: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    delete_url: string
  }
  success: boolean
  status: number
}

/**
 * Sube una imagen en base64 a ImgBB con reintentos automáticos
 * @param base64Image - Imagen en formato base64 (con o sin prefijo data:image)
 * @param name - Nombre opcional para la imagen
 * @param retryCount - Número de reintentos (para uso interno)
 * @returns Promise con la respuesta de ImgBB
 */
export async function uploadImageToImgBB(
  base64Image: string, 
  name: string = 'signature',
  retryCount: number = 0
): Promise<ImgBBResponse> {
  const maxRetries = 3
  const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Backoff exponencial: 1s, 2s, 4s, max 10s
  
  try {
    console.log(`🚀 Iniciando upload a ImgBB para: ${name}${retryCount > 0 ? ` (Reintento ${retryCount}/${maxRetries})` : ''}`)
    console.log(`📏 Tamaño del base64: ${base64Image.length} caracteres`)
    
    // Limpiar el base64 (remover prefijo data:image/png;base64, si existe)
    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '')
    console.log(`🧹 Base64 limpio, tamaño: ${cleanBase64.length} caracteres`)
    
    // Crear FormData
    const formData = new FormData()
    formData.append('key', IMGBB_API_KEY)
    formData.append('image', cleanBase64)
    formData.append('name', name)
    
    console.log(`📤 Enviando petición a ImgBB...`)
    
    // Realizar la petición con timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 segundos timeout
    
    const response = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    console.log(`📡 Respuesta recibida de ImgBB - Status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Error HTTP en ImgBB: ${response.status} - ${errorText}`)
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
    }
    
    const result: ImgBBResponse = await response.json()
    console.log(`🔍 Respuesta de ImgBB procesada:`, {
      success: result.success,
      url: result.data?.url,
      size: result.data?.size
    })
    
    if (!result.success) {
      console.error(`❌ Upload falló según ImgBB:`, result)
      throw new Error('Upload failed according to ImgBB response')
    }
    
    console.log(`✅ Upload exitoso a ImgBB: ${result.data.url}`)
    return result
    
  } catch (error) {
    const isNetworkError = error instanceof TypeError && error.message.includes('fetch')
    const isTimeoutError = error instanceof Error && error.name === 'AbortError'
    const shouldRetry = (isNetworkError || isTimeoutError) && retryCount < maxRetries
    
    if (shouldRetry) {
      console.warn(`⚠️ Error de red en upload a ImgBB, reintentando en ${retryDelay}ms...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return uploadImageToImgBB(base64Image, name, retryCount + 1)
    }
    
    if (isTimeoutError) {
      console.error('❌ Timeout en upload a ImgBB después de reintentos')
      throw new Error('Upload timeout - La subida tomó demasiado tiempo')
    }
    
    console.error('❌ Error uploading to ImgBB:', error)
    throw error
  }
}

/**
 * Convierte un canvas a base64 y lo sube a ImgBB
 * @param canvas - Canvas element
 * @param name - Nombre para la imagen
 * @param quality - Calidad de compresión (0-1)
 * @returns Promise con la respuesta de ImgBB
 */
export async function uploadCanvasToImgBB(
  canvas: HTMLCanvasElement,
  name: string = 'signature',
  quality: number = 0.9
): Promise<ImgBBResponse> {
  const base64 = canvas.toDataURL('image/png', quality)
  return uploadImageToImgBB(base64, name)
}

/**
 * Genera un nombre único para la firma
 * @param orderNumber - Número de orden
 * @param type - Tipo de firma ('tecnico' | 'cliente')
 * @returns Nombre único para la imagen
 */
export function generateSignatureName(orderNumber: string, type: 'tecnico' | 'cliente'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  return `ARAN-Firma-${type}-${orderNumber}-${timestamp}`
}