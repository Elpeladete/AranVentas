/**
 * Utilidades para envío de formularios a Google Forms
 */

import { type FormData as AranFormData } from "@/hooks/use-form-data"

/**
 * Configuración de Google Forms
 */
const GOOGLE_FORMS_CONFIG = {
  formId: "1FAIpQLSdJAZ9JrGyNTXFXI6q5kSr3uyMcTO2AlkCopKU0yN1nSbJJMw",
  baseUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdJAZ9JrGyNTXFXI6q5kSr3uyMcTO2AlkCopKU0yN1nSbJJMw",
  entries: {
    numeroOrden: "entry.372880175",
    fecha: "entry.272882206",
    razonSocial: "entry.51656733",
    cuit: "entry.1027759127",
    contacto: "entry.1341519067",
    telefono: "entry.577931152",
    servicioTecnico: "entry.1807472627",
    instalacion: "entry.1866760485",
    puestaEnMarcha: "entry.1483769432",
    capacitacion: "entry.2009413697",
    calibracion: "entry.552164344",
    tercero: "entry.50477222",
    maquina: "entry.2137289700",
    equipo: "entry.345774046",
    descripcion: "entry.530697442",
    insumos: "entry.1213632366",
    servicioACampo: "entry.2003105797",
    servicioEnOficina: "entry.52141665",
    conCargo: "entry.1755189551",
    sinCargo: "entry.83013412",
    servicioEnGarantia: "entry.67997979",
    aConvenir: "entry.758707307",
    localidad: "entry.1993960771",
    provincia: "entry.1508422004",
    distancia: "entry.1889226445",
    duracion: "entry.990111352",
    tipoCambio: "entry.1638646015",
    iva: "entry.1689852362",
    total: "entry.71662572",
    tecnicoNombre: "entry.743176313",
    tecnicoFirma: "entry.1089739266",
    clienteNombre: "entry.544693955",
    clienteFirma: "entry.271745922",
    aux1: "entry.1799477516",
    aux2: "entry.1822594865",
    aux3: "entry.46860826",
    aux4: "entry.2041327332"
  }
}

/**
 * Procesa una firma para envío a Google Forms
 * @param signature - Firma en formato URL, base64 o texto
 * @returns String procesado para Google Forms (máximo 1000 caracteres)
 */
function processSignatureForGoogleForms(signature: string | undefined): string {
  if (!signature || signature.trim() === '') {
    return ""
  }
  
  if (signature.startsWith('https://i.ibb.co/')) {
    // Es una URL de ImgBB - usar directamente (son cortas)
    console.log('✅ Procesando URL de ImgBB para Google Forms:', signature)
    return signature
  } else if (signature.startsWith('http')) {
    // Es otra URL - usar directamente pero truncar si es muy larga
    const processed = signature.length > 1000 ? signature.substring(0, 1000) : signature
    console.log('✅ Procesando URL externa para Google Forms:', processed)
    return processed
  } else if (signature.startsWith('data:image')) {
    // Es base64 - NO enviar el base64 completo, usar mensaje descriptivo
    console.warn('⚠️ Intentando enviar base64 a Google Forms - convirtiendo a mensaje descriptivo')
    return '[Firma digital - disponible en PDF exportado]'
  } else {
    // Es texto normal - truncar si es muy largo
    const processed = signature.length > 1000 ? signature.substring(0, 1000) : signature
    console.log('✅ Procesando texto para Google Forms:', processed)
    return processed
  }
}

/**
 * Obtiene información detallada de las firmas para logging/debugging
 */
export function getSignatureInfo(formData: AranFormData): {
  tecnicoFirma: { type: 'url' | 'base64' | 'text' | 'empty', value: string }
  clienteFirma: { type: 'url' | 'base64' | 'text' | 'empty', value: string }
} {
  const processSignatureInfo = (sig: string | undefined) => {
    if (!sig || sig.trim() === '') {
      return { type: 'empty' as const, value: '' }
    }
    
    if (sig.startsWith('https://i.ibb.co/')) {
      return { type: 'url' as const, value: sig }
    } else if (sig.startsWith('http')) {
      return { type: 'url' as const, value: sig }
    } else if (sig.startsWith('data:image')) {
      return { type: 'base64' as const, value: '[Base64 data]' }
    } else {
      return { type: 'text' as const, value: sig }
    }
  }

  return {
    tecnicoFirma: processSignatureInfo(formData.tecnicoFirma),
    clienteFirma: processSignatureInfo(formData.clienteFirma)
  }
}

