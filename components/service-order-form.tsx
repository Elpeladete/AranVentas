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
import { submitFormToGoogle, generatePrefilledUrl, validateFormDataForSubmission, getSignatureInfo } from "@/lib/google-forms"
import { SignatureCanvas } from "@/components/signature-canvas"
import { formatPhoneNumber, formatCuit, getFieldHint, validateAllGroups, validateRequiredFields } from "@/lib/validations"
import { uploadImageToImgBB } from "@/lib/imgbb-upload"
import { addPendingSubmission } from "@/lib/offline-storage"
import { syncManager } from "@/lib/offline-sync"


import { ValidationStatus } from "@/components/validation-status"
import { OdooContactSearch, useOdooContactSearch } from "@/components/odoo-contact-search-fixed"
import type { OdooContact } from "@/lib/odoo-api-client"
import { InsumosTable } from "@/components/insumos-table"
import { InsumosCompactView } from "@/components/insumos-compact-view"


interface ClickableArea {
  id: keyof FormData
  x: number
  y: number
  width: number
  height: number
  label: string
  type: "text" | "checkbox" | "textarea" | "signature"
}

interface ServiceOrderFormProps {
  onShowDatabase?: () => void
}

export function ServiceOrderForm({ onShowDatabase }: ServiceOrderFormProps = {}) {
  const { 
    formData, 
    updateField, 
    resetForm, 
 
    importData, 
    isLoading,
    fieldErrors,
    getFieldError,
    hasErrors,
    validateCriticalFields,
    lastSaveTime,
    regenerateOrderNumber
  } = useFormData()
  
  // Hook para detectar conectividad
  const { isOnline, isChecking } = useNetworkStatus()
  
  // Hook para búsqueda de contactos en Odoo
  const { selectedContact, handleContactSelect, resetSelection } = useOdooContactSearch()
  
  const [activeField, setActiveField] = useState<keyof FormData | null>(null)
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 })
  const [tempValue, setTempValue] = useState<string | boolean>("")
  const [originalValue, setOriginalValue] = useState<string | boolean>("")
  const [forceRender, setForceRender] = useState(0) // Para forzar re-render

  const [isMobile, setIsMobile] = useState(false) // Estado para detectar móvil
  const [showValidationProminent, setShowValidationProminent] = useState(false) // Mostrar validación prominente
  const [zoomLevel, setZoomLevel] = useState(1) // Estado para el zoom
  const imageRef = useRef<HTMLDivElement>(null)

  // Inicializar sincronización automática al cargar el componente
  useEffect(() => {
    // Inicializar el sistema de sincronización offline
    syncManager.startAutoSync(60000)
    

    
    // Cleanup al desmontar el componente
    return () => {
      syncManager.stopAutoSync()
    }
  }, [])

  // Autocompletar datos cuando se selecciona un contacto de Odoo
  useEffect(() => {
    if (selectedContact) {
      console.log('🎯 Autocompletando datos de contacto Odoo:', selectedContact)
      
      // Autocompletar campos con los datos del contacto
      updateField('razonSocial', selectedContact.name)
      
      if (selectedContact.vat) {
        updateField('cuit', selectedContact.vat)
      }
      
      if (selectedContact.phone) {
        updateField('telefono', selectedContact.phone)
      }
      
      // Usar el nombre como contacto por defecto
      updateField('contacto', selectedContact.name)
      
      if (selectedContact.city) {
        updateField('localidad', selectedContact.city)
      }
      
      if (selectedContact.state) {
        updateField('provincia', selectedContact.state)
      }
      
      toast.success("Datos autocompletados", {
        description: `Información cargada desde Odoo: ${selectedContact.name}${selectedContact.state ? ` - ${selectedContact.state}` : ''}`,
        duration: 4000
      })
      
      // Limpiar selección después del autocompletado
      resetSelection()
    }
  }, [selectedContact, updateField, resetSelection])

  // useEffect para detectar cambios en firmas y forzar re-render
  useEffect(() => {
    const hasValidSignatures = 
      (formData.tecnicoFirma && typeof formData.tecnicoFirma === 'string' && 
       (formData.tecnicoFirma.startsWith('http') || formData.tecnicoFirma.startsWith('data:image'))) ||
      (formData.clienteFirma && typeof formData.clienteFirma === 'string' && 
       (formData.clienteFirma.startsWith('http') || formData.clienteFirma.startsWith('data:image')))
       
    if (hasValidSignatures) {

      setForceRender(prev => prev + 1)
    }
  }, [formData.tecnicoFirma, formData.clienteFirma])

  // useEffect para detectar dispositivos móviles
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Funciones para manejo de zoom
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 2.5))
  }

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5))
  }

  const resetZoom = () => {
    setZoomLevel(1)
  }

  // Función para posicionar la vista cerca del área clickeada (móvil)
  const centerAreaOnScreen = (area: ClickableArea) => {
    if (!isMobile || !imageRef.current) return
    
    const container = imageRef.current.parentElement
    if (!container) return
    
    // Calcular posición del área en la imagen escalada
    const imageHeight = imageRef.current.clientHeight
    const imageWidth = imageRef.current.clientWidth
    const scaledAreaY = (area.y / 1200) * imageHeight * zoomLevel
    const scaledAreaX = (area.x / 850) * imageWidth * zoomLevel
    const scaledAreaHeight = (area.height / 1200) * imageHeight * zoomLevel
    const scaledAreaWidth = (area.width / 850) * imageWidth * zoomLevel
    
    // Obtener posición actual del contenedor de imagen
    const imageRect = imageRef.current.getBoundingClientRect()
    
    // Calcular el centro del área clickeada
    const areaCenterY = scaledAreaY + (scaledAreaHeight / 2)
    const areaCenterX = scaledAreaX + (scaledAreaWidth / 2)
    
    // Posición absoluta del centro del área
    const absoluteAreaY = imageRect.top + areaCenterY + window.scrollY
    const absoluteAreaX = imageRect.left + areaCenterX + window.scrollX
    
    // Calcular posición ideal: área visible en el tercio superior de la pantalla
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const targetY = absoluteAreaY - (viewportHeight * 0.3) // Tercio superior, no centro
    
    // Solo hacer scroll horizontal si el área está fuera de la vista
    let targetX = window.scrollX
    if (absoluteAreaX < window.scrollX + 50) {
      // Área muy a la izquierda, mover hacia la derecha
      targetX = absoluteAreaX - (viewportWidth * 0.2)
    } else if (absoluteAreaX > window.scrollX + viewportWidth - 50) {
      // Área muy a la derecha, mover hacia la izquierda  
      targetX = absoluteAreaX - (viewportWidth * 0.8)
    }
    
    // Aplicar scroll suave
    window.scrollTo({
      top: Math.max(0, targetY),
      left: Math.max(0, targetX),
      behavior: 'smooth'
    })
    

  }

  // useEffect para ocultar la validación prominente cuando el formulario esté completo
  useEffect(() => {
    if (showValidationProminent) {
      const validation = validateRequiredFields(formData)
      if (validation.isValid) {
        // Ocultar después de un pequeño delay para que el usuario vea el cambio
        const timer = setTimeout(() => {
          setShowValidationProminent(false)
        }, 2000)
        
        return () => clearTimeout(timer)
      }
    }
  }, [formData, showValidationProminent])

  // useEffect para detectar tamaño de pantalla
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Verificar al cargar
    checkScreenSize()
    
    // Agregar listener para cambios de tamaño
    window.addEventListener('resize', checkScreenSize)
    
    return () => {
      window.removeEventListener('resize', checkScreenSize)
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
    { id: "insumos", x: 59, y: 685, width: 717, height: 235, label: "Insumos/Equipos", type: "textarea" },
    { id: "localidad", x: 470, y: 920, width: 135, height: 21, label: "Localidad", type: "text" },
    { id: "provincia", x: 594, y: 920, width: 60, height: 21, label: "Provincia", type: "text" },
    { id: "distancia", x: 470, y: 943, width: 150, height: 21, label: "Distancia (km)", type: "text" },
    { id: "duracion", x: 470, y: 966, width: 150, height: 21, label: "Duración (horas)", type: "text" },
    { id: "tipoCambio", x: 660, y: 990, width: 110, height: 21, label: "Tipo de Cambio", type: "text" },
    { id: "iva", x: 660, y: 1014, width: 110, height: 21, label: "IVA", type: "text" },
    { id: "total", x: 660, y: 1038, width: 110, height: 21, label: "Total", type: "text" },
    { id: "tecnicoNombre", x: 250, y: 1100, width: 160, height: 21, label: "Técnico Asociado", type: "text" },
    { id: "clienteNombre", x: 607, y: 1100, width: 160, height: 21, label: "Cliente Asociado", type: "text" },
    { id: "tecnicoFirma", x: 70, y: 1075, width: 150, height: 50, label: "Firma Técnico", type: "signature" },
    { id: "clienteFirma", x: 430, y: 1075, width: 150, height: 50, label: "Firma Cliente", type: "signature" },
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
    
    // Centrar automáticamente el área en móvil
    if (isMobile) {
      // Pequeño delay para permitir que el overlay se renderice primero
      setTimeout(() => {
        centerAreaOnScreen(area)
      }, 100)
    }
  }

  const handleApplyValue = () => {
    if (activeField) {
      updateField(activeField, tempValue)
      setActiveField(null)
      toast.success("Campo actualizado", { 
        description: `${clickableAreas.find(a => a.id === activeField)?.label} guardado correctamente`,
        duration: 2000 
      })
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
        description: groupValidation.errors.join(', ')
      })
      return
    }
    
    // Analizar campos críticos del formulario
    const criticalValidation = validateCriticalFields()
    
    // Si hay campos críticos faltantes, mostrar advertencia
    if (!criticalValidation.isValid) {
      toast.error("Campos críticos incompletos", {
        description: `Faltan campos críticos: ${criticalValidation.missingFields.length} campo(s)`
      })
      return
    }
    
    // Si está completo, enviar directamente
    submitToGoogleForms()
  }

  const submitToGoogleForms = async () => {
    try {
      // Mostrar info sobre firmas
      const signatureInfo = getSignatureInfo(formData)


      if (!isOnline) {
        // Modo offline: guardar en cola para envío posterior
        await addPendingSubmission(formData)
        toast.success("Formulario guardado offline", { 
          description: "Se enviará automáticamente cuando haya conexión",
          duration: 4000 
        })
        return
      }

      // Validar datos antes del envío
      const validation = validateFormDataForSubmission(formData)
      if (!validation.isValid) {
        toast.error("Error en validación", {
          description: validation.errors.join(', ')
        })
        return
      }

      // Enviar a Google Forms
      toast.info("Enviando formulario...", { description: "Por favor espere" })
      
      const result = await submitFormToGoogle(formData)
      
      if (result.success) {
        toast.success("¡Formulario enviado exitosamente!", { 
          description: "Los datos se han guardado en Google Forms",
          duration: 5000 
        })
        
        // Opcional: Limpiar formulario después del envío exitoso
        // resetForm()
      } else {
        throw new Error(result.error || "Error desconocido")
      }
      
    } catch (error) {
      console.error('Error al enviar formulario:', error)
      
      // En caso de error, guardar offline como respaldo
      if (isOnline) {
        try {
          await addPendingSubmission(formData)
          toast.error("Error en envío online", { 
            description: "Guardado offline para reintento automático",
            duration: 4000 
          })
        } catch (offlineError) {
          toast.error("Error crítico", { 
            description: "No se pudo enviar ni guardar offline",
            duration: 6000 
          })
        }
      } else {
        // Ya está offline, guardar directamente
        try {
          await addPendingSubmission(formData)
          toast.info("Guardado offline", { 
            description: "Se enviará cuando haya conexión",
            duration: 4000 
          })
        } catch (offlineError) {
          toast.error("Error de almacenamiento", { 
            description: "No se pudo guardar el formulario",
            duration: 6000 
          })
        }
      }
    }
  }

  // Función auxiliar para generar URL de Google Forms (fallback)
  const generateGoogleFormsUrl = (): string => {
    return generatePrefilledUrl(formData)
  }

  const handleSubmitIncomplete = () => {
    submitToGoogleForms()
  }

  const handleContinueEditing = () => {
    // Opcionalmente, podrías enfocar el primer campo crítico faltante
    const criticalValidation = validateCriticalFields()
    if (!criticalValidation.isValid) {
      toast.info("Campos críticos pendientes", {
        description: `Completa: ${criticalValidation.missingFields.slice(0, 3).join(', ')}${criticalValidation.missingFields.length > 3 ? '...' : ''}`
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
      
      // Log específico para firmas
      if (area.type === 'signature') {

      }
      
      return (
        <div
          key={`value-${area.id}-${forceRender}`}
          className={`absolute pointer-events-none ${area.type === 'signature' ? 'z-50' : 'z-10'}`}
          style={{
            left: `${(area.x / 850) * 100}%`,
            top: `${(area.y / 1200) * 100}%`,
            width: `${(area.width / 850) * 100}%`,
            height: `${(area.height / 1200) * 100}%`,
            // Debug styles for signatures
            ...(area.type === 'signature' ? {
              backgroundColor: 'red',
              border: '5px solid blue',
              boxShadow: '0 0 20px rgba(255, 0, 0, 0.8)',
              transform: 'translateZ(0)' // Force hardware acceleration
            } : {})
          }}
        >
          {area.type === 'checkbox' ? (
            hasValue && formData[area.id] && (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-black text-lg font-bold">✓</span>
              </div>
            )
          ) : hasValue ? (
            <div className={`
              w-full h-full flex text-black text-xs font-medium overflow-hidden
              ${area.type === 'textarea' ? 'items-start p-1' : 
                area.type === 'signature' ? 'items-center justify-center' : 'items-center'}
            `}>
              {area.type === 'signature' ? (
                /* FIRMA: Renderizado limpio y funcional */
                <div className="w-full h-full flex items-center justify-center relative bg-white/95 border border-gray-200 rounded shadow-sm">
                  {value && typeof value === 'string' && (value.startsWith('http') || value.startsWith('data:image')) ? (
                    /* Mostrar imagen de firma */
                    <img 
                      src={value.toString()} 
                      alt={`Firma ${area.label}`}
                      className="max-w-full max-h-full object-contain"
                      style={{
                        backgroundColor: 'transparent',
                        filter: 'contrast(1.1)'
                      }}

                      onError={(e) => console.error(`❌ Error mostrando firma: ${area.id}`, e)}
                    />
                  ) : (
                    /* Placeholder cuando no hay firma */
                    <div className="flex flex-col items-center justify-center text-gray-400 text-xs">
                      <div className="text-lg mb-1">✍️</div>
                      <div>Área de Firma</div>
                      <div className="text-xs">{area.label}</div>
                    </div>
                  )}
                </div>
              ) : area.id === 'insumos' && value ? (
                /* Mostrar tabla compacta de insumos */
                <InsumosCompactView value={value.toString()} />
              ) : (
                <span className={`
                  ${area.type === 'textarea' ? 'whitespace-pre-wrap leading-tight' : 'truncate'}
                  ${area.id === 'numeroOrden' ? 'font-bold' : ''}
                `}>
                  {value.toString()}
                </span>
              )}
            </div>
          ) : null}
        </div>
      )
    })
  }

  const renderOverlay = () => {
    if (!activeField) return null

    const field = clickableAreas.find((area) => area.id === activeField)
    if (!field) return null

    // Función simplificada para posicionar overlay cerca del área clickeada
    const calculateResponsivePosition = () => {
      if (!imageRef.current) {
        // Fallback si no hay referencia a la imagen
        return {
          position: 'fixed' as const,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: '90vw',
          maxHeight: '80vh'
        }
      }

      // 🎯 SIEMPRE usar el sistema de porcentajes (móvil Y desktop)
      // Tamaño especial para la tabla de insumos
      const isInsumosTable = activeField === "insumos"
      const overlayWidth = isInsumosTable 
        ? (isMobile ? 600 : 800)  // Más ancho para la tabla
        : (isMobile ? 320 : 400)
      const overlayHeight = isInsumosTable 
        ? (isMobile ? 400 : 500)  // Más alto para la tabla
        : (isMobile ? 250 : 300)
      
      // Para la tabla de insumos, posicionar más centrado
      const percentageX = isInsumosTable 
        ? 50  // Centrado para la tabla grande
        : Math.max(20, (field.x / 850) * 100)
      const percentageY = isInsumosTable
        ? Math.max(10, (field.y / 1200) * 100 - 10)  // Más arriba para tabla grande
        : (field.y / 1200) * 100
      
      return {
        position: 'absolute' as const,
        left: `${percentageX}%`,
        top: `${Math.max(0, percentageY - 5)}%`, // Un poco arriba del campo
        width: `${overlayWidth}px`,
        maxHeight: `${overlayHeight}px`,
        overflow: 'auto',
        zIndex: 60,
        transform: 'translateX(-50%)' // Centrar horizontalmente
      }
    }

    const positionStyle = calculateResponsivePosition()

    return (
      <>
        {/* Backdrop para móviles */}
        {isMobile && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
            onClick={handleCancelEdit}
          />
        )}
        
        <div
          className="bg-white border-2 border-blue-500 rounded-lg shadow-xl p-4 z-50 min-w-[280px] relative"
          style={positionStyle}
        >
          {/* Indicador visual que apunta al área */}
          <div className="absolute -top-2 left-4 w-4 h-4 bg-blue-500 transform rotate-45 border-l-2 border-t-2 border-white"></div>
          
          {/* Header con información del campo */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <h3 className="font-semibold text-sm text-blue-700">{field.label}</h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Editando</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {field.type === "checkbox" ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={tempValue as boolean}
                  onCheckedChange={handleTempValueChange}
                />
                <Label>{field.label}</Label>
              </div>
            </div>
          ) : field.type === "textarea" ? (
            <div className="space-y-2">
              {activeField === "insumos" ? (
                /* Tabla especializada para insumos */
                <InsumosTable
                  value={tempValue as string}
                  onChange={handleTempValueChange}
                  className="w-full"
                />
              ) : (
                /* Textarea normal para otros campos como descripción */
                <Textarea
                  value={tempValue as string}
                  onChange={(e) => handleTempValueChange(e.target.value)}
                  rows={isMobile ? 3 : 4}
                  placeholder={`Ingrese ${field.label.toLowerCase()}`}
                  className="text-sm"
                />
              )}
              {getFieldHint(activeField) && (
                <p className="text-xs text-blue-600">💡 {getFieldHint(activeField)}</p>
              )}
            </div>
          ) : field.type === "signature" ? (
            <div className="space-y-2">
              <SignatureCanvas
                value={tempValue as string}
                onChange={handleTempValueChange}
                width={isMobile ? Math.min(250, window.innerWidth - 60) : 280}
                height={isMobile ? 100 : 120}
                orderNumber={formData.numeroOrden}
                signatureType={activeField === 'tecnicoFirma' ? 'tecnico' : 'cliente'}
              />
            </div>
          ) : activeField === "razonSocial" ? (
            <div className="space-y-2">
              {/* Componente de búsqueda inteligente de Odoo */}
              <OdooContactSearch
                value={tempValue as string}
                onValueChange={handleTempValueChange}
                onContactSelect={handleContactSelect}
                placeholder="Buscar en Odoo o escribir manualmente..."
                className="text-sm"
              />
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                🔍 <strong>Búsqueda inteligente:</strong> Escribe para buscar contactos en Odoo y autocompletar datos (CUIT, teléfono, etc.)
              </div>
              {getFieldHint(activeField) && (
                <p className="text-xs text-blue-600">💡 {getFieldHint(activeField)}</p>
              )}
              {getFieldError(activeField) && (
                <p className="text-xs text-red-600">⚠️ {getFieldError(activeField)}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                value={tempValue as string}
                onChange={(e) => handleTempValueChange(e.target.value)}
                placeholder={`Ingrese ${field.label.toLowerCase()}`}
                className="text-sm"
                type={field.id === "fecha" ? "date" : "text"}
              />
              {getFieldHint(activeField) && (
                <p className="text-xs text-blue-600">💡 {getFieldHint(activeField)}</p>
              )}
              {getFieldError(activeField) && (
                <p className="text-xs text-red-600">⚠️ {getFieldError(activeField)}</p>
              )}
            </div>
          )}

          {/* Botones responsivos */}
          <div className={`flex gap-2 mt-4 ${isMobile ? 'flex-col' : 'flex-row'}`}>
            <Button onClick={handleApplyValue} size="sm" className="flex-1">
              ✅ Aplicar
            </Button>
            <Button variant="outline" onClick={handleCancelEdit} size="sm" className="flex-1">
              ✖️ Cancelar
            </Button>
          </div>

          {field.type !== "signature" && (
            <div className="mt-2 text-xs text-muted-foreground">
              {tempValue && (
                <span className="font-medium">
                  Vista previa: {typeof tempValue === 'string' ? tempValue.slice(0, isMobile ? 30 : 50) : String(tempValue)}
                  {typeof tempValue === 'string' && tempValue.length > (isMobile ? 30 : 50) && '...'}
                </span>
              )}
            </div>
          )}
        </div>
      </>
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
      <div className="bg-card border-b border-border p-2 sm:p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary">ARAN Tecnologías</h1>
            <p className="text-sm text-muted-foreground">Sistema de Órdenes de Servicio</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">

            
            {/* Mostrar estado de validación */}
            <div className="w-full">
              <ValidationStatus 
                formData={formData} 
                mode={showValidationProminent ? 'prominent' : 'discrete'}
                onFieldFocus={(fieldName) => {
                  // Lógica para hacer scroll/focus al campo si es necesario

                }}
              />
            </div>
            
            <div className="w-full sm:w-auto">
              <FormActions
                formData={formData}
                onSubmit={handleSubmit}
                onReset={resetForm}
                onUpdateField={updateField}
                hasErrors={hasErrors()}
                lastSaveTime={lastSaveTime}
                onShowValidationProminent={() => setShowValidationProminent(true)}
                onHideValidationProminent={() => setShowValidationProminent(false)}
                formRef={imageRef}
                onShowDatabase={onShowDatabase}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Form - Always show image overlay design */}
      <div className="max-w-7xl mx-auto p-2 sm:p-4">
        <Card className="p-2 sm:p-6">
          {/* Controles de Zoom para Móvil */}
          {isMobile && (
            <div className="mb-4 flex items-center justify-center gap-2 p-2 bg-gray-50 rounded-lg">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="text-xs"
              >
                🔍−
              </Button>
              <span className="text-xs text-gray-600 min-w-[60px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={resetZoom}
                className="text-xs"
              >
                🎯
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 2.5}
                className="text-xs"
              >
                🔍+
              </Button>
            </div>
          )}

          {/* Form View - Visual overlay on image for all devices */}
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: isMobile ? '70vh' : 'auto' }}>
            <div 
              ref={imageRef} 
              className="relative mx-auto" 
              style={{ 
                minWidth: "850px", 
                maxWidth: "850px",
                transform: isMobile ? `scale(${zoomLevel})` : 'scale(1)',
                transformOrigin: 'top left',
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              <img src="/images/orden-servicio-aran.png" alt="Orden de Servicio ARAN" className="w-full h-auto" />

              {/* Value Overlays - Mostrar valores sobre la imagen */}
              {renderValueOverlays()}

              {/* Clickable Areas */}
            {clickableAreas.map((area) => (
              <div
                key={area.id}
                className={`absolute clickable-area ${
                  activeField === area.id 
                    ? 'ring-4 ring-blue-500 ring-opacity-50 bg-blue-100 bg-opacity-30' 
                    : 'hover:bg-blue-50 hover:bg-opacity-20'
                }`}
                style={{
                  left: `${(area.x / 850) * 100}%`,
                  top: `${(area.y / 1200) * 100}%`,
                  width: `${(area.width / 850) * 100}%`,
                  height: `${(area.height / 1200) * 100}%`,
                  transition: 'all 0.2s ease-in-out',
                  zIndex: activeField === area.id ? 10 : 1
                }}
                onClick={(e) => handleAreaClick(area, e)}
                title={`Clic para editar: ${area.label}`}
              />
            ))}

            {/* Overlay */}
            {renderOverlay()}
            </div>
          </div>

          {/* Instrucción para móvil */}
          {isMobile && (
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">
                📱 Usa los controles arriba para hacer zoom o pellizca la pantalla
              </p>
            </div>
          )}
        </Card>
      </div>


      

    </div>
  )
}