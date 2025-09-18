"use client"

import { useState, useEffect } from "react"
import { toast } from "@/lib/toast"
import { validateField, formatPhoneNumber, formatCuit, type FormValidationData } from "@/lib/validations"
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
  fecha: new Date().toISOString().split("T")[0],
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
const criticalFields: (keyof FormData)[] = ["numeroOrden", "cuit", "fecha", "telefono", "razonSocial", "contacto"]

// Campos recomendados para una orden completa
const recommendedFields: (keyof FormData)[] = [
  "numeroOrden", "fecha", "razonSocial", "cuit", "contacto", "telefono",
  "maquina", "equipo", "descripcion", "localidad", "provincia", 
  "tecnicoNombre", "clienteNombre"
]

// Analizar el progreso del formulario
export function analyzeFormProgress(formData: FormData) {
  const allFields = Object.keys(formData) as (keyof FormData)[]
  
  // Campos completados
  const completedFields = allFields.filter(field => {
    const value = formData[field]
    return typeof value === 'boolean' ? value : (value && value.toString().trim() !== '')
  })
  
  // Campos críticos faltantes
  const criticalMissing = criticalFields.filter(field => {
    const value = formData[field]
    return typeof value === 'boolean' ? !value : (!value || value.toString().trim() === '')
  })
  
  // Campos recomendados faltantes
  const recommendedMissing = recommendedFields.filter(field => {
    const value = formData[field]
    return typeof value === 'boolean' ? !value : (!value || value.toString().trim() === '')
  })
  
  // Todos los campos faltantes
  const allMissing = allFields.filter(field => {
    const value = formData[field]
    return typeof value === 'boolean' ? !value : (!value || value.toString().trim() === '')
  })
  
  // Calcular progreso basado en campos recomendados
  const progress = Math.round(
    ((recommendedFields.length - recommendedMissing.length) / recommendedFields.length) * 100
  )
  
  return {
    progress,
    totalFields: allFields.length,
    completedFields: completedFields.length,
    criticalMissing,
    recommendedMissing,
    allMissing,
    isComplete: allMissing.length === 0,
    isRecommendedComplete: recommendedMissing.length === 0,
    hasCriticalMissing: criticalMissing.length > 0
  }
}

export function useFormData() {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [isLoading, setIsLoading] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem("aran-form-data")
      if (savedData) {
        const parsedData = JSON.parse(savedData)
        setFormData({ ...defaultFormData, ...parsedData })
        toast.info("Datos recuperados", { description: "Se han cargado los datos guardados anteriormente" })
      }
    } catch (error) {
      console.error("Error loading form data:", error)
      toast.error("Error al cargar datos", { description: "No se pudieron recuperar los datos guardados" })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-save to localStorage when data changes
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem("aran-form-data", JSON.stringify(formData))
        setLastSaveTime(new Date())
      } catch (error) {
        console.error("Error saving form data:", error)
        toast.error("Error al guardar", { description: "No se pudieron guardar los datos automáticamente" })
      }
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
    // Aplicar formateo automático antes de guardar
    if (typeof value === "string") {
      if (field === "telefono") {
        value = formatPhoneNumber(value)
      } else if (field === "cuit") {
        value = formatCuit(value)
      }
    }
    
    setFormData((prev) => ({ ...prev, [field]: value }))
    validateAndUpdateField(field, value)
  }

  const resetForm = () => {
    const newFormData = {
      ...defaultFormData,
      numeroOrden: generateOrderNumber(), // Generar nuevo número de orden
      fecha: new Date().toISOString().split("T")[0] // Fecha actual
    }
    setFormData(newFormData)
    setFieldErrors({})
    localStorage.removeItem("aran-form-data")
    setLastSaveTime(null)
    toast.formReset()
  }

  const exportData = () => {
    const dataStr = JSON.stringify(formData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    const filename = `orden-servicio-${formData.numeroOrden || "nueva"}-${new Date().toISOString().split("T")[0]}.json`
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    toast.dataExported(filename)
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

  const getFormProgress = (): number => {
    const totalFields = Object.keys(defaultFormData).length
    const filledFields = Object.values(formData).filter(value => 
      typeof value === 'boolean' ? true : value.trim() !== ''
    ).length
    return Math.round((filledFields / totalFields) * 100)
  }

  const regenerateOrderNumber = () => {
    const newOrderNumber = generateOrderNumber()
    updateField('numeroOrden', newOrderNumber)
    sonnerToast.success(`Nuevo número de orden generado: ${newOrderNumber}`)
  }

  const getDetailedProgress = () => {
    return analyzeFormProgress(formData)
  }

  return {
    formData,
    updateField,
    resetForm,
    exportData,
    importData,
    isLoading,
    fieldErrors,
    getFieldError,
    hasErrors,
    getFormProgress,
    getDetailedProgress,
    lastSaveTime,
    regenerateOrderNumber,
  }
}
