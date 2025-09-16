"use client"

import { useState, useEffect } from "react"

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
  numeroOrden: "",
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

export function useFormData() {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [isLoading, setIsLoading] = useState(true)

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem("aran-form-data")
      if (savedData) {
        const parsedData = JSON.parse(savedData)
        setFormData({ ...defaultFormData, ...parsedData })
      }
    } catch (error) {
      console.error("Error loading form data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-save to localStorage when data changes
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem("aran-form-data", JSON.stringify(formData))
      } catch (error) {
        console.error("Error saving form data:", error)
      }
    }
  }, [formData, isLoading])

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData(defaultFormData)
    localStorage.removeItem("aran-form-data")
  }

  const exportData = () => {
    const dataStr = JSON.stringify(formData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `orden-servicio-${formData.numeroOrden || "nueva"}-${new Date().toISOString().split("T")[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importData = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string)
          setFormData({ ...defaultFormData, ...importedData })
          resolve()
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error("Error reading file"))
      reader.readAsText(file)
    })
  }

  return {
    formData,
    updateField,
    resetForm,
    exportData,
    importData,
    isLoading,
  }
}
