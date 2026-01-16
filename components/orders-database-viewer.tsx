/**
 * Visualizador de Base de Datos Local de Órdenes
 * Funciona como una tabla/hoja de cálculo interna
 */

"use client"

import React, { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  getAllOrders, 
  searchOrders, 
  getOrdersByStatus, 
  getDatabaseStats,
  archiveOrder,
  type OrderRecord 
} from "@/lib/local-database"
import { toast } from "@/lib/toast"
import { sendServiceOrderToWhatsApp } from "@/lib/wazzup-api"

// Iconos simples usando Unicode
const Icons = {
  Database: () => <span>🗃️</span>,
  Search: () => <span>🔍</span>,
  User: () => <span>👤</span>,
  FileText: () => <span>📄</span>,
  CheckCircle: () => <span>✅</span>,
  Clock: () => <span>🕐</span>,
  Archive: () => <span>📦</span>,
  Eye: () => <span>👁️</span>,
  RefreshCw: () => <span>🔄</span>,
  Calendar: () => <span>📅</span>,
  WhatsApp: () => <span>📱</span>,
  Send: () => <span>📤</span>,
  Edit: () => <span>✏️</span>
}

// Funciones auxiliares para estado de órdenes
const getStatusColor = (status: OrderRecord['status']) => {
  switch (status) {
    case 'draft': return 'bg-gray-500'
    case 'completed': return 'bg-blue-500'
    case 'local-only': return 'bg-red-500'      // Rojo: Solo local
    case 'partial': return 'bg-yellow-500'      // Amarillo: Envío parcial
    case 'sent': return 'bg-green-500'          // Verde: Todo enviado
    case 'archived': return 'bg-gray-600'
    default: return 'bg-gray-400'
  }
}

const getStatusText = (status: OrderRecord['status']) => {
  switch (status) {
    case 'draft': return 'Borrador'
    case 'completed': return 'Completado'
    case 'local-only': return 'Solo Local'
    case 'partial': return 'Envío Parcial'
    case 'sent': return 'Enviado'
    case 'archived': return 'Archivado'
    default: return 'Desconocido'
  }
}

const getStatusIcon = (status: OrderRecord['status']) => {
  switch (status) {
    case 'local-only': return '💾'  // Rojo
    case 'partial': return '⚠️'     // Amarillo
    case 'sent': return '✅'        // Verde
    default: return '📄'
  }
}

interface OrdersDatabaseViewerProps {
  onClose?: () => void
  onEditOrder?: (order: OrderRecord) => void
}

