"use client"

import { useState, useEffect } from "react"
import { toast } from "@/lib/toast"
import { validateField, formatPhoneNumber, formatCuit, type FormValidationData, validateRequiredFields } from "@/lib/validations"
import { generateOrderNumber } from "@/lib/order-number"
import { toast as sonnerToast } from "sonner"

export interface FormData {
  numeroOrden: string
  fecha: string
  razonSocial: string
  cuit: string
  contacto: string
  telefono: string
  servicioTecnico: boolean
  instalacion: boolean
  puestaEnMarcha: boolean
  capacitacion: boolean
  calibracion: boolean
  tercero: boolean
  maquina: string
  equipo: string
  descripcion: string
  insumos: string
  servicioACampo: boolean
  servicioEnOficina: boolean
  conCargo: boolean
  sinCargo: boolean
  servicioEnGarantia: boolean
  aConvenir: boolean
  localidad: string
  provincia: string
  distancia: string
  duracion: string
  tipoCambio: string
  iva: string
  total: string
  tecnicoNombre: string
  tecnicoFirma: string
  clienteNombre: string
  clienteFirma: string
  aux1: string
  aux2: string
  aux3: string
  aux4: string
}

const defaultFormData: FormData = {
  numeroOrden: generateOrderNumber(),
  fecha: (() => {
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()
    return `${dd}-${mm}-${yyyy}`
  })(),
  razonSocial: "",
  cuit: "",
  contacto: "",
  telefono: "",
  servicioTecnico: false,
  instalacion: false,
  puestaEnMarcha: false,
  capacitacion: false,
  calibracion: false,
  tercero: false,
  maquina: "",
  equipo: "",
  descripcion: "",
  insumos: "",
  servicioACampo: false,
  servicioEnOficina: false,
  conCargo: false,
  sinCargo: false,
  servicioEnGarantia: false,
  aConvenir: false,
  localidad: "",
  provincia: "",
  distancia: "",
  duracion: "",
  tipoCambio: "",
  iva: "",
  total: "",
  tecnicoNombre: "",
  tecnicoFirma: "",
  clienteNombre: "",
  clienteFirma: "",
  aux1: "",
  aux2: "",
  aux3: "",
  aux4: "",
}

// Campos críticos que requieren validación en tiempo real
const criticalFields: (keyof FormData)[] = [
  "razonSocial", "contacto", "cuit", "telefono",
  "maquina", "equipo", "descripcion", "insumos",
  "tecnicoNombre", "clienteNombre"
  // Nota: Los grupos de servicios, ubicación, facturación y firmas se validan por separado
]

