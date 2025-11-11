/**
 * Wazzup API Integration for WhatsApp Business
 * Documentación: https://wazzup24.com/docs/api
 */

export interface WazzupConfig {
  apiKey: string
  channelId: string
  baseUrl?: string
}

export interface WazzupTextMessage {
  channelId: string
  chatType: string
  chatId: string
  text: string
}

export interface WazzupImageMessage {
  channelId: string
  chatType: string
  chatId: string
  text?: string
  file: {
    url: string
    filename: string
  }
}

export interface WazzupApiResponse {
  success: boolean
  messageId?: string
  error?: string
}

// Configuración con credenciales reales de Wazzup
const DEFAULT_CONFIG: WazzupConfig = {
  apiKey: '9a807d7e759044d78ae1049e5ef2e273',
//  channelId: '5d636b50-9ebc-4690-8c8c-ad6fb44bbcc7',
  channelId: '3afb4472-71cf-4709-a226-840a0522bf63',
  baseUrl: 'https://api.wazzup24.com'
}

// Función para verificar si Wazzup está configurado correctamente
function isWazzupConfigured(config: WazzupConfig = DEFAULT_CONFIG): boolean {
  return config.apiKey !== 'YOUR_WAZZUP_API_KEY' && 
         config.channelId !== 'YOUR_CHANNEL_ID' &&
         config.apiKey.length > 10 && 
         config.channelId.length > 10
}

/**
 * Envía un mensaje de texto por WhatsApp usando Wazzup API
 */
