/**
 * Componente que muestra el estado de conectividad y formularios pendientes
 */

"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  List
} from "lucide-react"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { getPendingStats } from "@/lib/offline-storage"
import { PendingFormsList } from "./pending-forms-list"

export function NetworkStatusIndicator() {
  const { isOnline, isChecking } = useNetworkStatus()
  const [stats, setStats] = useState(getPendingStats())
  const [showPendingList, setShowPendingList] = useState(false)

  // Actualizar stats periódicamente
  useEffect(() => {
    const updateStats = () => {
      setStats(getPendingStats())
    }

    // Actualizar inmediatamente
    updateStats()

    // Actualizar cada 5 segundos
    const interval = setInterval(updateStats, 5000)

    return () => clearInterval(interval)
  }, [])

  const hasPendingForms = stats.total > 0

  if (showPendingList) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-y-auto">
          <PendingFormsList onClose={() => setShowPendingList(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed top-4 right-4 z-40">
      <div className="flex flex-col gap-2">
        {/* Indicador de conectividad */}
        <div className={`
          flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg
          ${isOnline 
            ? 'bg-green-100 border border-green-200 text-green-800' 
            : 'bg-red-100 border border-red-200 text-red-800'
          }
        `}>
          {isChecking ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isOnline ? (
            <Wifi className="w-4 h-4" />
          ) : (
            <WifiOff className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {isChecking ? 'Verificando...' : isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Indicador de formularios pendientes */}
        {hasPendingForms && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-gray-700">
                  Formularios pendientes
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {stats.total}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPendingList(true)}
                  className="h-6 px-2 text-xs"
                >
                  <List className="w-3 h-3 mr-1" />
                  Ver
                </Button>
              </div>
            </div>
            
            {/* Desglose de estados */}
            {(stats.pending > 0 || stats.uploading > 0 || stats.failed > 0) && (
              <div className="flex gap-2 mt-2 text-xs">
                {stats.pending > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Clock className="w-3 h-3" />
                    {stats.pending} pendientes
                  </span>
                )}
                {stats.uploading > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    {stats.uploading} subiendo
                  </span>
                )}
                {stats.failed > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    {stats.failed} fallidos
                  </span>
                )}
              </div>
            )}

            {/* Mensaje de información */}
            <div className="mt-2 text-xs text-gray-500">
              {isOnline 
                ? "Se sincronizarán automáticamente" 
                : "Se enviarán cuando haya conexión"
              }
            </div>
          </div>
        )}

        {/* Mensaje de estado cuando no hay formularios pendientes y está offline */}
        {!hasPendingForms && !isOnline && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Modo offline
              </span>
            </div>
            <div className="text-xs text-yellow-700 mt-1">
              Los formularios se guardarán localmente
            </div>
          </div>
        )}
      </div>
    </div>
  )
}