export function useFormData() {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [isLoading, setIsLoading] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)

  // Load data from localStorage on mount
  useEffect(() => {
    console.log('🚀 useEffect MOUNT ejecutándose, isLoading:', isLoading)
    try {
      const savedData = localStorage.getItem("aran-form-data")
      console.log('🔍 Cargando datos del localStorage:', savedData)
      if (savedData) {
        const parsedData = JSON.parse(savedData)
        console.log('📦 Datos parseados del localStorage:', {
          tecnicoFirma: parsedData.tecnicoFirma,
          clienteFirma: parsedData.clienteFirma,
          totalFields: Object.keys(parsedData).length
        })
        setFormData({ ...defaultFormData, ...parsedData })
        toast.info("Datos recuperados", { description: "Se han cargado los datos guardados anteriormente" })
      } else {
        console.log('📝 No hay datos en localStorage, usando valores por defecto')
      }
    } catch (error) {
      console.error("Error loading form data:", error)
      toast.error("Error al cargar datos", { description: "No se pudieron recuperar los datos guardados" })
    } finally {
      console.log('✅ Finalizando carga, estableciendo isLoading = false')
      setIsLoading(false)
    }
  }, []) // Solo en mount

  // Auto-save to localStorage when data changes (with debounce)
  useEffect(() => {
    if (!isLoading) {
      const timeoutId = setTimeout(() => {
        try {
          console.log('💾 Guardando en localStorage:', {
            tecnicoFirma: formData.tecnicoFirma,
            clienteFirma: formData.clienteFirma,
            isLoading
          })
          localStorage.setItem("aran-form-data", JSON.stringify(formData))
          setLastSaveTime(new Date())
        } catch (error) {
          console.error("Error saving form data:", error)
          toast.error("Error al guardar", { description: "No se pudieron guardar los datos automáticamente" })
        }
      }, 500) // Debounce de 500ms

      return () => clearTimeout(timeoutId)
    }
  }, [formData, isLoading])

  const validateAndUpdateField = (field: keyof FormData, value: string | boolean) => {
    // Solo validar campos críticos en tiempo real
    if (criticalFields.includes(field) && typeof value === "string") {
      const validation = validateField(field as keyof FormValidationData, value)
      
      if (!validation.isValid && validation.error) {
        setFieldErrors(prev => ({ ...prev, [field]: validation.error! }))
        toast.fieldError(field, validation.error)
      } else {
        setFieldErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[field]
          return newErrors
        })
      }
    }
  }

  const updateField = (field: keyof FormData, value: string | boolean) => {
    // Log específico para firmas para debugging
    if (field === 'tecnicoFirma' || field === 'clienteFirma') {
      console.log(`🎯 FormData: ${field} actualizado con:`, {
        type: typeof value,
        isUrl: typeof value === 'string' && value.startsWith('http'),
        isBase64: typeof value === 'string' && value.startsWith('data:image'),
        length: typeof value === 'string' ? value.length : 0,
        preview: typeof value === 'string' ? value.substring(0, 100) + '...' : value,
        fullValue: value
      })

      // Log el estado actual antes del update
      console.log(`📝 Estado ANTES del update ${field}:`, formData[field])
    }
    
    // Aplicar formateo automático antes de guardar
    if (typeof value === "string") {
      if (field === "telefono") {
        value = formatPhoneNumber(value)
      } else if (field === "cuit") {
        value = formatCuit(value)
      }
    }
    
    const oldFormData = formData
    setFormData((prev) => {
      const newData = { ...prev, [field]: value }
      
      // Log específico para firmas después del update
      if (field === 'tecnicoFirma' || field === 'clienteFirma') {
        console.log(`📝 Estado DESPUÉS del update ${field}:`, newData[field])
        console.log(`🔄 FormData completo actualizado:`, {
          [field]: newData[field],
          estadoCompleto: newData
        })
      }
      
      return newData
    })
    validateAndUpdateField(field, value)
  }

  const resetForm = () => {
    console.log('🔄 RESET FORM LLAMADO - Preservando datos del técnico')
    
    // Guardar campos del técnico que deben persistir
    const persistentTechnicianData = {
      tecnicoNombre: formData.tecnicoNombre,
      tecnicoFirma: formData.tecnicoFirma
    }
    
    console.log('💾 Datos del técnico a preservar:', persistentTechnicianData)
    
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()
    
    // Crear nuevo formulario manteniendo los datos del técnico
    const newFormData = {
      ...defaultFormData,
      numeroOrden: generateOrderNumber(), // Generar nuevo número de orden
      fecha: `${dd}-${mm}-${yyyy}`, // Fecha actual en formato DD-MM-YYYY
      tecnicoNombre: persistentTechnicianData.tecnicoNombre, // Mantener nombre del técnico
      tecnicoFirma: persistentTechnicianData.tecnicoFirma // Mantener firma del técnico
    }
    
    console.log('✅ Nuevo formulario con datos del técnico:', {
      tecnicoNombre: newFormData.tecnicoNombre,
      tecnicoFirma: newFormData.tecnicoFirma ? 'Preservada' : 'Vacía'
    })
    
    setFormData(newFormData)
    setFieldErrors({})
    // No remover completamente, guardar con los datos del técnico
    localStorage.setItem("aran-form-data", JSON.stringify(newFormData))
    setLastSaveTime(null)
    toast.success("Formulario limpiado", { 
      description: "Los datos del técnico se han preservado" 
    })
  }



  const importData = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string)
          setFormData({ ...defaultFormData, ...importedData })
          setFieldErrors({}) // Limpiar errores al importar
          toast.dataImported()
          resolve()
        } catch (error) {
          toast.error("Error al importar", { description: "El archivo no tiene un formato válido" })
          reject(error)
        }
      }
      reader.onerror = () => {
        toast.error("Error de archivo", { description: "No se pudo leer el archivo" })
        reject(new Error("Error reading file"))
      }
      reader.readAsText(file)
    })
  }

  const getFieldError = (field: keyof FormData): string | undefined => {
    return fieldErrors[field]
  }

  const hasErrors = (): boolean => {
    return Object.keys(fieldErrors).length > 0
  }

  // Validación actualizada de campos críticos usando los nuevos requerimientos
  const validateCriticalFields = (): { isValid: boolean; missingFields: string[]; errors: Record<string, string> } => {
    const validation = validateRequiredFields(formData)
    
    return {
      isValid: validation.isValid,
      missingFields: validation.missingFields,
      errors: validation.errors
    }
  }

  const regenerateOrderNumber = () => {
    const newOrderNumber = generateOrderNumber()
    updateField('numeroOrden', newOrderNumber)
    sonnerToast.success(`Nuevo número de orden generado: ${newOrderNumber}`)
  }

  const loadFormData = (data: FormData) => {
    console.log('📥 Cargando datos en formulario:', data)
    setFormData(data)
    setFieldErrors({})
    localStorage.setItem("aran-form-data", JSON.stringify(data))
    setLastSaveTime(new Date())
    sonnerToast.success("Datos cargados", { 
      description: "Orden lista para editar" 
    })
  }

  return {
    formData,
    updateField,
    resetForm,
    loadFormData,
    importData,
    isLoading,
    fieldErrors,
    getFieldError,
    hasErrors,
    validateCriticalFields,
    lastSaveTime,
    regenerateOrderNumber,
  }
}
