"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FormData } from "@/hooks/use-form-data"
import { validateRequiredFields } from "@/lib/validations"

interface ValidationStatusProps {
  formData: FormData
  onFieldFocus?: (fieldName: string) => void
  mode?: 'discrete' | 'prominent'
}

export function ValidationStatus({ formData, onFieldFocus, mode = 'discrete' }: ValidationStatusProps) {
  const validation = validateRequiredFields(formData)
  
  // Modo discreto - versión compacta
  if (mode === 'discrete') {
    if (validation.isValid) {
      return (
        <div className="flex items-center space-x-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-200">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-[8px]">✓</span>
          </div>
          <span className="font-medium">Completo</span>
        </div>
      )
    } else {
      return (
        <div className="flex items-center space-x-1.5 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-200">
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white text-[8px]">{validation.missingFields.length}</span>
          </div>
          <span className="font-medium">Faltan {validation.missingFields.length} campos</span>
        </div>
      )
    }
  }
  
  // Modo prominente - versión completa (actual)
  if (validation.isValid) {
    return (
      <Card className="border-green-200 bg-green-50 validation-status shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
            <span className="text-green-700 font-medium">
              ✅ Formulario completo - Listo para enviar
            </span>
            <div className="ml-2 h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const fieldLabels: Record<string, string> = {
    fecha: "Fecha",
    razonSocial: "Razón Social",
    contacto: "Contacto",
    cuit: "CUIT",
    telefono: "Teléfono",
    tiposServicio: "Tipo de Servicio",
    maquina: "Máquina",
    equipo: "Equipo", 
    descripcion: "Descripción",
    insumos: "Insumos",
    ubicacionServicio: "Ubicación del Servicio",
    tipoCargo: "Tipo de Cargo",
    tipoGarantia: "Tipo de Garantía"
  }

  return (
    <Card className="border-orange-200 bg-orange-50 validation-status shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-orange-800 text-sm flex items-center">
          ⚠️ Campos Obligatorios Faltantes ({validation.missingFields.length})
          <div className="ml-2 h-2 w-2 bg-orange-500 rounded-full animate-pulse"></div>
        </CardTitle>
        <CardDescription className="text-orange-600 text-xs">
          Complete estos campos antes de enviar el formulario
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {validation.missingFields.map((field, index) => (
            <div key={field} className="flex items-center justify-between bg-white p-2 rounded border border-orange-200">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 bg-orange-400 text-white text-xs rounded-full flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-orange-800">
                  {fieldLabels[field] || field}
                </span>
              </div>
              {onFieldFocus && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-6 px-2"
                  onClick={() => onFieldFocus(field)}
                >
                  Ir al campo
                </Button>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-3 p-2 bg-white rounded border border-orange-200">
          <p className="text-xs text-orange-600">
            💡 <strong>Tip:</strong> Los campos marcados en rojo son obligatorios para enviar el formulario.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}