"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { X } from "lucide-react"
import { useFormData, type FormData } from "@/hooks/use-form-data"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { FormActions } from "@/components/form-actions"
import { toast } from "@/lib/toast"
import { generateOrderNumber } from "@/lib/order-number"
import { FormProgressModal } from "@/components/form-progress-modal"
import { submitFormToGoogle, generatePrefilledUrl, validateFormDataForSubmission, getSignatureInfo } from "@/lib/google-forms"
import { SignatureCanvas } from "@/components/signature-canvas"
import { formatPhoneNumber, formatCuit, getFieldHint, validateAllGroups } from "@/lib/validations"
import { uploadImageToImgBB } from "@/lib/imgbb-upload"
import { addPendingSubmission } from "@/lib/offline-storage"
import { syncManager } from "@/lib/offline-sync"
import { NetworkStatusIndicator } from "@/components/network-status-indicator"

interface ClickableArea {
  id: keyof FormData
  x: number
  y: number
  width: number
  height: number
  label: string
  type: "text" | "checkbox" | "textarea" | "signature"
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
    getDetailedProgress,
    lastSaveTime,
    regenerateOrderNumber
  } = useFormData()
  
  // Hook para detectar conectividad
  const { isOnline, isChecking } = useNetworkStatus()
  
  const [activeField, setActiveField] = useState<keyof FormData | null>(null)
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 })
  const [tempValue, setTempValue] = useState<string | boolean>("")
  const [originalValue, setOriginalValue] = useState<string | boolean>("")
  const [showProgressModal, setShowProgressModal] = useState(false)
  const imageRef = useRef<HTMLDivElement>(null)

  // Inicializar sincronización automática al cargar el componente
  useEffect(() => {
    // Inicializar el sistema de sincronización offline
    syncManager.startAutoSync(60000) // Cada minuto
    
    console.log('🚀 Sistema de sincronización offline inicializado')
    
    // Cleanup al desmontar el componente
    return () => {
      syncManager.stopAutoSync()
    }
  }, [])

  // Define clickable areas based on the form image layout (campos editables)
  const clickableAreas: ClickableArea[] = [
    { id: "fecha", x: 650, y: 127, width: 100, height: 30, label: "Fecha", type: "text" },
    { id: "razonSocial", x: 185, y: 190, width: 220, height: 21, label: "Razón Social", type: "text" },
    { id: "cuit", x: 540, y: 190, width: 220, height: 21, label: "CUIT", type: "text" },
    { id: "contacto", x: 185, y: 214, width: 200, height: 21, label: "Contacto", type: "text" },
    { id: "telefono", x: 540, y: 214, width: 220, height: 21, label: "Teléfono", type: "text" },
    { id: "servicioTecnico", x: 110, y: 285, width: 20, height: 20, label: "Servicio Técnico", type: "checkbox" },
    { id: "instalacion", x: 230, y: 285, width: 20, height: 20, label: "Instalación", type: "checkbox" },
    { id: "puestaEnMarcha", x: 348, y: 285, width: 20, height: 20, label: "Puesta en Marcha", type: "checkbox" },
    { id: "capacitacion", x: 467, y: 285, width: 20, height: 20, label: "Capacitación", type: "checkbox" },
    { id: "calibracion", x: 586, y: 285, width: 20, height: 20, label: "Calibración", type: "checkbox" },
    { id: "tercero", x: 705, y: 285, width: 20, height: 20, label: "Tercero", type: "checkbox" },
    { id: "servicioACampo", x: 111, y: 945, width: 20, height: 20, label: "Servicio a Campo", type: "checkbox" },
    { id: "servicioEnOficina", x: 230, y: 945, width: 20, height: 20, label: "Servicio en Oficina", type: "checkbox" },
    { id: "conCargo", x: 111, y: 990, width: 20, height: 20, label: "Con Cargo", type: "checkbox" },
    { id: "sinCargo", x: 230, y: 990, width: 20, height: 20, label: "Sin Cargo", type: "checkbox" },
    { id: "servicioEnGarantia", x: 111, y: 1037, width: 20, height: 20, label: "Servicio en Garantía", type: "checkbox" },
    { id: "aConvenir", x: 230, y: 1037, width: 20, height: 20, label: "A Convenir", type: "checkbox" },
    { id: "maquina", x: 135, y: 332, width: 280, height: 21, label: "Máquina", type: "text" },
    { id: "equipo", x: 485, y: 332, width: 280, height: 21, label: "Equipo", type: "text" },
    { id: "descripcion", x: 65, y: 360, width: 700, height: 270, label: "Descripción Completa", type: "textarea" },
    { id: "insumos", x: 65, y: 685, width: 700, height: 220, label: "Insumos/Equipos", type: "textarea" },
    { id: "localidad", x: 470, y: 920, width: 135, height: 21, label: "Localidad", type: "text" },
    { id: "provincia", x: 594, y: 920, width: 60, height: 21, label: "Provincia", type: "text" },
    { id: "distancia", x: 470, y: 943, width: 150, height: 21, label: "Distancia (km)", type: "text" },
    { id: "duracion", x: 470, y: 966, width: 150, height: 21, label: "Duración (horas)", type: "text" },
    { id: "tipoCambio", x: 660, y: 990, width: 110, height: 21, label: "Tipo de Cambio", type: "text" },
    { id: "iva", x: 660, y: 1014, width: 110, height: 21, label: "IVA", type: "text" },
    { id: "total", x: 660, y: 1038, width: 110, height: 21, label: "Total", type: "text" },
    { id: "tecnicoNombre", x: 250, y: 1100, width: 160, height: 21, label: "Técnico Asociado", type: "text" },
    { id: "clienteNombre", x: 607, y: 1100, width: 160, height: 21, label: "Cliente Asociado", type: "text" },
    { id: "tecnicoFirma", x: 65, y: 1078, width: 150, height: 50, label: "Firma Técnico", type: "signature" },
    { id: "clienteFirma", x: 425, y: 1078, width: 150, height: 50, label: "Firma Cliente", type: "signature" },
  ]

  // Define todas las áreas para visualización (incluye campos no editables como numeroOrden)
  const allDisplayAreas: ClickableArea[] = [
    { id: "numeroOrden", x: 600, y: 70, width: 150, height: 30, label: "Número de Orden", type: "text" },
    ...clickableAreas
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
      let displayValue: string
      
      if (typeof tempValue === 'boolean') {
        displayValue = tempValue ? 'Sí' : 'No'
      } else if (activeField === 'tecnicoFirma' || activeField === 'clienteFirma') {
        // Para campos de firma, mostrar mensaje más limpio
        displayValue = tempValue ? 'La firma se ingresó correctamente' : 'Sin firma'
      } else {
        displayValue = tempValue as string
      }

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
    // Aplicar formateo automático para campos específicos
    if (typeof value === "string" && activeField) {
      if (activeField === "telefono") {
        value = formatPhoneNumber(value)
      } else if (activeField === "cuit") {
        value = formatCuit(value)
      }
    }
    setTempValue(value)
  }

  const handleSave = () => {
    // El guardado automático ya se maneja en el hook
  }

  const handleSubmit = () => {
    // Validación por grupos antes del envío
    const groupValidation = validateAllGroups(formData)
    if (!groupValidation.isValid) {
      toast.error("Validación de grupos fallida", {
        description: groupValidation.errors.join(". ")
      })
      return
    }
    
    // Analizar progreso del formulario
    const progressData = getDetailedProgress()
    
    // Si hay campos críticos faltantes o el formulario no está completo, mostrar modal
    if (progressData.hasCriticalMissing || progressData.progress < 100) {
      setShowProgressModal(true)
      return
    }
    
    // Si está completo, enviar directamente
    submitToGoogleForms()
  }

  const submitToGoogleForms = async () => {
    try {
      // Validar datos antes del envío
      const validation = validateFormDataForSubmission(formData)
      if (!validation.isValid) {
        toast.error("Error de validación", {
          description: validation.errors.join(", ")
        })
        return
      }

      console.log(`🌐 Estado de conectividad: ${isOnline ? 'ONLINE' : 'OFFLINE'}`)

      if (!isOnline) {
        // MODO OFFLINE: Guardar localmente
        console.log("📱 Sin conexión - Guardando formulario localmente")
        
        const submissionId = addPendingSubmission(formData)
        
        toast.success("📱 Formulario guardado localmente", {
          description: `Se enviará automáticamente cuando haya conexión. ID: ${submissionId.slice(-8)}`
        })
        
        console.log(`💾 Formulario guardado en cola de sincronización: ${submissionId}`)
        
        // Intentar sincronizar en el fondo si se recupera la conexión
        setTimeout(() => {
          syncManager.syncPendingSubmissions()
        }, 2000)
        
        return
      }

      // MODO ONLINE: Verificar si las firmas ya están en formato URL
      console.log("🌐 Con conexión - Verificando estado de firmas")
      
      const tecnicoFirmaIsUrl = !formData.tecnicoFirma || formData.tecnicoFirma.startsWith('https://')
      const clienteFirmaIsUrl = !formData.clienteFirma || formData.clienteFirma.startsWith('https://')
      
      console.log('📝 Estado de firmas:', {
        tecnicoFirma: tecnicoFirmaIsUrl ? 'URL lista' : 'Base64 - necesita subida',
        clienteFirma: clienteFirmaIsUrl ? 'URL lista' : 'Base64 - necesita subida'
      })

      // Si las firmas ya son URLs de ImgBB, enviar directamente
      if (tecnicoFirmaIsUrl && clienteFirmaIsUrl) {
        console.log("✅ Todas las firmas ya están en formato URL - Enviando directamente")
        
        toast.info("Enviando formulario...", { 
          description: "Las firmas ya están en la nube" 
        })

        const result = await submitFormToGoogle(formData)

        if (result.success) {
          toast.success("¡Formulario enviado exitosamente!", {
            description: `Orden de servicio #${formData.numeroOrden} enviada a ARAN Tecnologías`
          })
          console.log("✅ Formulario enviado exitosamente a Google Forms")
        } else {
          throw new Error(result.error || "Error al enviar formulario")
        }
        
        return
      }

      // Si hay firmas en base64, subirlas primero
      console.log("🔄 Algunas firmas están en base64 - Procesando subida")
      let processedFormData = { ...formData }
      
      // Verificar si hay firmas que necesitan ser procesadas (solo base64)
      const needsProcessing = (formData.tecnicoFirma && formData.tecnicoFirma.startsWith('data:image')) ||
                            (formData.clienteFirma && formData.clienteFirma.startsWith('data:image'))

      if (needsProcessing) {
        // Mostrar notificación de procesamiento
        toast.info("Procesando firmas...", { 
          description: "Subiendo firmas a la nube antes del envío" 
        })

        // Procesar firma del técnico si es base64
        if (formData.tecnicoFirma && formData.tecnicoFirma.startsWith('data:image')) {
          try {
            console.log("🔄 Subiendo firma del técnico a ImgBB...")
            toast.info("Subiendo firma del técnico...", { 
              description: "Por favor espera" 
            })
            
            const uploadResult = await uploadImageToImgBB(
              formData.tecnicoFirma, 
              `firma-tecnico-${formData.numeroOrden}`
            )
            
            processedFormData.tecnicoFirma = uploadResult.data.url
            console.log("✅ Firma del técnico subida exitosamente:", uploadResult.data.url)
            
            toast.success("✅ Firma del técnico subida", { 
              description: "Guardada en la nube correctamente"
            })
            
            // Pausa breve para asegurar que la operación se complete
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error) {
            console.error("❌ Error subiendo firma del técnico:", error)
            
            // Si falla la subida, guardar localmente para reintento
            const submissionId = addPendingSubmission(formData)
            toast.error("Error subiendo firma del técnico", {
              description: `Guardado localmente para reintento. ID: ${submissionId.slice(-8)}`
            })
            return
          }
        }

        // Procesar firma del cliente si es base64
        if (formData.clienteFirma && formData.clienteFirma.startsWith('data:image')) {
          try {
            console.log("🔄 Subiendo firma del cliente a ImgBB...")
            toast.info("Subiendo firma del cliente...", { 
              description: "Por favor espera" 
            })
            
            const uploadResult = await uploadImageToImgBB(
              formData.clienteFirma, 
              `firma-cliente-${formData.numeroOrden}`
            )
            
            processedFormData.clienteFirma = uploadResult.data.url
            console.log("✅ Firma del cliente subida exitosamente:", uploadResult.data.url)
            
            toast.success("✅ Firma del cliente subida", { 
              description: "Guardada en la nube correctamente"
            })
            
            // Pausa breve para asegurar que la operación se complete
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error) {
            console.error("❌ Error subiendo firma del cliente:", error)
            
            // Si falla la subida, guardar localmente para reintento
            const submissionId = addPendingSubmission(formData)
            toast.error("Error subiendo firma del cliente", {
              description: `Guardado localmente para reintento. ID: ${submissionId.slice(-8)}`
            })
            return
          }
        }

        console.log("✅ Todas las firmas han sido procesadas")
      }

      // Mostrar información de las firmas procesadas para debugging
      const signatureInfo = getSignatureInfo(processedFormData)
      console.log("📝 Información final de firmas para Google Forms:", {
        tecnicoFirma: signatureInfo.tecnicoFirma,
        clienteFirma: signatureInfo.clienteFirma
      })

      // Mostrar notificación de envío final
      toast.info("Enviando formulario a Google Forms...", { 
        description: "Procesando envío final" 
      })

      // Enviar el formulario a Google Forms con las firmas procesadas
      const result = await submitFormToGoogle(processedFormData)

      if (result.success) {
        toast.success("¡Formulario enviado exitosamente!", {
          description: `Orden de servicio #${formData.numeroOrden} enviada a ARAN Tecnologías`
        })
        console.log("✅ Formulario enviado exitosamente a Google Forms")
      } else {
        throw new Error(result.error || "Error al enviar formulario")
      }

    } catch (error) {
      console.error("❌ Error al enviar formulario:", error)
      
      // Guardar localmente como respaldo
      const submissionId = addPendingSubmission(formData)
      
      toast.error("Error al enviar formulario", {
        description: `Guardado localmente para reintento. ID: ${submissionId.slice(-8)}`
      })

      // Como fallback adicional, abrir Google Forms en una nueva pestaña
      const fallbackUrl = generatePrefilledUrl(formData)
      setTimeout(() => {
        window.open(fallbackUrl, "_blank")
        toast.info("Formulario manual abierto", {
          description: "Se ha abierto Google Forms en una nueva pestaña como respaldo"
        })
      }, 3000)
    }
  }

  // Función auxiliar para generar URL de Google Forms (fallback)
  const generateGoogleFormsUrl = (): string => {
    return generatePrefilledUrl(formData)
  }

  const handleSubmitIncomplete = () => {
    setShowProgressModal(false)
    submitToGoogleForms()
  }

  const handleContinueEditing = () => {
    setShowProgressModal(false)
    // Opcionalmente, podrías enfocar el primer campo crítico faltante
    const progressData = getDetailedProgress()
    if (progressData.criticalMissing.length > 0) {
      toast.info("Campos críticos pendientes", {
        description: `Completa: ${progressData.criticalMissing.slice(0, 3).join(', ')}${progressData.criticalMissing.length > 3 ? '...' : ''}`
      })
    }
  }

  const handleOpenManualForm = () => {
    const manualUrl = generatePrefilledUrl(formData)
    window.open(manualUrl, "_blank")
    toast.info("Formulario manual abierto", {
      description: "Se ha abierto Google Forms en una nueva pestaña"
    })
  }

  const renderValueOverlays = () => {
    return allDisplayAreas.map((area) => {
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
            // Renderizar texto o firma
            <div className={`
              value-overlay-text w-full h-full flex px-2 py-1 text-sm font-medium
              ${area.type === 'textarea' ? 'items-start pt-2' : 
                area.type === 'signature' ? 'items-center justify-center' : 'items-center'}
            `}>
              {area.type === 'signature' ? (
                <div className="w-full h-full flex items-center justify-center">
                  {(value as string).startsWith('data:image') ? (
                    <img 
                      src={value as string} 
                      alt="Firma" 
                      className="max-w-full max-h-full object-contain"
                      style={{ filter: 'contrast(1.2)' }}
                    />
                  ) : (value as string) ? (
                    <div className="text-center text-xs bg-blue-100 px-2 py-1 rounded border">
                      <div className="font-semibold text-blue-800">✍️ Firmado</div>
                      <div className="text-blue-600 mt-1">{value as string}</div>
                    </div>
                  ) : null}
                </div>
              ) : (
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
              )}
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
          ) : field.type === "signature" ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Firma Digital:
              </Label>
              <SignatureCanvas
                value={tempValue as string}
                onChange={(signature) => handleTempValueChange(signature)}
                width={350}
                height={150}
                className="w-full"
                orderNumber={formData.numeroOrden}
                signatureType={field.id === 'tecnicoFirma' ? 'tecnico' : 'cliente'}
                autoUpload={true}
              />
              <p className="text-xs text-muted-foreground text-center">
                Dibuje su firma - Se guardará automáticamente en la nube
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                {field.id === "fecha" ? "Selecciona la fecha:" : "Valor:"}
              </Label>
              
              {/* Field hint */}
              {getFieldHint(field.id) && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-700">
                    💡 {getFieldHint(field.id)}
                  </p>
                </div>
              )}
              
              <Input
                type={field.id === "fecha" ? "date" : "text"}
                value={tempValue as string}
                onChange={(e) => handleTempValueChange(e.target.value)}
                placeholder={field.id === "fecha" ? "yyyy-mm-dd" : `Ingrese ${field.label.toLowerCase()}`}
                className="w-full"
              />
              
              {field.id === "fecha" && (
                <p className="text-xs text-muted-foreground">
                  Selecciona una fecha usando el calendario
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

  // Función para renderizar el formulario móvil
  const renderMobileForm = () => {
    return (
      <div className="space-y-6">
        {/* Información básica */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Información Básica</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="numeroOrden" className="text-sm font-medium">Número de Orden</Label>
              <Input
                id="numeroOrden"
                value={formData.numeroOrden}
                disabled
                className="mt-1 bg-muted"
              />
            </div>
            
            <div>
              <Label htmlFor="fecha" className="text-sm font-medium">Fecha</Label>
              {getFieldHint("fecha") && (
                <p className="text-xs text-blue-600 mb-1">💡 {getFieldHint("fecha")}</p>
              )}
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => updateField("fecha", e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Información del Cliente */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Cliente</h3>
          
          <div>
            <Label htmlFor="razonSocial" className="text-sm font-medium">Razón Social</Label>
            <Input
              id="razonSocial"
              value={formData.razonSocial}
              onChange={(e) => updateField("razonSocial", e.target.value)}
              placeholder="Ingrese la razón social"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cuit" className="text-sm font-medium">CUIT</Label>
              {getFieldHint("cuit") && (
                <p className="text-xs text-blue-600 mb-1">💡 {getFieldHint("cuit")}</p>
              )}
              <Input
                id="cuit"
                value={formData.cuit}
                onChange={(e) => updateField("cuit", e.target.value)}
                placeholder="20123456789"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="contacto" className="text-sm font-medium">Contacto</Label>
              <Input
                id="contacto"
                value={formData.contacto}
                onChange={(e) => updateField("contacto", e.target.value)}
                placeholder="Nombre del contacto"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="telefono" className="text-sm font-medium">Teléfono</Label>
            {getFieldHint("telefono") && (
              <p className="text-xs text-blue-600 mb-1">💡 {getFieldHint("telefono")}</p>
            )}
            <Input
              id="telefono"
              value={formData.telefono}
              onChange={(e) => updateField("telefono", e.target.value)}
              placeholder="3476626662"
              className="mt-1"
            />
          </div>
        </div>

        {/* Tipo de Servicio */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Tipo de Servicio</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: "servicioTecnico", label: "Servicio Técnico" },
              { key: "instalacion", label: "Instalación" },
              { key: "puestaEnMarcha", label: "Puesta en Marcha" },
              { key: "capacitacion", label: "Capacitación" },
              { key: "calibracion", label: "Calibración" },
              { key: "tercero", label: "Tercero" }
            ].map((service) => (
              <div key={service.key} className="flex items-center space-x-2 p-2 border rounded-md">
                <Checkbox
                  id={service.key}
                  checked={formData[service.key as keyof FormData] as boolean}
                  onCheckedChange={(checked) => updateField(service.key as keyof FormData, checked as boolean)}
                />
                <Label htmlFor={service.key} className="text-sm">{service.label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Descripción del trabajo */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Descripción del Trabajo</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maquina" className="text-sm font-medium">Máquina</Label>
              <Input
                id="maquina"
                value={formData.maquina}
                onChange={(e) => updateField("maquina", e.target.value)}
                placeholder="Descripción de la máquina"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="equipo" className="text-sm font-medium">Equipo</Label>
              <Input
                id="equipo"
                value={formData.equipo}
                onChange={(e) => updateField("equipo", e.target.value)}
                placeholder="Descripción del equipo"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="descripcion" className="text-sm font-medium">Descripción del Servicio</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => updateField("descripcion", e.target.value)}
              placeholder="Descripción detallada del trabajo realizado"
              rows={4}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="insumos" className="text-sm font-medium">Insumos Utilizados</Label>
            <Textarea
              id="insumos"
              value={formData.insumos}
              onChange={(e) => updateField("insumos", e.target.value)}
              placeholder="Lista de insumos y materiales utilizados"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        {/* Ubicación del servicio */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Ubicación y Modalidad</h3>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { key: "servicioACampo", label: "Servicio a Campo" },
              { key: "servicioEnOficina", label: "Servicio en Oficina" }
            ].map((location) => (
              <div key={location.key} className="flex items-center space-x-2 p-2 border rounded-md">
                <Checkbox
                  id={location.key}
                  checked={formData[location.key as keyof FormData] as boolean}
                  onCheckedChange={(checked) => updateField(location.key as keyof FormData, checked as boolean)}
                />
                <Label htmlFor={location.key} className="text-sm">{location.label}</Label>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="localidad" className="text-sm font-medium">Localidad</Label>
              <Input
                id="localidad"
                value={formData.localidad}
                onChange={(e) => updateField("localidad", e.target.value)}
                placeholder="Ciudad donde se realizó el servicio"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="provincia" className="text-sm font-medium">Provincia</Label>
              <Input
                id="provincia"
                value={formData.provincia}
                onChange={(e) => updateField("provincia", e.target.value)}
                placeholder="Provincia"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Condiciones del servicio */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Condiciones</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "conCargo", label: "Con Cargo" },
              { key: "sinCargo", label: "Sin Cargo" },
              { key: "servicioEnGarantia", label: "En Garantía" },
              { key: "aConvenir", label: "A Convenir" }
            ].map((condition) => (
              <div key={condition.key} className="flex items-center space-x-2 p-2 border rounded-md">
                <Checkbox
                  id={condition.key}
                  checked={formData[condition.key as keyof FormData] as boolean}
                  onCheckedChange={(checked) => updateField(condition.key as keyof FormData, checked as boolean)}
                />
                <Label htmlFor={condition.key} className="text-sm">{condition.label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Datos técnicos */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Datos Técnicos</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="distancia" className="text-sm font-medium">Distancia (km)</Label>
              <Input
                id="distancia"
                value={formData.distancia}
                onChange={(e) => updateField("distancia", e.target.value)}
                placeholder="Distancia en kilómetros"
                type="number"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="duracion" className="text-sm font-medium">Duración (hs)</Label>
              <Input
                id="duracion"
                value={formData.duracion}
                onChange={(e) => updateField("duracion", e.target.value)}
                placeholder="Duración en horas"
                type="number"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="tipoCambio" className="text-sm font-medium">Tipo de Cambio</Label>
              <Input
                id="tipoCambio"
                value={formData.tipoCambio}
                onChange={(e) => updateField("tipoCambio", e.target.value)}
                placeholder="Tipo de cambio"
                type="number"
                step="0.01"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="iva" className="text-sm font-medium">IVA</Label>
              <Input
                id="iva"
                value={formData.iva}
                onChange={(e) => updateField("iva", e.target.value)}
                placeholder="Monto del IVA"
                type="number"
                step="0.01"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="total" className="text-sm font-medium">Total</Label>
              <Input
                id="total"
                value={formData.total}
                onChange={(e) => updateField("total", e.target.value)}
                placeholder="Monto total"
                type="number"
                step="0.01"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Firmas */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Firmas</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tecnicoNombre" className="text-sm font-medium">Nombre del Técnico</Label>
              <Input
                id="tecnicoNombre"
                value={formData.tecnicoNombre}
                onChange={(e) => updateField("tecnicoNombre", e.target.value)}
                placeholder="Nombre completo del técnico"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="clienteNombre" className="text-sm font-medium">Nombre del Cliente</Label>
              <Input
                id="clienteNombre"
                value={formData.clienteNombre}
                onChange={(e) => updateField("clienteNombre", e.target.value)}
                placeholder="Nombre completo del cliente"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Firma del Técnico</Label>
              <div className="mt-2 border border-border rounded-md">
                <SignatureCanvas
                  value={formData.tecnicoFirma}
                  onChange={(signature) => updateField("tecnicoFirma", signature)}
                  width={300}
                  height={120}
                  className="w-full"
                  orderNumber={formData.numeroOrden}
                  signatureType="tecnico"
                  autoUpload={true}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Firma del Cliente</Label>
              <div className="mt-2 border border-border rounded-md">
                <SignatureCanvas
                  value={formData.clienteFirma}
                  onChange={(signature) => updateField("clienteFirma", signature)}
                  width={300}
                  height={120}
                  className="w-full"
                  orderNumber={formData.numeroOrden}
                  signatureType="cliente"
                  autoUpload={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Campos auxiliares */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Campos Adicionales</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "aux1", label: "Campo Auxiliar 1" },
              { key: "aux2", label: "Campo Auxiliar 2" },
              { key: "aux3", label: "Campo Auxiliar 3" },
              { key: "aux4", label: "Campo Auxiliar 4" }
            ].map((aux) => (
              <div key={aux.key}>
                <Label htmlFor={aux.key} className="text-sm font-medium">{aux.label}</Label>
                <Input
                  id={aux.key}
                  value={formData[aux.key as keyof FormData] as string}
                  onChange={(e) => updateField(aux.key as keyof FormData, e.target.value)}
                  placeholder={`Contenido de ${aux.label.toLowerCase()}`}
                  className="mt-1"
                />
              </div>
            ))}
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
      {/* Indicador de estado de red */}
      <NetworkStatusIndicator />
      
      {/* Header */}
      <div className="bg-card border-b border-border p-2 sm:p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary">ARAN Tecnologías</h1>
            <p className="text-sm text-muted-foreground">Sistema de Órdenes de Servicio</p>
          </div>
          <div className="w-full sm:w-auto">
            <FormActions
              formData={formData}
              onSubmit={handleSubmit}
              onReset={resetForm}
              hasErrors={hasErrors()}
              lastSaveTime={lastSaveTime}
              formProgress={getFormProgress()}
            />
          </div>
        </div>
      </div>

      {/* Interactive Form */}
      <div className="max-w-7xl mx-auto p-2 sm:p-4">
        <Card className="p-2 sm:p-6">
          {/* Mobile/Tablet View */}
          <div className="block lg:hidden">
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-2">Orden de Servicio #{formData.numeroOrden}</h2>
              <p className="text-sm text-muted-foreground">Formulario adaptado para dispositivos móviles</p>
            </div>
            {renderMobileForm()}
          </div>

          {/* Desktop View */}
          <div className="hidden lg:block">
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
          </div>
        </Card>
      </div>

      {/* Progress Modal */}
      <FormProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        onSubmitIncomplete={handleSubmitIncomplete}
        onContinueEditing={handleContinueEditing}
        onOpenManualForm={handleOpenManualForm}
        formData={formData}
        progress={getDetailedProgress().progress}
        missingFields={getDetailedProgress().allMissing}
        criticalMissing={getDetailedProgress().criticalMissing}
      />
    </div>
  )
}
