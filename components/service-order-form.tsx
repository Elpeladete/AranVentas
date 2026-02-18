"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { X, CheckCircle, Camera } from "lucide-react"
import { useFormData, type FormData } from "@/hooks/use-form-data"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { FormActions } from "@/components/form-actions"
import { toast } from "@/lib/toast"
import { generateOrderNumber } from "@/lib/order-number"
import { submitFormToGoogle, generatePrefilledUrl, validateFormDataForSubmission, getSignatureInfo } from "@/lib/google-forms"
import { SignatureCanvas } from "@/components/signature-canvas"
import { HybridDigitalSignature } from "@/components/hybrid-digital-signature"
import { formatPhoneNumber, formatCuit, getFieldHint, validateAllGroups, validateRequiredFields } from "@/lib/validations"
import { formatDateForDisplay, formatDateForStorage } from "@/lib/utils"
import { uploadImageToImgBB } from "@/lib/imgbb-upload"
import { addPendingSubmission } from "@/lib/offline-storage"
import { syncManager } from "@/lib/offline-sync"
import type { DigitalSignature } from "@/lib/digital-signature-hybrid"
import { BarcodeScanner } from "@/components/barcode-scanner"


import { ValidationStatus } from "@/components/validation-status"
import { OdooContactSearch, useOdooContactSearch } from "@/components/odoo-contact-search-fixed"
import { CompanyContactSearch } from "@/components/company-contact-search"
import type { OdooContact } from "@/lib/odoo-api-client"
import { InsumosTable } from "@/components/insumos-table"
import { InsumosCompactView } from "@/components/insumos-compact-view"
import { LocalidadAutocomplete } from "@/components/localidad-autocomplete"
import type { LocalidadSearchResult } from "@/lib/localidades-search"
import { TecnicoAutocomplete } from "@/components/tecnico-autocomplete"
import type { TecnicoSearchResult } from "@/lib/tecnicos-search"
import { GeolocationPermissionIndicator } from "@/components/geolocation-permission-indicator"
import { useGeolocationPermission } from "@/hooks/use-geolocation-permission"


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
  onLoadFormData?: (loadFn: (data: FormData) => void) => void
}

