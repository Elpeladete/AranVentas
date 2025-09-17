"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { X } from "lucide-react"
import { useFormData, type FormData } from "@/hooks/use-form-data"
import { FormActions } from "@/components/form-actions"
import { toast } from "@/lib/toast"
import { generateOrderNumber } from "@/lib/order-number"

interface ClickableArea {
  id: keyof FormData
  x: number
  y: number
  width: number
  height: number
  label: string
  type: "text" | "checkbox" | "textarea"
}

export function ServiceOrderForm() {
  const { 
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
    lastSaveTime,
    regenerateOrderNumber
  } = useFormData()
  const [activeField, setActiveField] = useState<keyof FormData | null>(null)
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 })
  const [tempValue, setTempValue] = useState<string | boolean>("")
  const [originalValue, setOriginalValue] = useState<string | boolean>("")
  const imageRef = useRef<HTMLDivElement>(null)

  // Define clickable areas based on the form image layout
  const clickableAreas: ClickableArea[] = [
    { id: "numeroOrden", x: 610, y: 70, width: 80, height: 30, label: "Número de Orden", type: "text" },
    { id: "fecha", x: 650, y: 127, width: 100, height: 30, label: "Fecha", type: "text" },
    { id: "razonSocial", x: 185, y: 190, width: 220, height: 22, label: "Razón Social", type: "text" },
    { id: "cuit", x: 540, y: 190, width: 220, height: 22, label: "CUIT", type: "text" },
    { id: "contacto", x: 185, y: 214, width: 200, height: 21, label: "Contacto", type: "text" },
    { id: "telefono", x: 540, y: 214, width: 220, height: 21, label: "Teléfono", type: "text" },
    { id: "servicioTecnico", x: 110, y: 285, width: 20, height: 20, label: "Servicio Técnico", type: "checkbox" },
    { id: "instalacion", x: 230, y: 285, width: 20, height: 20, label: "Instalación", type: "checkbox" },
    { id: "puestaEnMarcha", x: 348, y: 285, width: 20, height: 20, label: "Puesta en Marcha", type: "checkbox" },
    { id: "capacitacion", x: 467, y: 285, width: 20, height: 20, label: "Capacitación", type: "checkbox" },
    { id: "calibracion", x: 586, y: 285, width: 20, height: 20, label: "Calibración", type: "checkbox" },
    { id: "tercero", x: 705, y: 285, width: 20, height: 20, label: "Tercero", type: "checkbox" },
    { id: "maquina", x: 135, y: 332, width: 280, height: 21, label: "Máquina", type: "text" },
    { id: "equipo", x: 485, y: 332, width: 280, height: 21, label: "Equipo", type: "text" },
    { id: "descripcion", x: 65, y: 360, width: 700, height: 270, label: "Descripción Completa", type: "textarea" },
    { id: "insumos", x: 65, y: 685, width: 700, height: 220, label: "Insumos/Equipos", type: "textarea" },
    { id: "localidad", x: 470, y: 920, width: 135, height: 21, label: "Localidad", type: "text" },
    { id: "provincia", x: 594, y: 920, width: 60, height: 21, label: "Provincia", type: "text" },
    { id: "distancia", x: 470, y: 943, width: 150, height: 21, label: "Distancia (km)", type: "text" },
    { id: "duracion", x: 470, y: 966, width: 150, height: 21, label: "Duración (horas)", type: "text" },
    { id: "tipoCambio", x: 660, y: 990, width: 100, height: 21, label: "Tipo de Cambio", type: "text" },
    { id: "iva", x: 660, y: 1014, width: 70, height: 21, label: "IVA", type: "text" },
    { id: "total", x: 660, y: 1038, width: 70, height: 21, label: "Total", type: "text" },
  ]

  const handleAreaClick = (area: ClickableArea, event: React.MouseEvent) => {
    const rect = imageRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Guardar valor original y establecer valor temporal
    const currentValue = formData[area.id]
    setOriginalValue(currentValue)
    setTempValue(currentValue)
    
    setActiveField(area.id)
    setOverlayPosition({ x: x + 10, y: y + 10 })
  }

  const handleApplyValue = () => {
    if (activeField) {
      updateField(activeField, tempValue)
      
      // Feedback visual y en consola
      const fieldLabel = clickableAreas.find(area => area.id === activeField)?.label || activeField
      const displayValue = typeof tempValue === 'boolean' 
        ? (tempValue ? 'Sí' : 'No') 
        : tempValue

      console.log(`Campo ${fieldLabel} actualizado:`, tempValue)
      toast.success("Campo actualizado", { 
        description: `${fieldLabel}: ${displayValue}`,
        duration: 2000 
      })
      
      setActiveField(null)
    }
  }

  const handleCancelEdit = () => {
    setTempValue(originalValue)
    setActiveField(null)
    toast.info("Edición cancelada", { 
      description: "Los cambios no se han guardado",
      duration: 1500 
    })
  }

  const handleTempValueChange = (value: string | boolean) => {
    setTempValue(value)
  }

  const handleSave = () => {
    // El guardado automático ya se maneja en el hook
  }

  const handleSubmit = () => {
    // Build Google Forms URL with pre-filled data based on the provided URL structure
    const baseUrl =
      "https://docs.google.com/forms/d/e/1FAIpQLSdJAZ9JrGyNTXFXI6q5kSr3uyMcTO2AlkCopKU0yN1nSbJJMw/viewform"
    const params = new URLSearchParams({
      usp: "pp_url",
      "entry.372880175": formData.numeroOrden || "",
      "entry.272882206": formData.fecha || "",
      "entry.51656733": formData.razonSocial || "",
      "entry.1027759127": formData.cuit || "",
      "entry.1341519067": formData.contacto || "",
      "entry.577931152": formData.telefono || "",
      "entry.1807472627": formData.servicioTecnico ? "TRUE" : "FALSE",
      "entry.1866760485": formData.instalacion ? "TRUE" : "FALSE",
      "entry.1483769432": formData.puestaEnMarcha ? "TRUE" : "FALSE",
      "entry.2009413697": formData.capacitacion ? "TRUE" : "FALSE",
      "entry.552164344": formData.calibracion ? "TRUE" : "FALSE",
      "entry.50477222": formData.tercero ? "TRUE" : "FALSE",
      "entry.2137289700": formData.maquina || "",
      "entry.345774046": formData.equipo || "",
      "entry.530697442": formData.descripcion || "",
      "entry.1213632366": formData.insumos || "",
      "entry.2003105797": formData.servicioACampo ? "TRUE" : "FALSE",
      "entry.52141665": formData.servicioEnOficina ? "TRUE" : "FALSE",
      "entry.1755189551": formData.conCargo ? "TRUE" : "FALSE",
      "entry.83013412": formData.sinCargo ? "TRUE" : "FALSE",
      "entry.67997979": formData.servicioEnGarantia ? "TRUE" : "FALSE",
      "entry.758707307": formData.aConvenir ? "TRUE" : "FALSE",
      "entry.1993960771": formData.localidad || "",
      "entry.1508422004": formData.provincia || "",
      "entry.1889226445": formData.distancia || "",
      "entry.990111352": formData.duracion || "",
      "entry.1638646015": formData.tipoCambio || "",
      "entry.1689852362": formData.iva || "",
      "entry.71662572": formData.total || "",
      "entry.743176313": formData.tecnicoNombre || "",
      "entry.1089739266": formData.tecnicoFirma || "",
      "entry.544693955": formData.clienteNombre || "",
      "entry.271745922": formData.clienteFirma || "",
      "entry.1799477516": formData.aux1 || "",
      "entry.1822594865": formData.aux2 || "",
      "entry.46860826": formData.aux3 || "",
      "entry.2041327332": formData.aux4 || "",
    })

    const fullUrl = `${baseUrl}?${params.toString()}`
    window.open(fullUrl, "_blank")
  }

  const renderValueOverlays = () => {
    return clickableAreas.map((area) => {
      const value = formData[area.id]
      const hasValue = area.type === 'checkbox' ? true : (value && value.toString().trim() !== '')
      
      return (
        <div
          key={`value-${area.id}`}
          className="absolute pointer-events-none"
          style={{
            left: `${(area.x / 850) * 100}%`,
            top: `${(area.y / 1200) * 100}%`,
            width: `${(area.width / 850) * 100}%`,
            height: `${(area.height / 1200) * 100}%`,
          }}
        >
          {area.type === 'checkbox' ? (
            // Renderizar checkbox visual
            <div className="flex items-center justify-center w-full h-full">
              <div className={`
                value-overlay-checkbox w-4 h-4 border-2 rounded-sm flex items-center justify-center text-xs font-bold
                ${value as boolean 
                  ? 'bg-primary border-primary text-white shadow-md' 
                  : 'bg-white border-gray-300 text-transparent'
                }
              `}>
                {value as boolean ? '✓' : ''}
              </div>
            </div>
          ) : hasValue ? (
            // Renderizar texto
            <div className={`
              value-overlay-text w-full h-full flex px-2 py-1 text-sm font-medium
              ${area.type === 'textarea' ? 'items-start pt-2' : 'items-center'}
            `}>
              <span className={`
                w-full leading-tight
                ${area.type === 'textarea' 
                  ? 'text-xs leading-tight overflow-hidden' 
                  : 'truncate'
                }
              `}>
                {area.type === 'textarea' 
                  ? (value as string).substring(0, 100) + ((value as string).length > 100 ? '...' : '')
                  : value as string
                }
              </span>
            </div>
          ) : (
            // Mostrar placeholder sutil para campos vacíos
            <div className="w-full h-full flex items-center justify-center opacity-30">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            </div>
          )}
        </div>
      )
    })
  }

  const renderOverlay = () => {
    if (!activeField) return null

    const field = clickableAreas.find((area) => area.id === activeField)
    if (!field) return null

    return (
      <div
        className="form-overlay p-6 min-w-96 max-w-md bg-white border-2 border-primary rounded-lg shadow-lg"
        style={{
          left: overlayPosition.x,
          top: overlayPosition.y,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <Label className="font-semibold text-primary text-lg">{field.label}</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Modifica el valor y haz clic en Aplicar
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Error message display */}
        {getFieldError(field.id) && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-destructive rounded-full"></div>
              <span className="text-sm text-destructive font-medium">
                {getFieldError(field.id)}
              </span>
            </div>
          </div>
        )}

        {/* Input Field */}
        <div className="mb-6">
          {field.type === "checkbox" ? (
            <div className="flex items-center space-x-3 p-3 border rounded-md bg-muted/30">
              <Checkbox
                id={field.id}
                checked={tempValue as boolean}
                onCheckedChange={(checked) => handleTempValueChange(checked as boolean)}
              />
              <Label htmlFor={field.id} className="text-sm font-medium">
                {field.label}
              </Label>
            </div>
          ) : field.type === "textarea" ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Contenido:
              </Label>
              <Textarea
                value={tempValue as string}
                onChange={(e) => handleTempValueChange(e.target.value)}
                placeholder={`Ingrese ${field.label.toLowerCase()}`}
                rows={6}
                className="resize-none"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                {field.id === "fecha" ? "Selecciona la fecha:" : "Valor:"}
              </Label>
              
              {field.id === "numeroOrden" ? (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={tempValue as string}
                    onChange={(e) => handleTempValueChange(e.target.value)}
                    placeholder="Ingrese número de orden (7 dígitos)"
                    className="flex-1"
                    maxLength={7}
                    pattern="[0-9]{7}"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newNumber = generateOrderNumber()
                      handleTempValueChange(newNumber)
                    }}
                    title="Generar nuevo número automático"
                    className="px-3"
                  >
                    🔄
                  </Button>
                </div>
              ) : (
                <Input
                  type={field.id === "fecha" ? "date" : "text"}
                  value={tempValue as string}
                  onChange={(e) => handleTempValueChange(e.target.value)}
                  placeholder={field.id === "fecha" ? "yyyy-mm-dd" : `Ingrese ${field.label.toLowerCase()}`}
                  className="w-full"
                />
              )}
              
              {field.id === "fecha" && (
                <p className="text-xs text-muted-foreground">
                  Selecciona una fecha usando el calendario
                </p>
              )}
              {field.id === "numeroOrden" && (
                <p className="text-xs text-muted-foreground">
                  Debe ser exactamente 7 dígitos. Usa 🔄 para generar automáticamente.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleCancelEdit}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleApplyValue}
            className="flex-1"
          >
            <span className="mr-2">✓</span>
            Aplicar
          </Button>
        </div>

        {/* Preview de valor actual */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Valor actual:</span> 
            <span className="ml-2 px-2 py-1 bg-muted rounded">
              {typeof tempValue === 'boolean' 
                ? (tempValue ? 'Sí' : 'No') 
                : (tempValue || 'Sin valor')
              }
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando formulario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">ARAN Tecnologías</h1>
            <p className="text-muted-foreground">Sistema de Órdenes de Servicio</p>
          </div>
          <FormActions
            formData={formData}
            onSave={handleSave}
            onSubmit={handleSubmit}
            onExport={exportData}
            onImport={importData}
            onReset={resetForm}
            hasErrors={hasErrors()}
            lastSaveTime={lastSaveTime}
            formProgress={getFormProgress()}
          />
        </div>
      </div>

      {/* Interactive Form */}
      <div className="max-w-7xl mx-auto p-4">
        <Card className="p-6">
          <div ref={imageRef} className="relative mx-auto" style={{ maxWidth: "850px" }}>
            <img src="/images/orden-servicio-aran.png" alt="Orden de Servicio ARAN" className="w-full h-auto" />

            {/* Value Overlays - Mostrar valores sobre la imagen */}
            {renderValueOverlays()}

            {/* Clickable Areas */}
            {clickableAreas.map((area) => (
              <div
                key={area.id}
                className="absolute clickable-area"
                style={{
                  left: `${(area.x / 850) * 100}%`,
                  top: `${(area.y / 1200) * 100}%`,
                  width: `${(area.width / 850) * 100}%`,
                  height: `${(area.height / 1200) * 100}%`,
                }}
                onClick={(e) => handleAreaClick(area, e)}
                title={`Clic para editar: ${area.label}`}
              />
            ))}

            {/* Overlay */}
            {renderOverlay()}
          </div>
        </Card>
      </div>
    </div>
  )
}
