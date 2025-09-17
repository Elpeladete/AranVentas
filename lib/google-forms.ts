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
 * Prepara los datos del formulario para Google Forms
 */
export function prepareFormDataForSubmission(formData: AranFormData): FormData {
  const submissionData = new FormData()
  
  // Iterar sobre todas las entradas configuradas
  Object.entries(GOOGLE_FORMS_CONFIG.entries).forEach(([fieldName, entryId]) => {
    const value = formData[fieldName as keyof AranFormData]
    
    if (typeof value === 'boolean') {
      submissionData.append(entryId, value ? "TRUE" : "FALSE")
    } else {
      submissionData.append(entryId, value || "")
    }
  })
  
  return submissionData
}

/**
 * Genera URL pre-llenada de Google Forms
 */
export function generatePrefilledUrl(formData: AranFormData): string {
  const params = new URLSearchParams()
  params.append("usp", "pp_url")
  
  // Agregar todos los campos
  Object.entries(GOOGLE_FORMS_CONFIG.entries).forEach(([fieldName, entryId]) => {
    const value = formData[fieldName as keyof AranFormData]
    
    if (typeof value === 'boolean') {
      params.append(entryId, value ? "TRUE" : "FALSE")
    } else {
      params.append(entryId, value || "")
    }
  })
  
  return `${GOOGLE_FORMS_CONFIG.baseUrl}/viewform?${params.toString()}`
}

/**
 * Envía el formulario directamente a Google Forms
 */
export async function submitFormToGoogle(formData: AranFormData): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const submitUrl = `${GOOGLE_FORMS_CONFIG.baseUrl}/formResponse`
    const submissionData = prepareFormDataForSubmission(formData)
    
    // Enviar usando fetch con mode no-cors
    await fetch(submitUrl, {
      method: "POST",
      body: submissionData,
      mode: "no-cors" // Necesario para Google Forms
    })
    
    // Con mode: "no-cors" no podemos verificar el status de respuesta
    // pero si no hay excepción, asumimos que se envió correctamente
    return { success: true }
    
  } catch (error) {
    console.error("Error al enviar formulario a Google:", error)
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
  if (formData.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(formData.fecha)) {
    errors.push("Formato de fecha inválido (debe ser YYYY-MM-DD)")
  }
  
  // Validar CUIT si está presente
  if (formData.cuit && formData.cuit.length > 0 && !/^\d{2}-\d{8}-\d{1}$/.test(formData.cuit)) {
    // Nota: Esta es una validación básica, la validación completa está en validations.ts
    if (!/^\d+$/.test(formData.cuit.replace(/[-]/g, ''))) {
      errors.push("CUIT debe contener solo números y guiones")
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}