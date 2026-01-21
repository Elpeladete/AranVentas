/**
 * Componente para mostrar formularios pendientes de sincronización
 */

"use client"

import React, { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Trash2,
  Download,
  Send,
  Loader2
} from "lucide-react"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { useSyncManager } from "@/lib/offline-sync"
import { 
  getPendingSubmissions, 
  getPendingStats, 
  clearAllPendingSubmissions,
  exportPendingSubmissions,
  updateSubmissionStatus,
  type PendingFormSubmission 
} from "@/lib/offline-storage"
import { toast } from "@/lib/toast"
import { submitFormToGoogle } from "@/lib/google-forms"
import { syncServiceOrderToOdoo } from "@/lib/odoo-service"
import { isOdooConfigured } from "@/lib/odoo-client"
import { sendServiceOrderToWhatsApp } from "@/lib/wazzup-api"
import { uploadImageToImgBB } from "@/lib/imgbb-upload"

interface PendingFormsListProps {
  onClose?: () => void
}

export function PendingFormsList({ onClose }: PendingFormsListProps) {
  const { isOnline, isChecking, lastChecked } = useNetworkStatus()
  const { syncNow, getStatus, addListener } = useSyncManager()
  const [pendingForms, setPendingForms] = useState<PendingFormSubmission[]>([])
  const [stats, setStats] = useState(getPendingStats())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

  // Función para actualizar la lista
  const refreshPendingForms = () => {
    const forms = getPendingSubmissions()
    const newStats = getPendingStats()
    setPendingForms(forms)
    setStats(newStats)
  }

  // Efecto para cargar formularios iniciales
  useEffect(() => {
    refreshPendingForms()
  }, [])

  // Listener para eventos de sincronización
  useEffect(() => {
    const removeListener = addListener((event) => {
      console.log('📡 Evento de sincronización:', event)
      
      switch (event.type) {
        case 'started':
          toast.info("Iniciando sincronización...", {
            description: `Procesando ${event.total} formularios pendientes`
          })
          break
          
        case 'form-uploaded':
          toast.success("Formulario enviado", {
            description: `Orden #${event.formData?.numeroOrden} enviada exitosamente`
          })
          refreshPendingForms()
          break
          
        case 'completed':
          toast.success("Sincronización completada", {
            description: `${event.processed}/${event.total} formularios enviados`
          })
          refreshPendingForms()
          break
          
        case 'error':
          toast.error("Error en sincronización", {
            description: event.error || "Error desconocido"
          })
          refreshPendingForms()
          break
      }
    })

    return removeListener
  }, [addListener])

  // Función para forzar sincronización
  const handleSyncNow = async () => {
    if (!isOnline) {
      toast.error("Sin conexión", {
        description: "No es posible sincronizar sin conexión a internet"
      })
      return
    }

    setIsRefreshing(true)
    try {
      await syncNow()
      toast.success("Sincronización iniciada", {
        description: "Los formularios se están procesando"
      })
    } catch (error) {
      toast.error("Error al iniciar sincronización", {
        description: "Inténtalo de nuevo en unos momentos"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Función para limpiar todos los formularios
  const handleClearAll = () => {
    if (confirm("¿Estás seguro de que quieres eliminar todos los formularios pendientes?")) {
      clearAllPendingSubmissions()
      refreshPendingForms()
      toast.success("Formularios eliminados", {
        description: "Todos los formularios pendientes han sido eliminados"
      })
    }
  }

  // Función para exportar formularios
  const handleExport = () => {
    const exported = exportPendingSubmissions()
    const blob = new Blob([exported], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `formularios-pendientes-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success("Formularios exportados", {
      description: "Archivo JSON descargado exitosamente"
    })
  }

  // Función para reenviar una orden completada
  const handleResend = async (form: PendingFormSubmission) => {
    if (!isOnline) {
      toast.error("Sin conexión", {
        description: "No es posible reenviar sin conexión a internet"
      })
      return
    }

    if (!confirm(`¿Desea reenviar la orden #${form.formData.numeroOrden} a Google Forms, WhatsApp y Odoo?`)) {
      return
    }

    setResendingId(form.id)
    
    // Guardar el estado original para restaurarlo en caso de error
    const originalStatus = form.status
    
    try {
      console.log('🔄 Reenviando orden completada:', form.formData.numeroOrden)
      
      // Marcar como uploading temporalmente
      updateSubmissionStatus(form.id, 'uploading')
      refreshPendingForms()
      
      // Preparar datos procesados (si hay base64, convertir a URL)
      let processedFormData = { ...form.formData }
      
      // Procesar imagen del formulario (aux1) si está en base64
      if (form.formData.aux1?.startsWith('data:image')) {
        console.log('🖼️ Subiendo imagen del formulario...')
        try {
          const base64Data = form.formData.aux1.split(',')[1]
          const result = await uploadImageToImgBB(
            base64Data,
            `orden-${form.formData.numeroOrden}-reenvio-${Date.now()}`
          )
          processedFormData.aux1 = result.data.url
          console.log('✅ Imagen subida:', result.data.url)
        } catch (error) {
          console.warn('⚠️ Error subiendo imagen:', error)
        }
      }

      // Procesar firmas si están en base64
      if (form.formData.tecnicoFirma?.startsWith('data:image')) {
        try {
          const base64Data = form.formData.tecnicoFirma.split(',')[1]
          const result = await uploadImageToImgBB(
            base64Data,
            `firma-tecnico-${form.formData.numeroOrden}-reenvio-${Date.now()}`
          )
          processedFormData.tecnicoFirma = result.data.url
        } catch (error) {
          console.warn('⚠️ Error subiendo firma técnico:', error)
        }
      }

      if (form.formData.clienteFirma?.startsWith('data:image')) {
        try {
          const base64Data = form.formData.clienteFirma.split(',')[1]
          const result = await uploadImageToImgBB(
            base64Data,
            `firma-cliente-${form.formData.numeroOrden}-reenvio-${Date.now()}`
          )
          processedFormData.clienteFirma = result.data.url
        } catch (error) {
          console.warn('⚠️ Error subiendo firma cliente:', error)
        }
      }

      let successCount = 0
      let errorMessages: string[] = []

      // 1. Enviar a Google Forms
      toast.info("Enviando a Google Forms...")
      try {
        const googleResult = await submitFormToGoogle(processedFormData)
        if (googleResult.success) {
          successCount++
          console.log('✅ Google Forms enviado')
        } else {
          errorMessages.push('Google Forms: ' + (googleResult.error || 'Error desconocido'))
        }
      } catch (error) {
        console.error('❌ Error enviando a Google Forms:', error)
        errorMessages.push('Google Forms: ' + (error instanceof Error ? error.message : 'Error'))
      }

      // 2. Enviar a Odoo (si está configurado)
      if (isOdooConfigured()) {
        toast.info("Enviando a Odoo...")
        try {
          const odooResult = await syncServiceOrderToOdoo(processedFormData)
          if (odooResult.success) {
            successCount++
            console.log('✅ Odoo enviado:', odooResult.orderId)
          } else {
            errorMessages.push('Odoo: ' + (odooResult.error || 'Error desconocido'))
          }
        } catch (error) {
          console.error('❌ Error enviando a Odoo:', error)
          errorMessages.push('Odoo: ' + (error instanceof Error ? error.message : 'Error'))
        }
      }

      // 3. Enviar por WhatsApp (si hay teléfono y imagen URL)
      const imageUrl = processedFormData.aux1
      if (form.formData.telefono && imageUrl && imageUrl.startsWith('http')) {
        toast.info("Enviando por WhatsApp...")
        try {
          const whatsappResult = await sendServiceOrderToWhatsApp(
            form.formData.telefono,
            processedFormData,
            imageUrl
          )
          if (whatsappResult.success) {
            successCount++
            console.log('✅ WhatsApp enviado al cliente')

            // Enviar también al técnico si tiene teléfono diferente
            if (processedFormData.aux3 && processedFormData.aux3 !== form.formData.telefono) {
              try {
                const techResult = await sendServiceOrderToWhatsApp(
                  processedFormData.aux3,
                  processedFormData,
                  imageUrl
                )
                if (techResult.success) {
                  console.log('✅ WhatsApp enviado al técnico')
                }
              } catch (error) {
                console.warn('⚠️ Error enviando WhatsApp al técnico:', error)
              }
            }
          } else {
            errorMessages.push('WhatsApp: ' + (whatsappResult.error || 'Error desconocido'))
          }
        } catch (error) {
          console.error('❌ Error enviando por WhatsApp:', error)
          errorMessages.push('WhatsApp: ' + (error instanceof Error ? error.message : 'Error'))
        }
      }

      // Marcar como completado si todo fue exitoso, sino restaurar estado original
      const finalStatus = successCount > 0 ? 'completed' : originalStatus
      updateSubmissionStatus(form.id, finalStatus)
      refreshPendingForms()

      // Mostrar resultado
      if (successCount > 0) {
        toast.success("Reenvío completado", {
          description: `${successCount} servicio(s) enviado(s) exitosamente${errorMessages.length > 0 ? `. Algunos fallos: ${errorMessages.join(', ')}` : ''}`,
          duration: 5000
        })
      } else {
        toast.error("Reenvío fallido", {
          description: errorMessages.join(', '),
          duration: 5000
        })
      }

    } catch (error) {
      console.error('❌ Error en reenvío:', error)
      toast.error("Error en reenvío", {
        description: error instanceof Error ? error.message : "Error desconocido"
      })
      // Restaurar el estado original
      updateSubmissionStatus(form.id, originalStatus)
      refreshPendingForms()
    } finally {
      setResendingId(null)
    }
  }

  // Función para obtener el color del estado
  const getStatusColor = (status: PendingFormSubmission['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'uploading': return 'bg-blue-500'
      case 'failed': return 'bg-red-500'
      case 'completed': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  // Función para formatear fecha
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Formularios Pendientes</h2>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="flex items-center gap-1 text-green-600">
                <Wifi className="w-4 h-4" />
                <span className="text-sm">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600">
                <WifiOff className="w-4 h-4" />
                <span className="text-sm">Offline</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={pendingForms.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncNow}
            disabled={!isOnline || isRefreshing || pendingForms.length === 0}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearAll}
            disabled={pendingForms.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpiar Todo
          </Button>
          
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-sm text-yellow-600">Pendientes</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">{stats.uploading}</div>
          <div className="text-sm text-blue-600">Subiendo</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
          <div className="text-sm text-red-600">Fallidos</div>
        </div>
      </div>

      {/* Lista de formularios */}
      <div className="space-y-4">
        {pendingForms.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p className="text-lg font-medium">No hay formularios pendientes</p>
            <p className="text-sm">Todos los formularios han sido enviados exitosamente</p>
          </div>
        ) : (
          pendingForms.map((form) => (
            <Card key={form.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">
                      Orden #{form.formData.numeroOrden}
                    </h3>
                    <Badge className={`${getStatusColor(form.status)} text-white`}>
                      {form.status === 'pending' && 'Pendiente'}
                      {form.status === 'uploading' && 'Subiendo'}
                      {form.status === 'failed' && 'Falló'}
                      {form.status === 'completed' && 'Completado'}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      Intentos: {form.attempts}/3
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <strong>Cliente:</strong> {form.formData.razonSocial || 'Sin especificar'}
                    </div>
                    <div>
                      <strong>Fecha:</strong> {form.formData.fecha || 'Sin fecha'}
                    </div>
                    <div>
                      <strong>Creado:</strong> {formatDate(form.createdAt)}
                    </div>
                    <div>
                      <strong>Último intento:</strong> {
                        form.lastAttempt ? formatDate(form.lastAttempt) : 'Nunca'
                      }
                    </div>
                  </div>
                  
                  {form.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <strong>Error:</strong> {form.error}
                    </div>
                  )}
                </div>
                
                <div className="ml-4 flex items-center gap-2">
                  {/* Botón de reenvío - Disponible para TODOS los estados */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResend(form)}
                    disabled={!isOnline || resendingId === form.id}
                    title="Reenviar a Google Forms, WhatsApp y Odoo"
                    className={form.status === 'completed' ? 'border-green-500' : ''}
                  >
                    {resendingId === form.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                  
                  {/* Iconos de estado */}
                  {form.status === 'pending' && <Clock className="w-6 h-6 text-yellow-500" />}
                  {form.status === 'uploading' && <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />}
                  {form.status === 'failed' && <AlertCircle className="w-6 h-6 text-red-500" />}
                  {form.status === 'completed' && <CheckCircle className="w-6 h-6 text-green-500" />}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      
      {lastChecked && (
        <div className="mt-6 text-center text-sm text-gray-500">
          Última verificación de conectividad: {formatDate(lastChecked)}
        </div>
      )}
    </Card>
  )
}