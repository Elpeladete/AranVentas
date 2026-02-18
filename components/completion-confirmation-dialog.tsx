"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle, AlertTriangle, FileEdit, Save } from "lucide-react"

interface CompletionConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onEdit: () => void
  onSaveDraft?: () => void
  missingFields: string[]
  errors: Record<string, string>
}

export function CompletionConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  onEdit,
  onSaveDraft,
  missingFields,
  errors,
}: CompletionConfirmationDialogProps) {
  const hasIssues = missingFields.length > 0 || Object.keys(errors).length > 0
  
  // Mapeo de nombres de campos técnicos a nombres legibles
  const fieldLabels: Record<string, string> = {
    numeroOrden: "Número de Orden",
    fecha: "Fecha",
    razonSocial: "Razón Social",
    cuit: "CUIT",
    contacto: "Contacto",
    telefono: "Teléfono",
    tiposServicio: "Tipo de Servicio",
    maquina: "Máquina",
    equipo: "Equipo",
    descripcion: "Descripción del Trabajo",
    ubicacionServicio: "Ubicación del Servicio",
    tipoCargo: "Tipo de Cargo",
    tipoGarantia: "Tipo de Garantía",
    localidad: "Localidad",
    provincia: "Provincia",
    distancia: "Distancia (km)",
    duracion: "Duración (horas)",
    tecnicoNombre: "Nombre del Técnico",
    tecnicoFirma: "Firma del Técnico",
    clienteNombre: "Nombre del Cliente",
    clienteFirma: "Firma del Cliente",
  }

  const getFieldLabel = (field: string): string => {
    return fieldLabels[field] || field
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasIssues ? (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span>Campos Incompletos</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Formulario Completo</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {hasIssues 
              ? "Los siguientes campos requieren atención. No se puede enviar la orden hasta completarlos. Puede guardarla como borrador."
              : "Todos los campos están completos. ¿Desea confirmar y registrar la orden de servicio?"
            }
          </DialogDescription>
        </DialogHeader>

        {hasIssues && (
          <div className="max-h-[300px] overflow-y-auto py-4">
            {/* Campos faltantes */}
            {missingFields.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-sm text-red-600 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Campos Obligatorios Faltantes ({missingFields.length})
                </h4>
                <ul className="space-y-1 text-sm">
                  {missingFields.map((field) => (
                    <li key={field} className="flex items-start gap-2 text-red-600">
                      <span className="mt-0.5">•</span>
                      <span>{getFieldLabel(field)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Errores de validación */}
            {Object.keys(errors).length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-orange-600 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Errores de Validación ({Object.keys(errors).length})
                </h4>
                <ul className="space-y-1 text-sm">
                  {Object.entries(errors).map(([field, error]) => (
                    <li key={field} className="flex items-start gap-2 text-orange-600">
                      <span className="mt-0.5">•</span>
                      <span>
                        <strong>{getFieldLabel(field)}:</strong> {error}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!hasIssues && (
          <div className="py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">¡Todo listo!</p>
                <p className="text-sm text-green-700">
                  El formulario está completo y será enviado a Google Forms, Odoo y WhatsApp.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onEdit}
            className="w-full sm:w-auto order-3 sm:order-1"
          >
            <FileEdit className="h-4 w-4 mr-2" />
            Seguir Editando
          </Button>
          
          {onSaveDraft && (
            <Button
              type="button"
              variant="outline"
              onClick={onSaveDraft}
              className="w-full sm:w-auto order-2 border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Borrador
            </Button>
          )}
          
          <Button
            type="button"
            onClick={onConfirm}
            disabled={hasIssues}
            className={`w-full sm:w-auto order-1 sm:order-3 ${
              hasIssues 
                ? "bg-gray-400 cursor-not-allowed opacity-50" 
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {hasIssues ? "Complete los campos para enviar" : "Confirmar y Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
