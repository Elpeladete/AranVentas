"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getWazzupChannels, getActiveChannel, checkChannelAvailability, type WazzupChannel } from '@/lib/wazzup-api'
import { CheckCircle, XCircle, RefreshCw, Wifi } from 'lucide-react'

export function WazzupChannelTest() {
  const [channels, setChannels] = useState<WazzupChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<WazzupChannel | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availability, setAvailability] = useState<any>(null)

  const testChannels = async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log('🧪 Iniciando prueba de canales Wazzup...')
      
      const result = await getWazzupChannels()
      console.log('📋 Resultado completo:', result)
      
      setChannels(result.channels)
      setActiveChannel(result.activeChannel || null)
      
      if (!result.hasActiveChannels) {
        setError('No se encontraron canales activos')
      }
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const testAvailability = async () => {
    setIsLoading(true)
    try {
      const result = await checkChannelAvailability()
      console.log('🔍 Disponibilidad:', result)
      setAvailability(result)
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50'
      case 'inactive': return 'text-gray-600 bg-gray-50'
      case 'pending': return 'text-yellow-600 bg-yellow-50'
      case 'disconnected': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">🔍 Diagnóstico de Canales Wazzup</h3>
        <div className="flex gap-2">
          <Button 
            onClick={testChannels} 
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Wifi className="h-4 w-4 mr-2" />
            )}
            Obtener Canales
          </Button>
          <Button 
            onClick={testAvailability} 
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            Verificar Disponibilidad
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-800">
            <XCircle className="h-4 w-4" />
            <span className="font-medium">Error:</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {availability && (
        <div className={`border rounded-lg p-4 ${availability.available ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {availability.available ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-yellow-600" />
            )}
            <span className="font-semibold">
              {availability.available ? 'Canal Disponible' : 'Sin Canales Activos'}
            </span>
          </div>
          <p className="text-sm">{availability.message}</p>
          {availability.channel && (
            <div className="mt-2 text-xs bg-white rounded p-2">
              <div><strong>ID:</strong> {availability.channel.id}</div>
              <div><strong>Nombre:</strong> {availability.channel.name}</div>
              <div><strong>Estado:</strong> {availability.channel.status}</div>
            </div>
          )}
        </div>
      )}

      {activeChannel && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-semibold">Canal Activo Seleccionado</span>
          </div>
          <div className="space-y-1 text-sm">
            <div><strong>ID:</strong> <code className="bg-white px-2 py-1 rounded">{activeChannel.id}</code></div>
            <div><strong>Nombre:</strong> {activeChannel.name}</div>
            <div><strong>Estado:</strong> <span className={`px-2 py-1 rounded text-xs ${getStatusColor(activeChannel.status)}`}>{activeChannel.status}</span></div>
            <div><strong>Tipo:</strong> {activeChannel.channelType}</div>
            {activeChannel.phone && <div><strong>Teléfono:</strong> {activeChannel.phone}</div>}
          </div>
        </div>
      )}

      {channels.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Todos los canales ({channels.length})</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {channels.map((channel) => (
              <div 
                key={channel.id} 
                className={`border rounded-lg p-3 ${
                  channel.id === '5d636b50-9ebc-4690-8c8c-ad6fb44bbcc7' ? 'border-blue-500 border-2' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{channel.name}</span>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(channel.status)}`}>
                    {channel.status}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <div><strong>ID:</strong> <code className="bg-gray-100 px-1 rounded text-[10px]">{channel.id}</code></div>
                  {channel.id === '5d636b50-9ebc-4690-8c8c-ad6fb44bbcc7' && (
                    <div className="text-blue-600 font-semibold mt-2">⭐ Canal buscado</div>
                  )}
                  <div><strong>Transport:</strong> {channel.transport}</div>
                  <div><strong>Tipo:</strong> {channel.channelType}</div>
                  {channel.phone && <div><strong>Tel:</strong> {channel.phone}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!channels.length && !isLoading && (
        <div className="text-center text-gray-500 py-8">
          <Wifi className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Haz clic en "Obtener Canales" para ver los canales disponibles</p>
        </div>
      )}
    </Card>
  )
}
