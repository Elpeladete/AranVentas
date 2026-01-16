"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Send, RotateCcw, AlertCircle, CheckCircle, Camera, Wifi, WifiOff, Clock, AlertTriangle } from "lucide-react"
import type { FormData } from "@/hooks/use-form-data"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { toast } from "@/lib/toast"
import { validateForm, validateRequiredFields } from "@/lib/validations"
import { CompletionConfirmationDialog } from "@/components/completion-confirmation-dialog"
import { uploadImageToImgBB } from "@/lib/imgbb-upload"
import { sendServiceOrderToWhatsApp } from "@/lib/wazzup-api"
import { submitFormToGoogle } from "@/lib/google-forms"
import { addPendingSubmission } from "@/lib/offline-storage"
import { syncManager } from "@/lib/offline-sync"
import html2canvas from "html2canvas"
import { addNewOrder, updateOrder, getOrdersByNumber, updateOrderStatus } from "@/lib/local-database"
import { formatDateForDisplay } from "@/lib/utils"

// Cache global para la imagen de fondo (precargada)
let cachedBackgroundImage: HTMLImageElement | null = null

interface FormActionsProps {
  formData: FormData
  onSubmit: () => void
  onReset: () => void
  onUpdateField: (field: keyof FormData, value: any) => void
  hasErrors?: boolean
  lastSaveTime?: Date | null
  onShowValidationProminent?: () => void
  onHideValidationProminent?: () => void
  formRef?: React.RefObject<HTMLDivElement>
  onShowDatabase?: () => void
}