/**
 * Convierte fecha de DD-MM-YYYY a YYYY-MM-DD para Google Forms
 * @param dateString - Fecha en formato DD-MM-YYYY o YYYY-MM-DD
 * @returns Fecha en formato YYYY-MM-DD
 */
function convertDateForGoogleForms(dateString: string | undefined): string {
  if (!dateString || dateString.trim() === '') {
    console.log('⚠️ Fecha vacía, devolviendo string vacío')
    return ''
  }
  
  // Si ya está en formato YYYY-MM-DD, devolver tal como está
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    console.log('✅ Fecha ya en formato YYYY-MM-DD:', dateString)
    return dateString
  }
  
  // Convertir de DD-MM-YYYY a YYYY-MM-DD
  if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
    const [day, month, year] = dateString.split('-')
    const converted = `${year}-${month}-${day}`
    console.log(`📅 Convirtiendo fecha: ${dateString} → ${converted}`)
    return converted
  }
  
  // Si no coincide con ningún formato, devolver vacío y advertir
  console.warn('⚠️ Formato de fecha no reconocido:', dateString)
  return ''
}

/**
 * Prepara los datos del formulario para Google Forms
 * Procesa especialmente las firmas para usar URLs de ImgBB
 */
export function prepareFormDataForSubmission(formData: AranFormData): FormData {
  console.log('🔄 Preparando datos para Google Forms...')
  const submissionData = new FormData()
  
  // Iterar sobre todas las entradas configuradas
  Object.entries(GOOGLE_FORMS_CONFIG.entries).forEach(([fieldName, entryId]) => {
    const value = formData[fieldName as keyof AranFormData]
    
    if (typeof value === 'boolean') {
      const boolValue = value ? "TRUE" : "FALSE"
      console.log(`✅ ${fieldName}: ${boolValue} (entry: ${entryId})`)
      submissionData.append(entryId, boolValue)
    } else if (fieldName === 'fecha') {
      // Convertir fecha a formato YYYY-MM-DD para Google Forms
      const convertedDate = convertDateForGoogleForms(value as string)
      console.log('📅 Procesando fecha:', {
        campo: fieldName,
        valorOriginal: value,
        valorConvertido: convertedDate,
        entryId: entryId
      })
      submissionData.append(entryId, convertedDate)
    } else if (fieldName === 'tecnicoFirma' || fieldName === 'clienteFirma') {
      // Usar la función especializada para procesar firmas
      const processedSignature = processSignatureForGoogleForms(value as string)
      console.log(`📝 Procesando firma ${fieldName}:`, {
        original: value ? `${(value as string).substring(0, 50)}...` : 'vacío',
        originalLength: value ? (value as string).length : 0,
        processed: processedSignature,
        processedLength: processedSignature.length,
        entryId: entryId
      })
      submissionData.append(entryId, processedSignature)
    } else {
      // Log para campos de texto
      const stringValue = value || ""
      if (fieldName === 'insumos' || fieldName === 'descripcion') {
        console.log(`� ${fieldName}:`, {
          entryId,
          length: (stringValue as string).length,
          preview: (stringValue as string).substring(0, 100) + '...'
        })
      } else {
        console.log(`📝 ${fieldName}: ${stringValue} (entry: ${entryId})`)
      }
      submissionData.append(entryId, stringValue)
    }
  })
  
  console.log('✅ Todos los datos preparados para envío')
  return submissionData
}

/**
 * Genera URL pre-llenada de Google Forms
 * Incluye URLs de firmas de ImgBB cuando están disponibles
 */
export function generatePrefilledUrl(formData: AranFormData): string {
  const params = new URLSearchParams()
  params.append("usp", "pp_url")
  
  // Agregar todos los campos
  Object.entries(GOOGLE_FORMS_CONFIG.entries).forEach(([fieldName, entryId]) => {
    const value = formData[fieldName as keyof AranFormData]
    
    if (typeof value === 'boolean') {
      params.append(entryId, value ? "TRUE" : "FALSE")
    } else if (fieldName === 'fecha') {
      // Convertir fecha a formato YYYY-MM-DD para Google Forms
      const convertedDate = convertDateForGoogleForms(value as string)
      params.append(entryId, convertedDate)
    } else if (fieldName === 'tecnicoFirma' || fieldName === 'clienteFirma') {
      // Usar la función especializada para procesar firmas
      const processedSignature = processSignatureForGoogleForms(value as string)
      params.append(entryId, processedSignature)
    } else {
      params.append(entryId, value || "")
    }
  })
  
  return `${GOOGLE_FORMS_CONFIG.baseUrl}/viewform?${params.toString()}`
}

