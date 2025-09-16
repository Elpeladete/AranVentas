"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Save, Send, Download, Upload, RotateCcw } from "lucide-react"
import { useRef } from "react"
import type { FormData } from "@/hooks/use-form-data"

interface FormActionsProps {
  formData: FormData
  onSave: () => void
  onSubmit: () => void
  onExport: () => void
  onImport: (file: File) => Promise<void>
  onReset: () => void
}

export function FormActions({ formData, onSave, onSubmit, onExport, onImport, onReset }: FormActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        await onImport(file)
        alert("Datos importados correctamente")
      } catch (error) {
        alert("Error al importar los datos")
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleReset = () => {
    if (confirm("¿Está seguro de que desea limpiar todos los datos del formulario?")) {
      onReset()
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={onSave}>
        <Save className="h-4 w-4 mr-2" />
        Guardar
      </Button>

      <Button onClick={onSubmit} disabled={!formData.numeroOrden}>
        <Send className="h-4 w-4 mr-2" />
        Enviar a Google Forms
      </Button>

      <Button variant="outline" onClick={onExport}>
        <Download className="h-4 w-4 mr-2" />
        Exportar JSON
      </Button>

      <Button variant="outline" onClick={handleImportClick}>
        <Upload className="h-4 w-4 mr-2" />
        Importar JSON
      </Button>

      <Button variant="outline" onClick={handleReset}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Limpiar
      </Button>

      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
    </div>
  )
}