export function ServiceOrderForm({ onShowDatabase, onLoadFormData }: ServiceOrderFormProps = {}) {
  const { 
    formData, 
    updateField, 
    resetForm, 
    loadFormData,
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
  
  // Hook para permisos de geolocalización
  const { hasPermission: hasGeoPermission } = useGeolocationPermission()
  
  // Hook para búsqueda de contactos en Odoo
  const { selectedContact, handleContactSelect, resetSelection } = useOdooContactSearch()
  
  // Estado para empresa seleccionada (para búsqueda de contactos)
  const [selectedCompany, setSelectedCompany] = useState<{ id: number; name: string } | null>(null)
  
  // Función para manejar selección de localidad
  const handleLocalidadSelect = (localidad: LocalidadSearchResult) => {
    console.log('🏙️ Localidad seleccionada:', localidad)
    
    // Actualizar el tempValue con la localidad seleccionada
    setTempValue(localidad.municipio)
    
    // Aplicar inmediatamente los valores al formulario
    updateField('localidad', localidad.municipio)
    
    // Autocompletar automáticamente la provincia
    updateField('provincia', localidad.provincia)
    
    toast.success("Localidad autocompletada", {
      description: `${localidad.municipio}, ${localidad.provincia}${localidad.pais !== 'Argentina' ? ` - ${localidad.pais}` : ''}`,
      duration: 3000
    })
  }
  
  // Función para manejar selección de técnico
  const handleTecnicoSelect = (tecnico: TecnicoSearchResult) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('👨‍🔧 TÉCNICO SELECCIONADO - DEBUG COMPLETO')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 Objeto completo del técnico:', tecnico)
    console.log('👤 Nombre:', tecnico.nombre)
    console.log('📱 Teléfono:', tecnico.telefono)
    console.log('💼 Cargo:', tecnico.cargo)
    console.log('📧 Email:', tecnico.email)
    console.log('🔢 Tipo de teléfono:', typeof tecnico.telefono)
    console.log('📏 Longitud teléfono:', tecnico.telefono?.length || 0)
    console.log('❓ ¿Tiene teléfono?:', !!tecnico.telefono)
    console.log('ℹ️ Nota: El teléfono se guarda automáticamente en aux3 por TecnicoAutocomplete')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Autocompletar el nombre del técnico
    setTempValue(tecnico.nombre)
    
    // Mostrar información adicional en el toast
    const infoDetails = []
    if (tecnico.cargo) infoDetails.push(tecnico.cargo)
    if (tecnico.telefono) infoDetails.push(`Tel: ${tecnico.telefono}`)
    
    toast.success("Técnico seleccionado", {
      description: `${tecnico.nombre}${infoDetails.length > 0 ? ` - ${infoDetails.join(', ')}` : ''}`,
      duration: 3000
    })
  }
  
  // Función para buscar teléfono cuando se cierra el campo sin seleccionar del autocomplete
  const handleTecnicoBlur = async (nombreTecnico: string) => {
    if (!nombreTecnico || nombreTecnico.trim().length < 2) {
      console.log('⏭️ handleTecnicoBlur: nombre muy corto, saltando búsqueda')
      return
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 BUSCANDO TELÉFONO AUTOMÁTICAMENTE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('👤 Nombre a buscar:', nombreTecnico)
    console.log('📏 Longitud del nombre:', nombreTecnico.length)
    
    try {
      const { searchTecnicos } = await import('@/lib/tecnicos-search')
      const results = await searchTecnicos(nombreTecnico, 5)
      
      console.log('📊 Resultados encontrados:', results.length)
      console.log('📋 Resultados completos:', results)
      
      if (results.length > 0) {
        // Buscar coincidencia exacta o muy cercana
        const exactMatch = results.find(t => 
          t.nombre.toLowerCase() === nombreTecnico.toLowerCase()
        )
        
        const bestMatch = exactMatch || results[0]
        
        console.log('🎯 Mejor coincidencia:', bestMatch)
        console.log('📱 Teléfono del mejor match:', bestMatch.telefono)
        console.log('❓ ¿Tiene teléfono?:', !!bestMatch.telefono)
        
        if (bestMatch.telefono) {
          updateField('aux3', bestMatch.telefono)
          console.log('✅ Teléfono guardado en aux3:', bestMatch.telefono)
          
          toast.info("Teléfono detectado", {
            description: `${bestMatch.nombre}: ${bestMatch.telefono}`,
            duration: 3000
          })
        } else {
          console.warn('⚠️ Técnico encontrado pero sin teléfono:', bestMatch.nombre)
          console.warn('⚠️ Objeto completo:', JSON.stringify(bestMatch, null, 2))
        }
      } else {
        console.warn('⚠️ No se encontró técnico con ese nombre:', nombreTecnico)
      }
    } catch (error) {
      console.error('❌ Error buscando teléfono del técnico:', error)
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }
  
  const [activeField, setActiveField] = useState<keyof FormData | null>(null)
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 })
  const [tempValue, setTempValue] = useState<string | boolean>("")
  const [originalValue, setOriginalValue] = useState<string | boolean>("")
  const [forceRender, setForceRender] = useState(0) // Para forzar re-render

  const [isMobile, setIsMobile] = useState(false) // Estado para detectar móvil
  const [showValidationProminent, setShowValidationProminent] = useState(false) // Mostrar validación prominente
  const [zoomLevel, setZoomLevel] = useState(1) // Estado para el zoom
  const imageRef = useRef<HTMLDivElement>(null)
  
  // Estados para firma digital híbrida
  const [digitalSignatures, setDigitalSignatures] = useState<{
    tecnico?: DigitalSignature
    cliente?: DigitalSignature
  }>({})
  const [showDigitalSignature, setShowDigitalSignature] = useState<'tecnico' | 'cliente' | null>(null)
  const [clienteManualSignatureComplete, setClienteManualSignatureComplete] = useState(false)
  const [isSignatureLoading, setIsSignatureLoading] = useState(false) // Estado de carga de firma digital
  
  // Estados para escáner de código de barras
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Inicializar sincronización automática al cargar el componente
  useEffect(() => {
    // Inicializar el sistema de sincronización offline
    syncManager.startAutoSync(60000)
    

    
    // Cleanup al desmontar el componente
    return () => {
      syncManager.stopAutoSync()
    }
  }, [])
  
  // Exponer función loadFormData al padre
  useEffect(() => {
    if (onLoadFormData) {
      onLoadFormData(loadFormData)
    }
  }, [onLoadFormData, loadFormData])

  // Autocompletar datos cuando se selecciona un contacto de Odoo
  useEffect(() => {
    if (selectedContact) {
      console.log('🎯 Autocompletando datos de contacto Odoo:', selectedContact)
      console.log(`📋 Tipo: ${selectedContact.is_company ? 'Empresa' : 'Persona'}${selectedContact.parent_name ? ` (de ${selectedContact.parent_name})` : ''}`)
      
      if (selectedContact.is_company) {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🏢 ES UNA EMPRESA
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log('🏢 Seleccionada EMPRESA:', selectedContact.name)
        
        // Guardar datos de la empresa seleccionada
        setSelectedCompany({
          id: selectedContact.id,
          name: selectedContact.name
        })
        
        // Razón social = nombre de la empresa
        updateField('razonSocial', selectedContact.name)
        
        // Contacto vacío (para que el usuario lo complete)
        updateField('contacto', '')
        
        // Solo completar CUIT y Teléfono (NO localidad ni provincia)
        if (selectedContact.vat) {
          updateField('cuit', selectedContact.vat)
        }
        
        if (selectedContact.phone) {
          updateField('telefono', selectedContact.phone)
        }
        
        toast.success("Empresa seleccionada", {
          description: `${selectedContact.name} • Completa el campo Contacto para buscar personas de esta empresa`,
          duration: 4000
        })
        
      } else {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 👤 ES UNA PERSONA (puede tener empresa padre)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log('👤 Seleccionada PERSONA:', selectedContact.name)
        
        if (selectedContact.parent_name) {
          console.log('🏢 Con empresa padre:', selectedContact.parent_name)
          
          // Razón social = empresa padre
          updateField('razonSocial', selectedContact.parent_name)
          
          // Contacto = nombre de la persona
          updateField('contacto', selectedContact.name)
          
          toast.success("Contacto y empresa autocompletados", {
            description: `${selectedContact.name} de ${selectedContact.parent_name}`,
            duration: 4000
          })
        } else {
          console.log('⚠️ Persona sin empresa asociada')
          
          // Si no tiene empresa, usar el nombre en ambos campos
          updateField('razonSocial', selectedContact.name)
          updateField('contacto', selectedContact.name)
          
          toast.info("Contacto sin empresa asociada", {
            description: `${selectedContact.name} (sin empresa en Odoo)`,
            duration: 4000
          })
        }
        
        // Datos comunes
        if (selectedContact.vat) {
          updateField('cuit', selectedContact.vat)
        }
        
        if (selectedContact.phone) {
          updateField('telefono', selectedContact.phone)
        }
        
        if (selectedContact.city) {
          updateField('localidad', selectedContact.city)
        }
        
        if (selectedContact.state) {
          updateField('provincia', selectedContact.state)
        }
      }
      
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
    { id: "provincia", x: 594, y: 920, width: 170, height: 21, label: "Provincia", type: "text" },
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
    // Si es un checkbox, cambiar estado directamente sin abrir overlay
    if (area.type === "checkbox") {
      const currentValue = formData[area.id] as boolean
      const newValue = !currentValue
      updateField(area.id, newValue)
      toast.success("Campo actualizado", { 
        description: `${area.label} ${newValue ? 'activado' : 'desactivado'}`,
        duration: 2000 
      })
      return
    }

    const rect = imageRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Guardar valor original y establecer valor temporal
    const currentValue = formData[area.id]
    setOriginalValue(currentValue)
    
    // Para el campo fecha, convertir a formato YYYY-MM-DD para el input date
    if (area.id === "fecha" && typeof currentValue === "string") {
      setTempValue(formatDateForStorage(currentValue))
    } else {
      setTempValue(currentValue)
    }
    
    setActiveField(area.id)
    setOverlayPosition({ x: x + 10, y: y + 10 })
    
    // Resetear estados de secuencia de firma cuando se cambia de campo
    if (area.id !== 'clienteFirma') {
      setClienteManualSignatureComplete(false)
    }
    
    // Centrar automáticamente el área en móvil
    if (isMobile) {
      // Pequeño delay para permitir que el overlay se renderice primero
      setTimeout(() => {
        centerAreaOnScreen(area)
      }, 100)
    }
  }

  const handleApplyValue = async () => {
    if (activeField) {
      let finalValue = tempValue
      
      // Para la fecha, convertir de YYYY-MM-DD (del input date) a DD-MM-YYYY para almacenamiento
      if (activeField === "fecha" && typeof tempValue === "string") {
        finalValue = formatDateForDisplay(tempValue)
      }
      
      updateField(activeField, finalValue)
      
      // 🔍 Si se guardó el nombre del técnico, buscar automáticamente su teléfono
      if (activeField === "tecnicoNombre" && typeof finalValue === "string") {
        // Esperar un poco para que se guarde el nombre primero
        setTimeout(() => {
          handleTecnicoBlur(finalValue)
        }, 100)
      }
      
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
      } else if (activeField === "fecha") {
        // Para la fecha, convertir a formato de almacenamiento (YYYY-MM-DD) 
        // para que sea compatible con input type="date"
        value = formatDateForStorage(value)
      }
      
      // Detectar cuando se completa la firma manual del cliente
      if (activeField === "clienteFirma" && typeof value === "string" && value.length > 0 && !value.startsWith('digital_signature:')) {
        console.log('🖊️ Firma manual del cliente completada')
        setClienteManualSignatureComplete(true)
        
        // Mostrar toast informativo
        toast.success('Firma manual guardada correctamente', {
          description: 'Puedes continuar con la firma digital cuando estés listo',
          duration: 4000
        })
        
        // NO abrir automáticamente la firma digital - el usuario decidirá cuándo continuar
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
    
    // Analizar campos críticos del formulario
    const criticalValidation = validateCriticalFields()
    
    // Si hay cualquier campo faltante, bloquear envío
    if (!groupValidation.isValid || !criticalValidation.isValid) {
      const allErrors = [
        ...groupValidation.errors,
        ...criticalValidation.missingFields.map(f => `Falta: ${f}`)
      ]
      toast.error("No se puede enviar la orden", {
        description: `Faltan ${criticalValidation.missingFields.length + groupValidation.errors.length} campo(s) obligatorios. Solo puede guardar como borrador.`
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
                  {area.id === 'fecha' ? formatDateForDisplay(value.toString()) : value.toString()}
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
      // Detectar si es tablet (1280x800)
      const isTablet = window.innerWidth >= 1200 && window.innerWidth <= 1300 && 
                       window.innerHeight >= 750 && window.innerHeight <= 850
      
      // Obtener dimensiones del contenedor primero
      const containerRect = imageRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Tamaño especial para la tabla de insumos - 90% ancho, 85% alto del contenedor
      const isInsumosTable = activeField === "insumos"
      const overlayWidth = isInsumosTable 
        ? containerRect.width * 0.90  // 90% del ancho del contenedor del formulario
        : (isMobile ? 360 : isTablet ? 500 : 600)  // Ancho reducido para mejor visualización
      const overlayHeight = isInsumosTable 
        ? containerRect.height * 0.85  // 85% del alto del contenedor del formulario
        : (isMobile ? viewportHeight * 0.60 : isTablet ? viewportHeight * 0.65 : viewportHeight * 0.65)  // 60-65% del viewport
      
      // Calcular posición inicial basada en el campo
      let percentageX = isInsumosTable 
        ? 50  // Centrado para la tabla grande
        : (field.x / 850) * 100
      let percentageY = isInsumosTable
        ? Math.max(10, (field.y / 1200) * 100 - 10)  // Más arriba para tabla grande
        : (field.y / 1200) * 100
      
      // Calcular posición absoluta en píxeles
      let leftPos = (percentageX / 100) * containerRect.width
      let topPos = (percentageY / 100) * containerRect.height
      
      // ========== AJUSTES HORIZONTALES ==========
      // Ajustar si se sale por la izquierda (considerando el translateX(-50%))
      const halfOverlayWidth = overlayWidth / 2
      if (leftPos - halfOverlayWidth < 0) {
        // Reposicionar para que no se salga por la izquierda
        leftPos = halfOverlayWidth + 55 // 55px de margen
        percentageX = (leftPos / containerRect.width) * 100
      }
      
      // Ajustar si se sale por la derecha
      if (leftPos + halfOverlayWidth > containerRect.width) {
        // Reposicionar para que no se salga por la derecha
        leftPos = containerRect.width - halfOverlayWidth - 20 // 20px de margen
        percentageX = (leftPos / containerRect.width) * 100
      }
      
      // ========== AJUSTES VERTICALES ==========
      // Posicionar el overlay arriba del campo (35% menos)
      topPos = topPos - (containerRect.height * 0.30)
      
      // Verificar si se sale por arriba
      if (topPos < 0) {
        topPos = 20 // Margen superior de 20px
      }
      
      // Verificar si se sale por abajo
      const availableSpaceBelow = containerRect.height - topPos
      if (overlayHeight > availableSpaceBelow - 20) {
        // No hay espacio abajo, intentar posicionar arriba del campo
        const fieldTopPos = (field.y / 1200) * containerRect.height
        const spaceAbove = fieldTopPos - 20 // Espacio disponible arriba
        
        if (spaceAbove > overlayHeight) {
          // Hay espacio arriba, posicionar allí
          topPos = fieldTopPos - overlayHeight - 10
        } else if (fieldTopPos > containerRect.height / 2) {
          // El campo está en la mitad inferior, posicionar arriba lo más posible
          topPos = Math.max(20, fieldTopPos - overlayHeight - 10)
        } else {
          // El campo está arriba, usar posición fija centrada
          return {
            position: 'fixed' as const,
            left: '50%',
            top: '35%',
            transform: 'translate(-50%, -50%)',
            width: `${Math.min(overlayWidth, viewportWidth - 40)}px`,
            height: `${Math.min(overlayHeight, viewportHeight - 100)}px`,
            maxHeight: `${Math.min(overlayHeight, viewportHeight - 100)}px`,
            overflow: 'auto',
            zIndex: 60
          }
        }
      }
      
      // Recalcular porcentaje Y después de ajustes
      percentageY = (topPos / containerRect.height) * 100
      
      // Si el overlay es muy ancho para el contenedor, usar posición fija centrada
      if (overlayWidth > containerRect.width - 40) {
        return {
          position: 'fixed' as const,
          left: '50%',
          top: '10%',
          transform: 'translateX(-50%)',
          width: `${Math.min(overlayWidth, viewportWidth - 40)}px`,
          height: `${Math.min(overlayHeight, viewportHeight - 100)}px`,
          maxHeight: `${Math.min(overlayHeight, viewportHeight - 100)}px`,
          overflow: 'auto',
          zIndex: 60
        }
      }
      
      return {
        position: 'absolute' as const,
        left: `${percentageX}%`,
        top: `${Math.max(0, percentageY)}%`,
        width: `${overlayWidth}px`,
        height: `${overlayHeight}px`,
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
          className={`bg-white border-2 border-blue-500 rounded-lg shadow-xl z-50 relative flex flex-col ${
            activeField === 'insumos' 
              ? 'min-w-[90%]'  // Tabla de insumos ocupa 90% del ancho
              : ''  // Sin restricciones de ancho para overlays normales
          }`}
          style={positionStyle}
        >
          {/* Indicador visual que apunta al área */}
          <div className="absolute -top-2 left-4 w-4 h-4 bg-blue-500 transform rotate-45 border-l-2 border-t-2 border-white"></div>
          
          {/* Header con información del campo - FIJO */}
          <div className="flex items-center justify-between p-3 md:p-4 pb-2 flex-shrink-0 border-b border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <h3 className="font-semibold text-sm text-blue-700">{field.label}</h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Editando</span>
              {/* Indicador de campo persistente */}
              {(activeField === 'tecnicoNombre' || activeField === 'tecnicoFirma') && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200 flex items-center gap-1">
                  <span>💾</span>
                  <span>Persistente</span>
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Contenedor con scroll para el contenido */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4 pt-3"
               style={{
                 scrollbarWidth: 'thin',
                 scrollbarColor: '#cbd5e0 #f7fafc'
               }}
          >
          
          {/* Mensaje informativo para campos persistentes */}
          {(activeField === 'tecnicoNombre' || activeField === 'tecnicoFirma') && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-lg">💾</span>
                <div className="flex-1 text-xs text-green-800">
                  <div className="font-semibold mb-1">Campo Persistente del Técnico</div>
                  <div>
                    Este dato se guardará automáticamente y se mantendrá en futuras órdenes 
                    para agilizar tu trabajo. Puedes modificarlo cuando sea necesario.
                  </div>
                </div>
              </div>
            </div>
          )}

          {field.type === "checkbox" ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={tempValue as boolean}
                  onCheckedChange={(checked) => {
                    handleTempValueChange(checked)
                    // Aplicar inmediatamente el cambio y cerrar el overlay
                    updateField(activeField!, checked)
                    setActiveField(null)
                    toast.success("Campo actualizado", { 
                      description: `${field.label} ${checked ? 'activado' : 'desactivado'}`,
                      duration: 2000 
                    })
                  }}
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
                <>
                  <div className="relative">
                    <Textarea
                      ref={textareaRef}
                      value={tempValue as string}
                      onChange={(e) => handleTempValueChange(e.target.value)}
                      rows={isMobile ? 20 : 40}
                      placeholder={`Ingrese ${field.label.toLowerCase()}`}
                      className="text-sm pr-10 min-h-[500px]"
                      autoFocus
                    />
                    {activeField === "descripcion" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="absolute top-2 right-2 h-8 w-8 p-0"
                        title="Escanear código de barras o QR"
                      >
                        <Camera className="h-4 w-4 text-blue-600" />
                      </Button>
                    )}
                  </div>
                </>
              )}
              {getFieldHint(activeField) && (
                <p className="text-xs text-blue-600">💡 {getFieldHint(activeField)}</p>
              )}
            </div>
          ) : field.type === "signature" ? (
            <div className="space-y-4">
              {/* Selector de tipo de firma */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={showDigitalSignature === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDigitalSignature(null)}
                >
                  ✍️ Firma Manual
                  {activeField === 'clienteFirma' && clienteManualSignatureComplete && (
                    <span className="ml-1 text-green-600">✓</span>
                  )}
                </Button>
                <Button
                  variant={showDigitalSignature !== null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDigitalSignature(activeField === 'tecnicoFirma' ? 'tecnico' : 'cliente')}
                  disabled={activeField === 'clienteFirma' && !clienteManualSignatureComplete}
                >
                  🔒 Firma Digital
                  {activeField === 'clienteFirma' && !clienteManualSignatureComplete && (
                    <span className="ml-1 text-gray-400 text-xs">(Completa la firma manual primero)</span>
                  )}
                </Button>
              </div>
              
              {/* Indicador de progreso para firma del cliente */}
              {activeField === 'clienteFirma' && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <div className="font-medium mb-2">Secuencia de Firma del Cliente:</div>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 ${clienteManualSignatureComplete ? 'text-green-600' : 'text-blue-600'}`}>
                        {clienteManualSignatureComplete ? '✅' : '1️⃣'} Firma Manual
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className={`flex items-center gap-1 ${digitalSignatures.cliente ? 'text-green-600' : 'text-gray-500'}`}>
                        {digitalSignatures.cliente ? '✅' : '2️⃣'} Firma Digital
                        {digitalSignatures.cliente && (
                          <span className="text-xs">(Completada)</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {showDigitalSignature === null ? (
                /* Firma manual tradicional */
                <div className="space-y-2">
                  <SignatureCanvas
                    value={tempValue as string}
                    onChange={handleTempValueChange}
                    onGeolocationCapture={(geoLocation) => {
                      // Guardar geolocalización en AUX2
                      console.log('📍 Geolocalización recibida:', geoLocation)
                      updateField('aux2', geoLocation)
                    }}
                    onLoadingChange={(loading) => {
                      console.log('🔄 Estado de carga de firma manual:', loading)
                      setIsSignatureLoading(loading)
                    }}
                    width={isMobile ? Math.min(250, window.innerWidth - 60) : 280}
                    height={isMobile ? 100 : 120}
                    orderNumber={formData.numeroOrden}
                    signatureType={activeField === 'tecnicoFirma' ? 'tecnico' : 'cliente'}
                  />
                  <div className="text-xs text-gray-500">
                    Firma manual dibujada en canvas
                    {activeField === 'clienteFirma' && (
                      <span className="block text-blue-600 mt-1">
                        📍 Se capturará la ubicación automáticamente
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Firma digital híbrida */
                <div className="space-y-2">
                  <HybridDigitalSignature
                    documentData={{
                      ...formData,
                      timestamp: Date.now(),
                      orderNumber: formData.numeroOrden
                    }}
                    signerInfo={{
                      name: activeField === 'tecnicoFirma' 
                        ? formData.tecnicoNombre 
                        : (formData.clienteNombre || formData.contacto || 'Cliente'),
                      email: activeField === 'tecnicoFirma' ? '' : '',
                      role: activeField === 'tecnicoFirma' ? 'technician' : 'client',
                      company: activeField === 'tecnicoFirma' ? 'Arán Tecnologías' : formData.razonSocial,
                      dni: '',
                      position: activeField === 'tecnicoFirma' ? 'Técnico' : 'Cliente'
                    }}
                    onSignatureComplete={(signature) => {
                      const signatureType = activeField === 'tecnicoFirma' ? 'tecnico' : 'cliente'
                      setDigitalSignatures(prev => ({
                        ...prev,
                        [signatureType]: signature
                      }))
                      
                      // Guardar referencia de la firma en el formulario
                      handleTempValueChange(`digital_signature:${signature.id}`)
                      
                      toast.success('Firma digital aplicada', {
                        description: `Firma ${signature.type} guardada exitosamente`
                      })
                    }}
                    onLoadingChange={(loading) => {
                      console.log('🔄 Estado de carga de firma digital:', loading)
                      setIsSignatureLoading(loading)
                    }}
                    className="border rounded-lg p-4"
                  />
                  
                  {/* Mostrar firma aplicada */}
                  {digitalSignatures[activeField === 'tecnicoFirma' ? 'tecnico' : 'cliente'] && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">Firma Digital Aplicada</span>
                      </div>
                      <div className="text-sm text-green-700 mt-1">
                        ID: {digitalSignatures[activeField === 'tecnicoFirma' ? 'tecnico' : 'cliente']?.id}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeField === "razonSocial" ? (
            <div className="space-y-2">
              {/* Componente de búsqueda inteligente de Odoo */}
              <OdooContactSearch
                value={tempValue as string}
                onValueChange={handleTempValueChange}
                onContactSelect={handleContactSelect}
                onCompanyCreated={(company, contact) => {
                  console.log('🏢 Empresa creada desde formulario:', company)
                  // Guardar la empresa seleccionada
                  setSelectedCompany({
                    id: company.id,
                    name: company.name
                  })
                  // Autocompletar campos
                  updateField('razonSocial', company.name)
                  if (company.vat) {
                    updateField('cuit', company.vat)
                  }
                  if (company.phone) {
                    updateField('telefono', company.phone)
                  }
                  // Si también se creó un contacto, autocompletarlo
                  if (contact) {
                    updateField('contacto', contact.name)
                  }
                }}
                placeholder="Buscar en Odoo o escribir manualmente..."
                className="text-sm"
              />
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                🔍 <strong>Búsqueda inteligente:</strong> Escribe para buscar contactos en Odoo. Si no existe, puedes crear una empresa nueva con el botón "Crear empresa".
              </div>
              {getFieldHint(activeField) && (
                <p className="text-xs text-blue-600">💡 {getFieldHint(activeField)}</p>
              )}
              {getFieldError(activeField) && (
                <p className="text-xs text-red-600">⚠️ {getFieldError(activeField)}</p>
              )}
            </div>
          ) : activeField === "localidad" ? (
            <div className="space-y-2">
              {/* Componente de búsqueda inteligente de localidades */}
              <LocalidadAutocomplete
                value={tempValue as string}
                onValueChange={handleTempValueChange}
                onLocalidadSelect={handleLocalidadSelect}
                placeholder="Buscar localidad..."
                className="text-sm"
              />
              <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                🏙️ <strong>Autocompletado inteligente:</strong> Selecciona una localidad y se completará automáticamente la provincia
              </div>
              {getFieldHint(activeField) && (
                <p className="text-xs text-blue-600">💡 {getFieldHint(activeField)}</p>
              )}
              {getFieldError(activeField) && (
                <p className="text-xs text-red-600">⚠️ {getFieldError(activeField)}</p>
              )}
            </div>
          ) : activeField === "tecnicoNombre" ? (
            <div className="space-y-2">
              {/* Componente de búsqueda inteligente de técnicos */}
              <TecnicoAutocomplete
                value={tempValue as string}
                onChange={handleTempValueChange}
                onSelect={handleTecnicoSelect}
                onUpdateField={(field, value) => updateField(field as keyof FormData, value)}
                placeholder="Buscar técnico..."
                className="text-sm"
              />
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                👨‍🔧 <strong>Búsqueda de técnicos:</strong> Selecciona un técnico de la lista o escribe manualmente
              </div>
              {getFieldHint(activeField) && (
                <p className="text-xs text-blue-600">💡 {getFieldHint(activeField)}</p>
              )}
              {getFieldError(activeField) && (
                <p className="text-xs text-red-600">⚠️ {getFieldError(activeField)}</p>
              )}
            </div>
          ) : activeField === "contacto" ? (
            <div className="space-y-2">
              {selectedCompany ? (
                // Si hay empresa seleccionada, usar búsqueda de contactos
                <CompanyContactSearch
                  companyId={selectedCompany.id}
                  companyName={selectedCompany.name}
                  value={tempValue as string}
                  onValueChange={handleTempValueChange}
                  onContactSelect={(contact) => {
                    console.log('✅ Contacto de empresa seleccionado:', contact)
                    handleTempValueChange(contact.name)
                    
                    // Si el contacto tiene teléfono, actualizar el campo
                    if (contact.phone) {
                      updateField('telefono', contact.phone)
                    }
                    
                    toast.success('Contacto seleccionado', {
                      description: `${contact.name}${contact.phone ? ` - ${contact.phone}` : ''}`,
                      duration: 3000
                    })
                  }}
                  placeholder="Buscar contacto de la empresa..."
                  className="text-sm"
                />
              ) : (
                // Si NO hay empresa seleccionada, permitir entrada libre
                <Input
                  value={tempValue as string}
                  onChange={(e) => handleTempValueChange(e.target.value)}
                  placeholder="Escribe el nombre del contacto..."
                  className="text-sm"
                  autoFocus
                />
              )}
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                {selectedCompany ? (
                  <>
                    👤 <strong>Contactos de {selectedCompany.name}:</strong> Busca o crea contactos asociados a esta empresa
                  </>
                ) : (
                  <>
                    ✏️ <strong>Modo manual:</strong> Escribe el nombre del contacto libremente
                  </>
                )}
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
                autoFocus
              />
              {getFieldHint(activeField) && (
                <p className="text-xs text-blue-600">💡 {getFieldHint(activeField)}</p>
              )}
              {getFieldError(activeField) && (
                <p className="text-xs text-red-600">⚠️ {getFieldError(activeField)}</p>
              )}
            </div>
          )}
          
          {/* Vista previa dentro del área de scroll */}
          {field.type !== "signature" && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-muted-foreground">
              {tempValue && (
                <span className="font-medium">
                  Vista previa: {typeof tempValue === 'string' ? tempValue.slice(0, isMobile ? 30 : 50) : String(tempValue)}
                  {typeof tempValue === 'string' && tempValue.length > (isMobile ? 30 : 50) && '...'}
                </span>
              )}
            </div>
          )}
          </div>

          {/* Botones responsivos - SIEMPRE VISIBLES AL FONDO */}
          {/* Ocultar botones para checkbox ya que se aplica automáticamente */}
          {field.type !== "checkbox" && (
            <div className={`flex gap-2 p-3 md:p-4 pt-2 border-t border-gray-200 bg-gray-50 flex-shrink-0 ${isMobile ? 'flex-col' : 'flex-row'}`}>
              <Button 
                onClick={handleApplyValue} 
                size="sm" 
                className="flex-1"
                disabled={isSignatureLoading}
              >
                {isSignatureLoading ? '⏳ Procesando firma...' : '✅ Aplicar'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancelEdit} 
                size="sm" 
                className="flex-1"
                disabled={isSignatureLoading}
              >
                ✖️ Cancelar
              </Button>
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
      <div className="bg-card border-b border-border p-1.5 sm:p-2">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center">
            <img 
              src="/logo-claro.png" 
              alt="ARAN Tecnologías" 
              className="h-8 sm:h-10 w-auto"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">

            
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

      {/* Indicador de Permisos de Geolocalización - Solo si no están concedidos */}
      {!hasGeoPermission && (
        <div className="max-w-[1240px] mx-auto p-2 sm:p-4 pt-4">
          <GeolocationPermissionIndicator 
            className="mb-4"
            showDetails={true}
            autoRequest={false}
          />
        </div>
      )}

      {/* Interactive Form - Always show image overlay design */}
      <div className="max-w-[1240px] mx-auto p-2 sm:p-4">
        <Card className="p-2 sm:p-4 lg:p-6">
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
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: isMobile ? '70vh' : 'calc(100vh - 200px)' }}>
            <div 
              ref={imageRef} 
              className="relative mx-auto" 
              style={{ 
                minWidth: isMobile ? "850px" : "min(850px, 100%)", 
                maxWidth: isMobile ? "850px" : "min(850px, 100%)",
                width: isMobile ? "850px" : "min(850px, calc(100vw - 4rem))",
                transform: isMobile ? `scale(${zoomLevel})` : 'scale(1)',
                transformOrigin: 'top left',
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              <img src="/images/orden-servicio-aran.png" alt="Orden de Servicio ARAN" className="w-full h-auto" />

              {/* Value Overlays - Mostrar valores sobre la imagen */}
              {renderValueOverlays()}

              {/* Clickable Areas */}
            {clickableAreas.map((area) => {
              const isPersistentField = area.id === 'tecnicoNombre' || area.id === 'tecnicoFirma'
              return (
              <div
                key={area.id}
                className={`absolute clickable-area ${
                  activeField === area.id 
                    ? 'ring-4 ring-blue-500 ring-opacity-50 bg-blue-100 bg-opacity-30' 
                    : isPersistentField
                      ? 'hover:bg-green-50 hover:bg-opacity-20 ring-1 ring-green-300 ring-opacity-40'
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
                title={isPersistentField 
                  ? `💾 Campo Persistente - Clic para editar: ${area.label}` 
                  : `Clic para editar: ${area.label}`}
              >
                {/* Indicador visual de campo persistente */}
                {isPersistentField && formData[area.id] && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-xs shadow-sm z-10 pointer-events-none">
                    💾
                  </div>
                )}
              </div>
              )
            })}

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

      {/* Escáner de código de barras para descripción */}
      {showBarcodeScanner && (
        <BarcodeScanner 
          onScan={(code) => {
            // Agregar el código escaneado en formato de lista separada por comas
            const currentValue = tempValue as string || ''
            
            // Verificar si ya existe la sección de SN
            const snPrefix = 'Se agregan los siguientes SN: '
            const hasSNSection = currentValue.includes(snPrefix)
            
            let newValue: string
            if (hasSNSection) {
              // Ya existe la sección, agregar el código separado por coma
              newValue = currentValue + `, ${code}`
            } else {
              // No existe la sección, crearla
              const separator = currentValue.trim() ? '\n\n' : ''
              newValue = currentValue + separator + snPrefix + code
            }
            
            handleTempValueChange(newValue)
            setShowBarcodeScanner(false)
            
            // Enfocar el textarea después de un momento
            setTimeout(() => {
              textareaRef.current?.focus()
            }, 100)
          }}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      

    </div>
  )
}