/**
 * Envía el formulario directamente a Google Forms con reintentos
 */
export async function submitFormToGoogle(
  formData: AranFormData,
  retryCount: number = 0
): Promise<{
  success: boolean
  error?: string
}> {
  const maxRetries = 3
  const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Backoff: 1s, 2s, 4s, max 10s
  
  try {
    console.log(`📤 Enviando a Google Forms${retryCount > 0 ? ` (Reintento ${retryCount}/${maxRetries})` : ''}`)
    
    const submitUrl = `${GOOGLE_FORMS_CONFIG.baseUrl}/formResponse`
    const submissionData = prepareFormDataForSubmission(formData)
    
    // Crear timeout controller
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 segundos timeout
    
    // Enviar usando fetch con mode no-cors
    await fetch(submitUrl, {
      method: "POST",
      body: submissionData,
      mode: "no-cors", // Necesario para Google Forms
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    // Con mode: "no-cors" no podemos verificar el status de respuesta
    // pero si no hay excepción, asumimos que se envió correctamente
    console.log('✅ Formulario enviado a Google Forms exitosamente')
    return { success: true }
    
  } catch (error) {
    const isNetworkError = error instanceof TypeError && error.message.includes('fetch')
    const isTimeoutError = error instanceof Error && error.name === 'AbortError'
    const shouldRetry = (isNetworkError || isTimeoutError) && retryCount < maxRetries
    
    if (shouldRetry) {
      console.warn(`⚠️ Error enviando a Google Forms, reintentando en ${retryDelay}ms...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return submitFormToGoogle(formData, retryCount + 1)
    }
    
    console.error("❌ Error al enviar formulario a Google Forms:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Error desconocido"
    }
  }
}

/**
 * Valida que los datos estén en formato correcto para Google Forms
 */
export function validateFormDataForSubmission(formData: AranFormData): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // Validaciones específicas para Google Forms
  if (!formData.numeroOrden?.trim()) {
    errors.push("Número de orden es requerido")
  }
  
  if (!formData.fecha?.trim()) {
    errors.push("Fecha es requerida")
  }
  
  // Validar formato de fecha
  // Validar formato de fecha - aceptar AMBOS formatos (DD-MM-YYYY y YYYY-MM-DD)
  if (formData.fecha) {
    const isValidDDMMYYYY = /^\d{2}-\d{2}-\d{4}$/.test(formData.fecha)
    const isValidYYYYMMDD = /^\d{4}-\d{2}-\d{2}$/.test(formData.fecha)
    
    if (!isValidDDMMYYYY && !isValidYYYYMMDD) {
      console.error('❌ Formato de fecha inválido:', formData.fecha)
      errors.push("Formato de fecha inválido (debe ser DD-MM-YYYY o YYYY-MM-DD)")
    } else {
      console.log('✅ Formato de fecha válido:', formData.fecha)
    }
  }
  
  // Validar CUIT si está presente
  if (formData.cuit && formData.cuit.length > 0 && !/^\d{2}-\d{8}-\d{1}$/.test(formData.cuit)) {
    // Nota: Esta es una validación básica, la validación completa está en validations.ts
    if (!/^\d+$/.test(formData.cuit.replace(/[-]/g, ''))) {
      errors.push("CUIT debe contener solo números y guiones")
    }
  }

  // Validar firmas - asegurar que no sean demasiado largas
  if (formData.tecnicoFirma && formData.tecnicoFirma.length > 2000) {
    console.warn('⚠️ Firma técnico muy larga:', {
      length: formData.tecnicoFirma.length,
      preview: formData.tecnicoFirma.substring(0, 100)
    })
    errors.push("Firma del técnico demasiado larga - contacte al administrador")
  }
  
  if (formData.clienteFirma && formData.clienteFirma.length > 2000) {
    console.warn('⚠️ Firma cliente muy larga:', {
      length: formData.clienteFirma.length,
      preview: formData.clienteFirma.substring(0, 100)
    })
    errors.push("Firma del cliente demasiado larga - contacte al administrador")
  }

  // Validar que las firmas sean URLs válidas (no base64)
  if (formData.tecnicoFirma && formData.tecnicoFirma.startsWith('data:image')) {
    errors.push("La firma del técnico debe ser subida a la nube antes del envío")
  }
  
  if (formData.clienteFirma && formData.clienteFirma.startsWith('data:image')) {
    errors.push("La firma del cliente debe ser subida a la nube antes del envío")
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}