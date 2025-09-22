/**
 * Componente de prueba para demostrar funcionalidades offline
 * Este componente permite simular condiciones offline y probar la sincronización
 */

"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Wifi, 
  WifiOff, 
  Database, 
  RefreshCw, 
  Trash2,
  Download,
  Upload
} from "lucide-react"
import { 
  getPendingSubmissions, 
  getPendingStats,
  clearAllPendingSubmissions,
  exportPendingSubmissions
} from "@/lib/offline-storage"
import { syncManager } from "@/lib/offline-sync"
import { useNetworkStatus } from "@/hooks/use-network-status"

export function OfflineTestPanel() {
  const { isOnline, isChecking, checkConnectivity } = useNetworkStatus()
  const [stats, setStats] = useState(getPendingStats())
  const [pendingForms, setPendingForms] = useState(getPendingSubmissions())
  const [syncStatus, setSyncStatus] = useState(syncManager.getStatus())

  // Actualizar datos cada 2 segundos
  useEffect(() => {
    const updateData = () => {
      setStats(getPendingStats())
      setPendingForms(getPendingSubmissions())
      setSyncStatus(syncManager.getStatus())
    }

    updateData()
    const interval = setInterval(updateData, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleManualSync = async () => {
    try {
      await syncManager.syncPendingSubmissions()
    } catch (error) {
      console.error('Error en sincronización manual:', error)
    }
  }

  const handleExportData = () => {
    const data = exportPendingSubmissions()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aran-offline-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleClearAll = () => {
    if (confirm('¿Estás seguro de que quieres eliminar todos los formularios pendientes?')) {
      clearAllPendingSubmissions()
      setStats(getPendingStats())
      setPendingForms(getPendingSubmissions())
    }
  }

  return (
    <Card className="p-6 m-4 max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Panel de Pruebas Offline</h2>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <Wifi className="w-3 h-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                <WifiOff className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
            <div className="text-sm text-blue-600">Total Pendientes</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-sm text-yellow-600">En Cola</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-700">{stats.uploading}</div>
            <div className="text-sm text-green-600">Subiendo</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
            <div className="text-sm text-red-600">Fallidos</div>
          </div>
        </div>

        {/* Estado del sistema */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h3 className="font-semibold mb-3">Estado del Sistema</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Conectividad:</strong> {isChecking ? 'Verificando...' : isOnline ? 'Online' : 'Offline'}
            </div>
            <div>
              <strong>Sincronización:</strong> {syncStatus.isRunning ? 'Ejecutándose' : 'Inactiva'}
            </div>
            <div>
              <strong>Auto-sync:</strong> {syncStatus.autoSyncEnabled ? 'Habilitado' : 'Deshabilitado'}
            </div>
            <div>
              <strong>Formularios pendientes:</strong> {syncStatus.hasPending ? 'Sí' : 'No'}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={checkConnectivity} 
            disabled={isChecking}
            variant="outline"
          >
            <Wifi className="w-4 h-4 mr-2" />
            Verificar Conexión
          </Button>
          
          <Button 
            onClick={handleManualSync} 
            disabled={stats.total === 0 || syncStatus.isRunning}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Sincronizar Ahora
          </Button>
          
          <Button 
            onClick={handleExportData} 
            disabled={stats.total === 0}
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Datos
          </Button>
          
          <Button 
            onClick={handleClearAll} 
            disabled={stats.total === 0}
            variant="destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpiar Todo
          </Button>
        </div>

        {/* Lista de formularios pendientes */}
        {stats.total > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Formularios Pendientes</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pendingForms.map((form) => (
                <div 
                  key={form.id} 
                  className="flex items-center justify-between p-3 bg-white border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      Orden #{form.formData.numeroOrden}
                    </div>
                    <div className="text-sm text-gray-500">
                      {form.formData.razonSocial || 'Sin razón social'}
                    </div>
                    <div className="text-xs text-gray-400">
                      Creado: {form.createdAt.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={
                        form.status === 'pending' ? 'secondary' :
                        form.status === 'uploading' ? 'default' :
                        form.status === 'failed' ? 'destructive' :
                        'outline'
                      }
                    >
                      {form.status}
                    </Badge>
                    {form.attempts > 0 && (
                      <span className="text-xs text-gray-500">
                        Intentos: {form.attempts}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instrucciones */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">Cómo probar el sistema offline:</h3>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
            <li>Abre las herramientas de desarrollador (F12)</li>
            <li>Ve a la pestaña "Network" o "Red"</li>
            <li>Marca la opción "Offline" para simular pérdida de conexión</li>
            <li>Completa y envía un formulario - se guardará localmente</li>
            <li>Desmarca "Offline" para restaurar la conexión</li>
            <li>Observa cómo se sincroniza automáticamente</li>
          </ol>
        </div>
      </div>
    </Card>
  )
}