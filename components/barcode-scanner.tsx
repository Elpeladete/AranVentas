"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Camera, X } from 'lucide-react'
import { toast } from '@/lib/toast'

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string>('')
  const hasScannedRef = useRef(false) // Prevenir múltiples escaneos

  useEffect(() => {
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader")
        scannerRef.current = scanner

        const config = { 
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        }

        await scanner.start(
          { facingMode: "environment" }, // Cámara trasera
          config,
          async (decodedText) => {
            // Prevenir múltiples escaneos del mismo código
            if (hasScannedRef.current) return
            
            hasScannedRef.current = true
            console.log('📷 Código escaneado:', decodedText)
            
            // Detener inmediatamente el escáner
            try {
              await scanner.stop()
              scanner.clear()
              setIsScanning(false)
            } catch (err) {
              console.error('Error deteniendo escáner:', err)
            }
            
            // Ejecutar callback DESPUÉS de detener el escáner
            setTimeout(() => {
              toast.success('Código escaneado', {
                description: decodedText,
                duration: 2000
              })
              onScan(decodedText)
            }, 100)
          },
          (errorMessage) => {
            // Error de escaneo (se llama constantemente mientras busca)
            // No mostrar estos errores al usuario
          }
        )

        setIsScanning(true)
      } catch (err: any) {
        console.error('Error iniciando escáner:', err)
        setError('No se pudo acceder a la cámara. Verifica los permisos.')
        toast.error('Error de cámara', {
          description: 'No se pudo acceder a la cámara'
        })
      }
    }

    startScanner()

    return () => {
      stopScanner()
    }
  }, [])

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
        setIsScanning(false)
      } catch (err) {
        console.error('Error deteniendo escáner:', err)
      }
    }
  }

  const handleClose = async () => {
    await stopScanner()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Escanear Código</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scanner Area */}
        <div className="p-4">
          {error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={handleClose} variant="outline">
                Cerrar
              </Button>
            </div>
          ) : (
            <>
              <div id="qr-reader" className="w-full rounded-lg overflow-hidden"></div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  📷 Apunta la cámara al código de barras o QR
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  El escaneo es automático
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t rounded-b-lg">
          <Button
            variant="outline"
            onClick={handleClose}
            className="w-full"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
