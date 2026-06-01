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

export interface WazzupChannel {
  id: string
  name: string
  status: 'active' | 'inactive' | 'pending' | 'disconnected' | 'online' | 'connected' | 'ready' | string
  transport: string
  channelType: string
  phone?: string
}

export interface ChannelsResponse {
  channels: WazzupChannel[]
  activeChannel?: WazzupChannel
  hasActiveChannels: boolean
}

// Configuración con credenciales reales de Wazzup
const DEFAULT_CONFIG: WazzupConfig = {
  apiKey: '9a807d7e759044d78ae1049e5ef2e273',
  channelId: '5d636b50-9ebc-4690-8c8c-ad6fb44bbcc7',      // Canal "Eventos" (ACTIVO)
//  channelId: '3afb4472-71cf-4709-a226-840a0522bf63',      // Canal "Natalí" (bloqueado)
  baseUrl: 'https://api.wazzup24.com'
}

// ChatId del grupo de WhatsApp "ARÁN (OS) Órdenes de servicio"
const WHATSAPP_GROUP_CHAT_ID = '5493493444444-1633389785'

// Variable para cachear el canal activo
let cachedActiveChannel: WazzupChannel | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos en milisegundos

// ⏱️ Timeout para llamadas a la API de Wazzup (evita bloqueos si la API no responde)
const WAZZUP_TIMEOUT_MS = 8000 // 8 segundos

/**
 * Fetch con timeout para evitar que llamadas colgadas bloqueen el proceso de envío
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = WAZZUP_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Verifica si WhatsApp está desactivado temporalmente.
 * ⛔ SUSPENDIDO MANUALMENTE: envíos de WhatsApp deshabilitados por problemas con la cuenta de Wazzup.
 *    Para reactivar: poner WHATSAPP_SUSPENDED en false (o eliminar la constante y volver a leer la env var).
 * Fallback: si WHATSAPP_SUSPENDED es false, respeta NEXT_PUBLIC_DISABLE_WHATSAPP=true en .env.local
 */
const WHATSAPP_SUSPENDED = true
export function isWhatsAppDisabled(): boolean {
  if (WHATSAPP_SUSPENDED) return true
  return process.env.NEXT_PUBLIC_DISABLE_WHATSAPP === 'true'
}

