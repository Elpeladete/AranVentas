"use client"

import { useUpdateChecker } from '@/hooks/use-update-checker'
import { Button } from '@/components/ui/button'
import { RefreshCw, X, Download } from 'lucide-react'
import { useState } from 'react'

export function UpdateNotification() {
  const { updateAvailable, isChecking, latestVersion, reloadApp, dismissUpdate } = useUpdateChecker()
  const [isDismissed, setIsDismissed] = useState(false)

  if (isChecking || !updateAvailable || isDismissed) {
    return null
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    dismissUpdate()
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-2xl p-4 border border-blue-500">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Download className="h-5 w-5" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">
              ✨ Nueva versión disponible
            </h3>
            <p className="text-xs text-blue-100 mb-3">
              Hay una actualización de AranServices. Recarga la aplicación para obtener las mejoras más recientes.
            </p>
            
            {latestVersion && (
              <p className="text-xs text-blue-200 mb-3 font-mono">
                Versión: {latestVersion.substring(0, 15)}...
              </p>
            )}
            
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={reloadApp}
                className="bg-white text-blue-700 hover:bg-blue-50 h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Actualizar ahora
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-white hover:bg-white/10 h-8 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Más tarde
              </Button>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-blue-200 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
