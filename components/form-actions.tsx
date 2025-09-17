"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Save, Send, Download, Upload, RotateCcw, AlertCircle, CheckCircle } from "lucide-react"
import { useRef } from "react"
import type { FormData } from "@/hooks/use-form-data"
import { toast } from "@/lib/toast"
import { validateForm } from "@/lib/validations"

interface FormActionsProps {
  formData: FormData
  onSave: () => void
  onSubmit: () => void
  onExport: () => void
  onImport: (file: File) => Promise<void>
  onReset: () => void
  hasErrors?: boolean
  lastSaveTime?: Date | null
  formProgress?: number
}

export function FormActions({ 
  formData, 
  onSave, 
  onSubmit, 
  onExport, 
  onImport, 
  onReset,
  hasErrors = false,
  lastSaveTime,
  formProgress = 0
}: FormActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        await onImport(file)
      } catch (error) {
        console.error("Import error:", error)
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

  const handleSubmit = () => {
    // Validar formulario antes de enviar
    const validation = validateForm(formData)
    
    if (!validation.isValid) {
      toast.validationError(validation.errors)
      return
    }

    if (!formData.numeroOrden.trim()) {
      toast.error("Campo requerido", { description: "El número de orden es obligatorio" })
      return
    }

    onSubmit()
    toast.formSubmitted()
  }

  const handleSave = () => {
    onSave()
    toast.formSaved()
  }

  const getStatusIcon = () => {
    if (hasErrors) {
      return <AlertCircle className="h-4 w-4 text-destructive" />
    }
    return <CheckCircle className="h-4 w-4 text-green-600" />
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span>
            {hasErrors ? "Hay errores en el formulario" : "Formulario válido"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>Progreso: {formProgress}%</span>
          {lastSaveTime && (
            <span>
              Guardado: {lastSaveTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Guardar
        </Button>

        <Button 
          onClick={handleSubmit} 
          disabled={!formData.numeroOrden.trim() || hasErrors}
          className={hasErrors ? "opacity-50" : ""}
        >
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

        <input 
          ref={fileInputRef} 
          type="file" 
          accept=".json" 
          onChange={handleFileChange} 
          className="hidden" 
        />
      </div>
    </div>
  )
}