export async function sendWhatsAppText(
  chatId: string, 
  text: string, 
  config: WazzupConfig = DEFAULT_CONFIG
): Promise<WazzupApiResponse> {
  try {
    console.log('📱 Enviando mensaje de texto por WhatsApp:', { chatId, textLength: text.length })

    const payload = {
      channelId: config.channelId,
      chatType: "whatsapp",
      chatId: chatId,
      text: text
    }

    console.log('📤 Payload para Wazzup:', payload)

    const response = await fetch(`${config.baseUrl}/v3/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error en API Wazzup:', response.status, errorText)
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      }
    }

    const result = await response.json()
    console.log('✅ Mensaje de texto enviado exitosamente:', result)

    return {
      success: true,
      messageId: result.id || result.messageId
    }

  } catch (error) {
    console.error('❌ Error enviando mensaje de texto:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Envía una imagen por WhatsApp usando Wazzup API
 */
export async function sendWhatsAppImage(
  chatId: string, 
  imageUrl: string, 
  caption?: string,
  config: WazzupConfig = DEFAULT_CONFIG
): Promise<WazzupApiResponse> {
  try {
    console.log('�️ Enviando imagen por WhatsApp:', { chatId, imageUrl, caption })

    // Extraer el nombre del archivo de la URL
    const filename = imageUrl.split('/').pop() || 'orden-servicio.png'
    
    const payload = {
      channelId: config.channelId,
      chatType: "whatsapp",
      chatId: chatId,
      type: "image",
      contentUri: imageUrl
    }

    console.log('📤 Payload para imagen:', payload)

    const response = await fetch(`${config.baseUrl}/v3/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error en API Wazzup:', response.status, errorText)
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      }
    }

    const result = await response.json()
    console.log('✅ Imagen enviada exitosamente:', result)

    return {
      success: true,
      messageId: result.id || result.messageId
    }

  } catch (error) {
    console.error('❌ Error enviando imagen:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Envía una orden de servicio completa por WhatsApp (texto + imagen)
 */
export async function sendServiceOrderToWhatsApp(
  phoneNumber: string,
  orderData: any,
  imageUrl?: string
): Promise<WazzupApiResponse> {
  try {
    console.log('📱 Iniciando envío por WhatsApp:', { 
      phoneNumber,
      orderNumber: orderData.numeroOrden,
      hasImage: !!imageUrl,
      imageUrl: imageUrl?.substring(0, 50) + '...'
    })

    // Verificar si Wazzup está configurado
    if (!isWazzupConfigured()) {
      console.warn('⚠️ Wazzup no configurado, usando fallback de WhatsApp Web')
      return sendWhatsAppWebFallback(phoneNumber, orderData, imageUrl)
    }

    // Formatear número de teléfono (agregar código de país si no lo tiene)
    let chatId = phoneNumber.replace(/\D/g, '') // Solo números
    if (!chatId.startsWith('54')) {
      chatId = '54' + chatId // Agregar código de Argentina si no está
    }
    chatId = chatId + '@c.us' // Formato WhatsApp

    // Crear mensaje de texto con información de la orden
    const orderText = createOrderMessage(orderData)

    console.log('📋 Enviando orden de servicio por Wazzup API:', { 
      chatId, 
      orderNumber: orderData.numeroOrden,
      hasImage: !!imageUrl 
    })

    // Enviar mensaje de texto primero
    const textResult = await sendWhatsAppText(chatId, orderText)
    
    if (!textResult.success) {
      console.error('❌ Falló envío de texto:', textResult.error)
      return textResult
    }

    console.log('✅ Texto enviado exitosamente')

    // Si hay imagen, enviarla después
    if (imageUrl) {
      console.log('📎 Enviando imagen adjunta...')
      const imageResult = await sendWhatsAppImage(
        chatId, 
        imageUrl, 
        `Orden de Servicio N° ${orderData.numeroOrden} - ARAN Tecnologías`
      )
      
      if (!imageResult.success) {
        // El texto se envió pero la imagen falló
        console.error('❌ Falló envío de imagen:', imageResult.error)
        return {
          success: false,
          error: `Mensaje enviado, pero falló el envío de imagen: ${imageResult.error}`
        }
      }
      
      console.log('✅ Imagen enviada exitosamente')
    } else {
      console.warn('⚠️ No hay imagen para enviar')
    }

    console.log('✅ Orden de servicio enviada completamente por WhatsApp')
    return { success: true }

  } catch (error) {
    console.error('❌ Error enviando orden de servicio:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Fallback que abre WhatsApp Web cuando Wazzup no está configurado
 */
async function sendWhatsAppWebFallback(
  phoneNumber: string,
  orderData: any,
  imageUrl?: string
): Promise<WazzupApiResponse> {
  console.log('📱 Usando fallback de WhatsApp Web')
  
  const orderText = createOrderMessage(orderData)
  let message = orderText
  
  if (imageUrl) {
    message += `\n\n🖼️ Ver imagen de la orden:\n${imageUrl}`
  }
  
  // Formatear número para WhatsApp Web
  const cleanPhone = phoneNumber.replace(/\D/g, '')
  const whatsappUrl = `https://wa.me/54${cleanPhone}?text=${encodeURIComponent(message)}`
  
  // Abrir WhatsApp Web en nueva ventana
  window.open(whatsappUrl, '_blank')
  
  return {
    success: true,
    messageId: 'whatsapp-web-fallback'
  }
}

/**
 * Crea el mensaje de texto con la información de la orden
 */
function createOrderMessage(orderData: any): string {
  const {
    numeroOrden,
    fecha,
    razonSocial,
    contacto,
    telefono,
    descripcion,
    tecnicoNombre,
    clienteNombre
  } = orderData

  return `🔧 *ORDEN DE SERVICIO - ARAN TECNOLOGÍAS*

📋 *Orden N°:* ${numeroOrden}
📅 *Fecha:* ${fecha}

👤 *Cliente:*
• Razón Social: ${razonSocial || 'No especificado'}
• Contacto: ${contacto || 'No especificado'}
• Teléfono: ${telefono || 'No especificado'}

🔧 *Servicio:*
${descripcion || 'No especificado'}

👨‍🔧 *Técnico:* ${tecnicoNombre || 'No especificado'}
🤝 *Cliente:* ${clienteNombre || 'No especificado'}

---
🏢 *ARAN Tecnologías*
Sistema de Órdenes de Servicio`
}

/**
 * Función de prueba para verificar la conexión con Wazzup API
 */
export async function testWazzupConnection(config: WazzupConfig = DEFAULT_CONFIG): Promise<boolean> {
  try {
    console.log('🧪 Probando conexión con Wazzup API...')
    
    // Número de test (debes cambiarlo por un número real para pruebas)
    const testChatId = '5491123456789@c.us'
    const testMessage = '🧪 Test de conexión - ARAN Tecnologías'
    
    const result = await sendWhatsAppText(testChatId, testMessage, config)
    
    if (result.success) {
      console.log('✅ Conexión con Wazzup API exitosa')
      return true
    } else {
      console.error('❌ Fallo en prueba de conexión:', result.error)
      return false
    }
  } catch (error) {
    console.error('❌ Error en prueba de conexión:', error)
    return false
  }
}