export function OrdersDatabaseViewer({ onClose, onEditOrder }: OrdersDatabaseViewerProps) {
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [filteredOrders, setFilteredOrders] = useState<OrderRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderRecord['status'] | 'all'>('all')
  const [stats, setStats] = useState(getDatabaseStats())
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null)
  
  // Cargar datos
  useEffect(() => {
    loadData()
  }, [])
  
  // Filtrar por búsqueda y estado
  useEffect(() => {
    let filtered = orders
    
    if (searchQuery.trim()) {
      filtered = searchOrders(searchQuery)
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter)
    }
    
    setFilteredOrders(filtered)
  }, [orders, searchQuery, statusFilter])
  
  const loadData = () => {
    try {
      const allOrders = getAllOrders()
      setOrders(allOrders)
      setStats(getDatabaseStats())
    } catch (error) {
      console.error('Error cargando órdenes:', error)
      toast.error("Error", { description: "No se pudieron cargar las órdenes" })
    }
  }
  
  const handleRefresh = () => {
    loadData()
    toast.success("Datos actualizados", { description: "Base de datos recargada" })
  }
  
  const handleArchive = (order: OrderRecord) => {
    const shouldArchive = confirm(
      `¿Archivar la orden ${order.numeroOrden}?\\n\\nEsta acción marcará la orden como archivada.`
    )
    
    if (shouldArchive) {
      try {
        archiveOrder(order.id, "Archivada desde visualizador")
        loadData()
        toast.success("Orden archivada", { 
          description: `${order.numeroOrden} ha sido archivada` 
        })
      } catch (error) {
        toast.error("Error", { description: "No se pudo archivar la orden" })
      }
    }
  }
  
  const handleWhatsAppResend = async (order: OrderRecord) => {
    // 🔒 Si está en estado "sent" (todo enviado), informar que solo se reenvía WhatsApp
    if (order.status === 'sent') {
      toast.info("Reenvío de WhatsApp únicamente", { 
        description: "Esta orden ya fue enviada completamente. Solo se reenviará por WhatsApp.",
        duration: 3000
      })
    }
    
    if (!order.formData.telefono) {
      toast.error("Sin teléfono", { 
        description: "Esta orden no tiene un número de teléfono registrado" 
      })
      return
    }
    
    if (!order.imageUrl || !order.imageUrl.startsWith('http')) {
      toast.error("Sin imagen", { 
        description: "Esta orden no tiene una imagen válida para enviar" 
      })
      return
    }
    
    const statusMsg = order.status === 'sent' 
      ? '✅ Estado: Enviado completamente\n⚠️ Solo se reenviará WhatsApp (Google Forms y Odoo ya registrados)'
      : `📊 Estado: ${getStatusText(order.status)}\n⚠️ Se reenviará solo WhatsApp`
    
    const shouldResend = confirm(
      `¿Reenviar orden ${order.numeroOrden} por WhatsApp?\n\n` +
      `${statusMsg}\n\n` +
      `Se enviará a:\n` +
      `📱 Cliente: ${order.formData.telefono}\n` +
      (order.formData.aux3 ? `👨‍🔧 Técnico: ${order.formData.aux3}\n` : '') +
      `\nRazón Social: ${order.formData.razonSocial || 'Sin especificar'}`
    )
    
    if (!shouldResend) return
    
    try {
      toast.info("Reenviando por WhatsApp...", { 
        description: `Enviando orden ${order.numeroOrden}` 
      })
      
      // Enviar al cliente
      const result = await sendServiceOrderToWhatsApp(
        order.formData.telefono,
        order.formData,
        order.imageUrl
      )
      
      if (result.success) {
        // Si tiene técnico, enviar también
        if (order.formData.aux3) {
          try {
            await sendServiceOrderToWhatsApp(
              order.formData.aux3,
              order.formData,
              order.imageUrl
            )
            toast.success("¡Reenviado exitosamente!", { 
              description: `Orden ${order.numeroOrden} enviada al cliente y técnico`,
              duration: 4000 
            })
          } catch (tecError) {
            toast.success("Reenvío parcial", { 
              description: `Enviado al cliente. Falló envío al técnico.`,
              duration: 4000 
            })
          }
        } else {
          toast.success("¡Reenviado exitosamente!", { 
            description: `Orden ${order.numeroOrden} enviada por WhatsApp`,
            duration: 4000 
          })
        }
      } else {
        toast.error("Error en reenvío", { 
          description: `No se pudo reenviar: ${result.error || 'Error desconocido'}` 
        })
      }
    } catch (error) {
      console.error('Error en reenvío por WhatsApp:', error)
      toast.error("Error en reenvío", { 
        description: "No se pudo conectar con el servicio de WhatsApp" 
      })
    }
  }
  
  const handleEdit = (order: OrderRecord) => {
    if (order.status !== 'draft') {
      toast.error("No se puede editar", { 
        description: "Solo se pueden editar órdenes en estado Borrador" 
      })
      return
    }
    
    const shouldEdit = confirm(
      `¿Cargar la orden ${order.numeroOrden} en el formulario para editarla?\n\nLos datos actuales del formulario se sobrescribirán.`
    )
    
    if (shouldEdit && onEditOrder) {
      onEditOrder(order)
      if (onClose) onClose()
      toast.success("Orden cargada", { 
        description: `${order.numeroOrden} lista para editar` 
      })
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Icons.Database />
              <h2 className="text-2xl font-bold">Registros Anteriores - Órdenes de Servicio</h2>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <Icons.RefreshCw />
                <span className="ml-2">Actualizar</span>
              </Button>
              {onClose && (
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cerrar
                </Button>
              )}
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.localOnly}</div>
              <div className="text-sm text-red-600">💾 Solo Local</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.partial}</div>
              <div className="text-sm text-yellow-600">⚠️ Parcial</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
              <div className="text-sm text-green-600">✅ Enviados</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{stats.drafts}</div>
              <div className="text-sm text-gray-600">Borradores</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{stats.archived}</div>
              <div className="text-sm text-gray-600">Archivados</div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <Icons.Search />
              </span>
              <Input
                placeholder="Buscar por número, cliente, contacto, descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">Todos los estados</option>
                <option value="draft">Borradores</option>
                <option value="completed">Completados</option>
                <option value="sent">Enviados</option>
                <option value="archived">Archivados</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-full">
            <table className="w-full">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Número Orden
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha Creación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Última Act.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <Icons.FileText />
                        <span className="font-medium text-sm ml-2">
                          {order.numeroOrden}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <Icons.User />
                        <span className="text-sm ml-2">
                          {order.formData.razonSocial || 'Sin especificar'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {order.formData.contacto || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${getStatusColor(order.status)} text-white text-xs`}>
                        {getStatusIcon(order.status)} {getStatusText(order.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(order.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setSelectedOrder(order)}
                          title="Ver detalles"
                        >
                          <Icons.Eye />
                        </Button>
                        {order.status === 'draft' && onEditOrder && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-blue-600"
                            onClick={() => handleEdit(order)}
                            title="Editar borrador"
                          >
                            <Icons.Edit />
                          </Button>
                        )}
                        {order.status !== 'archived' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-yellow-600"
                            onClick={() => handleArchive(order)}
                            title="Archivar"
                          >
                            <Icons.Archive />
                          </Button>
                        )}
                        {order.imageUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-blue-600"
                            onClick={() => window.open(order.imageUrl, '_blank')}
                            title="Ver imagen"
                          >
                            <Icons.FileText />
                          </Button>
                        )}
                        {order.formData.telefono && order.imageUrl && order.imageUrl.startsWith('http') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-green-600"
                            onClick={() => handleWhatsAppResend(order)}
                            title="Reenviar por WhatsApp"
                          >
                            <Icons.WhatsApp />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">
                  <Icons.Database />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay órdenes
                </h3>
                <p className="text-gray-600">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No se encontraron órdenes con los filtros aplicados.'
                    : 'Aún no hay registros anteriores.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      {/* Modal de detalles */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}

// Modal para mostrar detalles de una orden
function OrderDetailModal({ order, onClose }: { order: OrderRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">
              Detalles - Orden {order.numeroOrden}
            </h3>
            <Button variant="outline" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Estado</label>
                <p className="mt-1">
                  <Badge className={`${getStatusColor(order.status)} text-white`}>
                    {getStatusIcon(order.status)} {getStatusText(order.status)}
                  </Badge>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Google Forms</label>
                <p className="mt-1">
                  {order.googleFormsSent ? (
                    <span className="text-green-600 font-medium">✅ Enviado</span>
                  ) : (
                    <span className="text-red-600 font-medium">❌ No enviado</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Odoo FSM</label>
                <p className="mt-1">
                  {order.odooSent ? (
                    <span className="text-green-600 font-medium">✅ Enviado</span>
                  ) : (
                    <span className="text-red-600 font-medium">❌ No enviado</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">WhatsApp Cliente</label>
                <p className="mt-1">
                  {order.whatsappClientSent ? (
                    <span className="text-green-600 font-medium">✅ Enviado</span>
                  ) : (
                    <span className="text-red-600 font-medium">❌ No enviado</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">WhatsApp Técnico</label>
                <p className="mt-1">
                  {order.whatsappTechSent ? (
                    <span className="text-green-600 font-medium">✅ Enviado</span>
                  ) : (
                    <span className="text-gray-500 font-medium">➖ No enviado</span>
                  )}
                </p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Razón Social</label>
              <p className="mt-1">{order.formData.razonSocial || 'N/A'}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Contacto</label>
              <p className="mt-1">{order.formData.contacto || 'N/A'}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Descripción</label>
              <p className="mt-1 text-sm bg-gray-50 p-3 rounded">
                {order.formData.descripcion || 'Sin descripción'}
              </p>
            </div>
            
            {order.imageUrl && (
              <div>
                <label className="text-sm font-medium text-gray-600">Imagen</label>
                <p className="mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(order.imageUrl, '_blank')}
                  >
                    Ver imagen completa
                  </Button>
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-sm font-medium text-gray-600">Creado</label>
                <p className="mt-1">{formatDate(order.createdAt)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Actualizado</label>
                <p className="mt-1">{formatDate(order.updatedAt)}</p>
              </div>
            </div>
            
            {order.sentAt && (
              <div>
                <label className="text-sm font-medium text-gray-600">Enviado</label>
                <p className="mt-1">{formatDate(order.sentAt)}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

// Función auxiliar para formato de fecha
function formatDate(date: Date) {
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}