/**
 * Componente para gestionar y mostrar el estado de los permisos de geolocalización
 */

"use client"

import React from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Check, X, AlertCircle, RefreshCw } from "lucide-react"
import { useGeolocationPermission } from "@/hooks/use-geolocation-permission"
import { toast } from "@/lib/toast"

interface GeolocationPermissionIndicatorProps {
  className?: string
  showDetails?: boolean
  autoRequest?: boolean // Solicitar automáticamente si es necesario
}

export function GeolocationPermissionIndicator({ 
  className = '', 
  showDetails = true,
  autoRequest = false 
}: GeolocationPermissionIndicatorProps) {
  const {
    status,
    lastChecked,
    isChecking,
    needsRecheck,
    hasPermission,
    isPermissionDenied,
    shouldRequestPermission,
    requestPermission,
    checkPermissions
  } = useGeolocationPermission()

  const handleRequestPermission = React.useCallback(async () => {
    const granted = await requestPermission()
    
    if (granted) {
      toast.success("Permisos concedidos", {
        description: "Se puede capturar la ubicación del cliente",
        duration: 4000
      })
    } else {
      toast.error("Permisos denegados", {
        description: "No se podrá capturar la ubicación. Habilítalo en la configuración del navegador.",
        duration: 6000
      })
    }
  }, [requestPermission])

  // Solicitar automáticamente si está configurado y es necesario
  React.useEffect(() => {
    if (autoRequest && shouldRequestPermission && !isChecking) {
      handleRequestPermission()
    }
  }, [autoRequest, shouldRequestPermission, isChecking, handleRequestPermission])

  const getStatusIcon = () => {
    if (isChecking) {
      return <RefreshCw className="h-4 w-4 animate-spin" />
    }
    
    switch (status) {
      case 'granted':
        return <Check className="h-4 w-4" />
      case 'denied':
        return <X className="h-4 w-4" />
      case 'prompt':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <MapPin className="h-4 w-4" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'granted':
        return 'bg-green-500'
      case 'denied':
        return 'bg-red-500'
      case 'prompt':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'granted':
        return 'Habilitado'
      case 'denied':
        return 'Denegado'
      case 'prompt':
        return 'Pendiente'
      default:
        return 'Desconocido'
    }
  }

  if (!showDetails) {
    // Vista compacta - solo badge
    return (
      <Badge 
        variant="outline" 
        className={`flex items-center gap-1 ${className}`}
      >
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <MapPin className="h-3 w-3" />
        <span className="text-xs">{getStatusText()}</span>
      </Badge>
    )
  }

  // Vista completa
  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${
            status === 'granted' ? 'bg-green-100 text-green-700' :
            status === 'denied' ? 'bg-red-100 text-red-700' :
            status === 'prompt' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {getStatusIcon()}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm">Geolocalización</h3>
              <Badge 
                variant={
                  status === 'granted' ? 'default' :
                  status === 'denied' ? 'destructive' :
                  'secondary'
                }
                className="text-xs"
              >
                {getStatusText()}
              </Badge>
            </div>
            
            <p className="text-xs text-gray-600 mb-2">
              {status === 'granted' && 'Permisos activos. La ubicación se capturará con las firmas del cliente.'}
              {status === 'denied' && 'Permisos denegados. No se podrá capturar la ubicación. Habilítalo en la configuración del navegador.'}
              {status === 'prompt' && 'Es necesario conceder permisos para capturar la ubicación del cliente.'}
              {status === 'unknown' && 'Estado de permisos desconocido.'}
            </p>

            {lastChecked && (
              <p className="text-xs text-gray-400">
                Última verificación: {lastChecked.toLocaleString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}

            {needsRecheck && (
              <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Se verificarán los permisos en las próximas 24 horas
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {shouldRequestPermission && (
            <Button
              size="sm"
              onClick={handleRequestPermission}
              disabled={isChecking}
              className="whitespace-nowrap"
            >
              {isChecking ? 'Verificando...' : 'Habilitar'}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={checkPermissions}
            disabled={isChecking}
            className="whitespace-nowrap"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isChecking ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
        </div>
      </div>

      {isPermissionDenied && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs text-red-700 font-medium mb-1">
            ¿Cómo habilitar los permisos?
          </p>
          <ol className="text-xs text-red-600 space-y-1 ml-4 list-decimal">
            <li>Toca el ícono del candado o la "i" en la barra de dirección</li>
            <li>Busca "Ubicación" o "Location"</li>
            <li>Selecciona "Permitir" o "Allow"</li>
            <li>Recarga la página</li>
          </ol>
        </div>
      )}
    </Card>
  )
}
