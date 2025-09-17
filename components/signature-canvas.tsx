"use client"

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, Check } from 'lucide-react'

interface SignatureCanvasProps {
  value?: string
  onChange?: (signature: string) => void
  onSave?: (signature: string) => void
  onClear?: () => void
  width?: number
  height?: number
  className?: string
}

export function SignatureCanvas({
  value = '',
  onChange,
  onSave,
  onClear,
  width = 400,
  height = 200,
  className = ''
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

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

    // Llamar onChange en tiempo real si está disponible
    if (onChange) {
      const signature = canvas.toDataURL('image/png')
      onChange(signature)
    }
  }, [isDrawing, getEventPos, onChange])

  // Terminar dibujo
  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

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
    
    if (onChange) {
      onChange('')
    }
    if (onClear) {
      onClear()
    }
  }, [onChange, onClear])

  // Guardar firma
  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    const signature = canvas.toDataURL('image/png')
    if (onSave) {
      onSave(signature)
    }
  }, [hasSignature, onSave])

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
      <div className="text-xs text-gray-500 text-center">
        {hasSignature ? (
          <span className="text-green-600">✓ Firma capturada</span>
        ) : (
          <span>Dibuje su firma en el área de arriba</span>
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
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
        
        {onSave && (
          <Button
            type="button"
            size="sm"
            onClick={saveSignature}
            disabled={!hasSignature}
            className="px-3"
          >
            <Check className="h-4 w-4 mr-1" />
            Confirmar
          </Button>
        )}
      </div>
    </div>
  )
}