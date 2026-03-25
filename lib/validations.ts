import { z } from "zod"

// Función para formatear teléfono argentino
export function formatPhoneNumber(phone: string): string {
  // Limpiar el teléfono de espacios, guiones y símbolos
  const cleaned = phone.replace(/\D/g, '')
  
  // Si empieza con 54, quitar el prefijo para el formateo
  const withoutCountryCode = cleaned.startsWith('54') ? cleaned.slice(2) : cleaned
  
  // Si tiene 10 dígitos (con 9), formatear como +54 9 XXXX XX-XXXX
  if (withoutCountryCode.length === 10 && withoutCountryCode.startsWith('9')) {
    const areaCode = withoutCountryCode.slice(1, 5) // Después del 9
    const firstPart = withoutCountryCode.slice(5, 7)
    const secondPart = withoutCountryCode.slice(7)
    return `+54 9 ${areaCode} ${firstPart}-${secondPart}`
  }
  
  // Si tiene 10 dígitos sin 9, agregar el 9 y formatear
  if (withoutCountryCode.length === 10) {
    const areaCode = withoutCountryCode.slice(0, 4)
    const firstPart = withoutCountryCode.slice(4, 6)
    const secondPart = withoutCountryCode.slice(6)
    return `+54 9 ${areaCode} ${firstPart}-${secondPart}`
  }
  
  // Si no cumple el formato, devolver tal como está
  return phone
}

