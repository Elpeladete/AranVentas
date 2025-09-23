"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Send, RotateCcw, AlertCircle, CheckCircle, Download, Camera, Wifi, WifiOff, Clock, AlertTriangle } from "lucide-react"
import type { FormData } from "@/hooks/use-form-data"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { toast } from "@/lib/toast"
import { validateForm, validateRequiredFields } from "@/lib/validations"
import { uploadImageToImgBB } from "@/lib/imgbb-upload"
import html2canvas from "html2canvas"

interface FormActionsProps {
  formData: FormData
  onSubmit: () => void
  onReset: () => void
  onUpdateField: (field: keyof FormData, value: any) => void
  hasErrors?: boolean
  lastSaveTime?: Date | null
}

export function FormActions({ 
  formData, 
  onSubmit, 
  onReset,
  onUpdateField,
  hasErrors = false,
  lastSaveTime
}: FormActionsProps) {
  const { isOnline, isChecking } = useNetworkStatus()
  
  // Estados para rastrear envíos
  const [hasBeenSubmitted, setHasBeenSubmitted] = useState(false)
  const lastSubmittedData = useRef<FormData | null>(null)

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
    }
  }

  const handleSubmit = async () => {
    try {
      // Verificar si se intenta reenviar sin cambios
      if (isFormUnchangedSinceSubmit()) {
        toast.warning("Formulario ya enviado", { 
          description: "Este formulario ya fue enviado. Modifique algún campo para volver a enviarlo.",
          duration: 4000
        })
        return
      }

      toast.info("Iniciando proceso...", { description: "Guardando datos localmente primero" })
      
      // PASO 1: Guardar datos del formulario localmente (JSON)
      console.log('💾 Guardando datos del formulario localmente...')
      try {
        const formDataJson = JSON.stringify(formData, null, 2)
        const jsonBlob = new Blob([formDataJson], { type: 'application/json' })
        const jsonUrl = URL.createObjectURL(jsonBlob)
        const jsonLink = document.createElement('a')
        const timestamp = new Date().toISOString().split('T')[0]
        const jsonFilename = `ARAN-FormData-${formData.numeroOrden || 'nueva'}-${timestamp}.json`
        
        jsonLink.href = jsonUrl
        jsonLink.download = jsonFilename
        document.body.appendChild(jsonLink)
        jsonLink.click()
        document.body.removeChild(jsonLink)
        URL.revokeObjectURL(jsonUrl)
        
        toast.success("Datos guardados localmente", { 
          description: `Formulario respaldado como ${jsonFilename}` 
        })
      } catch (jsonError) {
        console.error('❌ Error guardando datos JSON:', jsonError)
        toast.warning("Advertencia", { 
          description: "No se pudieron guardar los datos localmente" 
        })
      }
      
      // PASO 2: Capturar y guardar imagen localmente
      console.log('🚀 Capturando imagen de la orden...')
      const formContainer = document.querySelector('.relative.mx-auto') as HTMLElement
      let imageUrl: string | null = null
      
      if (formContainer) {
        try {
          const captureResult = await captureOrderToCanvas(formContainer)
          
          if (captureResult) {
            const { blob, filename } = captureResult
            
            // Guardar imagen localmente (descarga automática)
            const localUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = localUrl
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(localUrl)
            
            toast.success("Imagen guardada localmente", { 
              description: "Orden capturada y descargada" 
            })

            // PASO 3: Intentar subir imagen a ImgBB (opcional)
            try {
              console.log('☁️ Iniciando subida a ImgBB...')
              toast.info("Subiendo imagen...", { description: "Obteniendo URL para compartir" })
              
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => {
                  const result = reader.result as string
                  const base64Data = result.split(',')[1]
                  console.log('📝 Base64 generado, length:', base64Data.length)
                  resolve(base64Data)
                }
                reader.onerror = (error) => {
                  console.error('❌ Error leyendo blob como base64:', error)
                  reject(error)
                }
                reader.readAsDataURL(blob)
              })

              console.log('🚀 Llamando a uploadImageToImgBB...')
              const uploadResult = await uploadImageToImgBB(base64, filename.replace('.png', ''))
              imageUrl = uploadResult.data.url
              
              console.log('💾 URL de imagen obtenida:', imageUrl)
              toast.success("URL de imagen obtenida", { 
                description: "Imagen disponible online para compartir" 
              })
              
              // Compartir por WhatsApp automáticamente
              if (imageUrl && imageUrl.startsWith('http')) {
                console.log('📱 Preparando para compartir por WhatsApp...')
                const message = `🔧 ARAN Tecnologías - Orden de Servicio ${formData.numeroOrden || 'Nueva'}\n\n✅ Trabajo completado para: ${formData.razonSocial || 'Cliente'}\n\n🖼️ Ver orden completa: ${imageUrl}\n\n📞 ARAN Tecnologías - Servicio Técnico`
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
                
                // Mostrar opción de compartir
                setTimeout(() => {
                  const shouldShare = confirm(
                    `¿Desea compartir la orden de servicio por WhatsApp?\n\nSe abrirá WhatsApp con el mensaje y la imagen listos para enviar.`
                  )
                  
                  if (shouldShare) {
                    window.open(whatsappUrl, '_blank')
                    toast.success("WhatsApp abierto", {
                      description: "Envía el mensaje con la orden de servicio"
                    })
                  }
                }, 1000) // Esperar 1 segundo para que se vea el toast de éxito
              }
              
            } catch (uploadError) {
              console.error('❌ Error completo en subida a ImgBB:', uploadError)
              console.error('❌ Stack trace:', uploadError instanceof Error ? uploadError.stack : 'No stack')
              
              // Usar referencia local como fallback
              imageUrl = `Local: ${filename}`
              toast.error("No se pudo compartir por WhatsApp", { 
                description: `Error subiendo imagen: ${uploadError instanceof Error ? uploadError.message : 'Error desconocido'}. La imagen se guardó localmente.` 
              })
              
              // Mostrar mensaje sobre compartir manualmente
              setTimeout(() => {
                toast.info("Para compartir manualmente", {
                  description: "Use la imagen descargada localmente en su dispositivo",
                  duration: 5000
                })
              }, 2000)
            }
          }
          
        } catch (captureError) {
          console.error('❌ Error en captura de imagen:', captureError)
          toast.warning("Error en captura", { 
            description: "No se pudo capturar la imagen" 
          })
        }
      }

      // PASO 4: Actualizar campo AUX1 con la URL (si se obtuvo)
      if (imageUrl) {
        onUpdateField('aux1', imageUrl)
        console.log('📝 Campo AUX1 actualizado con:', imageUrl)
      }

      // PASO 5: Validar formulario antes de enviar
      toast.info("Validando formulario...", { description: "Verificando datos antes del envío" })
      const validation = validateRequiredFields(formData)
      
      if (!validation.isValid) {
        const errorArray = Object.entries(validation.errors).map(([field, error]) => `• ${error}`)
        const errorList = errorArray.join('\n')
        const shouldProceed = confirm(
          `⚠️ CAMPOS OBLIGATORIOS FALTANTES:\n\n${errorList}\n\nCampos faltantes: ${validation.missingFields.length}\n\n¿Desea enviar el formulario incompleto de todas formas?\n\n⚠️ ADVERTENCIA: El formulario no cumple con los requisitos mínimos.`
        )
        
        if (!shouldProceed) {
          toast.warning("Envío cancelado", {
            description: `Complete los ${validation.missingFields.length} campos obligatorios y vuelva a intentar`
          })
          return
        }
        
        toast.warning("Enviando formulario incompleto", {
          description: `⚠️ Faltan ${validation.missingFields.length} campos obligatorios`
        })
      } else {
        toast.success("Validación exitosa", {
          description: "✅ Todos los campos obligatorios están completos"
        })
      }

      // PASO 6: Enviar al formulario 
      toast.info("Enviando formulario...", { description: "Transmitiendo datos al servidor" })
      
      try {
        await new Promise<void>((resolve, reject) => {
          // Envolver onSubmit en una promesa para manejar su resultado
          try {
            onSubmit()
            // Asumir éxito si no hay excepción inmediata
            setTimeout(resolve, 1000) // Dar tiempo para posibles errores asíncronos
          } catch (error) {
            reject(error)
          }
        })
        
        // PASO 7: Marcar como enviado solo si llegamos hasta aquí sin errores
        setHasBeenSubmitted(true)
        lastSubmittedData.current = { ...formData }
        
        console.log('✅ Proceso completado exitosamente')
        toast.success("Formulario enviado exitosamente", { 
          description: "Datos guardados localmente y enviados al servidor",
          duration: 5000 
        })
        
      } catch (submitError) {
        console.error('❌ Error en envío del formulario:', submitError)
        toast.error("Error en envío", { 
          description: "Los datos están guardados localmente, pero no se enviaron al servidor" 
        })
        throw submitError // Re-lanzar para que se maneje en el catch principal
      }
      
    } catch (error) {
      console.error('❌ Error en proceso completo:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast.error("Error en el proceso", { 
        description: `${errorMessage}. Los datos locales están guardados.`
      })
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

      // Buscar y cargar la imagen de fondo
      const originalImage = formContainer.querySelector('img') as HTMLImageElement
      if (!originalImage) {
        throw new Error('No se encontró la imagen del formulario')
      }
      
      // Crear una nueva imagen para asegurar que esté cargada
      const bgImage = new Image()
      bgImage.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        bgImage.onload = () => resolve(true)
        bgImage.onerror = reject
        bgImage.src = originalImage.src
      })

      // Dibujar imagen de fondo
      ctx.drawImage(bgImage, 0, 0, 850, 1200)

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
        insumos: { x: 65, y: 685, width: 700, height: 220 },
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
          if (fieldName === 'descripcion' || fieldName === 'insumos') {
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

      await drawSignatures()

      // Convertir canvas a blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('No se pudo crear blob'))
        }, 'image/png', 0.95)
      })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
      const filename = `ARAN-OrdenServicio-${formData.numeroOrden || 'nueva'}-${timestamp}.png`
      
      console.log('✅ Captura completada exitosamente')
      return { blob, filename }

    } catch (error) {
      console.error('❌ Error en captura con canvas:', error)
      throw error
    }
  }

  const handleCaptureOrder = async () => {
    try {
      const formContainer = document.querySelector('.relative.mx-auto') as HTMLElement
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
    if (isChecking) return "Verificando conexión..."
    if (isFormUnchangedSinceSubmit()) return "Ya enviado (sin cambios)"
    if (!isOnline) return "Guardar localmente"
    if (hasErrors) return "Guardar y Compartir (incompleto)"
    if (hasBeenSubmitted) return "Reenviar formulario"
    return "Guardar y Compartir"
  }

  const getSubmitButtonIcon = () => {
    if (isChecking) return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
    if (isFormUnchangedSinceSubmit()) return <CheckCircle className="w-4 h-4" />
    if (!isOnline) return <Clock className="w-4 h-4" />
    if (hasErrors) return <AlertTriangle className="w-4 h-4" />
    return <Send className="w-4 h-4" />
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 flex-wrap">
      {/* Estado del formulario */}
      <div className="flex items-center gap-2 text-sm">
        {getStatusIcon()}
        <span className="font-medium text-gray-600">
          Orden #{formData.numeroOrden}
        </span>
        
        {/* Indicador de conectividad */}
        <div className="flex items-center gap-1 ml-2">
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-green-600" />
              <span className="text-green-600 text-xs hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-600" />
              <span className="text-red-600 text-xs hidden sm:inline">Offline</span>
            </>
          )}
        </div>
        
        {lastSaveTime && (
          <span className="text-muted-foreground hidden sm:inline">
            • Guardado automáticamente {lastSaveTime.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
        <Button 
          variant="outline" 
          onClick={handleReset}
          className="w-full sm:w-auto"
          size="sm"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Limpiar</span>
          <span className="sm:hidden">Limpiar Formulario</span>
        </Button>

        <Button 
          variant="outline" 
          onClick={handleCaptureOrder}
          className="border-green-200 text-green-700 hover:bg-green-50 w-full sm:w-auto"
          size="sm"
        >
          <Camera className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Cerrar Orden</span>
          <span className="sm:hidden">Cerrar y Enviar Orden</span>
        </Button>

        <Button 
          onClick={handleSubmit} 
          className={`w-full sm:w-auto ${
            isFormUnchangedSinceSubmit()
              ? 'bg-gray-500 hover:bg-gray-600 cursor-not-allowed'
              : !isOnline 
                ? 'bg-orange-600 hover:bg-orange-700' 
                : hasErrors 
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : hasBeenSubmitted
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-primary hover:bg-primary/90'
          }`}
          size="sm"
          disabled={isFormUnchangedSinceSubmit()}
          title={
            isFormUnchangedSinceSubmit()
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
          <span className="ml-2">
            <span className="hidden sm:inline">{getSubmitButtonText()}</span>
            <span className="sm:hidden">{isOnline ? "Enviar" : "Guardar"}</span>
          </span>
        </Button>
      </div>
    </div>
  )
}