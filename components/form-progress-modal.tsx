"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, CheckCircle, AlertCircle, Circle } from "lucide-react"
import { type FormData } from "@/hooks/use-form-data"

interface FormProgressModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmitIncomplete: () => void
  onContinueEditing: () => void
  onOpenManualForm?: () => void
  formData: FormData
  progress: number
  missingFields: string[]
  criticalMissing: string[]
}

export function FormProgressModal({
  isOpen,
  onClose,
  onSubmitIncomplete,
  onContinueEditing,
  onOpenManualForm,
  formData,
  progress,
  missingFields,
  criticalMissing
}: FormProgressModalProps) {
  if (!isOpen) return null

  const isComplete = progress === 100
  const hasCriticalMissing = criticalMissing.length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Estado del Formulario</h2>
              <p className="text-muted-foreground">
                Revisa el progreso antes de enviar
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progreso de completado</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${
                  progress === 100 
                    ? 'bg-green-500' 
                    : progress >= 75 
                    ? 'bg-blue-500' 
                    : progress >= 50 
                    ? 'bg-yellow-500' 
                    : 'bg-red-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(formData).filter(value => 
                  typeof value === 'boolean' ? value : (value && value.toString().trim() !== '')
                ).length}
              </div>
              <div className="text-sm text-muted-foreground">Campos completados</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {missingFields.length}
              </div>
              <div className="text-sm text-muted-foreground">Campos pendientes</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {criticalMissing.length}
              </div>
              <div className="text-sm text-muted-foreground">Campos críticos</div>
            </div>
          </div>

          {/* Critical Fields Section */}
          {hasCriticalMissing && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-800">Campos Críticos Pendientes</h3>
              </div>
              <div className="space-y-2">
                {criticalMissing.map((field) => (
                  <div key={field} className="flex items-center gap-2 text-sm text-red-700">
                    <Circle className="h-3 w-3 fill-red-600" />
                    <span>{getFieldLabel(field)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-red-600 mt-2">
                Estos campos son esenciales para el procesamiento de la orden de servicio.
              </p>
            </div>
          )}

          {/* Missing Fields Section */}
          {missingFields.length > 0 && !hasCriticalMissing && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-800">Campos Opcionales Pendientes</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {missingFields.slice(0, 8).map((field) => (
                  <div key={field} className="flex items-center gap-2 text-sm text-yellow-700">
                    <Circle className="h-3 w-3 fill-yellow-600" />
                    <span>{getFieldLabel(field)}</span>
                  </div>
                ))}
              </div>
              {missingFields.length > 8 && (
                <p className="text-xs text-yellow-600 mt-2">
                  ... y {missingFields.length - 8} campos más
                </p>
              )}
            </div>
          )}

          {/* Complete Status */}
          {isComplete && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-800">¡Formulario Completo!</h3>
              </div>
              <p className="text-sm text-green-700">
                Todos los campos han sido completados. El formulario está listo para enviar.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-col sm:flex-row">
            {hasCriticalMissing ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={onContinueEditing}
                  className="flex-1"
                >
                  Completar Campos Críticos
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={onSubmitIncomplete}
                  className="flex-1"
                >
                  Enviar de Todos Modos
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={onContinueEditing}
                  className="flex-1"
                >
                  Continuar Editando
                </Button>
                <Button 
                  onClick={onSubmitIncomplete}
                  className="flex-1"
                  variant={isComplete ? "default" : "secondary"}
                >
                  {isComplete ? "Enviar Formulario" : "Enviar Incompleto"}
                </Button>
              </>
            )}
          </div>

          {/* Footer info */}
          <div className="mt-4 p-3 bg-muted/30 rounded text-xs text-muted-foreground">
            <p>
              <strong>Envío automático:</strong> Los datos se envían directamente a Google Forms.
            </p>
            <p>
              <strong>Envío manual:</strong> Se abre Google Forms pre-llenado para revisión manual.
            </p>
            {onOpenManualForm && (
              <div className="mt-2 pt-2 border-t border-muted">
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={onOpenManualForm}
                  className="p-0 h-auto text-xs"
                >
                  🔗 Abrir formulario manual de Google Forms
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

// Helper function para obtener labels amigables de los campos
function getFieldLabel(fieldId: string): string {
  const labels: Record<string, string> = {
    numeroOrden: "Número de Orden",
    fecha: "Fecha",
    razonSocial: "Razón Social",
    cuit: "CUIT",
    contacto: "Contacto",
    telefono: "Teléfono",
    servicioTecnico: "Servicio Técnico",
    instalacion: "Instalación",
    puestaEnMarcha: "Puesta en Marcha",
    capacitacion: "Capacitación",
    calibracion: "Calibración",
    tercero: "Tercero",
    maquina: "Máquina",
    equipo: "Equipo",
    descripcion: "Descripción",
    insumos: "Insumos",
    servicioACampo: "Servicio a Campo",
    servicioEnOficina: "Servicio en Oficina",
    conCargo: "Con Cargo",
    sinCargo: "Sin Cargo",
    servicioEnGarantia: "Servicio en Garantía",
    aConvenir: "A Convenir",
    localidad: "Localidad",
    provincia: "Provincia",
    distancia: "Distancia",
    duracion: "Duración",
    tipoCambio: "Tipo de Cambio",
    iva: "IVA",
    total: "Total",
    tecnicoNombre: "Nombre del Técnico",
    tecnicoFirma: "Firma del Técnico",
    clienteNombre: "Nombre del Cliente",
    clienteFirma: "Firma del Cliente",
    aux1: "Auxiliar 1",
    aux2: "Auxiliar 2",
    aux3: "Auxiliar 3",
    aux4: "Auxiliar 4"
  }
  
  return labels[fieldId] || fieldId
}