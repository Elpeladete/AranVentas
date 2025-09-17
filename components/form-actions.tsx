"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Send, RotateCcw, AlertCircle, CheckCircle, Download, Camera } from "lucide-react"
import type { FormData } from "@/hooks/use-form-data"
import { toast } from "@/lib/toast"
import { validateForm } from "@/lib/validations"
import html2canvas from "html2canvas"

interface FormActionsProps {
  formData: FormData
  onSubmit: () => void
  onReset: () => void
  hasErrors?: boolean
  lastSaveTime?: Date | null
  formProgress?: number
}

export function FormActions({ 
  formData, 
  onSubmit, 
  onReset,
  hasErrors = false,
  lastSaveTime,
  formProgress = 0
}: FormActionsProps) {

  const handleReset = () => {
    if (confirm("¿Está seguro de que desea limpiar todos los datos del formulario?")) {
      onReset()
    }
  }

  const handleSubmit = () => {
    // Validar formulario antes de enviar
    const validation = validateForm(formData)
    
    if (!validation.isValid) {
      toast.validationError(validation.errors)
      return
    }

    // El número de orden se genera automáticamente, no necesita validación manual
    onSubmit()
  }

  const handleCaptureOrder = async () => {
    try {
      // Buscar el contenedor del formulario PDF
      let formContainer = document.querySelector('.relative.mx-auto') as HTMLElement
      if (!formContainer) {
        toast.error("Error de captura", { description: "No se pudo encontrar el formulario para capturar" })
        return
      }

      toast.info("Iniciando captura...", { description: "Debuggeando proceso paso a paso" })

      // Debug: Verificar qué datos tenemos
      console.log('🔍 Datos del formulario para captura:', formData)
      
      const camposConDatos = Object.entries(formData).filter(([key, value]) => {
        if (typeof value === 'boolean') return value === true
        return value && value.toString().trim() !== ''
      })
      
      console.log('📊 Campos con datos:', camposConDatos)
      toast.info(`Datos encontrados: ${camposConDatos.length} campos`, { description: "Revisando información disponible" })

      // Alternativa: Usar Canvas API nativo completamente
      // Esto evita html2canvas y sus problemas con oklch
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

      console.log('🎨 Canvas creado, buscando imagen de fondo...')

      // Buscar y cargar la imagen de fondo
      const originalImage = formContainer.querySelector('img') as HTMLImageElement
      if (!originalImage) {
        throw new Error('No se encontró la imagen del formulario')
      }

      console.log('🖼️ Imagen encontrada:', originalImage.src)
      
      // Crear una nueva imagen para asegurar que esté cargada
      const bgImage = new Image()
      bgImage.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        bgImage.onload = () => {
          console.log('✅ Imagen de fondo cargada exitosamente')
          resolve(true)
        }
        bgImage.onerror = (error) => {
          console.error('❌ Error cargando imagen:', error)
          reject(error)
        }
        bgImage.src = originalImage.src
      })

      // Dibujar imagen de fondo
      ctx.drawImage(bgImage, 0, 0, 850, 1200)
      console.log('🖼️ Imagen de fondo dibujada')

      // Definir posiciones de campos (las mismas que en el formulario)
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

      let itemsDrawn = 0

      // Dibujar campos de texto
      Object.entries(fieldPositions).forEach(([fieldName, pos]) => {
        const value = formData[fieldName as keyof typeof formData]
        if (value && value.toString().trim() !== '') {
          // Configurar estilo de texto
          ctx.font = 'bold 12px Arial'
          ctx.fillStyle = '#000000'
          
          // Fondo semi-transparente para el texto
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
          
          // Borde
          ctx.strokeStyle = '#cccccc'
          ctx.lineWidth = 1
          ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
          
          // Texto
          ctx.fillStyle = '#000000'
          ctx.font = 'bold 11px Arial'
          
          let displayValue = value.toString()
          if (fieldName === 'descripcion' || fieldName === 'insumos') {
            // Para campos largos, dividir en líneas
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
                if (yPos > pos.y + pos.height - 5) break // No salirse del área
              } else {
                line = testLine
              }
            }
            if (line.trim() !== '') {
              ctx.fillText(line.trim(), pos.x + 4, yPos)
            }
          } else {
            // Texto en una línea
            ctx.fillText(displayValue, pos.x + 4, pos.y + 15)
          }
          
          itemsDrawn++
          console.log(`✏️ Dibujado campo texto: ${fieldName} = "${displayValue}"`)
        }
      })

      // Dibujar checkboxes
      Object.entries(checkboxPositions).forEach(([fieldName, pos]) => {
        const value = formData[fieldName as keyof typeof formData]
        if (value === true) {
          // Dibujar checkbox marcado
          ctx.fillStyle = '#3b82f6'
          ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
          
          // Borde
          ctx.strokeStyle = '#1e40af'
          ctx.lineWidth = 2
          ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
          
          // Check mark
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(pos.x + 4, pos.y + pos.height/2)
          ctx.lineTo(pos.x + pos.width/2, pos.y + pos.height - 4)
          ctx.lineTo(pos.x + pos.width - 4, pos.y + 4)
          ctx.stroke()
          
          itemsDrawn++
          console.log(`☑️ Dibujado checkbox: ${fieldName}`)
        }
      })

      // Dibujar firmas
      const drawSignatures = async () => {
        for (const [fieldName, pos] of Object.entries(signaturePositions)) {
          const signatureValue = formData[fieldName as keyof typeof formData]
          
          if (signatureValue && typeof signatureValue === 'string' && signatureValue.trim() !== '') {
            console.log(`✍️ Procesando firma: ${fieldName}`)
            
            if (signatureValue.startsWith('data:image')) {
              // Es una firma en formato base64 (imagen)
              try {
                const signatureImage = new Image()
                signatureImage.crossOrigin = 'anonymous'
                
                await new Promise((resolve, reject) => {
                  signatureImage.onload = () => {
                    // Dibujar fondo para la firma
                    ctx.fillStyle = 'rgba(248, 249, 250, 0.95)'
                    ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
                    
                    // Borde del área de firma
                    ctx.strokeStyle = '#d1d5db'
                    ctx.lineWidth = 1
                    ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
                    
                    // Dibujar la imagen de la firma
                    ctx.drawImage(signatureImage, pos.x + 2, pos.y + 2, pos.width - 4, pos.height - 4)
                    
                    itemsDrawn++
                    console.log(`✅ Firma dibujada como imagen: ${fieldName}`)
                    resolve(true)
                  }
                  
                  signatureImage.onerror = (error) => {
                    console.error(`❌ Error cargando firma ${fieldName}:`, error)
                    // Dibujar texto indicativo en caso de error
                    ctx.fillStyle = 'rgba(248, 249, 250, 0.95)'
                    ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
                    ctx.strokeStyle = '#d1d5db'
                    ctx.lineWidth = 1
                    ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
                    
                    ctx.fillStyle = '#6b7280'
                    ctx.font = 'italic 10px Arial'
                    ctx.fillText('Firma capturada', pos.x + 5, pos.y + pos.height/2 + 3)
                    
                    itemsDrawn++
                    resolve(true)
                  }
                  
                  signatureImage.src = signatureValue
                })
                
              } catch (error) {
                console.error(`❌ Error procesando firma ${fieldName}:`, error)
              }
              
            } else {
              // Es texto (nombre de firma)
              ctx.fillStyle = 'rgba(248, 249, 250, 0.95)'
              ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
              
              // Borde
              ctx.strokeStyle = '#d1d5db'
              ctx.lineWidth = 1
              ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
              
              // Texto de la firma
              ctx.fillStyle = '#374151'
              ctx.font = 'italic 11px Arial'
              const text = `✍️ ${signatureValue}`
              ctx.fillText(text, pos.x + 5, pos.y + pos.height/2 + 3)
              
              itemsDrawn++
              console.log(`✏️ Firma dibujada como texto: ${fieldName} = "${signatureValue}"`)
            }
          }
        }
      }

      // Ejecutar el dibujado de firmas
      await drawSignatures()

      console.log(`🎯 Total de elementos dibujados: ${itemsDrawn}`)

      // Convertir a blob y descargar
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Error al generar imagen", { description: "No se pudo crear el blob" })
          return
        }

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
        const filename = `ARAN-OrdenServicio-${formData.numeroOrden || 'nueva'}-${timestamp}.png`
        
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        console.log(`💾 Archivo descargado: ${filename}`)
        toast.success("✅ Captura exitosa con Canvas nativo", { 
          description: `${itemsDrawn} elementos incluidos - ${filename}`,
          duration: 6000 
        })
      }, 'image/png', 0.95)

    } catch (error) {
      console.error('❌ Error en captura:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast.error("Error de captura", { 
        description: `${errorMessage}. Revisa la consola para más detalles.` 
      })
    }
  }

  const getProgressColor = () => {
    if (formProgress >= 90) return "text-green-600"
    if (formProgress >= 70) return "text-blue-600"
    if (formProgress >= 50) return "text-yellow-600"
    return "text-red-600"
  }

  const getStatusIcon = () => {
    if (hasErrors) return <AlertCircle className="h-4 w-4 text-red-500" />
    if (formProgress >= 90) return <CheckCircle className="h-4 w-4 text-green-500" />
    return <AlertCircle className="h-4 w-4 text-yellow-500" />
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Estado del formulario */}
      <div className="flex items-center gap-2 text-sm">
        {getStatusIcon()}
        <span className={`font-medium ${getProgressColor()}`}>
          {formProgress}% completo
        </span>
        {lastSaveTime && (
          <span className="text-muted-foreground">
            • Guardado automáticamente {lastSaveTime.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2 ml-auto">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Limpiar
        </Button>

        <Button 
          variant="outline" 
          onClick={handleCaptureOrder}
          className="border-green-200 text-green-700 hover:bg-green-50"
        >
          <Camera className="h-4 w-4 mr-2" />
          Cerrar Orden
        </Button>

        <Button 
          onClick={handleSubmit} 
          disabled={hasErrors}
          className="bg-primary hover:bg-primary/90"
        >
          <Send className="h-4 w-4 mr-2" />
          Guardar y Compartir
        </Button>
      </div>
    </div>
  )
}