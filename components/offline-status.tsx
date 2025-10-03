"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Wifi, 
  WifiOff, 
  Download, 
  RefreshCw, 
  Database, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Info
} from "lucide-react"
import { offlineDataManager, type OfflineDataStatus, checkConnectivity } from "@/lib/offline-data-manager"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { toast } from "@/lib/toast"

interface OfflineStatusProps {
  className?: string
}

export function OfflineStatus({ className }: OfflineStatusProps) {
  const [datasets, setDatasets] = useState<OfflineDataStatus[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const { isOnline } = useNetworkStatus()

  // Actualizar estado de datasets
  const updateDatasetStatus = () => {
    const status = offlineDataManager.getDatasetStatus()
    setDatasets(status)
    setLastCheck(new Date())
  }

  // Verificar que estamos en el cliente
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Inicializar y actualizar periódicamente (solo en cliente)
  useEffect(() => {
    if (!isClient) return
    
    updateDatasetStatus()
    
    // Actualizar cada 30 segundos
    const interval = setInterval(updateDatasetStatus, 30000)
    
    return () => clearInterval(interval)
  }, [isClient])

  // Forzar actualización de todos los datasets
  const handleForceUpdate = async () => {
    if (!isOnline) {
      toast.error("Sin conexión", { 
        description: "No se pueden actualizar los datos offline sin conexión a internet" 
      })
      return
    }

    setIsUpdating(true)
    
    try {
      await offlineDataManager.forceUpdateAll()
      updateDatasetStatus()
      toast.success("Datos actualizados", {
        description: "Todos los datasets han sido actualizados exitosamente"
      })
    } catch (error) {
      console.error('Error actualizando datos:', error)
      toast.error("Error de actualización", {
        description: "No se pudieron actualizar algunos datasets"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // Formatear tamaño en bytes
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Formatear tiempo relativo
  const formatTimeAgo = (timestamp: number | null): string => {
    if (!timestamp) return 'Nunca'
    
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `Hace ${days}d`
    if (hours > 0) return `Hace ${hours}h`
    if (minutes > 0) return `Hace ${minutes}m`
    return 'Recién'
  }

  // Obtener color del badge según el estado
  const getDatasetBadgeColor = (dataset: OfflineDataStatus): "default" | "destructive" | "outline" | "secondary" => {
    if (!dataset.isAvailable) return "destructive"
    if (!dataset.lastUpdate) return "outline"
    
    const now = Date.now()
    const dayOld = 24 * 60 * 60 * 1000
    const isOld = (now - dataset.lastUpdate) > dayOld
    
    return isOld ? "outline" : "secondary"
  }

  // No renderizar nada hasta que estemos en el cliente
  if (!isClient) {
    return null
  }

  // Obtener información de almacenamiento
  const storageInfo = offlineDataManager.getStorageInfo()

  if (!expanded) {
    // Vista compacta
    const allAvailable = datasets.length > 0 && datasets.every(d => d.isAvailable)
    const someAvailable = datasets.some(d => d.isAvailable)
    
    return (
      <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 bg-white/95 backdrop-blur-sm shadow-lg border-2"
        >
          {isOnline ? (
            <Wifi className="h-3 w-3 text-green-600" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-600" />
          )}
          
          {allAvailable ? (
            <Database className="h-3 w-3 text-green-600" />
          ) : someAvailable ? (
            <AlertTriangle className="h-3 w-3 text-yellow-600" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-red-600" />
          )}
          
          <span className="text-xs">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </Button>
      </div>
    )
  }

  // Vista expandida
  return (
    <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
      <Card className="p-4 bg-white/95 backdrop-blur-sm shadow-xl border-2 min-w-[320px] max-w-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600" />
            )}
            <h3 className="font-semibold text-sm">
              Estado {isOnline ? 'Online' : 'Offline'}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>

        {/* Datasets status */}
        <div className="space-y-2 mb-3">
          <div className="text-xs text-gray-600 font-medium">Datasets Offline:</div>
          {datasets.map((dataset) => (
            <div key={dataset.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  dataset.isAvailable ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-xs capitalize">{dataset.key}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getDatasetBadgeColor(dataset)} className="text-xs py-0">
                  {dataset.isAvailable ? formatSize(dataset.size) : 'No disponible'}
                </Badge>
                <span className="text-xs text-gray-500">
                  {formatTimeAgo(dataset.lastUpdate)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Storage info */}
        {storageInfo.totalSize > 0 && (
          <div className="text-xs text-gray-600 mb-3">
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              <span>Almacenamiento total: {formatSize(storageInfo.totalSize)}</span>
            </div>
          </div>
        )}

        {/* Last check */}
        {lastCheck && (
          <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Última verificación: {lastCheck.toLocaleTimeString()}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleForceUpdate}
            disabled={!isOnline || isUpdating}
            className="flex-1"
          >
            {isUpdating ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            <span className="text-xs ml-1">
              {isUpdating ? 'Actualizando...' : 'Actualizar'}
            </span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={updateDatasetStatus}
            className="px-3"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* Info message */}
        {!isOnline && (
          <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700 flex items-start gap-2">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Funcionando offline. Los datos se actualizarán automáticamente cuando tengas conexión.
            </span>
          </div>
        )}
      </Card>
    </div>
  )
}