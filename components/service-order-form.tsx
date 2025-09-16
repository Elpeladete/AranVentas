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
  const { formData, updateField, resetForm, exportData, importData, isLoading } = useFormData()
  const [activeField, setActiveField] = useState<keyof FormData | null>(null)
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 })
  const imageRef = useRef<HTMLDivElement>(null)

  // Define clickable areas based on the form image layout
  const clickableAreas: ClickableArea[] = [
    { id: "numeroOrden", x: 610, y: 50, width: 200, height: 30, label: "Número de Orden", type: "text" },
    { id: "fecha", x: 650, y: 120, width: 150, height: 30, label: "Fecha", type: "text" },
    { id: "razonSocial", x: 90, y: 220, width: 200, height: 25, label: "Razón Social", type: "text" },
    { id: "cuit", x: 500, y: 220, width: 150, height: 25, label: "CUIT", type: "text" },
    { id: "contacto", x: 90, y: 245, width: 200, height: 25, label: "Contacto", type: "text" },
    { id: "telefono", x: 500, y: 245, width: 150, height: 25, label: "Teléfono", type: "text" },
    { id: "servicioTecnico", x: 80, y: 295, width: 20, height: 20, label: "Servicio Técnico", type: "checkbox" },
    { id: "instalacion", x: 210, y: 295, width: 20, height: 20, label: "Instalación", type: "checkbox" },
    { id: "puestaEnMarcha", x: 330, y: 295, width: 20, height: 20, label: "Puesta en Marcha", type: "checkbox" },
    { id: "capacitacion", x: 470, y: 295, width: 20, height: 20, label: "Capacitación", type: "checkbox" },
    { id: "calibracion", x: 610, y: 295, width: 20, height: 20, label: "Calibración", type: "checkbox" },
    { id: "tercero", x: 750, y: 295, width: 20, height: 20, label: "Tercero", type: "checkbox" },
    { id: "maquina", x: 80, y: 375, width: 350, height: 25, label: "Máquina", type: "text" },
    { id: "equipo", x: 470, y: 375, width: 350, height: 25, label: "Equipo", type: "text" },
    { id: "descripcion", x: 80, y: 400, width: 740, height: 280, label: "Descripción Completa", type: "textarea" },
    { id: "localidad", x: 470, y: 1015, width: 150, height: 25, label: "Localidad", type: "text" },
    { id: "distancia", x: 470, y: 1040, width: 150, height: 25, label: "Distancia (km)", type: "text" },
    { id: "duracion", x: 470, y: 1065, width: 150, height: 25, label: "Duración (horas)", type: "text" },
    { id: "tipoCambio", x: 650, y: 1090, width: 100, height: 25, label: "Tipo de Cambio", type: "text" },
    { id: "iva", x: 750, y: 1115, width: 70, height: 25, label: "IVA", type: "text" },
    { id: "total", x: 750, y: 1140, width: 70, height: 25, label: "Total", type: "text" },
  ]

  const handleAreaClick = (area: ClickableArea, event: React.MouseEvent) => {
    const rect = imageRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setActiveField(area.id)
    setOverlayPosition({ x: x + 10, y: y + 10 })
  }

  const handleSave = () => {
    alert("Datos guardados automáticamente")
  }

  const handleSubmit = () => {
    // Build Google Forms URL with pre-filled data
    const baseUrl =
      "https://docs.google.com/forms/d/e/1FAIpQLSdJAZ9JrGyNTXFXI6q5kSr3uyMcTO2AlkCopKU0yN1nSbJJMw/viewform"
    const params = new URLSearchParams({
      usp: "pp_url",
      "entry.372880175": formData.numeroOrden,
      "entry.272882206": formData.fecha,
      "entry.51656733": formData.razonSocial,
      "entry.1027759127": formData.cuit,
      "entry.1341519067": formData.contacto,
      "entry.577931152": formData.telefono,
      "entry.1807472627": formData.servicioTecnico ? "TRUE" : "FALSE",
      "entry.1866760485": formData.instalacion ? "TRUE" : "FALSE",
      "entry.1483769432": formData.puestaEnMarcha ? "TRUE" : "FALSE",
      "entry.2009413697": formData.capacitacion ? "TRUE" : "FALSE",
      "entry.552164344": formData.calibracion ? "TRUE" : "FALSE",
      "entry.50477222": formData.tercero ? "TRUE" : "FALSE",
      "entry.2137289700": formData.maquina,
      "entry.345774046": formData.equipo,
      "entry.530697442": formData.descripcion,
      "entry.1213632366": formData.insumos,
      "entry.2003105797": formData.servicioACampo ? "TRUE" : "FALSE",
      "entry.52141665": formData.servicioEnOficina ? "TRUE" : "FALSE",
      "entry.1755189551": formData.conCargo ? "TRUE" : "FALSE",
      "entry.83013412": formData.sinCargo ? "TRUE" : "FALSE",
      "entry.67997979": formData.servicioEnGarantia ? "TRUE" : "FALSE",
      "entry.758707307": formData.aConvenir ? "TRUE" : "FALSE",
      "entry.1993960771": formData.localidad,
      "entry.1508422004": formData.provincia,
      "entry.1889226445": formData.distancia,
      "entry.990111352": formData.duracion,
      "entry.1638646015": formData.tipoCambio,
      "entry.1689852362": formData.iva,
      "entry.71662572": formData.total,
      "entry.743176313": formData.tecnicoNombre,
      "entry.1089739266": formData.tecnicoFirma,
      "entry.544693955": formData.clienteNombre,
      "entry.271745922": formData.clienteFirma,
      "entry.1799477516": formData.aux1,
      "entry.1822594865": formData.aux2,
      "entry.46860826": formData.aux3,
      "entry.2041327332": formData.aux4,
    })

    const fullUrl = `${baseUrl}?${params.toString()}`
    window.open(fullUrl, "_blank")
  }

  const renderOverlay = () => {
    if (!activeField) return null

    const field = clickableAreas.find((area) => area.id === activeField)
    if (!field) return null

    return (
      <div
        className="form-overlay p-4 min-w-80"
        style={{
          left: overlayPosition.x,
          top: overlayPosition.y,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <Label className="font-semibold text-primary">{field.label}</Label>
          <Button variant="ghost" size="sm" onClick={() => setActiveField(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {field.type === "checkbox" ? (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={formData[field.id] as boolean}
              onCheckedChange={(checked) => updateField(field.id, checked as boolean)}
            />
            <Label htmlFor={field.id}>{field.label}</Label>
          </div>
        ) : field.type === "textarea" ? (
          <Textarea
            value={formData[field.id] as string}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={`Ingrese ${field.label.toLowerCase()}`}
            rows={4}
            className="resize-none"
          />
        ) : (
          <Input
            type={field.id === "fecha" ? "date" : "text"}
            value={formData[field.id] as string}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={`Ingrese ${field.label.toLowerCase()}`}
          />
        )}

        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => setActiveField(null)}>
            Cerrar
          </Button>
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
          />
        </div>
      </div>

      {/* Interactive Form */}
      <div className="max-w-7xl mx-auto p-4">
        <Card className="p-6">
          <div ref={imageRef} className="relative mx-auto" style={{ maxWidth: "850px" }}>
            <img src="/images/orden-servicio-aran.png" alt="Orden de Servicio ARAN" className="w-full h-auto" />

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