// Función para formatear CUIT
export function formatCuit(cuit: string): string {
  // Limpiar solo números
  const cleaned = cuit.replace(/\D/g, '')
  
  // Si tiene exactamente 11 dígitos, formatear como XX-XXXXXXXX-X
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`
  }
  
  // Si ya tiene guiones pero está bien formateado, devolver tal como está
  if (cuit.match(/^\d{2}-\d{8}-\d{1}$/)) {
    return cuit
  }
  
  return cuit
}

// Validaciones por grupos - actualizadas con los campos reales del formulario
export function validateServiceGroup1(data: any): { isValid: boolean; message?: string } {
  // Grupo 1: Tipos de servicio
  const group1Services = [
    data.servicioTecnico,
    data.instalacion,
    data.puestaEnMarcha,
    data.capacitacion,
    data.calibracion,
    data.tercero
  ]
  
  const hasAnyService = group1Services.some(service => service === true)
  
  if (!hasAnyService) {
    return {
      isValid: false,
      message: "Debe seleccionar al menos un tipo de servicio (Servicio Técnico, Instalación, Puesta en Marcha, etc.)"
    }
  }
  
  return { isValid: true }
}

export function validateServiceGroup2(data: any): { isValid: boolean; message?: string } {
  // Grupo 2: Ubicación del servicio
  const group2Services = [
    data.servicioACampo,
    data.servicioEnOficina
  ]
  
  const hasAnyService = group2Services.some(service => service === true)
  
  if (!hasAnyService) {
    return {
      isValid: false,
      message: "Debe seleccionar la ubicación del servicio (Campo u Oficina)"
    }
  }
  
  return { isValid: true }
}

export function validateServiceGroup3(data: any): { isValid: boolean; messages?: string[] } {
  // Grupo 3: Tipo de cargo Y tipo de garantía (ambos pares son obligatorios)
  const messages: string[] = []
  
  // Par 1: Con Cargo o Sin Cargo
  if (!data.conCargo && !data.sinCargo) {
    messages.push("Debe seleccionar si el servicio es Con Cargo o Sin Cargo")
  }
  
  // Par 2: En Garantía o A Convenir
  if (!data.servicioEnGarantia && !data.aConvenir) {
    messages.push("Debe seleccionar si el servicio está En Garantía o es A Convenir")
  }
  
  if (messages.length > 0) {
    return {
      isValid: false,
      messages
    }
  }
  
  return { isValid: true }
}

export function validateSignatureGroup(data: any): { isValid: boolean; message?: string } {
  // Verificar que existan firmas válidas (URLs o data URLs)
  const hasClientSignature = data.clienteFirma && 
    data.clienteFirma.trim() !== '' && 
    (data.clienteFirma.startsWith('http') || data.clienteFirma.startsWith('data:image'))
  
  const hasTechnicianSignature = data.tecnicoFirma && 
    data.tecnicoFirma.trim() !== '' && 
    (data.tecnicoFirma.startsWith('http') || data.tecnicoFirma.startsWith('data:image'))
  
  console.log('🔍 Validación de firmas:', {
    clienteFirma: {
      exists: !!data.clienteFirma,
      value: data.clienteFirma ? data.clienteFirma.substring(0, 50) + '...' : 'vacío',
      isValid: hasClientSignature
    },
    tecnicoFirma: {
      exists: !!data.tecnicoFirma,
      value: data.tecnicoFirma ? data.tecnicoFirma.substring(0, 50) + '...' : 'vacío',
      isValid: hasTechnicianSignature
    }
  })
  
  if (!hasClientSignature) {
    return {
      isValid: false,
      message: "La firma del cliente es obligatoria y debe ser una imagen válida"
    }
  }
  
  if (!hasTechnicianSignature) {
    return {
      isValid: false,
      message: "La firma del técnico es obligatoria y debe ser una imagen válida"
    }
  }
  
  return { isValid: true }
}

// Validación del dígito verificador del CUIT
export function validateCuitDigit(cuit: string): boolean {
  const cleaned = cuit.replace(/\D/g, '')
  if (cleaned.length !== 11) return false
  
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const digits = cleaned.split('').map(Number)
  
  const sum = digits.slice(0, 10).reduce((acc, digit, index) => {
    return acc + digit * multipliers[index]
  }, 0)
  
  const remainder = sum % 11
  const checkDigit = remainder < 2 ? remainder : 11 - remainder
  
  return checkDigit === digits[10]
}

// Mensajes de ayuda y sugerencias para campos
export const fieldHints = {
  phone: "Formato: 3476626662 (se formateará automáticamente como +54 9 3476 62-6662)",
  cuit: "Ingrese 11 dígitos sin guiones (ejemplo: 20123456789)",
  email: "Ingrese un email válido (ejemplo: cliente@empresa.com)",
  clientName: "Nombre completo del cliente",
  technicianName: "Nombre completo del técnico responsable",
  address: "Dirección completa donde se realizó el servicio",
  serviceDescription: "Descripción detallada del trabajo realizado",
  observations: "Observaciones adicionales o notas importantes",
  serviceGroup1: "Seleccione al menos un tipo de servicio (Técnico, Instalación, Puesta en Marcha, etc.)",
  serviceGroup2: "Seleccione la ubicación del servicio (Campo u Oficina)",
  serviceGroup3Cargo: "Seleccione si el servicio es Con Cargo o Sin Cargo",
  serviceGroup3Garantia: "Seleccione si el servicio está En Garantía o es A Convenir",
  signatures: "Ambas firmas (cliente y técnico) y nombres son obligatorios"
}

// Validación completa de todos los grupos
export function validateAllGroups(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  const group1Validation = validateServiceGroup1(data)
  if (!group1Validation.isValid && group1Validation.message) {
    errors.push(group1Validation.message)
  }
  
  const group2Validation = validateServiceGroup2(data)
  if (!group2Validation.isValid && group2Validation.message) {
    errors.push(group2Validation.message)
  }
  
  const group3Validation = validateServiceGroup3(data)
  if (!group3Validation.isValid && group3Validation.messages) {
    errors.push(...group3Validation.messages)
  }
  
  const signatureValidation = validateSignatureGroup(data)
  if (!signatureValidation.isValid && signatureValidation.message) {
    errors.push(signatureValidation.message)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Schema para validación de CUIT argentino con formateo automático
const cuitSchema = z.string()
  .min(1, "CUIT es requerido")
  .transform(formatCuit)
  .refine((cuit) => validateCuitDigit(cuit), "CUIT inválido - dígito verificador incorrecto")

// Schema para validación de número de orden (simplificado - solo string)
const numeroOrdenSchema = z.string()
  .min(1, "Número de orden es requerido")

// Schema para validación de fecha
const fechaSchema = z.string()
  .min(1, "Fecha es requerida")
  .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})$/, "Formato de fecha inválido (DD-MM-YYYY o YYYY-MM-DD)")

// Schema para validación de teléfono argentino con formateo automático  
const telefonoSchema = z.string()
  .min(1, "Teléfono es requerido")
  .transform(formatPhoneNumber)
  .refine((phone) => {
    const cleaned = phone.replace(/\D/g, '')
    return cleaned.length >= 10
  }, "Teléfono debe tener al menos 10 dígitos")

// Schema para validación de firmas (URLs de ImgBB o data URLs)
const firmaSchema = z.string()
  .max(500, "URL de firma muy larga")
  .optional()
  .refine((value) => {
    if (!value || value.trim() === '') return true
    // Permitir URLs de ImgBB, otras URLs HTTP, o data URLs
    return value.startsWith('https://i.ibb.co/') || 
           value.startsWith('http') || 
           value.startsWith('data:image')
  }, "Firma debe ser una URL válida o imagen base64")

// Schema para validación de números (distancia, duración, etc.)
const numeroPositivoSchema = z.string()
  .regex(/^\d*\.?\d+$/, "Debe ser un número válido")
  .refine((val) => parseFloat(val) >= 0, "Debe ser un número positivo")

// Schema para validación de moneda
const monedaSchema = z.string()
  .regex(/^\d*\.?\d{0,2}$/, "Formato de moneda inválido (máximo 2 decimales)")

// Schema principal para el formulario
export const formValidationSchema = z.object({
  numeroOrden: numeroOrdenSchema,
  fecha: fechaSchema,
  razonSocial: z.string().min(1, "Razón social es requerida").max(100, "Razón social muy larga"),
  cuit: cuitSchema,
  contacto: z.string().min(1, "Contacto es requerido").max(50, "Nombre de contacto muy largo"),
  telefono: telefonoSchema,
  servicioTecnico: z.boolean(),
  instalacion: z.boolean(),
  puestaEnMarcha: z.boolean(),
  capacitacion: z.boolean(),
  calibracion: z.boolean(),
  tercero: z.boolean(),
  maquina: z.string().max(100, "Descripción de máquina muy larga"),
  equipo: z.string().max(100, "Descripción de equipo muy larga"),
  descripcion: z.string().max(1000, "Descripción muy larga"),
  insumos: z.string().max(500, "Lista de insumos muy larga"),
  servicioACampo: z.boolean(),
  servicioEnOficina: z.boolean(),
  conCargo: z.boolean(),
  sinCargo: z.boolean(),
  servicioEnGarantia: z.boolean(),
  aConvenir: z.boolean(),
  localidad: z.string().max(50, "Localidad muy larga"),
  provincia: z.string().max(50, "Provincia muy larga"),
  distancia: z.string().optional().refine((val) => !val || /^\d*\.?\d+$/.test(val), "Distancia debe ser un número"),
  duracion: z.string().optional().refine((val) => !val || /^\d*\.?\d+$/.test(val), "Duración debe ser un número"),
  tipoCambio: z.string().optional().refine((val) => !val || /^\d*\.?\d{0,4}$/.test(val), "Tipo de cambio inválido"),
  iva: monedaSchema.optional(),
  total: monedaSchema.optional(),
  tecnicoNombre: z.string().max(50, "Nombre de técnico muy largo"),
  tecnicoFirma: firmaSchema,
  clienteNombre: z.string().max(50, "Nombre de cliente muy largo"),
  clienteFirma: firmaSchema,
  aux1: z.string().max(100, "Campo auxiliar 1 muy largo"),
  aux2: z.string().max(100, "Campo auxiliar 2 muy largo"),
  aux3: z.string().max(100, "Campo auxiliar 3 muy largo"),
  aux4: z.string().max(100, "Campo auxiliar 4 muy largo"),
  odooPartnerId: z.number().nullable().optional(),
})

// Tipos derivados del schema
export type FormValidationData = z.infer<typeof formValidationSchema>

// Función para validar campos individuales
export function validateField(field: keyof FormValidationData, value: any): { isValid: boolean; error?: string } {
  try {
    const fieldSchema = formValidationSchema.shape[field]
    fieldSchema.parse(value)
    return { isValid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0]?.message || "Valor inválido" }
    }
    return { isValid: false, error: "Error de validación" }
  }
}

// Función para validar todo el formulario
export function validateForm(data: Partial<FormValidationData>): { isValid: boolean; errors: Record<string, string> } {
  try {
    formValidationSchema.parse(data)
    return { isValid: true, errors: {} }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {}
      error.errors.forEach((err) => {
        const field = err.path[0] as string
        errors[field] = err.message
      })
      return { isValid: false, errors }
    }
    return { isValid: false, errors: { general: "Error de validación" } }
  }
}

// Validaciones específicas para campos críticos
export const validations = {
  cuit: (value: string) => validateField("cuit", value),
  numeroOrden: (value: string) => validateField("numeroOrden", value),
  fecha: (value: string) => validateField("fecha", value),
  telefono: (value: string) => validateField("telefono", value),
  moneda: (value: string) => {
    try {
      monedaSchema.parse(value)
      return { isValid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.errors[0]?.message || "Formato de moneda inválido" }
      }
      return { isValid: false, error: "Error de validación" }
    }
  }
}

// Función específica para validar campos obligatorios según requerimientos del usuario
export function validateRequiredFields(data: any): { 
  isValid: boolean; 
  errors: Record<string, string>;
  missingFields: string[];
} {
  const errors: Record<string, string> = {}
  const missingFields: string[] = []

  // 1. Fecha (obligatorio)
  if (!data.fecha || data.fecha.trim() === '') {
    errors.fecha = "La fecha es obligatoria"
    missingFields.push("fecha")
  }

  // 2. Razón Social (obligatorio)
  if (!data.razonSocial || data.razonSocial.trim() === '') {
    errors.razonSocial = "La razón social es obligatoria"
    missingFields.push("razonSocial")
  }

  // 3. Contacto (obligatorio)
  if (!data.contacto || data.contacto.trim() === '') {
    errors.contacto = "El contacto es obligatorio"
    missingFields.push("contacto")
  }

  // 4. CUIT (obligatorio)
  if (!data.cuit || data.cuit.trim() === '') {
    errors.cuit = "El CUIT es obligatorio"
    missingFields.push("cuit")
  } else {
    // Validar formato CUIT si está presente
    const cuitValidation = validateField("cuit", data.cuit)
    if (!cuitValidation.isValid && cuitValidation.error) {
      errors.cuit = cuitValidation.error
      missingFields.push("cuit")
    }
  }

  // 5. Teléfono (obligatorio)
  if (!data.telefono || data.telefono.trim() === '') {
    errors.telefono = "El teléfono es obligatorio"
    missingFields.push("telefono")
  } else {
    // Validar formato teléfono si está presente
    const telefonoValidation = validateField("telefono", data.telefono)
    if (!telefonoValidation.isValid && telefonoValidation.error) {
      errors.telefono = telefonoValidation.error
      missingFields.push("telefono")
    }
  }

  // 6. Al menos un tipo de servicio (obligatorio)
  const tiposServicio = [
    data.servicioTecnico,
    data.instalacion,
    data.puestaEnMarcha,
    data.capacitacion,
    data.calibracion,
    data.tercero
  ]
  if (!tiposServicio.some(servicio => servicio === true)) {
    errors.tiposServicio = "Debe seleccionar al menos un tipo de servicio"
    missingFields.push("tiposServicio")
  }

  // 7. Máquina (obligatorio)
  if (!data.maquina || data.maquina.trim() === '') {
    errors.maquina = "La máquina es obligatoria"
    missingFields.push("maquina")
  }

  // 8. Equipo (obligatorio)
  if (!data.equipo || data.equipo.trim() === '') {
    errors.equipo = "El equipo es obligatorio"
    missingFields.push("equipo")
  }

  // 9. Descripción (obligatorio)
  if (!data.descripcion || data.descripcion.trim() === '') {
    errors.descripcion = "La descripción es obligatoria"
    missingFields.push("descripcion")
  }

  // 10. Insumos - OPCIONAL, no se valida como obligatorio

  // 11. Al menos una ubicación de servicio (obligatorio)
  if (!data.servicioACampo && !data.servicioEnOficina) {
    errors.ubicacionServicio = "Debe seleccionar la ubicación del servicio (Campo u Oficina)"
    missingFields.push("ubicacionServicio")
  }

  // 12. Al menos un tipo de cargo (obligatorio) - conCargo O sinCargo
  if (!data.conCargo && !data.sinCargo) {
    errors.tipoCargo = "Debe seleccionar si el servicio es con cargo o sin cargo"
    missingFields.push("tipoCargo")
  }

  // 13. Al menos un tipo de garantía (obligatorio) - servicioEnGarantia O aConvenir
  if (!data.servicioEnGarantia && !data.aConvenir) {
    errors.tipoGarantia = "Debe seleccionar si el servicio está en garantía o es a convenir"
    missingFields.push("tipoGarantia")
  }

  // 14. Localidad (obligatorio)
  if (!data.localidad || data.localidad.trim() === '') {
    errors.localidad = "La localidad es obligatoria"
    missingFields.push("localidad")
  }

  // 15. Provincia (obligatorio)
  if (!data.provincia || data.provincia.trim() === '') {
    errors.provincia = "La provincia es obligatoria"
    missingFields.push("provincia")
  }

  // 16. Distancia (obligatorio)
  if (!data.distancia || data.distancia.trim() === '') {
    errors.distancia = "La distancia es obligatoria"
    missingFields.push("distancia")
  }

  // 17. Duración (obligatorio)
  if (!data.duracion || data.duracion.trim() === '') {
    errors.duracion = "La duración es obligatoria"
    missingFields.push("duracion")
  }

  // 18. Nombre del técnico (obligatorio)
  if (!data.tecnicoNombre || data.tecnicoNombre.trim() === '') {
    errors.tecnicoNombre = "El nombre del técnico es obligatorio"
    missingFields.push("tecnicoNombre")
  }

  // 19. Firma del técnico (obligatorio)
  const hasTechSignature = data.tecnicoFirma && 
    data.tecnicoFirma.trim() !== '' && 
    (data.tecnicoFirma.startsWith('http') || data.tecnicoFirma.startsWith('data:image'))
  if (!hasTechSignature) {
    errors.tecnicoFirma = "La firma del técnico es obligatoria"
    missingFields.push("tecnicoFirma")
  }

  // 20. Nombre del cliente (obligatorio)
  if (!data.clienteNombre || data.clienteNombre.trim() === '') {
    errors.clienteNombre = "El nombre del cliente es obligatorio"
    missingFields.push("clienteNombre")
  }

  // 21. Firma del cliente (obligatorio)
  const hasClientSignature = data.clienteFirma && 
    data.clienteFirma.trim() !== '' && 
    (data.clienteFirma.startsWith('http') || data.clienteFirma.startsWith('data:image'))
  if (!hasClientSignature) {
    errors.clienteFirma = "La firma del cliente es obligatoria"
    missingFields.push("clienteFirma")
  }

  return {
    isValid: missingFields.length === 0,
    errors,
    missingFields
  }
}

// Función para obtener hints de campos
export function getFieldHint(fieldName: string): string {
  const hints: Record<string, string> = {
    telefono: fieldHints.phone,
    cuit: fieldHints.cuit,
    contacto: fieldHints.clientName,
    tecnicoNombre: fieldHints.technicianName,
    localidad: fieldHints.address,
    descripcion: fieldHints.serviceDescription,
    insumos: fieldHints.observations,
    // Agregar más hints según sea necesario
  }
  
  return hints[fieldName] || ""
}