export function FormActions({ 
  formData, 
  onSubmit, 
  onReset,
  onUpdateField,
  hasErrors = false,
  lastSaveTime,
  onShowValidationProminent,
  onHideValidationProminent,
  formRef,
  onShowDatabase
}: FormActionsProps) {
  const { isOnline, isChecking } = useNetworkStatus()
  
  // Estados para el modal de confirmación
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  const [validationData, setValidationData] = useState<{
    missingFields: string[]
    errors: Record<string, string>
  }>({ missingFields: [], errors: {} })
  
  // Estados para rastrear envíos
  const [hasBeenSubmitted, setHasBeenSubmitted] = useState(false)
  const lastSubmittedData = useRef<FormData | null>(null)
  
  // 🔒 SISTEMA DE PROTECCIÓN CONTRA ENVÍOS DUPLICADOS
  const [isSubmitting, setIsSubmitting] = useState(false) // Lock para prevenir ejecución concurrente
  const submissionTimestamp = useRef<number>(0) // Timestamp del último envío
  const submissionTracker = useRef<{
    orderId: string | null
    googleFormsSent: boolean
    odooSent: boolean
    whatsappSent: boolean
    imageCaptured: boolean
    imageUploaded: boolean
  }>({
    orderId: null,
    googleFormsSent: false,
    odooSent: false,
    whatsappSent: false,
    imageCaptured: false,
    imageUploaded: false
  })

  // 🚀 Precargar imagen de fondo cuando el componente se monta
  useEffect(() => {
    const precacheBackgroundImage = async () => {
      if (cachedBackgroundImage) {
        console.log('✅ Imagen de fondo ya está en caché')
        return
      }

      console.log('📥 Precargando imagen de fondo para uso offline...')
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            cachedBackgroundImage = img
            console.log('✅ Imagen de fondo precargada exitosamente')
            console.log('   Dimensiones:', img.width, 'x', img.height)
            resolve()
          }
          img.onerror = (err) => {
            console.error('❌ Error precargando imagen:', err)
            reject(err)
          }
          img.src = '/images/orden-servicio-aran.png'
        })
      } catch (error) {
        console.error('❌ No se pudo precargar la imagen:', error)
      }
    }

    precacheBackgroundImage()
  }, [])

  // Función para comparar si el formulario actual es igual al último enviado
  const isFormUnchangedSinceSubmit = (): boolean => {
    if (!hasBeenSubmitted || !lastSubmittedData.current) {
      return false
    }
    
    // Comparar los datos actuales con los últimos enviados
    const current = JSON.stringify(formData)
    const lastSubmitted = JSON.stringify(lastSubmittedData.current)
    
    return current === lastSubmitted
  }

  const handleReset = () => {
    if (confirm("¿Está seguro de que desea limpiar todos los datos del formulario?")) {
      // Resetear también el estado de envío
      setHasBeenSubmitted(false)
      lastSubmittedData.current = null
      onReset()
      
      // Ocultar la validación prominente al limpiar el formulario
      if (onHideValidationProminent) {
        onHideValidationProminent()
      }
    }
  }

  const handleSubmit = async () => {
    // 🔒 GUARD #1: Prevenir ejecución concurrente
    if (isSubmitting) {
      console.warn('⚠️ GUARD: Envío ya en progreso, ignorando clic adicional')
      toast.warning("Procesando...", { 
        description: "El formulario se está enviando. Por favor espere.",
        duration: 3000
      })
      return
    }
    
    // 🔒 GUARD #2: Prevenir envíos duplicados en menos de 5 segundos
    const now = Date.now()
    const timeSinceLastSubmit = now - submissionTimestamp.current
    if (timeSinceLastSubmit < 5000 && submissionTimestamp.current > 0) {
      console.warn('⚠️ GUARD: Intento de envío duplicado en menos de 5 segundos')
      toast.warning("Demasiado rápido", { 
        description: `Espere ${Math.ceil((5000 - timeSinceLastSubmit) / 1000)}s antes de volver a enviar`,
        duration: 3000
      })
      return
    }
    
    // 📋 Validar campos antes de mostrar el modal
    const validation = validateRequiredFields(formData)
    setValidationData({
      missingFields: validation.missingFields,
      errors: validation.errors
    })
    
    // Mostrar modal de confirmación
    setShowConfirmationDialog(true)
    
  }

  const handleSaveDraft = async () => {
    // Cerrar el modal
    setShowConfirmationDialog(false)
    
    try {
      console.log('💾 Guardando borrador de orden:', formData.numeroOrden)
      
      // Capturar la imagen del formulario si no se ha hecho ya
      let imageUrl = formData.imageUrl
      if (!imageUrl && formRef?.current) {
        toast.info("Generando vista previa...", { 
          description: "Capturando imagen del formulario",
          duration: 2000 
        })
        
        try {
          const canvas = await html2canvas(formRef.current, {
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
          })
          imageUrl = canvas.toDataURL('image/png')
          console.log('✅ Imagen capturada para borrador')
          
          // Actualizar formData con la imagen
          if (onUpdateField) {
            onUpdateField('imageUrl', imageUrl)
          }
        } catch (captureError) {
          console.warn('⚠️ No se pudo capturar imagen para borrador:', captureError)
        }
      }
      
      // Verificar si la orden ya existe en la base de datos
      const existingOrders = getOrdersByNumber(formData.numeroOrden)
      
      if (existingOrders.length > 0) {
        // Actualizar borrador existente
        const existingOrder = existingOrders[0]
        updateOrder(existingOrder.id, {
          formData: formData,
          imageUrl: imageUrl || existingOrder.imageUrl,
          status: 'draft'
        })
        console.log('📝 Actualizando borrador existente, ID:', existingOrder.id)
        
        toast.success("Borrador actualizado", { 
          description: `Orden ${formData.numeroOrden} actualizada`,
          duration: 4000 
        })
      } else {
        // Crear nuevo borrador
        const orderId = addNewOrder(formData, 'draft', imageUrl)
        console.log('📝 Nuevo borrador creado, ID:', orderId)
        
        toast.success("Borrador guardado", { 
          description: `Orden ${formData.numeroOrden} guardada como borrador`,
          duration: 4000 
        })
      }
      
      console.log('✅ Borrador guardado exitosamente')
    } catch (error) {
      console.error('❌ Error al guardar borrador:', error)
      toast.error("Error al guardar", { 
        description: "No se pudo guardar el borrador. Intente nuevamente.",
        duration: 4000 
      })
    }
  }

  const proceedWithSubmit = async () => {
    // Cerrar el modal
    setShowConfirmationDialog(false)
    
    // 🔒 ACTIVAR LOCK
    const now = Date.now()
    setIsSubmitting(true)
    submissionTimestamp.current = now
    
    // 📊 RESET TRACKER
    submissionTracker.current = {
      orderId: null,
      googleFormsSent: false,
      odooSent: false,
      whatsappSent: false,
      imageCaptured: false,
      imageUploaded: false
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🚀 INICIANDO PROCESO DE ENVÍO DE ORDEN')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 Orden:', formData.numeroOrden)
    console.log('🌐 Estado de red:', isOnline ? 'ONLINE' : 'OFFLINE')
    console.log('⏰ Timestamp:', new Date().toISOString())
    
    try {
      // Verificar si se intenta reenviar sin cambios
      if (isFormUnchangedSinceSubmit()) {
        toast.warning("Formulario ya enviado", { 
          description: "Este formulario ya fue enviado. Modifique algún campo para volver a enviarlo.",
          duration: 4000
        })
        return
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 📍 PASO 1: GUARDAR EN BASE DE DATOS LOCAL
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('\n📍 PASO 1: Guardando en base de datos local...')
      toast.info("Paso 1/6: Base de datos", { description: "Registrando orden localmente" })
      
      let orderId: string
      try {
        orderId = addNewOrder(formData, 'completed')
        submissionTracker.current.orderId = orderId
        
        console.log('✅ PASO 1 COMPLETADO: Orden guardada en BD local')
        console.log('   ID:', orderId)
        console.log('   Número de orden:', formData.numeroOrden)
        
        toast.success("✅ Paso 1 completado", { 
          description: `Orden ${formData.numeroOrden || 'nueva'} registrada localmente`,
          duration: 2000
        })
      } catch (dbError) {
        console.error('❌ PASO 1 FALLIDO: Error guardando en BD local:', dbError)
        toast.warning("⚠️ Advertencia BD", { 
          description: "No se pudo guardar en BD local, continuando...",
          duration: 3000
        })
        orderId = `temp-${Date.now()}`
        submissionTracker.current.orderId = orderId
      }
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 📍 PASO 2: CAPTURAR IMAGEN DE LA ORDEN
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('\n📍 PASO 2: Capturando imagen de la orden...')
      toast.info("Paso 2/6: Captura de imagen", { description: "Generando imagen de la orden" })
      
      // PASO 2: Capturar imagen SIEMPRE (online u offline) - CRÍTICO PARA OFFLINE
      console.log('🚀 Capturando imagen de la orden...')
      toast.info("Capturando imagen...", { description: "Buscando formulario en pantalla" })
      
      console.log('🔍 Buscando contenedor del formulario...')
      console.log('   formRef:', formRef)
      console.log('   formRef?.current:', formRef?.current)
      
      // Intentar múltiples estrategias para encontrar el contenedor
      let formContainer: HTMLElement | null = formRef?.current || null
      
      if (!formContainer) {
        console.log('⚠️ formRef no disponible, buscando por selector .relative.mx-auto...')
        formContainer = document.querySelector('.relative.mx-auto') as HTMLElement | null
        console.log('   Resultado:', formContainer ? 'ENCONTRADO' : 'NULL')
      }
      
      if (!formContainer) {
        console.log('⚠️ Selector .relative.mx-auto no encontrado, buscando div con imagen...')
        // Buscar directamente el div que contiene la imagen del formulario
        const allDivs = document.querySelectorAll('div')
        console.log('   Total de divs en página:', allDivs.length)
        
        for (const div of allDivs) {
          const img = div.querySelector('img[src*="orden-servicio"]') || 
                     div.querySelector('img[src*="placeholder"]') ||
                     div.querySelector('img[alt*="Orden"]')
          if (img) {
            formContainer = div as HTMLElement
            console.log('✅ Encontrado div con imagen del formulario:', div)
            console.log('   Imagen src:', (img as HTMLImageElement).src)
            break
          }
        }
        
        if (!formContainer) {
          console.log('⚠️ No se encontró por imagen, buscando selectores alternativos...')
          formContainer = (document.querySelector('[class*="max-w"]') ||
                         document.querySelector('main > div > div') ||
                         document.querySelector('.card') ||
                         document.querySelector('main')) as HTMLElement | null
          console.log('   Resultado:', formContainer ? 'ENCONTRADO' : 'NULL')
        }
      }
      
      let imageBase64: string | null = null
      let imageUrl: string | null = null
      let captureSuccess = false
      
      if (formContainer) {
        console.log('✅ Contenedor del formulario encontrado:', formContainer)
        console.log('📐 Dimensiones del contenedor:', {
          width: formContainer.offsetWidth,
          height: formContainer.offsetHeight,
          className: formContainer.className,
          tagName: formContainer.tagName
        })
        
        toast.success("Contenedor encontrado", { 
          description: `${formContainer.offsetWidth}x${formContainer.offsetHeight}px`,
          duration: 2000
        })
        
        // Verificar que hay una imagen dentro
        const imgElement = formContainer.querySelector('img')
        console.log('🖼️ Buscando imagen dentro del contenedor...')
        console.log('   Resultado:', imgElement ? 'ENCONTRADA' : 'NULL')
        
        if (imgElement) {
          console.log('✅ Imagen encontrada:', imgElement)
          console.log('   src:', imgElement.src)
          console.log('   width:', imgElement.width, 'height:', imgElement.height)
          console.log('   naturalWidth:', imgElement.naturalWidth, 'naturalHeight:', imgElement.naturalHeight)
          console.log('   complete:', imgElement.complete)
          
          if (!imgElement.complete) {
            console.warn('⚠️ La imagen aún no se ha cargado completamente')
            toast.warning("Esperando imagen", {
              description: "La imagen del formulario se está cargando...",
              duration: 3000
            })
            // Esperar a que la imagen se cargue
            await new Promise((resolve) => {
              if (imgElement.complete) {
                resolve(true)
              } else {
                imgElement.onload = () => resolve(true)
                imgElement.onerror = () => resolve(false)
                setTimeout(() => resolve(false), 5000) // timeout de 5 segundos
              }
            })
          }
        } else {
          console.error('❌ NO SE ENCONTRÓ IMAGEN DENTRO DEL CONTENEDOR')
          console.error('   Contenedor:', formContainer)
          console.error('   innerHTML preview:', formContainer.innerHTML.substring(0, 200))
          
          toast.error("Error crítico", {
            description: "No se encontró la imagen del formulario. La orden se guardará sin imagen.",
            duration: 6000
          })
          // Continuar sin imagen
        }
        
        try {
          console.log('📸 Llamando a captureOrderToCanvas...')
          const captureResult = await captureOrderToCanvas(formContainer)
          console.log('📸 Resultado de captureOrderToCanvas:', captureResult ? 'SUCCESS' : 'NULL')
          
          if (captureResult) {
            const { blob, filename } = captureResult
            captureSuccess = true
            
            // SIEMPRE convertir a base64 para almacenamiento offline
            console.log('📝 Convirtiendo imagen a base64...')
            imageBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                const result = reader.result as string
                console.log('✅ Base64 generado, longitud:', result.length)
                console.log('   Primeros 100 caracteres:', result.substring(0, 100))
                resolve(result) // Incluye el prefijo data:image/png;base64,
              }
              reader.onerror = (error) => {
                console.error('❌ Error leyendo blob como base64:', error)
                reject(error)
              }
              reader.readAsDataURL(blob)
            })
            
            // 📊 MARCAR PASO 2 COMO COMPLETADO
            submissionTracker.current.imageCaptured = true
            console.log('✅ PASO 2 COMPLETADO: Imagen capturada exitosamente')
            console.log('   Formato:', imageUrl ? 'URL pública (ImgBB)' : 'Base64 local')
            console.log('   Tamaño:', imageBase64.length, 'caracteres')
            
            toast.success("✅ Paso 2 completado", { 
              description: "Imagen capturada y lista para compartir",
              duration: 2000
            })
            
            // Guardar imagen localmente (descarga automática)
            console.log('💾 Descargando imagen localmente...')
            const localUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = localUrl
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(localUrl)
            console.log('✅ Imagen descargada:', filename)
            
            toast.success("Imagen capturada", { 
              description: "Orden guardada localmente" 
            })

            // PASO 3: Si hay conexión, intentar subir a ImgBB
            if (isOnline) {
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // 📍 PASO 3: SUBIR IMAGEN A IMGBB
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              console.log('\n📍 PASO 3: Subiendo imagen a ImgBB...')
              toast.info("Paso 3/6: Subida de imagen", { description: "Obteniendo URL pública" })
              
              try {
                console.log('☁️ Conexión disponible - Subiendo a ImgBB...')
                toast.info("Subiendo imagen...", { description: "Obteniendo URL para compartir" })
                
                const base64Data = imageBase64.split(',')[1]
                const uploadResult = await uploadImageToImgBB(base64Data, filename.replace('.png', ''))
                imageUrl = uploadResult.data.url
                
                // 📊 MARCAR PASO 3 COMO COMPLETADO
                submissionTracker.current.imageUploaded = true
                
                console.log('✅ PASO 3 COMPLETADO: Imagen subida a ImgBB')
                console.log('   URL pública:', imageUrl)
                
                toast.success("✅ Paso 3 completado", { 
                  description: "Imagen disponible para compartir",
                  duration: 2000
                })
                
              } catch (uploadError) {
                console.error('❌ PASO 3 FALLIDO: Error subiendo a ImgBB:', uploadError)
                toast.info("⚠️ Paso 3 omitido", {
                  description: "Se usará imagen local. Se reintentará automáticamente.",
                  duration: 3000
                })
              }
            } else {
              console.log('📱 PASO 3 OMITIDO: Modo offline - Imagen guardada como base64')
              toast.info("⏭️ Paso 3 omitido (offline)", {
                description: "La imagen se subirá cuando haya conexión",
                duration: 2000
              })
            }
          } else {
            console.error('❌ captureOrderToCanvas retornó null')
            toast.error("Error en captura", {
              description: "La función de captura no retornó resultado",
              duration: 5000
            })
          }
          
        } catch (captureError) {
          console.error('❌ Error en captura de imagen:', captureError)
          console.error('   Tipo:', captureError instanceof Error ? captureError.constructor.name : typeof captureError)
          console.error('   Mensaje:', captureError instanceof Error ? captureError.message : String(captureError))
          console.error('   Stack:', captureError instanceof Error ? captureError.stack : 'N/A')
          
          toast.error("Error en captura", { 
            description: captureError instanceof Error ? captureError.message : "No se pudo capturar la imagen",
            duration: 6000
          })
        }
      } else {
        console.error('❌ No se encontró el contenedor del formulario después de múltiples intentos')
        console.error('   Selectores intentados:')
        console.error('   - formRef?.current')
        console.error('   - .relative.mx-auto')
        console.error('   - [class*="max-w"]')
        console.error('   - main > div > div')
        console.error('   - .card')
        
        toast.error("Error crítico", {
          description: "No se pudo encontrar el formulario para capturar. El formulario debe estar visible en pantalla.",
          duration: 6000
        })
      }
      
      // VERIFICACIÓN FINAL: ¿Tenemos imagen para offline?
      if (!isOnline && !imageBase64) {
        console.error('🚨 PROBLEMA CRÍTICO: Modo offline sin imagen capturada')
        console.error('   isOnline:', isOnline)
        console.error('   captureSuccess:', captureSuccess)
        console.error('   imageBase64:', imageBase64 ? 'EXISTS' : 'NULL')
        
        toast.error("Advertencia offline", {
          description: "No se pudo capturar la imagen. La orden se guardará sin imagen adjunta.",
          duration: 7000
        })
      } else if (!isOnline && imageBase64) {
        console.log('✅ Modo offline con imagen capturada correctamente')
        console.log('   imageBase64 length:', imageBase64.length)
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 📍 PASO 4: ACTUALIZAR CAMPO AUX1 Y VALIDAR
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('\n📍 PASO 4: Actualizando datos y validando...')
      toast.info("Paso 4/6: Validación", { description: "Verificando datos del formulario" })
      
      // PASO 4A: Actualizar campo AUX1 con URL de ImgBB O base64
      // Prioridad: URL de ImgBB > base64 > null
      const aux1Value = imageUrl || imageBase64
      
      // 🚀 CRÍTICO: Crear una copia del formData con aux1 actualizado
      // para usar en los envíos (Google Forms y Odoo)
      // React NO garantiza que el estado se actualice de forma síncrona,
      // así que usamos una variable local inmediata
      const formDataWithImage: AranFormData = {
        ...formData,
        aux1: aux1Value || formData.aux1, // Usar nueva imagen o mantener la existente
        aux3: formData.aux3 // Asegurar que el teléfono del técnico se incluya
      }
      
      // 🔍 DEBUG CRÍTICO: Verificar teléfono del técnico
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔍 VERIFICACIÓN DE TELÉFONO DEL TÉCNICO')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📋 formData.aux3:', formData.aux3)
      console.log('📋 formDataWithImage.aux3:', formDataWithImage.aux3)
      console.log('👨‍🔧 formData.tecnicoNombre:', formData.tecnicoNombre)
      console.log('📱 formData.telefono (cliente):', formData.telefono)
      console.log('🔢 Tipo de aux3:', typeof formData.aux3)
      console.log('📏 Longitud de aux3:', formData.aux3?.length || 0)
      console.log('❓ ¿aux3 está vacío?:', !formData.aux3)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      if (aux1Value) {
        console.log('📝 Actualizando campo AUX1:', imageUrl ? 'URL de ImgBB' : 'base64')
        console.log('📋 AUX1 valor:', aux1Value.substring(0, 80))
        
        // Actualizar el estado React (para la UI), pero NO esperar por él
        onUpdateField('aux1', aux1Value)
        
        console.log('✅ AUX1 preparado para envío:', aux1Value.substring(0, 80))
      } else {
        console.warn('⚠️ No se obtuvo imagen para AUX1')
      }

      // PASO 4B: Validar formulario antes de enviar
      // Usar formDataWithImage que tiene aux1 actualizado
      console.log('📋 FormData FINAL para validación y envío:', {
        aux1: formDataWithImage.aux1?.substring(0, 80),
        numeroOrden: formDataWithImage.numeroOrden,
        fecha: formDataWithImage.fecha,
        aux1Length: formDataWithImage.aux1?.length || 0
      })
      
      toast.info("Validando formulario...", { description: "Verificando datos antes del envío" })
      const validation = validateRequiredFields(formDataWithImage)
      
      if (!validation.isValid) {
        // Activar modo prominente de validación
        if (onShowValidationProminent) {
          onShowValidationProminent()
        }
        
        const missingFieldsCount = validation.missingFields.length
        const errorList = Object.values(validation.errors).slice(0, 3) // Mostrar solo los primeros 3
        
        // Mostrar confirmación inmediata para continuar con campos faltantes
        const shouldProceed = confirm(
          `⚠️ CAMPOS OBLIGATORIOS FALTANTES\n\nFaltan ${missingFieldsCount} campos obligatorios:\n\n• ${errorList.join('\n• ')}${missingFieldsCount > 3 ? '\n• Y más campos...' : ''}\n\n¿Desea continuar con el envío a pesar de los campos faltantes?\n\n⚠️ RECOMENDACIÓN: Complete los campos para un envío óptimo.`
        )
        
        if (!shouldProceed) {
          // Usuario canceló - mostrar información y salir
          toast.warning("Envío cancelado", { 
            description: "Complete los campos obligatorios y vuelva a intentar.",
            duration: 4000
          })
          
          // Hacer scroll hacia el panel de validación
          setTimeout(() => {
            const validationPanel = document.querySelector('.validation-status')
            if (validationPanel) {
              validationPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              })
              
              // Añadir efecto de highlight temporal
              validationPanel.classList.add('ring-2', 'ring-orange-400', 'ring-opacity-75')
              setTimeout(() => {
                validationPanel.classList.remove('ring-2', 'ring-orange-400', 'ring-opacity-75')
              }, 3000)
            }
          }, 500)
          
          return // Salir sin continuar el envío
        }
        
        // Si llega aquí, el usuario decidió continuar con campos faltantes
        console.log('✅ PASO 4 COMPLETADO CON ADVERTENCIAS: Usuario aceptó continuar con campos faltantes')
        toast.warning("⚠️ Paso 4: Validación parcial", { 
          description: `Continuando con ${missingFieldsCount} campos faltantes`,
          duration: 3000
        })
        
      } else {
        console.log('✅ PASO 4 COMPLETADO: Validación exitosa')
        toast.success("✅ Paso 4 completado", {
          description: "Todos los campos obligatorios completos",
          duration: 2000
        })
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 📍 PASO 5: ENVIAR A GOOGLE FORMS
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('\n📍 PASO 5: Enviando a Google Forms...')
      toast.info("Paso 5/6: Google Forms", { description: "Registrando orden en Google" })
      
      // PASO 6: Enviar a Google Forms (con manejo offline)
      console.log('📤 Preparando envío a Google Forms...')
      
      // 🔒 GUARD: Verificar que no se haya enviado ya en esta sesión
      if (submissionTracker.current.googleFormsSent) {
        console.warn('⚠️ GUARD: Google Forms ya enviado en esta sesión, omitiendo...')
        toast.info("⏭️ Google Forms ya enviado", { 
          description: "Ya se envió a Google Forms, continuando...",
          duration: 2000
        })
      } else if (!isOnline) {
        // SIN CONEXIÓN: Guardar en cola offline CON IMAGEN
        console.log('📱 Modo offline - Guardando en cola para envío posterior')
        console.log('   imageBase64:', imageBase64 ? `EXISTS (${imageBase64.length} chars)` : 'NULL')
        toast.info("Modo offline", { description: "Guardando en cola de sincronización" })
        
        try {
          console.log('💾 Guardando formData con imagen en cola offline:')
          console.log('   aux1 length:', formDataWithImage.aux1?.length || 0)
          console.log('   numeroOrden:', formDataWithImage.numeroOrden)
          
          await addPendingSubmission(formDataWithImage)
          
          console.log('✅ PASO 5 COMPLETADO (MODO OFFLINE): Orden guardada en cola')
          toast.success("✅ Paso 5 completado (offline)", { 
            description: "Se enviará automáticamente cuando haya conexión",
            duration: 3000
          })
          
          // NO marcar como enviado completamente, sino como pendiente
          setHasBeenSubmitted(false) // Permitir reenvío cuando haya conexión
          lastSubmittedData.current = null
          
          // Actualizar BD local como PENDIENTE OFFLINE
          try {
            updateOrder(orderId, { 
              status: 'pending-offline',
              imageUrl: imageBase64 || undefined 
            })
            console.log('🗃️ Estado actualizado en BD local: pending-offline')
            console.log('   imageUrl guardada:', imageBase64 ? 'SÍ' : 'NO')
          } catch (dbError) {
            console.error('❌ Error actualizando BD local:', dbError)
          }
          
        } catch (offlineError) {
          console.error('❌ Error guardando en cola offline:', offlineError)
          console.error('   Detalles:', offlineError instanceof Error ? offlineError.message : String(offlineError))
          toast.error("Error crítico", {
            description: "No se pudo guardar la orden",
            duration: 6000
          })
          return // Salir si falla el guardado offline
        }
        
      } else {
        // CON CONEXIÓN: Intentar envío inmediato
        console.log('☁️ Modo online - Intentando envío inmediato')
        console.log('📋 Enviando formData con aux1:', formDataWithImage.aux1?.substring(0, 80))
        toast.info("Enviando formulario...", { description: "Transmitiendo a Google Forms" })
        
        try {
          const result = await submitFormToGoogle(formDataWithImage)
          
          if (result.success) {
            // 📊 MARCAR PASO 5 COMO COMPLETADO
            submissionTracker.current.googleFormsSent = true
            
            console.log('✅ PASO 5 COMPLETADO: Formulario enviado a Google Forms')
            
            // Sincronizar con Odoo FSM (si está configurado)
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 📍 PASO 5B: SINCRONIZAR CON ODOO (OPCIONAL)
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 🔒 GUARD: Verificar que no se haya enviado ya en esta sesión
            if (submissionTracker.current.odooSent) {
              console.warn('⚠️ GUARD: Odoo ya sincronizado en esta sesión, omitiendo...')
            } else {
              console.log('\n📍 PASO 5B (OPCIONAL): Sincronizando con Odoo...')
              
              try {
                const { isOdooConfigured } = await import('@/lib/odoo-client')
                const { syncServiceOrderToOdoo } = await import('@/lib/odoo-service')
                
                const odooConfigured = isOdooConfigured()
                console.log(`🔍 Verificando configuración de Odoo: ${odooConfigured}`)
                
                if (odooConfigured) {
                  console.log('🔄 Sincronizando con Odoo FSM')
                  console.log('📋 Datos para Odoo con aux1:', formDataWithImage.aux1?.substring(0, 80))
                  const odooResult = await syncServiceOrderToOdoo(formDataWithImage)
                  
                  if (odooResult.success) {
                    // 📊 MARCAR ODOO COMO COMPLETADO
                    submissionTracker.current.odooSent = true
                    
                    // 📊 Actualizar BD local
                    try {
                      updateOrder(orderId, { odooSent: true })
                      updateOrderStatus(orderId)
                      console.log('🗃️ Odoo marcado como enviado en BD local')
                    } catch (dbError) {
                      console.error('❌ Error actualizando BD local:', dbError)
                    }
                    
                    console.log(`✅ PASO 5B COMPLETADO: Orden sincronizada con Odoo FSM: ID ${odooResult.orderId}`)
                    toast.success("✅ Sincronizado con Odoo", {
                      description: `Orden registrada en Odoo (ID: ${odooResult.orderId})`,
                      duration: 3000
                    })
                  } else {
                    console.warn(`⚠️ PASO 5B FALLIDO: Error sincronizando con Odoo:`, odooResult.error)
                    toast.warning("⚠️ Odoo no disponible", {
                      description: "La orden se guardó en Google Forms correctamente",
                      duration: 3000
                    })
                  }
                } else {
                  console.log('ℹ️ PASO 5B OMITIDO: Odoo no configurado')
                }
              } catch (odooError) {
                console.warn('⚠️ PASO 5B FALLIDO: Error en sincronización con Odoo:', odooError)
                toast.info("⚠️ Odoo no disponible", {
                  description: "La orden se guardó en Google Forms correctamente",
                  duration: 2000
                })
              }
            }
            
            toast.success("✅ Paso 5 completado", { 
              description: "Orden registrada en Google Forms",
              duration: 2000
            })
            
            // Marcar como enviado
            setHasBeenSubmitted(true)
            lastSubmittedData.current = { ...formData }
            
            // 📊 Actualizar BD local con flags granulares
            try {
              updateOrder(orderId, { 
                googleFormsSent: true,
                sentAt: new Date(),
                imageUrl: imageUrl || imageBase64 || undefined
              })
              // Recalcular estado basado en flags
              updateOrderStatus(orderId)
              console.log('🗃️ Google Forms marcado como enviado en BD local')
            } catch (dbError) {
              console.error('❌ Error actualizando BD local:', dbError)
            }
            
          } else {
            throw new Error(result.error || 'Error desconocido en envío')
          }
          
        } catch (sendError) {
          // Error en envío online - guardar en cola offline como respaldo
          console.error('❌ Error en envío online, guardando offline:', sendError)
          
          try {
            await addPendingSubmission(formData)
            toast.warning("Error en envío directo", { 
              description: "Guardado en cola para reintento automático",
              duration: 5000 
            })
            
            // NO marcar como enviado completamente
            setHasBeenSubmitted(false)
            lastSubmittedData.current = null
            
            // Actualizar BD local como PENDIENTE OFFLINE
            try {
              updateOrder(orderId, { 
                status: 'pending-offline',
                imageUrl: imageBase64 || undefined 
              })
              console.log('🗃️ Estado actualizado en BD local: pending-offline (reintento)')
            } catch (dbError) {
              console.error('❌ Error actualizando BD local:', dbError)
            }
            
          } catch (offlineError) {
            console.error('❌ Error guardando en cola offline:', offlineError)
            toast.error("Error crítico", {
              description: "No se pudo enviar ni guardar para reintento",
              duration: 6000
            })
            return // Salir si falla todo
          }
        }
      }
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 📍 PASO 6: ENVIAR POR WHATSAPP (OPCIONAL)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('\n📍 PASO 6: Enviando por WhatsApp...')
      
      // PASO 7: Enviar por WhatsApp si hay número de teléfono y imagen URL de ImgBB
      // (No se envía si solo tenemos base64, ya que WhatsApp necesita URL pública)
      // 🔒 GUARD: Verificar que no se haya enviado ya en esta sesión
      if (submissionTracker.current.whatsappSent) {
        console.warn('⚠️ GUARD: WhatsApp ya enviado en esta sesión, omitiendo...')
        toast.info("⏭️ WhatsApp ya enviado", { 
          description: "Ya se envió por WhatsApp, omitiendo...",
          duration: 2000
        })
      } else if (formData.telefono && imageUrl && imageUrl.startsWith('http')) {
        toast.info("Paso 6/6: WhatsApp", { description: "Compartiendo orden por WhatsApp" })
        // Verificar si esta orden ya fue enviada por WhatsApp anteriormente
        // y si tiene CAMBIOS respecto a la versión anterior
        const existingOrders = getOrdersByNumber(formData.numeroOrden || '')
        const previousSentOrder = existingOrders.find(order => 
          order.id !== orderId && // Excluir la orden actual
          order.status === 'sent' && 
          order.googleFormsSent === true &&
          order.imageUrl // Indica que ya se envió con imagen
        )
        
        // Comparar si hay cambios entre la orden anterior y la actual
        let hasChanges = true
        if (previousSentOrder) {
          // Comparar los datos del formulario
          const previousData = JSON.stringify(previousSentOrder.formData)
          const currentData = JSON.stringify(formData)
          hasChanges = previousData !== currentData
          
          console.log('🔍 Verificando cambios en orden:', {
            ordenIdAnterior: previousSentOrder.id,
            ordenIdActual: orderId,
            hasChanges,
            numeroOrden: formData.numeroOrden
          })
        }
        
        if (previousSentOrder && !hasChanges) {
          // Hay una orden anterior SIN cambios - mostrar advertencia pero NO bloquear
          const sentDate = previousSentOrder.sentAt ? new Date(previousSentOrder.sentAt) : null
          const dateStr = sentDate && !isNaN(sentDate.getTime()) 
            ? sentDate.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : 'fecha anterior'
            
          console.log('⚠️ WhatsApp: Orden sin cambios, pero permitiendo reenvío', {
            ordenIdAnterior: previousSentOrder.id,
            sentAt: dateStr,
            numeroOrden: formData.numeroOrden
          })
          
          toast.warning("Reenvío de orden sin cambios", { 
            description: `Esta orden ya fue enviada el ${dateStr}. Enviando nuevamente...`,
            duration: 3000
          })
        } else if (previousSentOrder && hasChanges) {
          // Hay cambios - informar que se está reenviando versión actualizada
          console.log('✅ WhatsApp: Enviando versión actualizada de la orden')
          toast.info("Enviando versión actualizada", { 
            description: "Se detectaron cambios. Enviando orden actualizada por WhatsApp" 
          })
        } else {
          // Primera vez que se envía
          toast.info("Enviando por WhatsApp...", { description: "Compartiendo orden de servicio" })
        }
        
        // Intentar enviar por WhatsApp
        try {
          // � DEBUG: Verificar datos antes de enviar
          console.log('🔍 DEBUG - Datos para envío de WhatsApp:')
          console.log('  📱 Teléfono cliente (formData.telefono):', formData.telefono)
          console.log('  👨‍🔧 Teléfono técnico (formData.aux3):', formData.aux3)
          console.log('  👨‍🔧 Teléfono técnico (formDataWithImage.aux3):', formDataWithImage.aux3)
          console.log('  🖼️ Image URL:', imageUrl?.substring(0, 50))
          
          // 📱 Enviar al CLIENTE
          console.log('\n📱 === ENVIANDO AL CLIENTE ===')
          console.log('  Número destino:', formData.telefono)
          const whatsappResult = await sendServiceOrderToWhatsApp(
            formData.telefono,
            formData,
            imageUrl
          )
          
          if (whatsappResult.success) {
            // 📊 MARCAR PASO 6 COMO COMPLETADO
            submissionTracker.current.whatsappSent = true
            
            // 📊 Actualizar BD local - Cliente
            try {
              updateOrder(orderId, { whatsappClientSent: true })
              updateOrderStatus(orderId)
              console.log('🗃️ WhatsApp cliente marcado como enviado en BD local')
            } catch (dbError) {
              console.error('❌ Error actualizando BD local:', dbError)
            }
            
            console.log('✅ Enviado al cliente exitosamente')
            
            // 👨‍🔧 Enviar también al TÉCNICO si tiene teléfono (guardado en aux3)
            console.log('\n🔍 DEBUG - Verificando teléfono del técnico:')
            console.log('  formData.aux3:', formData.aux3)
            console.log('  formDataWithImage.aux3:', formDataWithImage.aux3)
            console.log('  ¿Tiene teléfono técnico?', !!formDataWithImage.aux3)
            
            if (formDataWithImage.aux3) {
              console.log('\n👨‍🔧 === ENVIANDO AL TÉCNICO ===')
              console.log('  Número destino:', formDataWithImage.aux3)
              console.log('  ¿Es diferente al cliente?', formDataWithImage.aux3 !== formData.telefono)
              
              try {
                const tecnicoWhatsappResult = await sendServiceOrderToWhatsApp(
                  formDataWithImage.aux3,
                  formData,
                  imageUrl
                )
                
                if (tecnicoWhatsappResult.success) {
                  // 📊 Actualizar BD local - Técnico
                  try {
                    updateOrder(orderId, { whatsappTechSent: true })
                    updateOrderStatus(orderId)
                    console.log('🗃️ WhatsApp técnico marcado como enviado en BD local')
                  } catch (dbError) {
                    console.error('❌ Error actualizando BD local:', dbError)
                  }
                  
                  console.log('✅ Enviado al técnico exitosamente')
                  toast.success("✅ Paso 6 completado", { 
                    description: "Orden compartida con cliente y técnico",
                    duration: 2000
                  })
                } else {
                  console.warn('⚠️ Falló envío al técnico:', tecnicoWhatsappResult.error)
                  console.log('  Número que falló:', formDataWithImage.aux3)
                  toast.success("✅ Paso 6 parcial", { 
                    description: "Enviado al cliente. Fallo al enviar al técnico.",
                    duration: 3000
                  })
                }
              } catch (tecnicoError) {
                console.warn('⚠️ Error enviando al técnico:', tecnicoError)
                toast.success("✅ Paso 6 parcial", { 
                  description: "Enviado al cliente. Fallo al enviar al técnico.",
                  duration: 3000
                })
              }
            } else {
              console.log('\n⚠️ NO SE ENVIÓ AL TÉCNICO')
              console.log('  Razón: formDataWithImage.aux3 está vacío o undefined')
              console.log('  formData.aux3:', formData.aux3)
              console.log('  formDataWithImage.aux3:', formDataWithImage.aux3)
              console.log('  Tipo de formData.aux3:', typeof formData.aux3)
              console.log('  Tipo de formDataWithImage.aux3:', typeof formDataWithImage.aux3)
              
              toast.success("✅ Paso 6 completado", { 
                description: "Orden compartida con cliente",
                duration: 2000
              })
            }
          } else {
            console.warn('⚠️ PASO 6 FALLIDO: WhatsApp falló:', whatsappResult.error)
            toast.warning("⚠️ Paso 6 falló", { 
              description: "WhatsApp no disponible. La orden se guardó correctamente.",
              duration: 3000
            })
          }
        } catch (whatsappError) {
          console.error('❌ PASO 6 FALLIDO: Error en WhatsApp:', whatsappError)
          toast.warning("⚠️ Paso 6 falló", { 
            description: "WhatsApp no disponible. La orden se guardó correctamente.",
            duration: 3000
          })
        }
      } else {
        console.log('ℹ️ PASO 6 OMITIDO: No se cumplen requisitos para WhatsApp:', {
          hasTelefono: !!formData.telefono,
          hasImageUrl: !!imageUrl,
          isValidUrl: imageUrl?.startsWith('http')
        })
        toast.info("⏭️ Paso 6 omitido", {
          description: "WhatsApp requiere teléfono e imagen pública",
          duration: 2000
        })
      }
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🎉 PROCESO COMPLETADO
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🎉 PROCESO COMPLETADO EXITOSAMENTE')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📊 RESUMEN DE ENVÍOS:')
      console.log('   ✅ BD Local:', submissionTracker.current.orderId ? 'GUARDADO' : 'FALLÓ')
      console.log('   ✅ Imagen capturada:', submissionTracker.current.imageCaptured ? 'SÍ' : 'NO')
      console.log('   ✅ Imagen subida:', submissionTracker.current.imageUploaded ? 'SÍ (ImgBB)' : 'NO (Local)')
      console.log('   ✅ Google Forms:', submissionTracker.current.googleFormsSent ? 'ENVIADO' : 'PENDIENTE')
      console.log('   ✅ Odoo FSM:', submissionTracker.current.odooSent ? 'SINCRONIZADO' : 'NO CONFIGURADO/FALLÓ')
      console.log('   ✅ WhatsApp:', submissionTracker.current.whatsappSent ? 'ENVIADO' : 'OMITIDO/FALLÓ')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      console.log('✅ Proceso completado exitosamente')
      toast.success("🎉 ¡Proceso completado!", { 
        description: "Orden guardada y enviada correctamente",
        duration: 4000
      })
      
      // Ocultar la validación prominente después del envío exitoso
      if (onHideValidationProminent) {
        onHideValidationProminent()
      }
      
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('❌ ERROR CRÍTICO EN PROCESO DE ENVÍO')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('Error:', error)
      console.error('Tipo:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('Mensaje:', error instanceof Error ? error.message : String(error))
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast.error("❌ Error en el proceso", { 
        description: `${errorMessage}. Verifique los datos guardados localmente.`,
        duration: 6000
      })
    } finally {
      // 🔓 LIBERAR LOCK SIEMPRE
      setIsSubmitting(false)
      console.log('🔓 Lock liberado - Proceso finalizado')
    }
  }

  // Función auxiliar para capturar orden usando canvas nativo
  const captureOrderToCanvas = async (formContainer: HTMLElement): Promise<{blob: Blob, filename: string} | null> => {
    try {
      console.log('🎨 Iniciando captura con canvas nativo...')
      toast.info("Capturando imagen...", { description: "Procesando orden de servicio" })

      // Crear canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        throw new Error('No se pudo crear contexto de canvas')
      }

      // Configurar canvas de alta resolución
      const scale = 2
      canvas.width = 850 * scale
      canvas.height = 1200 * scale
      ctx.scale(scale, scale)

      // Fondo blanco
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 850, 1200)

      // 🎯 USAR IMAGEN CACHEADA (no cargar desde red)
      console.log('🔍 Verificando imagen de fondo cacheada...')
      
      if (!cachedBackgroundImage) {
        console.error('❌ Imagen de fondo no está cacheada, intentando cargar...')
        // Intentar cargar de emergencia (solo funcionará si hay conexión)
        const originalImage = formContainer.querySelector('img') as HTMLImageElement
        if (!originalImage) {
          throw new Error('No se encontró la imagen del formulario y no hay caché disponible')
        }
        
        const bgImage = new Image()
        bgImage.crossOrigin = 'anonymous'
        
        await new Promise((resolve, reject) => {
          bgImage.onload = () => {
            cachedBackgroundImage = bgImage
            console.log('✅ Imagen cargada de emergencia')
            resolve(true)
          }
          bgImage.onerror = (err) => {
            console.error('❌ Error cargando imagen de emergencia:', err)
            reject(err)
          }
          bgImage.src = originalImage.src
        })
      } else {
        console.log('✅ Usando imagen de fondo cacheada (offline-safe)')
        console.log('   Dimensiones:', cachedBackgroundImage.width, 'x', cachedBackgroundImage.height)
      }

      // Dibujar imagen de fondo desde caché
      if (!cachedBackgroundImage) {
        throw new Error('No hay imagen de fondo disponible')
      }
      
      console.log('🖌️ Dibujando imagen de fondo en canvas...')
      ctx.drawImage(cachedBackgroundImage, 0, 0, 850, 1200)
      console.log('✅ Imagen de fondo dibujada desde caché')

      // Definir posiciones de campos
      const fieldPositions = {
        numeroOrden: { x: 600, y: 70, width: 150, height: 30 },
        fecha: { x: 650, y: 127, width: 100, height: 30 },
        razonSocial: { x: 185, y: 190, width: 220, height: 21 },
        cuit: { x: 540, y: 190, width: 220, height: 21 },
        contacto: { x: 185, y: 214, width: 200, height: 21 },
        telefono: { x: 540, y: 214, width: 220, height: 21 },
        maquina: { x: 135, y: 332, width: 280, height: 21 },
        equipo: { x: 485, y: 332, width: 280, height: 21 },
        descripcion: { x: 65, y: 360, width: 700, height: 270 },
        insumos: { x: 58, y: 685, width: 719, height: 240 },
        localidad: { x: 470, y: 920, width: 135, height: 21 },
        provincia: { x: 594, y: 920, width: 60, height: 21 },
        distancia: { x: 470, y: 943, width: 150, height: 21 },
        duracion: { x: 470, y: 966, width: 150, height: 21 },
        tipoCambio: { x: 660, y: 990, width: 100, height: 21 },
        iva: { x: 660, y: 1014, width: 70, height: 21 },
        total: { x: 660, y: 1038, width: 70, height: 21 },
        tecnicoNombre: { x: 250, y: 1100, width: 160, height: 21 },
        clienteNombre: { x: 607, y: 1100, width: 160, height: 21 }
      }

      const checkboxPositions = {
        servicioTecnico: { x: 110, y: 285, width: 20, height: 20 },
        instalacion: { x: 230, y: 285, width: 20, height: 20 },
        puestaEnMarcha: { x: 348, y: 285, width: 20, height: 20 },
        capacitacion: { x: 467, y: 285, width: 20, height: 20 },
        calibracion: { x: 586, y: 285, width: 20, height: 20 },
        tercero: { x: 705, y: 285, width: 20, height: 20 },
        servicioACampo: { x: 111, y: 945, width: 20, height: 20 },
        servicioEnOficina: { x: 230, y: 945, width: 20, height: 20 },
        conCargo: { x: 111, y: 990, width: 20, height: 20 },
        sinCargo: { x: 230, y: 990, width: 20, height: 20 },
        servicioEnGarantia: { x: 111, y: 1037, width: 20, height: 20 },
        aConvenir: { x: 230, y: 1037, width: 20, height: 20 }
      }

      const signaturePositions = {
        tecnicoFirma: { x: 65, y: 1078, width: 150, height: 50 },
        clienteFirma: { x: 425, y: 1078, width: 150, height: 50 }
      }

      // Dibujar campos de texto
      Object.entries(fieldPositions).forEach(([fieldName, pos]) => {
        const value = formData[fieldName as keyof typeof formData]
        if (value && value.toString().trim() !== '') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
          
          ctx.strokeStyle = '#cccccc'
          ctx.lineWidth = 1
          ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
          
          ctx.fillStyle = '#000000'
          ctx.font = 'bold 11px Arial'
          
          let displayValue = value.toString()
          
          if (fieldName === 'insumos') {
            // Renderizar tabla de insumos
            const renderInsumosTable = () => {
              if (!displayValue || displayValue.trim() === '') return
              
              // Parsear datos: "cantidad;serie;codigo;articulo;precio|..."
              const rows = displayValue.split('|').filter(row => row.trim() !== '')
              if (rows.length === 0) return
              
              // Definir columnas y anchos (proporciones: 1fr 2.6fr 2.6fr 4fr 2fr, width=719px)
              const columnWidths = [59, 153, 153, 236, 118] // Cantidad, Serie, Código, Artículo, Precio
              const rowHeight = 16
              const startX = pos.x + 4
              let currentY = pos.y + 8
              
              // Configurar fuente para tabla
              ctx.font = '10px Arial'
              ctx.fillStyle = '#000000'
              
              // Renderizar cada fila
              rows.forEach((row, index) => {
                if (currentY > pos.y + pos.height - 20) return // No exceder área
                
                const cells = row.split(';')
                let currentX = startX
                
                // Renderizar cada celda
                cells.forEach((cell, cellIndex) => {
                  if (cellIndex < columnWidths.length) {
                    const cellWidth = columnWidths[cellIndex]
                    let cellText = cell.trim()
                    
                    // Formatear precio (última columna)
                    if (cellIndex === 4 && cellText && !isNaN(parseFloat(cellText))) {
                      const num = parseFloat(cellText)
                      cellText = new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        minimumFractionDigits: 0
                      }).format(num)
                    }
                    
                    // Truncar texto si es muy largo (ajustado a anchos reales)
                    const maxChars = cellIndex === 0 ? 6 :      // Cantidad (59px) 
                                   cellIndex === 1 ? 16 :      // Serie (153px)
                                   cellIndex === 2 ? 16 :      // Código (153px) 
                                   cellIndex === 3 ? 30 :      // Artículo (236px)
                                   cellIndex === 4 ? 12 : 8    // Precio (118px)
                    if (cellText.length > maxChars) {
                      cellText = cellText.substring(0, maxChars - 2) + '..'
                    }
                    
                    // Alinear texto según la columna (coincide con tabla HTML)
                    let textX = currentX + 2
                    if (cellIndex === 0) {
                      // Cantidad: Izquierda (text-left)
                      ctx.textAlign = 'left'
                      textX = currentX + 4
                    } else if (cellIndex === 1 || cellIndex === 2) {
                      // Serie y Código: Derecha (text-right)
                      ctx.textAlign = 'right'
                      textX = currentX + cellWidth - 4
                    } else if (cellIndex === 3) {
                      // Artículo: Izquierda (text-left)
                      ctx.textAlign = 'left'
                      textX = currentX + 4
                    } else if (cellIndex === 4) {
                      // Precio: Derecha (text-right)
                      ctx.textAlign = 'right'
                      textX = currentX + cellWidth - 4
                    }
                    
                    ctx.fillText(cellText, textX, currentY)
                    currentX += cellWidth
                  }
                })
                
                currentY += rowHeight
              })
              
              // Calcular y mostrar subtotal si hay datos
              if (rows.length > 0) {
                let total = 0
                rows.forEach(row => {
                  const cells = row.split(';')
                  if (cells.length >= 5) {
                    const precio = parseFloat(cells[4])
                    const cantidad = parseFloat(cells[0])
                    if (!isNaN(precio) && !isNaN(cantidad)) {
                      total += precio * cantidad
                    }
                  }
                })
                
                if (total > 0) {
                  currentY += 4
                  ctx.font = 'bold 10px Arial'
                  ctx.textAlign = 'right'
                  const subtotalText = 'Subtotal: ' + new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    minimumFractionDigits: 0
                  }).format(total)
                  ctx.fillText(subtotalText, pos.x + pos.width - 10, currentY)
                }
              }
              
              // Restaurar configuración de texto
              ctx.textAlign = 'left'
              ctx.font = 'bold 11px Arial'
            }
            
            renderInsumosTable()
            
          } else if (fieldName === 'descripcion') {
            const words = displayValue.split(' ')
            const maxWidth = pos.width - 8
            let line = ''
            let yPos = pos.y + 15
            
            for (let word of words) {
              const testLine = line + word + ' '
              const metrics = ctx.measureText(testLine)
              
              if (metrics.width > maxWidth && line !== '') {
                ctx.fillText(line.trim(), pos.x + 4, yPos)
                line = word + ' '
                yPos += 14
                if (yPos > pos.y + pos.height - 5) break
              } else {
                line = testLine
              }
            }
            if (line.trim() !== '') {
              ctx.fillText(line.trim(), pos.x + 4, yPos)
            }
          } else {
            // Para la fecha, aplicar formato DD-MM-YYYY para visualización
            if (fieldName === 'fecha') {
              displayValue = formatDateForDisplay(displayValue)
            }
            ctx.fillText(displayValue, pos.x + 4, pos.y + 15)
          }
        }
      })

      // Dibujar checkboxes
      Object.entries(checkboxPositions).forEach(([fieldName, pos]) => {
        const value = formData[fieldName as keyof typeof formData]
        if (value === true) {
          ctx.fillStyle = '#3b82f6'
          ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
          
          ctx.strokeStyle = '#1e40af'
          ctx.lineWidth = 2
          ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
          
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(pos.x + 4, pos.y + pos.height/2)
          ctx.lineTo(pos.x + pos.width/2, pos.y + pos.height - 4)
          ctx.lineTo(pos.x + pos.width - 4, pos.y + 4)
          ctx.stroke()
        }
      })

      // Dibujar firmas
      const drawSignatures = async () => {
        for (const [fieldName, pos] of Object.entries(signaturePositions)) {
          const signatureValue = formData[fieldName as keyof typeof formData]
          
          if (signatureValue && typeof signatureValue === 'string' && signatureValue.trim() !== '') {
            if (signatureValue.startsWith('data:image') || signatureValue.startsWith('http')) {
              try {
                const signatureImage = new Image()
                signatureImage.crossOrigin = 'anonymous'
                
                await new Promise((resolve) => {
                  signatureImage.onload = () => {
                    ctx.fillStyle = 'rgba(248, 249, 250, 0.95)'
                    ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
                    ctx.strokeStyle = '#d1d5db'
                    ctx.lineWidth = 1
                    ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
                    ctx.drawImage(signatureImage, pos.x + 2, pos.y + 2, pos.width - 4, pos.height - 4)
                    resolve(true)
                  }
                  signatureImage.onerror = () => resolve(true)
                  signatureImage.src = signatureValue
                })
              } catch (error) {
                console.error(`Error procesando firma ${fieldName}:`, error)
              }
            }
          }
        }
      }

      console.log('🖊️ Dibujando firmas...')
      await drawSignatures()
      console.log('✅ Firmas dibujadas')

      // Convertir canvas a blob
      console.log('💾 Convirtiendo canvas a blob...')
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('✅ Blob creado:', blob.size, 'bytes')
            resolve(blob)
          }
          else {
            console.error('❌ No se pudo crear blob')
            reject(new Error('No se pudo crear blob'))
          }
        }, 'image/png', 0.95)
      })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
      const filename = `ARAN-OrdenServicio-${formData.numeroOrden || 'nueva'}-${timestamp}.png`
      
      console.log('✅ Captura completada exitosamente')
      console.log('   Filename:', filename)
      console.log('   Blob size:', blob.size, 'bytes')
      return { blob, filename }

    } catch (error) {
      console.error('❌ Error en captura con canvas:', error)
      console.error('   Tipo de error:', error instanceof Error ? error.message : String(error))
      console.error('   Stack:', error instanceof Error ? error.stack : 'N/A')
      throw error
    }
  }

  const handleCaptureOrder = async () => {
    try {
      const formContainer = formRef?.current || document.querySelector('.relative.mx-auto') as HTMLElement
      if (!formContainer) {
        toast.error("Error de captura", { description: "No se pudo encontrar el formulario para capturar" })
        return
      }

      // Usar la función auxiliar de captura
      const captureResult = await captureOrderToCanvas(formContainer)
      
      if (captureResult) {
        const { blob, filename } = captureResult
        
        // Descargar localmente
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        console.log(`💾 Archivo descargado: ${filename}`)
        toast.success("✅ Captura exitosa", { 
          description: `Orden guardada como ${filename}`,
          duration: 5000 
        })
      }
      
    } catch (error) {
      console.error('❌ Error en captura:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast.error("Error de captura", { 
        description: errorMessage
      })
    }
  }

  const getStatusIcon = () => {
    if (hasErrors) return <AlertCircle className="h-4 w-4 text-red-500" />
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  const getSubmitButtonText = () => {
    if (isSubmitting) return "Enviando..." // 🔒 Mostrar estado de envío
    if (isChecking) return "Verificando conexión..."
    if (isFormUnchangedSinceSubmit()) return "Ya enviado (sin cambios)"
    if (!isOnline) return "Guardar localmente"
    if (hasErrors) return "Completar (incompleto)"
    if (hasBeenSubmitted) return "Reenviar formulario"
    return "Completar"
  }

  const getSubmitButtonIcon = () => {
    if (isSubmitting) return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> // 🔒 Spinner durante envío
    if (isChecking) return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
    if (isFormUnchangedSinceSubmit()) return <CheckCircle className="w-4 h-4" />
    if (!isOnline) return <Clock className="w-4 h-4" />
    if (hasErrors) return <AlertTriangle className="w-4 h-4" />
    return <Send className="w-4 h-4" />
  }

  return (
    <>
      <CompletionConfirmationDialog
        open={showConfirmationDialog}
        onOpenChange={setShowConfirmationDialog}
        onConfirm={proceedWithSubmit}
        onEdit={() => setShowConfirmationDialog(false)}
        onSaveDraft={handleSaveDraft}
        missingFields={validationData.missingFields}
        errors={validationData.errors}
      />
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2 flex-wrap">
      {/* Estado del formulario */}
      <div className="flex items-center gap-1.5 text-xs">
        {getStatusIcon()}
        <span className="font-medium text-gray-600">
          #{formData.numeroOrden}
        </span>
        
        {/* Indicador de conectividad */}
        <div className="flex items-center gap-1">
          {isOnline ? (
            <>
              <Wifi className="w-2.5 h-2.5 text-green-600" />
              <span className="text-green-600 text-[10px] hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-2.5 h-2.5 text-red-600" />
              <span className="text-red-600 text-[10px] hidden sm:inline">Offline</span>
            </>
          )}
        </div>
        
        {lastSaveTime && (
          <span className="text-muted-foreground text-[10px] hidden sm:inline">
            • {lastSaveTime.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-1.5 w-full sm:w-auto sm:ml-auto">
        <Button 
          variant="outline" 
          onClick={handleReset}
          className="w-full sm:w-auto h-7 text-xs px-2"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Limpiar</span>
          <span className="sm:hidden">Limpiar</span>
        </Button>

        <Button 
          variant="outline" 
          onClick={onShowDatabase}
          className="border-blue-200 text-blue-700 hover:bg-blue-50 w-full sm:w-auto h-7 text-xs px-2"
          disabled={!onShowDatabase}
        >
          <span className="mr-1">🗃️</span>
          <span className="hidden sm:inline">Registros</span>
          <span className="sm:hidden">Registros</span>
        </Button>

        <Button 
          onClick={handleSubmit} 
          className={`w-full sm:w-auto h-7 text-xs px-2 ${
            isSubmitting
              ? 'bg-gray-400 cursor-wait opacity-80' // 🔒 Estado durante envío
              : isFormUnchangedSinceSubmit()
                ? 'bg-gray-500 hover:bg-gray-600 cursor-not-allowed'
                : !isOnline 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : hasErrors 
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : hasBeenSubmitted
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-primary hover:bg-primary/90'
          }`}
          disabled={isSubmitting || isChecking || isFormUnchangedSinceSubmit()} // 🔒 Deshabilitar durante envío
          title={
            isSubmitting
              ? "Enviando formulario... Por favor espere"
              : isFormUnchangedSinceSubmit()
                ? "Formulario ya enviado sin cambios - Modifique algún campo para reenviar"
                : !isOnline 
                  ? "Sin conexión - Se guardará localmente y se enviará cuando haya internet"
                  : hasErrors
                    ? "Hay errores en el formulario - Se pedirá confirmación para enviar incompleto"
                    : hasBeenSubmitted
                      ? "Reenviar formulario con los cambios realizados"
                      : "Enviar formulario a Google Forms"
          }
        >
          {getSubmitButtonIcon()}
          <span className="ml-1">
            <span className="hidden sm:inline">{getSubmitButtonText()}</span>
            <span className="sm:hidden">{isSubmitting ? "..." : isOnline ? "Enviar" : "Guardar"}</span>
          </span>
        </Button>
      </div>
    </div>
    </>
  )
}