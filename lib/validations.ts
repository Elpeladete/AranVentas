import { z } from "zod"

// Schema para validación de CUIT argentino
const cuitSchema = z.string()
  .min(11, "CUIT debe tener 11 dígitos")
  .max(11, "CUIT debe tener 11 dígitos")
  .regex(/^\d{11}$/, "CUIT debe contener solo números")
  .refine((cuit) => {
    // Validación del dígito verificador del CUIT
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    const digits = cuit.split('').map(Number)
    
    const sum = digits.slice(0, 10).reduce((acc, digit, index) => {
      return acc + digit * multipliers[index]
    }, 0)
    
    const remainder = sum % 11
    const checkDigit = remainder < 2 ? remainder : 11 - remainder
    
    return checkDigit === digits[10]
  }, "CUIT inválido - dígito verificador incorrecto")

// Schema para validación de número de orden
const numeroOrdenSchema = z.string()
  .min(7, "Número de orden debe tener exactamente 7 dígitos")
  .max(7, "Número de orden debe tener exactamente 7 dígitos")
  .regex(/^\d{7}$/, "Número de orden debe ser exactamente 7 dígitos numéricos")

// Schema para validación de fecha
const fechaSchema = z.string()
  .min(1, "Fecha es requerida")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")

// Schema para validación de teléfono argentino
const telefonoSchema = z.string()
  .regex(/^[\d\s\-\+\(\)]+$/, "Teléfono debe contener solo números, espacios, guiones y paréntesis")
  .min(8, "Teléfono muy corto")
  .max(20, "Teléfono muy largo")

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
  tecnicoFirma: z.string().max(50, "Firma de técnico muy larga"),
  clienteNombre: z.string().max(50, "Nombre de cliente muy largo"),
  clienteFirma: z.string().max(50, "Firma de cliente muy larga"),
  aux1: z.string().max(100, "Campo auxiliar 1 muy largo"),
  aux2: z.string().max(100, "Campo auxiliar 2 muy largo"),
  aux3: z.string().max(100, "Campo auxiliar 3 muy largo"),
  aux4: z.string().max(100, "Campo auxiliar 4 muy largo"),
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