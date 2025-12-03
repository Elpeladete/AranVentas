"use client"

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, Check, Upload, Loader2 } from 'lucide-react'
import { uploadCanvasToImgBB, generateSignatureName } from '@/lib/imgbb-upload'
import { toast } from '@/lib/toast'

interface SignatureCanvasProps {
  value?: string
  onChange?: (signature: string) => void
  onSave?: (signature: string) => void
  onClear?: () => void
  onGeolocationCapture?: (geolocation: string) => void // Callback para geolocalización
  width?: number
  height?: number
  className?: string
  orderNumber?: string
  signatureType?: 'tecnico' | 'cliente'
  autoUpload?: boolean // Si debe subir automáticamente a ImgBB
}

export function SignatureCanvas({
  value = '',
  onChange,
  onSave,
  onClear,
  onGeolocationCapture,
  width = 800,
  height = 400,
  className = '',
  orderNumber = '',
  signatureType = 'tecnico',
  autoUpload = true
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState<string>('')

  // Configurar el canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Configurar el contexto de dibujo
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Si hay una firma existente, cargarla
    if (value && value.startsWith('data:image')) {
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        setHasSignature(true)
      }
      img.src = value
    }
  }, [value])

  // Obtener coordenadas del evento (mouse o touch)
  const getEventPos = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      // Touch event
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      }
    } else {
      // Mouse event
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      }
    }
  }, [])

  // Iniciar dibujo
  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    setIsDrawing(true)
    const pos = getEventPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [getEventPos])

  // Capturar geolocalización
  const captureGeolocation = useCallback(() => {
    // Solo capturar geolocalización para firma del cliente
    if (signatureType !== 'cliente' || !onGeolocationCapture) return

    if (navigator.geolocation) {
      console.log('📍 Solicitando geolocalización para firma del cliente...')
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const geoData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          }
          
          const geoString = `${geoData.latitude},${geoData.longitude}`
          onGeolocationCapture(geoString)
          
          console.log('✅ Geolocalización capturada:', geoData)
          toast.success("Ubicación capturada", {
            description: `Lat: ${geoData.latitude.toFixed(6)}, Lng: ${geoData.longitude.toFixed(6)}`,
            duration: 3000
          })
        },
        (error) => {
          console.error('❌ Error obteniendo geolocalización:', error.message)
          onGeolocationCapture('Geolocalización no disponible')
          
          toast.error("No se pudo obtener ubicación", {
            description: error.code === 1 ? "Permiso denegado" : "Error del GPS",
            duration: 3000
          })
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      )
    } else {
      console.error('❌ Geolocalización no soportada')
      onGeolocationCapture('Geolocalización no soportada')
    }
  }, [signatureType, onGeolocationCapture])

  // Subir firma a ImgBB
  const uploadSignature = useCallback(async (canvas: HTMLCanvasElement) => {
    if (!autoUpload || !orderNumber) return null

    try {
      setIsUploading(true)
      const signatureName = generateSignatureName(orderNumber, signatureType)
      
      toast.info("Subiendo firma...", { description: "Guardando en la nube" })
      
      const result = await uploadCanvasToImgBB(canvas, signatureName, 0.9)
      
      setUploadedUrl(result.data.url)
      toast.success("✅ Firma guardada", { 
        description: "Subida a la nube exitosamente",
        duration: 3000 
      })
      
      return result.data.url
      
    } catch (error) {
      console.error('Error uploading signature:', error)
      toast.error("Error al subir firma", { 
        description: "Se guardará localmente" 
      })
      return null
    } finally {
      setIsUploading(false)
    }
  }, [autoUpload, orderNumber, signatureType])

  // Dibujar
  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const pos = getEventPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasSignature(true)

    // No llamar onChange en tiempo real para evitar subidas múltiples
    // El onChange se llamará en stopDrawing después de subir a ImgBB
  }, [isDrawing, getEventPos])

  // Terminar dibujo y subir automáticamente
  const stopDrawing = useCallback(async () => {
    if (!isDrawing) return
    
    setIsDrawing(false)
    
    // Si hay dibujo y autoUpload está habilitado, subir automáticamente
    if (hasSignature && autoUpload) {
      const canvas = canvasRef.current
      if (!canvas) return
      
      // Deshabilitar botón INMEDIATAMENTE mientras se procesa
      setIsUploading(true)
      
      // Pequeña pausa para asegurar que el dibujo se complete
      setTimeout(async () => {
        try {
          // Capturar geolocalización ANTES de subir la firma (solo para clientes)
          if (signatureType === 'cliente') {
            captureGeolocation()
          }
          
          // uploadSignature maneja su propio isUploading, pero ya lo establecimos arriba
          // para cubrir el tiempo del setTimeout
          const uploadedUrl = await uploadSignature(canvas)
          if (uploadedUrl && onChange) {
            console.log(`🎯 SignatureCanvas: onChange llamado con URL: ${uploadedUrl}`)
            onChange(uploadedUrl) // Pasar URL directamente
          } else {
            console.log(`🎯 SignatureCanvas: Fallback a base64 (modo offline o error)`)
            // Fallback: usar base64 local (modo offline o error de red)
            const localSignature = canvas.toDataURL('image/png')
            if (onChange) {
              console.log(`🎯 SignatureCanvas: onChange llamado con base64 (length: ${localSignature.length})`)
              onChange(localSignature)
            }
          }
        } catch (error) {
          console.error('Error en subida automática:', error)
          // Fallback: usar base64 local
          const localSignature = canvas.toDataURL('image/png')
          if (onChange) {
            console.log(`🎯 SignatureCanvas: onChange llamado con base64 de emergencia (length: ${localSignature.length})`)
            onChange(localSignature)
          }
        } finally {
          // SIEMPRE habilitar botón al final, sin importar si fue exitoso o offline
          setIsUploading(false)
        }
      }, 500) // Pausa de 500ms para completar el trazo
    }
  }, [isDrawing, hasSignature, autoUpload, signatureType, captureGeolocation, uploadSignature, onChange])

  // Eventos del mouse
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (e: MouseEvent) => startDrawing(e)
    const handleMouseMove = (e: MouseEvent) => draw(e)
    const handleMouseUp = () => stopDrawing()
    const handleMouseLeave = () => stopDrawing()

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [startDrawing, draw, stopDrawing])

  // Eventos touch para móviles
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleTouchStart = (e: TouchEvent) => startDrawing(e)
    const handleTouchMove = (e: TouchEvent) => draw(e)
    const handleTouchEnd = () => stopDrawing()

    canvas.addEventListener('touchstart', handleTouchStart)
    canvas.addEventListener('touchmove', handleTouchMove)
    canvas.addEventListener('touchend', handleTouchEnd)

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
    }
  }, [startDrawing, draw, stopDrawing])

  // Limpiar canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    setUploadedUrl('')
    
    if (onChange) {
      onChange('')
    }
    if (onClear) {
      onClear()
    }
  }, [onChange, onClear])

  // Guardar firma (con subida automática a ImgBB si está habilitada)
  const saveSignature = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    const localSignature = canvas.toDataURL('image/png')
    
    // Si autoUpload está habilitado, subir a ImgBB
    let finalSignature = localSignature
    if (autoUpload) {
      const uploadedUrl = await uploadSignature(canvas)
      if (uploadedUrl) {
        finalSignature = uploadedUrl // Usar URL de ImgBB en lugar de base64
      }
    }
    
    if (onChange) {
      onChange(finalSignature)
    }
    if (onSave) {
      onSave(finalSignature)
    }
  }, [hasSignature, autoUpload, uploadSignature, onChange, onSave])

  // Subir manualmente a ImgBB
  const manualUpload = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    await uploadSignature(canvas)
  }, [hasSignature, uploadSignature])

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Canvas */}
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block w-full h-auto cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Instrucciones */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        {isUploading ? (
          <span className="text-blue-600 flex items-center justify-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Procesando firma...
          </span>
        ) : uploadedUrl ? (
          <span className="text-green-600">✓ Firma guardada en la nube</span>
        ) : hasSignature && !uploadedUrl && autoUpload ? (
          <span className="text-amber-600">✓ Firma guardada localmente (se subirá cuando haya conexión)</span>
        ) : hasSignature ? (
          <span className="text-green-600">✓ Firma capturada</span>
        ) : (
          <span>Dibuje su firma en el área de arriba</span>
        )}
        
        {autoUpload && orderNumber && (
          <div className="text-xs text-gray-400">
            {`${signatureType === 'tecnico' ? 'Técnico' : 'Cliente'} - Orden: ${orderNumber}`}
          </div>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2 justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          className="px-3"
          disabled={isUploading}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
        
        {onSave && (
          <Button
            type="button"
            size="sm"
            onClick={saveSignature}
            disabled={!hasSignature || isUploading}
            className="px-3"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            {isUploading ? 'Subiendo...' : 'Confirmar'}
          </Button>
        )}
        
        {/* Botón de subida manual (solo si autoUpload está deshabilitado) */}
        {!autoUpload && hasSignature && !uploadedUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={manualUpload}
            disabled={isUploading}
            className="px-3"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {isUploading ? 'Subiendo...' : 'Subir'}
          </Button>
        )}
      </div>
    </div>
  )
}