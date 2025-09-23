"use client"

import React, { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { FormData } from "@/hooks/use-form-data"

interface SavedOrder {
  id: string
  filename: string
  data: FormData
  timestamp: Date
  imageFilename?: string
}

interface SavedOrdersViewerProps {
  onLoadOrder?: (orderData: FormData) => void
}

export function SavedOrdersViewer({ onLoadOrder }: SavedOrdersViewerProps) {
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<SavedOrder | null>(null)
  const [showViewer, setShowViewer] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Cargar archivos JSON de órdenes
  const handleLoadJSONFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newOrders: SavedOrder[] = []

    Array.from(files).forEach((file) => {
      if (file.name.endsWith('.json')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string
            const data = JSON.parse(content) as FormData
            
            const order: SavedOrder = {
              id: `${file.name}-${Date.now()}`,
              filename: file.name,
              data,
              timestamp: new Date(file.lastModified),
            }
            
            newOrders.push(order)
            
            // Si hemos procesado todos los archivos
            if (newOrders.length === files.length) {
              setSavedOrders(prev => [...prev, ...newOrders])
              toast.success(`${newOrders.length} órdenes cargadas`, {
                description: "Archivos JSON procesados correctamente"
              })
            }
          } catch (error) {
            console.error('Error parsing JSON:', error)
            toast.error(`Error en ${file.name}`, {
              description: "No se pudo leer el archivo JSON"
            })
          }
        }
        reader.readAsText(file)
      }
    })

    // Reset del input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Cargar imágenes asociadas
  const handleLoadImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        // Buscar orden correspondiente basada en el nombre del archivo
        const orderMatch = savedOrders.find(order => {
          const orderNumber = order.data.numeroOrden
          const dateStr = order.timestamp.toISOString().split('T')[0]
          return file.name.includes(orderNumber || 'nueva') || file.name.includes(dateStr)
        })

        if (orderMatch) {
          setSavedOrders(prev => prev.map(order => 
            order.id === orderMatch.id 
              ? { ...order, imageFilename: file.name }
              : order
          ))
        }
      }
    })

    toast.success("Imágenes asociadas", {
      description: "Se vincularon las imágenes con sus órdenes"
    })

    // Reset del input
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getOrderSummary = (data: FormData) => {
    const parts = []
    if (data.numeroOrden) parts.push(`Orden: ${data.numeroOrden}`)
    if (data.razonSocial) parts.push(`Cliente: ${data.razonSocial}`)
    if (data.equipo) parts.push(`Equipo: ${data.equipo}`)
    return parts.join(' | ') || 'Sin datos principales'
  }

  const getServiceTypes = (data: FormData) => {
    const services = []
    if (data.servicioTecnico) services.push("Técnico")
    if (data.instalacion) services.push("Instalación")
    if (data.puestaEnMarcha) services.push("Puesta en Marcha")
    if (data.capacitacion) services.push("Capacitación")
    if (data.calibracion) services.push("Calibración")
    if (data.tercero) services.push("Tercero")
    return services.length > 0 ? services.join(", ") : "Sin servicios definidos"
  }

  const getBillingType = (data: FormData) => {
    if (data.conCargo) return "Con Cargo"
    if (data.sinCargo) return "Sin Cargo"
    if (data.servicioEnGarantia) return "En Garantía"
    if (data.aConvenir) return "A Convenir"
    return "Sin definir"
  }

  const getLocationInfo = (data: FormData) => {
    const location = []
    if (data.servicioACampo) location.push("A Campo")
    if (data.servicioEnOficina) location.push("En Oficina")
    const locationStr = location.length > 0 ? location.join(", ") : "Sin ubicación"
    
    if (data.localidad || data.provincia) {
      const place = [data.localidad, data.provincia].filter(Boolean).join(", ")
      return `${locationStr} - ${place}`
    }
    
    return locationStr
  }

  if (!showViewer) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setShowViewer(true)}
          className="rounded-full shadow-lg"
          size="lg"
        >
          📁 Ver Órdenes Guardadas
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>📁 Órdenes Guardadas Localmente</CardTitle>
            <CardDescription>
              Gestionar y visualizar órdenes de servicio guardadas en tu dispositivo
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowViewer(false)}
            size="sm"
          >
            ✕ Cerrar
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Área de carga de archivos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/10">
            <div>
              <Label htmlFor="json-files">Cargar archivos JSON:</Label>
              <Input
                id="json-files"
                ref={fileInputRef}
                type="file"
                multiple
                accept=".json"
                onChange={handleLoadJSONFiles}
                className="cursor-pointer"
              />
            </div>
            <div>
              <Label htmlFor="image-files">Cargar imágenes asociadas:</Label>
              <Input
                id="image-files"
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleLoadImages}
                className="cursor-pointer"
              />
            </div>
          </div>
          
          {/* Acciones rápidas */}
          {savedOrders.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-blue-50 rounded-lg">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSavedOrders([])
                  toast.success("Lista limpiada", {
                    description: "Se eliminaron todas las órdenes de la vista"
                  })
                }}
              >
                🗑️ Limpiar Lista
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const ordersWithImages = savedOrders.filter(o => o.imageFilename).length
                  toast.info("Estadísticas", {
                    description: `${savedOrders.length} órdenes, ${ordersWithImages} con imágenes`
                  })
                }}
              >
                📊 Ver Stats
              </Button>
            </div>
          )}

          {/* Lista de órdenes y visor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[60vh] overflow-hidden">
            {/* Lista de órdenes */}
            <div className="space-y-2 overflow-y-auto">
              <h3 className="font-semibold text-lg">Órdenes Cargadas ({savedOrders.length})</h3>
              {savedOrders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No hay órdenes cargadas.<br />
                  Selecciona archivos JSON para comenzar.
                </p>
              ) : (
                <div className="space-y-2">
                  {savedOrders.map((order) => (
                    <Card 
                      key={order.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedOrder?.id === order.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{order.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {getOrderSummary(order.data)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(order.timestamp)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {order.imageFilename && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                📷 Imagen
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                onLoadOrder?.(order.data)
                                toast.success("Orden cargada", {
                                  description: "Datos cargados en el formulario"
                                })
                              }}
                            >
                              Cargar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Visor de detalles */}
            <div className="overflow-y-auto">
              {selectedOrder ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Detalles de la Orden</h3>
                    <Button
                      onClick={() => {
                        onLoadOrder?.(selectedOrder.data)
                        setShowViewer(false)
                        toast.success("Orden cargada", {
                          description: "Datos cargados en el formulario principal"
                        })
                      }}
                    >
                      📝 Editar en Formulario
                    </Button>
                  </div>
                  
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>Archivo:</strong> {selectedOrder.filename}</div>
                        <div><strong>Fecha:</strong> {formatDate(selectedOrder.timestamp)}</div>
                        <div><strong>Orden #:</strong> {selectedOrder.data.numeroOrden || 'Sin número'}</div>
                        <div><strong>Cliente:</strong> {selectedOrder.data.razonSocial || 'Sin cliente'}</div>
                        <div><strong>Equipo:</strong> {selectedOrder.data.equipo || 'Sin equipo'}</div>
                        <div><strong>Máquina:</strong> {selectedOrder.data.maquina || 'Sin máquina'}</div>
                      </div>
                      
                      {/* Información de servicio */}
                      <div className="border-t pt-2 space-y-2">
                        <div>
                          <strong>Tipos de Servicio:</strong>
                          <p className="text-sm bg-blue-50 p-2 rounded mt-1">
                            {getServiceTypes(selectedOrder.data)}
                          </p>
                        </div>
                        
                        <div>
                          <strong>Ubicación:</strong>
                          <p className="text-sm bg-green-50 p-2 rounded mt-1">
                            {getLocationInfo(selectedOrder.data)}
                          </p>
                        </div>
                        
                        <div>
                          <strong>Facturación:</strong>
                          <p className="text-sm bg-yellow-50 p-2 rounded mt-1">
                            {getBillingType(selectedOrder.data)}
                          </p>
                        </div>
                      </div>
                      
                      {selectedOrder.data.descripcion && (
                        <div>
                          <strong>Descripción:</strong>
                          <p className="text-sm bg-muted p-2 rounded mt-1">
                            {selectedOrder.data.descripcion}
                          </p>
                        </div>
                      )}
                      
                      {selectedOrder.data.insumos && (
                        <div>
                          <strong>Insumos:</strong>
                          <p className="text-sm bg-muted p-2 rounded mt-1">
                            {selectedOrder.data.insumos}
                          </p>
                        </div>
                      )}

                      {/* Información de contacto y técnico */}
                      <div className="border-t pt-2 space-y-2">
                        {selectedOrder.data.contacto && (
                          <div>
                            <strong>Contacto:</strong> {selectedOrder.data.contacto}
                            {selectedOrder.data.telefono && ` - ${selectedOrder.data.telefono}`}
                          </div>
                        )}
                        
                        {selectedOrder.data.tecnicoNombre && (
                          <div>
                            <strong>Técnico:</strong> {selectedOrder.data.tecnicoNombre}
                          </div>
                        )}
                        
                        {(selectedOrder.data.duracion || selectedOrder.data.distancia) && (
                          <div className="text-sm text-muted-foreground">
                            {selectedOrder.data.duracion && `Duración: ${selectedOrder.data.duracion}`}
                            {selectedOrder.data.duracion && selectedOrder.data.distancia && ' | '}
                            {selectedOrder.data.distancia && `Distancia: ${selectedOrder.data.distancia}`}
                          </div>
                        )}
                      </div>

                      {selectedOrder.imageFilename && (
                        <div>
                          <strong>Imagen Asociada:</strong>
                          <p className="text-sm text-green-600">📷 {selectedOrder.imageFilename}</p>
                        </div>
                      )}

                      {selectedOrder.data.aux1 && (
                        <div>
                          <strong>URL/Referencia:</strong>
                          <p className="text-xs bg-blue-50 p-2 rounded mt-1 break-all">
                            {selectedOrder.data.aux1}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Selecciona una orden para ver sus detalles</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}