// Función para verificar si Wazzup está configurado correctamente
function isWazzupConfigured(config: WazzupConfig = DEFAULT_CONFIG): boolean {
  return config.apiKey !== 'YOUR_WAZZUP_API_KEY' && 
         config.channelId !== 'YOUR_CHANNEL_ID' &&
         config.apiKey.length > 10 && 
         config.channelId.length > 10
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnóstico de WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

export type WhatsAppDiagnosticStatus =
  | 'ok'
  | 'disabled'
  | 'not_configured'
  | 'timeout'
  | 'auth_error'
  | 'blocked'
  | 'rate_limit'
  | 'server_error'
  | 'no_channels'
  | 'unknown'

export interface WhatsAppDiagnostic {
  status: WhatsAppDiagnosticStatus
  /** Mensaje corto para mostrar al usuario */
  message: string
  /** Detalle técnico adicional (para logs/consola) */
  detail?: string
  /** Canales disponibles con su estado */
  channels?: Array<{ name: string; status: string }>
}

/**
 * Verifica el estado completo de WhatsApp / Wazzup y devuelve un diagnóstico
 * detallado indicando exactamente por qué no se pueden enviar mensajes.
 *
 * Se puede llamar antes de enviar para informar al usuario, o después de un
 * fallo para mostrar la causa real del error.
 */
export async function diagnoseWhatsApp(config: WazzupConfig = DEFAULT_CONFIG): Promise<WhatsAppDiagnostic> {
  // 1. Flag de desactivación manual
  if (isWhatsAppDisabled()) {
    return {
      status: 'disabled',
      message: 'WhatsApp desactivado manualmente',
      detail: 'Variable NEXT_PUBLIC_DISABLE_WHATSAPP=true en .env.local'
    }
  }

  // 2. Configuración básica
  if (!isWazzupConfigured(config)) {
    return {
      status: 'not_configured',
      message: 'Wazzup no está configurado',
      detail: 'Falta API key o channel ID válidos'
    }
  }

  // 3. Intentar conectar con la API
  let rawChannels: any[] = []
  try {
    const response = await fetchWithTimeout(`${config.baseUrl}/v3/channels`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    }, 6000)

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      if (response.status === 401) {
        return { status: 'auth_error', message: 'API key inválida o expirada', detail: `HTTP 401 — ${body}` }
      }
      if (response.status === 403) {
        return { status: 'blocked', message: 'Cuenta bloqueada o sin permisos en Wazzup', detail: `HTTP 403 — ${body}` }
      }
      if (response.status === 429) {
        return { status: 'rate_limit', message: 'Demasiadas solicitudes (rate limit)', detail: `HTTP 429 — ${body}` }
      }
      if (response.status >= 500) {
        return { status: 'server_error', message: `Error interno de Wazzup (${response.status})`, detail: `HTTP ${response.status} — ${body}` }
      }
      return { status: 'unknown', message: `Respuesta inesperada de la API (${response.status})`, detail: `HTTP ${response.status}` }
    }

    const rawData = await response.json()
    rawChannels = Array.isArray(rawData) ? rawData : (rawData.channels || rawData.data || [])

  } catch (err) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))
    if (isAbort) {
      return { status: 'timeout', message: 'La API de Wazzup no respondió (timeout 6s)', detail: 'La solicitud fue cancelada por tiempo de espera' }
    }
    return {
      status: 'unknown',
      message: 'Error de red al conectar con Wazzup',
      detail: err instanceof Error ? err.message : String(err)
    }
  }

  // 4. Verificar canales activos
  const channelsSummary = rawChannels.map((ch: any) => ({
    name: ch.name || ch.id || 'Sin nombre',
    status: ch.status || ch.state || (ch.active ? 'active' : 'inactive')
  }))

  const activeStatuses = ['active', 'online', 'connected', 'ready']
  const activeChannels = channelsSummary.filter(ch => activeStatuses.includes(ch.status))

  if (activeChannels.length === 0) {
    return {
      status: 'no_channels',
      message: channelsSummary.length === 0
        ? 'No hay canales registrados en Wazzup'
        : `Sin canales activos (${channelsSummary.length} canal(es) inactivo(s))`,
      detail: channelsSummary.map(ch => `${ch.name}: ${ch.status}`).join(' | '),
      channels: channelsSummary
    }
  }

  return {
    status: 'ok',
    message: `${activeChannels.length} canal(es) activo(s): ${activeChannels.map(c => c.name).join(', ')}`,
    channels: channelsSummary
  }
}

/**
 * Obtiene la lista de canales disponibles en Wazzup
 */
export async function getWazzupChannels(config: WazzupConfig = DEFAULT_CONFIG): Promise<ChannelsResponse> {
  try {
    console.log('🔍 Obteniendo canales de Wazzup...')

    const response = await fetchWithTimeout(`${config.baseUrl}/v3/channels`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error obteniendo canales:', response.status, errorText)
      return {
        channels: [],
        hasActiveChannels: false
      }
    }

    const rawData = await response.json()
    console.log('📋 Respuesta raw de la API:', rawData)
    
    // La API puede devolver directamente un array o un objeto con propiedad
    const channelsArray = Array.isArray(rawData) ? rawData : (rawData.channels || rawData.data || [])
    console.log('📋 Canales extraídos:', channelsArray)

    // Mapear la estructura real de Wazzup a nuestra interfaz
    const channels: WazzupChannel[] = channelsArray.map((ch: any) => ({
      id: ch.id || ch.channelId || ch.uuid || '',
      name: ch.name || ch.channelName || ch.title || 'Sin nombre',
      status: ch.status || ch.state || (ch.active ? 'active' : 'inactive'),
      transport: ch.transport || ch.type || 'whatsapp',
      channelType: ch.channelType || ch.category || ch.kind || '',
      phone: ch.phone || ch.number || ch.phoneNumber || ''
    }))

    console.log('📋 Canales procesados:', channels)

    // Filtrar canales activos (pueden ser 'active', 'online', 'connected', etc.)
    const activeChannels = channels.filter(channel => 
      channel.status === 'active' || 
      channel.status === 'online' || 
      channel.status === 'connected' ||
      channel.status === 'ready'
    )
    
    console.log(`✅ Canales activos encontrados: ${activeChannels.length}/${channels.length}`)
    activeChannels.forEach(ch => {
      console.log(`  - ${ch.name} (${ch.id}): ${ch.status}`)
    })
    
    // Buscar el canal específico que estamos buscando
    const targetChannel = channels.find(ch => ch.id === '5d636b50-9ebc-4690-8c8c-ad6fb44bbcc7')
    if (targetChannel) {
      console.log('🎯 Canal buscado encontrado:', targetChannel)
    }
    
    // Buscar el canal configurado si está activo
    const configuredChannel = activeChannels.find(ch => ch.id === config.channelId)
    
    // Si no está activo el configurado, tomar el primero activo
    const activeChannel = configuredChannel || activeChannels[0]

    // Cachear el resultado
    if (activeChannel) {
      cachedActiveChannel = activeChannel
      cacheTimestamp = Date.now()
      console.log('✅ Canal activo seleccionado:', activeChannel.name, activeChannel.id)
    }

    return {
      channels,
      activeChannel,
      hasActiveChannels: activeChannels.length > 0
    }

  } catch (error) {
    console.error('❌ Error obteniendo canales:', error)
    return {
      channels: [],
      hasActiveChannels: false
    }
  }
}

/**
 * Obtiene un canal activo (usa caché si está disponible)
 */
export async function getActiveChannel(config: WazzupConfig = DEFAULT_CONFIG): Promise<WazzupChannel | null> {
  // Verificar caché
  const now = Date.now()
  if (cachedActiveChannel && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('✅ Usando canal activo desde caché:', cachedActiveChannel.name)
    return cachedActiveChannel
  }

  // Obtener canales actualizados
  const channelsResponse = await getWazzupChannels(config)
  
  if (channelsResponse.activeChannel) {
    console.log('✅ Canal activo encontrado:', channelsResponse.activeChannel.name)
    return channelsResponse.activeChannel
  }

  console.warn('⚠️ No hay canales activos disponibles')
  return null
}

/**
 * Verifica si hay un canal activo disponible antes de enviar
 */
export async function checkChannelAvailability(config: WazzupConfig = DEFAULT_CONFIG): Promise<{
  available: boolean
  channel?: WazzupChannel
  message: string
}> {
  try {
    const activeChannel = await getActiveChannel(config)
    
    if (activeChannel) {
      return {
        available: true,
        channel: activeChannel,
        message: `Canal activo: ${activeChannel.name} (${activeChannel.phone || activeChannel.id})`
      }
    } else {
      return {
        available: false,
        message: 'No hay canales de WhatsApp activos disponibles. El mensaje se guardará localmente.'
      }
    }
  } catch (error) {
    console.error('❌ Error verificando disponibilidad de canal:', error)
    return {
      available: false,
      message: 'Error al verificar canales de WhatsApp. El mensaje se guardará localmente.'
    }
  }
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

    // Verificar canal activo antes de enviar
    const channelCheck = await checkChannelAvailability(config)
    
    if (!channelCheck.available) {
      console.warn('⚠️ No hay canal activo:', channelCheck.message)
      return {
        success: false,
        error: channelCheck.message
      }
    }

    // Usar el canal activo encontrado
    const activeChannelId = channelCheck.channel!.id
    console.log('✅ Usando canal activo:', activeChannelId)

    const payload = {
      channelId: activeChannelId,
      chatType: "whatsapp",
      chatId: chatId,
      text: text
    }

    console.log('📤 Payload para Wazzup:', payload)

    const response = await fetchWithTimeout(`${config.baseUrl}/v3/message`, {
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

    // Verificar canal activo antes de enviar
    const channelCheck = await checkChannelAvailability(config)
    
    if (!channelCheck.available) {
      console.warn('⚠️ No hay canal activo:', channelCheck.message)
      return {
        success: false,
        error: channelCheck.message
      }
    }

    // Usar el canal activo encontrado
    const activeChannelId = channelCheck.channel!.id
    console.log('✅ Usando canal activo:', activeChannelId)

    // Extraer el nombre del archivo de la URL
    const filename = imageUrl.split('/').pop() || 'orden-servicio.png'
    
    const payload = {
      channelId: activeChannelId,
      chatType: "whatsapp",
      chatId: chatId,
      type: "image",
      contentUri: imageUrl
    }

    console.log('📤 Payload para imagen:', payload)

    const response = await fetchWithTimeout(`${config.baseUrl}/v3/message`, {
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
    // ⛔ Wazzup suspendido: usar WhatsApp local (wa.me abre la app nativa en celular/tablet)
    if (isWhatsAppDisabled()) {
      console.warn('⛔ Wazzup suspendido. Usando WhatsApp local (wa.me) como fallback.')
      return sendWhatsAppWebFallback(phoneNumber, orderData, imageUrl)
    }

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

    // Verificar disponibilidad de canales ANTES de procesar
    console.log('🔍 Verificando canales de Wazzup disponibles...')
    const channelCheck = await checkChannelAvailability()
    
    if (!channelCheck.available) {
      console.warn('⚠️ No hay canales activos:', channelCheck.message)
      console.warn('📱 Usando fallback de WhatsApp Web')
      return sendWhatsAppWebFallback(phoneNumber, orderData, imageUrl)
    }

    console.log('✅ Canal activo disponible:', channelCheck.channel?.name)

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
      hasImage: !!imageUrl,
      channel: channelCheck.channel?.name
    })

    // Enviar mensaje de texto primero
    const textResult = await sendWhatsAppText(chatId, orderText)
    
    if (!textResult.success) {
      console.error('❌ Falló envío de texto:', textResult.error)
      // Si falló por problema de canal, usar fallback
      if (textResult.error?.includes('canal')) {
        console.warn('📱 Intentando con WhatsApp Web como fallback')
        return sendWhatsAppWebFallback(phoneNumber, orderData, imageUrl)
      }
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
 * Fallback que abre WhatsApp local (app nativa en celular/tablet, WhatsApp Web en desktop)
 * usando el deep link público https://wa.me/<numero>?text=<mensaje>
 */
async function sendWhatsAppWebFallback(
  phoneNumber: string,
  orderData: any,
  imageUrl?: string
): Promise<WazzupApiResponse> {
  console.log('📱 Usando fallback de WhatsApp local (wa.me)')

  const orderText = createOrderMessage(orderData)
  let message = orderText

  if (imageUrl) {
    message += `\n\n🖼️ Ver imagen de la orden:\n${imageUrl}`
  }

  // Formatear número (agregar 54 si no está)
  let cleanPhone = phoneNumber.replace(/\D/g, '')
  if (!cleanPhone.startsWith('54')) cleanPhone = '54' + cleanPhone
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`

  if (typeof window === 'undefined') {
    console.warn('⚠️ sendWhatsAppWebFallback llamado en server; devolviendo URL sin abrir.')
    return { success: false, error: 'WhatsApp local sólo disponible en cliente', messageId: whatsappUrl }
  }

  // Abrir WhatsApp (app nativa si está instalada, sino WhatsApp Web)
  window.open(whatsappUrl, '_blank')

  return {
    success: true,
    messageId: 'whatsapp-local-fallback'
  }
}

/**
 * Abre WhatsApp local con la encuesta de satisfacción pre-cargada.
 */
function sendSurveyViaLocalWhatsApp(phoneNumber: string): WazzupApiResponse {
  const surveyText = createSurveyMessage()
  let cleanPhone = phoneNumber.replace(/\D/g, '')
  if (!cleanPhone.startsWith('54')) cleanPhone = '54' + cleanPhone
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(surveyText)}`

  if (typeof window === 'undefined') {
    return { success: false, error: 'WhatsApp local sólo disponible en cliente', messageId: whatsappUrl }
  }

  window.open(whatsappUrl, '_blank')
  return { success: true, messageId: 'whatsapp-local-survey' }
}

/**
 * Crea el mensaje de la encuesta de satisfacción
 */
function createSurveyMessage(): string {
  return `💬 *¡Gracias por elegir ARAN Tecnologías!*

Tu opinión es muy importante para nosotros. Te invitamos a completar una breve encuesta de satisfacción. Solo te tomará unos segundos y nos ayudará a seguir mejorando nuestro servicio.

⭐ https://arantecnologias.odoo.com/survey/start/4ad30173-5320-4c3d-9baf-c84b48154da7

¡Muchas gracias por tu tiempo!

🚜 *ARAN Tecnologías*`
}

/**
 * Envía la encuesta de satisfacción por WhatsApp al cliente
 */
export async function sendSatisfactionSurvey(
  phoneNumber: string
): Promise<WazzupApiResponse> {
  try {
    // ⛔ Wazzup suspendido: abrir WhatsApp local con la encuesta pre-cargada
    if (isWhatsAppDisabled()) {
      console.warn('⛔ Wazzup suspendido. Abriendo encuesta vía WhatsApp local (wa.me).')
      return sendSurveyViaLocalWhatsApp(phoneNumber)
    }

    console.log('📝 Enviando encuesta de satisfacción a:', phoneNumber)

    // Verificar si Wazzup está configurado
    if (!isWazzupConfigured()) {
      console.warn('⚠️ Wazzup no configurado, no se puede enviar encuesta')
      return { success: false, error: 'Wazzup no configurado' }
    }

    // Formatear número
    let chatId = phoneNumber.replace(/\D/g, '')
    if (!chatId.startsWith('54')) {
      chatId = '54' + chatId
    }
    chatId = chatId + '@c.us'

    const surveyText = createSurveyMessage()
    const result = await sendWhatsAppText(chatId, surveyText)

    if (result.success) {
      console.log('✅ Encuesta de satisfacción enviada exitosamente')
    } else {
      console.warn('⚠️ Falló envío de encuesta:', result.error)
    }

    return result
  } catch (error) {
    console.error('❌ Error enviando encuesta de satisfacción:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
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
 * Envía la orden de servicio al grupo de WhatsApp de ARÁN
 */
export async function sendServiceOrderToGroup(
  orderData: any,
  imageUrl?: string,
  config: WazzupConfig = DEFAULT_CONFIG
): Promise<WazzupApiResponse> {
  try {
    // ⛔ Wazzup suspendido: no hay deep-link público para grupos, envío al grupo queda deshabilitado
    if (isWhatsAppDisabled()) {
      console.warn('⛔ Wazzup suspendido. El envío al grupo no tiene fallback local (wa.me no soporta grupos).')
      return { success: false, error: 'Envío al grupo suspendido (Wazzup deshabilitado, sin fallback para grupos)' }
    }

    console.log('👥 Enviando orden de servicio al grupo de WhatsApp...')

    if (!isWazzupConfigured(config)) {
      console.warn('⚠️ Wazzup no configurado, no se puede enviar al grupo')
      return { success: false, error: 'Wazzup no configurado' }
    }

    const channelCheck = await checkChannelAvailability(config)
    if (!channelCheck.available) {
      console.warn('⚠️ No hay canal activo:', channelCheck.message)
      return { success: false, error: channelCheck.message }
    }

    const activeChannelId = channelCheck.channel!.id
    const orderText = createOrderMessage(orderData)

    // Wazzup no permite enviar text + contentUri juntos, se envían por separado
    // Primero la imagen, luego el texto (así en el grupo se ve foto + info)
    if (imageUrl) {
      console.log('📤 Enviando imagen al grupo:', WHATSAPP_GROUP_CHAT_ID)
      const imagePayload = {
        channelId: activeChannelId,
        chatType: 'whatsgroup',
        chatId: WHATSAPP_GROUP_CHAT_ID,
        type: 'image',
        contentUri: imageUrl
      }

      const imageResponse = await fetchWithTimeout(`${config.baseUrl}/v3/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(imagePayload)
      })

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text()
        console.error('❌ Error enviando imagen al grupo:', imageResponse.status, errorText)
        return { success: false, error: `HTTP ${imageResponse.status}: ${errorText}` }
      }

      console.log('✅ Imagen enviada al grupo exitosamente')
    }

    // Enviar texto
    console.log('📤 Enviando texto al grupo:', WHATSAPP_GROUP_CHAT_ID)
    const textPayload = {
      channelId: activeChannelId,
      chatType: 'whatsgroup',
      chatId: WHATSAPP_GROUP_CHAT_ID,
      text: orderText
    }

    const textResponse = await fetchWithTimeout(`${config.baseUrl}/v3/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(textPayload)
    })

    if (!textResponse.ok) {
      const errorText = await textResponse.text()
      console.error('❌ Error enviando texto al grupo:', textResponse.status, errorText)
      return { success: false, error: `HTTP ${textResponse.status}: ${errorText}` }
    }

    console.log('✅ Texto enviado al grupo exitosamente')

    console.log('✅ Orden enviada al grupo completamente')
    return { success: true }

  } catch (error) {
    console.error('❌ Error enviando al grupo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
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
