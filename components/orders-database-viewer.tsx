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
  deleteOrder,
  type OrderRecord 
} from "@/lib/local-database"
import { toast } from "@/lib/toast"
import type { FormData } from "@/hooks/use-form-data"
import { generateOrderNumber } from "@/lib/order-number"
import { sendServiceOrderToWhatsApp, sendServiceOrderToGroup } from "@/lib/wazzup-api"
import { submitFormToGoogle } from "@/lib/google-forms"
import { syncServiceOrderToOdoo } from "@/lib/odoo-service"
import { getOdooClient, isOdooConfigured } from "@/lib/odoo-client"
import { uploadImageToImgBB } from "@/lib/imgbb-upload"
import { useNetworkStatus } from "@/hooks/use-network-status"

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
  Image: () => <span>🖼️</span>,
  RefreshCw: () => <span>🔄</span>,
  Calendar: () => <span>📅</span>,
  WhatsApp: () => <span>📱</span>,
  Send: () => <span>📤</span>,
  Edit: () => <span>✏️</span>,
  Loader: () => <span className="inline-block animate-spin">⏳</span>
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

/**
 * Formatea CUIT argentino de "XXXXXXXXXXX" o "ARXXXXXXXXXXX" a "XX-XXXXXXXX-X"
 */
function formatCuit(raw: string): string {
  if (!raw) return ''
  // Quitar prefijo AR, espacios, puntos y guiones existentes
  const digits = raw.replace(/^AR/i, '').replace(/[\s.\-]/g, '')
  if (digits.length === 11 && /^\d{11}$/.test(digits)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
  }
  return raw // devolver original si no matchea el formato
}

/**
 * Convierte una tarea pendiente de Odoo a FormData para cargar en el formulario
 * Nota: Odoo devuelve `false` para campos vacíos en lugar de null/""
 */
function mapOdooTaskToFormData(task: any, tecnicoNombre: string, tecnicoFirma: string, tecnicoPhone: string): FormData {
  // Helper: Odoo devuelve false para campos char vacíos
  const str = (val: any): string => (typeof val === 'string' ? val : '')

  // Helper: obtener valor del partner con fallback a x_studio_*
  const partnerStr = (partnerVal: any, studioVal: any): string => {
    const pv = str(partnerVal)
    return pv || str(studioVal)
  }

  // Convertir fecha YYYY-MM-DD a DD-MM-YYYY
  let fecha = ''
  const fechaRaw = str(task.x_studio_fecha)
  if (fechaRaw) {
    const [year, month, day] = fechaRaw.split('-')
    fecha = `${day}-${month}-${year}`
  } else {
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()
    fecha = `${dd}-${mm}-${yyyy}`
  }

  // Obtener partner_id (puede venir como [id, name] o como número)
  let odooPartnerId: number | null = null
  if (task.partner_id) {
    if (Array.isArray(task.partner_id)) {
      odooPartnerId = task.partner_id[0]
    } else if (typeof task.partner_id === 'number') {
      odooPartnerId = task.partner_id
    }
  }

  // Extraer datos del partner con jerarquía empresa/contacto
  const p = task._partner
  const parent = p?._parent

  // Razón social: empresa padre > parent_id[1] > partner name > x_studio
  // Razón social: si tiene padre → nombre del padre (empresa); sino → nombre del partner → x_studio
  const razonSocial = partnerStr(
    parent?.name || (p?.parent_id && Array.isArray(p.parent_id) ? p.parent_id[1] : null) || p?.name,
    task.x_studio_razon_social
  )

  // CUIT: empresa padre vat > partner vat > x_studio (formateado con guiones)
  const cuit = formatCuit(partnerStr(
    parent?.vat || p?.vat,
    task.x_studio_cuit
  ))

  // Contacto: si partner tiene padre (es contacto hijo de empresa), su nombre es el contacto
  // Si partner ES empresa, buscar en _child (contacto hijo) > x_studio
  // Si no tiene datos, queda vacío
  const hasParent = p?.parent_id && (Array.isArray(p.parent_id) || parent)
  const child = p?._child
  const contacto = hasParent
    ? partnerStr(p.name, task.x_studio_nombre_del_contacto)
    : partnerStr(child?.name, task.x_studio_nombre_del_contacto)

  // Teléfono: partner phone > padre phone > child phone > partner_phone de la tarea > x_studio
  const telefono = partnerStr(
    p?.phone || parent?.phone || child?.phone || task.partner_phone,
    task.x_studio_telefono_del_contacto
  )

  // Localidad: partner city > padre city > x_studio
  const localidad = partnerStr(
    p?.city || parent?.city,
    task.x_studio_localidad
  )

  // Provincia: partner state > padre state > x_studio
  const stateFromPartner = p?.state_id && Array.isArray(p.state_id) ? p.state_id[1] : null
  const stateFromParent = parent?.state_id && Array.isArray(parent.state_id) ? parent.state_id[1] : null
  const provincia = partnerStr(
    stateFromPartner || stateFromParent,
    task.x_studio_provincia
  )

  // Dirección: partner street > padre street
  const direccion = str(p?.street || parent?.street || '')

  console.log('📋 Mapeo de tarea a FormData:', {
    razonSocial, cuit, contacto, telefono, localidad, provincia, direccion,
    partnerExists: !!p, parentExists: !!parent, hasParent: !!hasParent,
    childExists: !!child, childName: child?.name,
    partnerName: p?.name, partnerIsCompany: p?.is_company,
    parentId: p?.parent_id, parentName: parent?.name,
    partnerVat: p?.vat, parentVat: parent?.vat,
    partnerPhone: p?.phone, partnerCity: p?.city,
  })

  return {
    numeroOrden: generateOrderNumber(),
    fecha,
    razonSocial,
    cuit,
    contacto,
    telefono,
    servicioTecnico: !!task.x_studio_servicio_tecnico,
    instalacion: !!task.x_studio_instalacion,
    puestaEnMarcha: !!task.x_studio_puesta_en_marcha,
    capacitacion: !!task.x_studio_capacitacion,
    calibracion: !!task.x_studio_calibracion,
    tercero: !!task.x_studio_tercero,
    maquina: str(task.x_studio_maquina),
    equipo: str(task.x_studio_equipo),
    descripcion: str(task.x_studio_descripcion_de_lo_acontecido),
    insumos: task._saleOrderLines && task._saleOrderLines.length > 0
      ? task._saleOrderLines.map((line: any) =>
          `${Math.round(line.quantity)};;${line.productCode};${line.productName};${line.priceUnit}`
        ).join('|')
      : '',
    servicioACampo: !!task.x_studio_servicio_a_campo,
    servicioEnOficina: !!task.x_studio_servicio_en_oficina,
    conCargo: !!task.x_studio_con_cargo,
    sinCargo: !!task.x_studio_sin_cargo,
    servicioEnGarantia: !!task.x_studio_servicio_en_garantia,
    aConvenir: !!task.x_studio_a_convenir,
    localidad,
    provincia,
    distancia: task.x_studio_distancia_km ? String(task.x_studio_distancia_km) : '',
    duracion: task.x_studio_duracion_hs ? String(task.x_studio_duracion_hs) : '',
    tipoCambio: '',
    iva: '',
    total: '',
    tecnicoNombre,
    tecnicoFirma,
    clienteNombre: '',
    clienteFirma: '',
    aux1: '',
    aux2: '',
    aux3: tecnicoPhone,
    aux4: '',
    odooPartnerId,
    odooTaskId: task.id,
    odooTaskName: str(task.name),
    odooSaleOrderId: task.sale_order_id
      ? (Array.isArray(task.sale_order_id) ? task.sale_order_id[0] : task.sale_order_id)
      : null,
  }
}

interface OrdersDatabaseViewerProps {
  onClose?: () => void
  onEditOrder?: (order: OrderRecord) => void
  onLoadFormData?: (data: FormData) => void
}

export function OrdersDatabaseViewer({ onClose, onEditOrder, onLoadFormData }: OrdersDatabaseViewerProps) {
  const { isOnline } = useNetworkStatus()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [filteredOrders, setFilteredOrders] = useState<OrderRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderRecord['status'] | 'all'>('all')
  const [stats, setStats] = useState(getDatabaseStats())
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [pendingTasks, setPendingTasks] = useState<any[]>([])
  const [showPending, setShowPending] = useState(false)
  const [loadingPending, setLoadingPending] = useState(false)
  const [pendingTaskDetail, setPendingTaskDetail] = useState<any | null>(null)
  
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
      `¿Archivar la orden ${order.numeroOrden}?\n\nEsta acción marcará la orden como archivada.`
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

  // Función para reenviar COMPLETO (Google Forms + Odoo + WhatsApp)
  const handleFullResend = async (order: OrderRecord) => {
    if (!isOnline) {
      toast.error("Sin conexión", {
        description: "No es posible reenviar sin conexión a internet"
      })
      return
    }

    const shouldResend = confirm(
      `¿Reenviar orden ${order.numeroOrden} COMPLETO?\n\n` +
      `Se enviará a:\n` +
      `📋 Google Forms\n` +
      `🔄 Odoo FSM (si está configurado)\n` +
      `📱 WhatsApp (cliente${order.formData.aux3 ? ' y técnico' : ''})\n\n` +
      `Razón Social: ${order.formData.razonSocial || 'Sin especificar'}\n` +
      `Estado actual: ${getStatusText(order.status)}`
    )

    if (!shouldResend) return

    setResendingId(order.id)

    try {
      console.log('🔄 Reenvío completo de orden:', order.numeroOrden)

      // Preparar datos procesados (convertir base64 a URLs si es necesario)
      let processedFormData = { ...order.formData }

      // Procesar imagen del formulario (aux1) si está en base64
      if (order.formData.aux1?.startsWith('data:image')) {
        console.log('🖼️ Subiendo imagen del formulario...')
        try {
          const base64Data = order.formData.aux1.split(',')[1]
          const result = await uploadImageToImgBB(
            base64Data,
            `orden-${order.numeroOrden}-reenvio-${Date.now()}`
          )
          processedFormData.aux1 = result.data.url
          console.log('✅ Imagen subida:', result.data.url)
        } catch (error) {
          console.warn('⚠️ Error subiendo imagen:', error)
        }
      }

      // Procesar firmas si están en base64
      if (order.formData.tecnicoFirma?.startsWith('data:image')) {
        try {
          const base64Data = order.formData.tecnicoFirma.split(',')[1]
          const result = await uploadImageToImgBB(
            base64Data,
            `firma-tecnico-${order.numeroOrden}-reenvio-${Date.now()}`
          )
          processedFormData.tecnicoFirma = result.data.url
        } catch (error) {
          console.warn('⚠️ Error subiendo firma técnico:', error)
        }
      }

      if (order.formData.clienteFirma?.startsWith('data:image')) {
        try {
          const base64Data = order.formData.clienteFirma.split(',')[1]
          const result = await uploadImageToImgBB(
            base64Data,
            `firma-cliente-${order.numeroOrden}-reenvio-${Date.now()}`
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
      if (order.formData.telefono && imageUrl && imageUrl.startsWith('http')) {
        toast.info("Enviando por WhatsApp...")
        try {
          const whatsappResult = await sendServiceOrderToWhatsApp(
            order.formData.telefono,
            processedFormData,
            imageUrl
          )
          if (whatsappResult.success) {
            successCount++
            console.log('✅ WhatsApp enviado al cliente')

            // Enviar también al técnico si tiene teléfono diferente
            if (processedFormData.aux3 && processedFormData.aux3 !== order.formData.telefono) {
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

      // 4. Enviar al grupo de WhatsApp
      try {
        const groupResult = await sendServiceOrderToGroup(processedFormData, imageUrl)
        if (groupResult.success) {
          console.log('✅ Orden enviada al grupo de WhatsApp')
        } else {
          console.warn('⚠️ No se pudo enviar al grupo:', groupResult.error)
        }
      } catch (error) {
        console.warn('⚠️ Error enviando al grupo:', error)
      }

      // Mostrar resultado
      if (successCount > 0) {
        toast.success("Reenvío completado", {
          description: `${successCount} servicio(s) enviado(s) exitosamente${errorMessages.length > 0 ? `. Algunos fallos: ${errorMessages.join(', ')}` : ''}`,
          duration: 5000
        })
        loadData() // Recargar para actualizar estados
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
    } finally {
      setResendingId(null)
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

  const handleDeleteRequest = (order: OrderRecord) => {
    setDeleteTarget(order)
    setDeleteConfirmText('')
  }

  const handleFetchPending = async () => {
    if (!isOnline) {
      toast.error("Sin conexión", { description: "Se requiere conexión para consultar Odoo" })
      return
    }

    if (!isOdooConfigured()) {
      toast.error("Odoo no configurado", { description: "Verificá las variables de entorno de Odoo" })
      return
    }

    // Obtener nombre del técnico desde localStorage
    let tecnicoNombre = ''
    try {
      const savedData = localStorage.getItem('aran-form-data')
      if (savedData) {
        const parsed = JSON.parse(savedData)
        tecnicoNombre = parsed.tecnicoNombre || ''
      }
    } catch (e) {
      console.warn('No se pudo leer tecnicoNombre de localStorage')
    }

    if (!tecnicoNombre) {
      toast.error("Sin técnico", { description: "No hay un técnico asociado al formulario actual" })
      return
    }

    setLoadingPending(true)
    try {
      console.log('📥 Buscando OS asignadas en Odoo para:', tecnicoNombre)
      const client = getOdooClient()

      const result = await client.searchRead(
        'project.task',
        [
          ['stage_id', '=', 105],
          ['x_studio_tecnico_asignado', 'ilike', tecnicoNombre]
        ],
        [
          'id', 'name', 'partner_id', 'partner_phone',
          'x_studio_orden_de_servicio', 'x_studio_fecha',
          'x_studio_razon_social', 'x_studio_nombre_del_contacto',
          'x_studio_telefono_del_contacto', 'x_studio_cuit',
          'x_studio_localidad',
          'x_studio_provincia', 'x_studio_maquina', 'x_studio_equipo',
          'x_studio_descripcion_de_lo_acontecido',
          'x_studio_tecnico_asignado', 'x_studio_aclaracion_del_tecnico',
          'x_studio_servicio_tecnico', 'x_studio_instalacion',
          'x_studio_puesta_en_marcha', 'x_studio_capacitacion',
          'x_studio_calibracion', 'x_studio_tercero',
          'x_studio_servicio_a_campo', 'x_studio_servicio_en_oficina',
          'x_studio_con_cargo', 'x_studio_sin_cargo',
          'x_studio_servicio_en_garantia', 'x_studio_a_convenir',
          'x_studio_distancia_km', 'x_studio_duracion_hs',
          'stage_id', 'date_deadline', 'planned_date_begin',
          'sale_order_id', 'sale_line_id'
        ],
        { order: 'x_studio_fecha desc', limit: 50 }
      )

      if (result.success && result.data) {
        const tasks = Array.isArray(result.data) ? result.data : []

        // Obtener datos del partner (cliente) para cada tarea
        const partnerIds = tasks
          .map((t: any) => Array.isArray(t.partner_id) ? t.partner_id[0] : (typeof t.partner_id === 'number' ? t.partner_id : null))
          .filter((id: number | null): id is number => id !== null)
        const uniquePartnerIds = [...new Set(partnerIds)]
        console.log('🔍 Partner IDs encontrados en tareas:', uniquePartnerIds)

        if (uniquePartnerIds.length > 0) {
          try {
            const partnerResult = await client.searchRead(
              'res.partner',
              [['id', 'in', uniquePartnerIds]],
              ['name', 'vat', 'phone', 'parent_id', 'is_company', 'city', 'state_id', 'street'],
              { limit: uniquePartnerIds.length }
            )
            console.log('👥 Resultado partners:', JSON.stringify(partnerResult, null, 2))
            if (partnerResult.success && Array.isArray(partnerResult.data)) {
              const partnerMap: Record<number, any> = {}
              for (const p of partnerResult.data) {
                partnerMap[p.id] = p
              }

              // Si algún partner es contacto (tiene parent_id), traer también la empresa padre
              const parentIds = partnerResult.data
                .filter((p: any) => p.parent_id && Array.isArray(p.parent_id))
                .map((p: any) => p.parent_id[0])
                .filter((id: number) => !partnerMap[id]) // solo los que no tenemos ya
              const uniqueParentIds = [...new Set(parentIds)]

              if (uniqueParentIds.length > 0) {
                const parentResult = await client.searchRead(
                  'res.partner',
                  [['id', 'in', uniqueParentIds]],
                  ['name', 'vat', 'phone', 'city', 'state_id', 'street'],
                  { limit: uniqueParentIds.length }
                )
                if (parentResult.success && Array.isArray(parentResult.data)) {
                  const parentMap: Record<number, any> = {}
                  for (const p of parentResult.data) {
                    parentMap[p.id] = p
                  }
                  // Enriquecer partners hijos con datos de la empresa padre
                  for (const p of partnerResult.data) {
                    if (p.parent_id && Array.isArray(p.parent_id) && parentMap[p.parent_id[0]]) {
                      p._parent = parentMap[p.parent_id[0]]
                    }
                  }
                  console.log(`🏢 ${uniqueParentIds.length} empresas padre obtenidas`)
                }
              }

              // Si algún partner es empresa (is_company), traer su primer contacto hijo
              const companyIds = partnerResult.data
                .filter((p: any) => p.is_company && !p.parent_id)
                .map((p: any) => p.id)
              if (companyIds.length > 0) {
                try {
                  const childResult = await client.searchRead(
                    'res.partner',
                    [['parent_id', 'in', companyIds], ['is_company', '=', false]],
                    ['name', 'phone', 'parent_id'],
                    { limit: companyIds.length * 3 }
                  )
                  if (childResult.success && Array.isArray(childResult.data)) {
                    // Agrupar por parent_id, tomar el primero de cada empresa
                    const childMap: Record<number, any> = {}
                    for (const c of childResult.data) {
                      const parentId = Array.isArray(c.parent_id) ? c.parent_id[0] : c.parent_id
                      if (parentId && !childMap[parentId]) {
                        childMap[parentId] = c
                      }
                    }
                    for (const compId of companyIds) {
                      if (childMap[compId]) {
                        partnerMap[compId]._child = childMap[compId]
                      }
                    }
                    console.log(`👶 Contactos hijos encontrados para ${Object.keys(childMap).length} empresas`)
                  }
                } catch (childError) {
                  console.warn('⚠️ No se pudieron obtener contactos hijos:', childError)
                }
              }

              // Enriquecer cada tarea con datos del partner
              for (const task of tasks) {
                const pid = Array.isArray(task.partner_id) ? task.partner_id[0] : task.partner_id
                if (pid && partnerMap[pid]) {
                  task._partner = partnerMap[pid]
                }
              }
              console.log(`👥 ${Object.keys(partnerMap).length} partners mapeados a tareas`)
            } else {
              console.warn('⚠️ Partner result no exitoso o no es array:', partnerResult)
            }
          } catch (partnerError) {
            console.warn('⚠️ No se pudieron obtener datos de partners:', partnerError)
          }
        } else {
          console.log('⚠️ Ninguna tarea tiene partner_id asignado')
        }

        // Obtener líneas de orden de venta para cada tarea que tenga sale_order_id
        const saleOrderIds = tasks
          .map((t: any) => Array.isArray(t.sale_order_id) ? t.sale_order_id[0] : (typeof t.sale_order_id === 'number' ? t.sale_order_id : null))
          .filter((id: number | null): id is number => id !== null)
        const uniqueSaleOrderIds = [...new Set(saleOrderIds)]

        if (uniqueSaleOrderIds.length > 0) {
          try {
            const linesResult = await client.searchRead(
              'sale.order.line',
              [['order_id', 'in', uniqueSaleOrderIds]],
              ['order_id', 'product_id', 'product_uom_qty', 'name', 'price_unit', 'product_template_id'],
              { limit: 200 }
            )
            if (linesResult.success && Array.isArray(linesResult.data)) {
              // Obtener default_code de los productos
              const productIds = linesResult.data
                .map((l: any) => Array.isArray(l.product_id) ? l.product_id[0] : l.product_id)
                .filter((id: number | null): id is number => !!id)
              const uniqueProductIds = [...new Set(productIds)]

              let productCodeMap: Record<number, string> = {}
              if (uniqueProductIds.length > 0) {
                const prodResult = await client.searchRead(
                  'product.product',
                  [['id', 'in', uniqueProductIds]],
                  ['id', 'default_code'],
                  { limit: uniqueProductIds.length }
                )
                if (prodResult.success && Array.isArray(prodResult.data)) {
                  for (const p of prodResult.data) {
                    productCodeMap[p.id] = p.default_code || ''
                  }
                }
              }

              // Agrupar líneas por order_id
              const linesByOrder: Record<number, any[]> = {}
              for (const line of linesResult.data) {
                const orderId = Array.isArray(line.order_id) ? line.order_id[0] : line.order_id
                if (orderId) {
                  if (!linesByOrder[orderId]) linesByOrder[orderId] = []
                  linesByOrder[orderId].push(line)
                }
              }

              // Enriquecer tareas con líneas de la orden de venta
              for (const task of tasks) {
                const soId = Array.isArray(task.sale_order_id) ? task.sale_order_id[0] : task.sale_order_id
                if (soId && linesByOrder[soId]) {
                  task._saleOrderLines = linesByOrder[soId].map((line: any) => {
                    const prodId = Array.isArray(line.product_id) ? line.product_id[0] : line.product_id
                    return {
                      productName: Array.isArray(line.product_id) ? line.product_id[1] : (line.name || ''),
                      productCode: prodId ? (productCodeMap[prodId] || '') : '',
                      quantity: line.product_uom_qty || 0,
                      priceUnit: line.price_unit || 0,
                      description: line.name || ''
                    }
                  })
                }
              }
              console.log(`🛒 Líneas de venta obtenidas para ${Object.keys(linesByOrder).length} órdenes`)
            }
          } catch (saleError) {
            console.warn('⚠️ No se pudieron obtener líneas de orden de venta:', saleError)
          }
        }

        setPendingTasks(tasks)
        setShowPending(true)
        console.log(`✅ ${tasks.length} OS asignadas encontradas`)
        if (tasks.length === 0) {
          toast.info("Sin pendientes", { description: `No hay OS asignadas para ${tecnicoNombre}` })
        } else {
          toast.success(`${tasks.length} OS encontradas`, { description: `Asignadas a ${tecnicoNombre}` })
        }
      } else {
        console.error('❌ Error consultando Odoo:', result.error)
        toast.error("Error", { description: result.error || "No se pudieron obtener las OS" })
      }
    } catch (error) {
      console.error('❌ Error:', error)
      toast.error("Error", { description: "Falló la consulta a Odoo" })
    } finally {
      setLoadingPending(false)
    }
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteConfirmText !== 'ELIMINAR') return
    
    try {
      deleteOrder(deleteTarget.id)
      loadData()
      setDeleteTarget(null)
      setDeleteConfirmText('')
      toast.success("Orden eliminada", { 
        description: `${deleteTarget.numeroOrden} fue eliminada permanentemente` 
      })
    } catch (error) {
      toast.error("Error", { description: "No se pudo eliminar la orden" })
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <Card className="w-full h-full sm:max-w-7xl sm:h-[90vh] sm:rounded-lg rounded-none flex flex-col">
        {/* Header */}
        <div className="p-3 sm:p-6 border-b">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Icons.Database />
              <h2 className="text-base sm:text-2xl font-bold truncate">Registros Anteriores</h2>
            </div>
            
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 w-8 sm:w-auto sm:h-auto p-0 sm:px-3 sm:py-2">
                <Icons.RefreshCw />
                <span className="ml-2 hidden sm:inline">Actualizar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchPending}
                disabled={loadingPending || !isOnline}
                className="h-8 w-auto px-2 sm:px-3 sm:py-2 text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                {loadingPending ? <Icons.Loader /> : <span>📋</span>}
                <span className="ml-1 text-xs sm:text-sm">Pendientes</span>
              </Button>
              {onClose && (
                <Button variant="outline" size="sm" onClick={onClose} className="h-8 w-8 sm:w-auto sm:h-auto p-0 sm:px-3 sm:py-2">
                  <span className="sm:hidden">×</span>
                  <span className="hidden sm:inline">Cerrar</span>
                </Button>
              )}
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4 mb-3 sm:mb-4">
            <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs sm:text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-red-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-red-600">{stats.localOnly}</div>
              <div className="text-xs sm:text-sm text-red-600">💾 Local</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-yellow-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">{stats.partial}</div>
              <div className="text-xs sm:text-sm text-yellow-600">⚠️ Parcial</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.sent}</div>
              <div className="text-xs sm:text-sm text-green-600">✅ Enviados</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-gray-600">{stats.drafts}</div>
              <div className="text-xs sm:text-sm text-gray-600">Borradores</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-gray-600">{stats.archived}</div>
              <div className="text-xs sm:text-sm text-gray-600">Archivados</div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <Icons.Search />
              </span>
              <Input
                placeholder="Buscar por número, cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-auto"
              >
                <option value="all">Todos</option>
                <option value="draft">Borradores</option>
                <option value="completed">Completados</option>
                <option value="local-only">Solo Local</option>
                <option value="partial">Parcial</option>
                <option value="sent">Enviados</option>
                <option value="archived">Archivados</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Desktop Table - hidden on mobile */}
        <div className="flex-1 overflow-auto hidden sm:block">
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
                        {/* Ver detalles - Siempre visible */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setSelectedOrder(order)}
                          title="Ver detalles"
                        >
                          <Icons.Eye />
                        </Button>

                        {/* REENVÍO COMPLETO - Disponible para TODAS las órdenes */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 text-blue-600"
                          onClick={() => handleFullResend(order)}
                          disabled={!isOnline || resendingId === order.id}
                          title="Reenviar completo (Google Forms + Odoo + WhatsApp)"
                        >
                          {resendingId === order.id ? <Icons.Loader /> : <Icons.Send />}
                        </Button>
                        
                        {/* Ver Orden (imagen) - Solo si existe imagen */}
                        {order.imageUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-purple-600"
                            onClick={() => window.open(order.imageUrl, '_blank')}
                            title="Ver Orden (imagen)"
                          >
                            <Icons.Image />
                          </Button>
                        )}
                        
                        {/* Reenviar WhatsApp - Solo si tiene teléfono e imagen válida */}
                        {order.formData.telefono && order.imageUrl && order.imageUrl.startsWith('http') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-green-600"
                            onClick={() => handleWhatsAppResend(order)}
                            title="Reenviar solo por WhatsApp"
                          >
                            <Icons.WhatsApp />
                          </Button>
                        )}
                        
                        {/* Editar - Solo para borradores */}
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
                        
                        {/* Archivar - Para todo excepto archivados */}
                        {order.status !== 'archived' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-gray-600"
                            onClick={() => handleArchive(order)}
                            title="Archivar"
                          >
                            <Icons.Archive />
                          </Button>
                        )}

                        {/* Eliminar */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteRequest(order)}
                          title="Eliminar"
                        >
                          🗑️
                        </Button>
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

        {/* Mobile Card List - visible only on mobile */}
        <div className="flex-1 overflow-auto sm:hidden">
          <div className="p-3 space-y-3">
            {filteredOrders.map((order) => (
              <div key={order.id} className="border rounded-lg p-3 bg-white">
                {/* Row 1: Order number + Status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icons.FileText />
                    <span className="font-semibold text-sm">{order.numeroOrden}</span>
                  </div>
                  <Badge className={`${getStatusColor(order.status)} text-white text-xs`}>
                    {getStatusIcon(order.status)} {getStatusText(order.status)}
                  </Badge>
                </div>
                
                {/* Row 2: Client + Contact */}
                <div className="mb-2 text-sm">
                  <div className="flex items-center gap-1 text-gray-900">
                    <Icons.User />
                    <span className="truncate">{order.formData.razonSocial || 'Sin especificar'}</span>
                  </div>
                  {order.formData.contacto && (
                    <div className="text-gray-500 text-xs mt-0.5 ml-5">
                      {order.formData.contacto}
                    </div>
                  )}
                </div>
                
                {/* Row 3: Date */}
                <div className="text-xs text-gray-500 mb-2">
                  <Icons.Calendar /> {formatDate(order.createdAt)}
                </div>
                
                {/* Row 4: Actions */}
                <div className="flex gap-1.5 flex-wrap border-t pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3 text-xs gap-1"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <Icons.Eye /> Ver
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3 text-xs gap-1 text-blue-600"
                    onClick={() => handleFullResend(order)}
                    disabled={!isOnline || resendingId === order.id}
                  >
                    {resendingId === order.id ? <Icons.Loader /> : <Icons.Send />} Reenviar
                  </Button>
                  
                  {order.imageUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 text-purple-600"
                      onClick={() => window.open(order.imageUrl, '_blank')}
                    >
                      <Icons.Image />
                    </Button>
                  )}
                  
                  {order.formData.telefono && order.imageUrl && order.imageUrl.startsWith('http') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 text-green-600"
                      onClick={() => handleWhatsAppResend(order)}
                    >
                      <Icons.WhatsApp />
                    </Button>
                  )}
                  
                  {order.status === 'draft' && onEditOrder && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 text-blue-600"
                      onClick={() => handleEdit(order)}
                    >
                      <Icons.Edit />
                    </Button>
                  )}
                  
                  {order.status !== 'archived' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 text-gray-600"
                      onClick={() => handleArchive(order)}
                    >
                      <Icons.Archive />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 p-0 text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteRequest(order)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            ))}
            
            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">
                  <Icons.Database />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay órdenes
                </h3>
                <p className="text-gray-600 text-sm">
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

      {/* Modal de confirmación de eliminación */}
      {/* Modal de tareas pendientes de Odoo */}
      {showPending && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-0 sm:p-4">
          <Card className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-4xl flex flex-col sm:rounded-lg rounded-none">
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-orange-50 sm:rounded-t-lg">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <h3 className="text-base sm:text-lg font-bold text-orange-800">OS Pendientes (Asignadas)</h3>
                <Badge className="bg-orange-500 text-white text-xs">{pendingTasks.length}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPending(false)} className="h-8 w-8 p-0">
                ×
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <span className="text-4xl block mb-2">📭</span>
                  <p>No hay órdenes de servicio asignadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map((task: any) => (
                    <Card key={task.id} className="p-3 sm:p-4 border-l-4 border-l-orange-400 hover:shadow-md transition-shadow">
                      <div className="flex flex-col gap-2">
                        {/* Encabezado de la tarea */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-orange-700 text-sm sm:text-base truncate">
                                {task.name || 'Sin nombre'}
                              </span>
                              {task.x_studio_fecha && (
                                <Badge variant="outline" className="text-xs">
                                  📅 {task.x_studio_fecha}
                                </Badge>
                              )}
                              {task.date_deadline && (
                                <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                                  ⏰ Límite: {task.date_deadline}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-800 mt-1 truncate">
                              {task._partner
                                ? (task._partner._parent?.name || (task._partner.parent_id ? task._partner.parent_id[1] : task._partner.name))
                                : (task.x_studio_razon_social || task.name || 'Sin razón social')}
                            </p>
                          </div>
                        </div>

                        {/* Datos del contacto */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs sm:text-sm text-gray-600">
                          {(task._partner?.parent_id ? task._partner.name : (task._partner?._child?.name || task.x_studio_nombre_del_contacto)) && (
                            <div>👤 {task._partner?.parent_id ? task._partner.name : (task._partner?._child?.name || task.x_studio_nombre_del_contacto)}</div>
                          )}
                          {(task._partner?.phone || task._partner?._parent?.phone || task.partner_phone || task.x_studio_telefono_del_contacto) && (
                            <div>📞 {task._partner?.phone || task._partner?._parent?.phone || task.partner_phone || task.x_studio_telefono_del_contacto}</div>
                          )}
                          {(task._partner?.city || task._partner?._parent?.city || task.x_studio_localidad) && (
                            <div>📍 {(() => {
                              const loc = task._partner?.city || task._partner?._parent?.city || task.x_studio_localidad
                              const prov = (task._partner?.state_id && Array.isArray(task._partner.state_id) ? task._partner.state_id[1] : '') || (task._partner?._parent?.state_id && Array.isArray(task._partner._parent.state_id) ? task._partner._parent.state_id[1] : '') || task.x_studio_provincia
                              return prov ? `${loc}, ${prov}` : loc
                            })()}</div>
                          )}
                        </div>

                        {/* Equipo */}
                        {(task.x_studio_maquina || task.x_studio_equipo) && (
                          <div className="text-xs sm:text-sm text-gray-700 bg-gray-50 rounded px-2 py-1">
                            🔧 {[task.x_studio_maquina, task.x_studio_equipo].filter(Boolean).join(' — ')}
                          </div>
                        )}

                        {/* Descripción */}
                        {task.x_studio_descripcion_de_lo_acontecido && (
                          <div className="text-xs sm:text-sm text-gray-600 bg-blue-50 rounded px-2 py-1">
                            📝 {task.x_studio_descripcion_de_lo_acontecido}
                          </div>
                        )}

                        {/* Insumos de la orden de venta */}
                        {task._saleOrderLines && task._saleOrderLines.length > 0 && (
                          <div className="text-xs sm:text-sm text-gray-700 bg-amber-50 rounded px-2 py-1">
                            <div className="font-medium text-amber-800 mb-1">📦 Insumos ({task._saleOrderLines.length})</div>
                            {task._saleOrderLines.slice(0, 3).map((line: any, i: number) => (
                              <div key={i} className="text-xs text-gray-600 truncate">
                                {line.productCode && <span className="font-mono text-gray-500">[{line.productCode}] </span>}
                                {line.productName} × {Math.round(line.quantity)}
                              </div>
                            ))}
                            {task._saleOrderLines.length > 3 && (
                              <div className="text-xs text-amber-600">...y {task._saleOrderLines.length - 3} más</div>
                            )}
                          </div>
                        )}

                        {/* Badges de tipo de servicio */}
                        <div className="flex flex-wrap gap-1">
                          {task.x_studio_servicio_tecnico && <Badge className="bg-blue-100 text-blue-800 text-[10px]">Servicio Técnico</Badge>}
                          {task.x_studio_instalacion && <Badge className="bg-green-100 text-green-800 text-[10px]">Instalación</Badge>}
                          {task.x_studio_puesta_en_marcha && <Badge className="bg-purple-100 text-purple-800 text-[10px]">Puesta en Marcha</Badge>}
                          {task.x_studio_capacitacion && <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">Capacitación</Badge>}
                          {task.x_studio_calibracion && <Badge className="bg-cyan-100 text-cyan-800 text-[10px]">Calibración</Badge>}
                          {task.x_studio_tercero && <Badge className="bg-gray-100 text-gray-800 text-[10px]">Tercero</Badge>}
                          {task.x_studio_servicio_a_campo && <Badge className="bg-amber-100 text-amber-800 text-[10px]">A Campo</Badge>}
                          {task.x_studio_servicio_en_oficina && <Badge className="bg-slate-100 text-slate-800 text-[10px]">En Oficina</Badge>}
                          {task.x_studio_con_cargo && <Badge className="bg-red-100 text-red-800 text-[10px]">Con Cargo</Badge>}
                          {task.x_studio_sin_cargo && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Sin Cargo</Badge>}
                          {task.x_studio_servicio_en_garantia && <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">En Garantía</Badge>}
                          {task.x_studio_a_convenir && <Badge className="bg-orange-100 text-orange-800 text-[10px]">A Convenir</Badge>}
                        </div>

                        {/* Botones: Ver detalle + Tomar posesión */}
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingTaskDetail(task)}
                            className="text-xs sm:text-sm px-3 py-1"
                          >
                            👁️ Ver detalle
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              // Obtener datos del técnico desde localStorage
                              let tecnicoNombre = ''
                              let tecnicoFirma = ''
                              let tecnicoPhone = ''
                              try {
                                const savedData = localStorage.getItem('aran-form-data')
                                if (savedData) {
                                  const parsed = JSON.parse(savedData)
                                  tecnicoNombre = parsed.tecnicoNombre || ''
                                  tecnicoFirma = parsed.tecnicoFirma || ''
                                  tecnicoPhone = parsed.aux3 || ''
                                }
                              } catch (e) { /* ignore */ }

                              const formData = mapOdooTaskToFormData(task, tecnicoNombre, tecnicoFirma, tecnicoPhone)
                              
                              if (onLoadFormData) {
                                onLoadFormData(formData)
                                setShowPending(false)
                                if (onClose) onClose()
                                const clienteNombreToast = task._partner
                                  ? (task._partner._parent?.name || (task._partner.parent_id ? task._partner.parent_id[1] : task._partner.name))
                                  : (task.x_studio_razon_social || task.name || 'Odoo')
                                toast.success('📋 Tarea cargada', {
                                  description: `OS de ${clienteNombreToast} lista para completar. Al enviar se actualizará en Odoo.`
                                })
                              } else {
                                toast.error('Error', { description: 'No se puede cargar la tarea en el formulario' })
                              }
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm px-3 py-1"
                          >
                            ✋ Tomar posesión
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Modal de detalle de tarea pendiente */}
      {pendingTaskDetail && (
        <PendingTaskDetailModal
          task={pendingTaskDetail}
          onClose={() => setPendingTaskDetail(null)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4">
          <Card className="w-full max-w-md p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-red-600 mb-2">Eliminar orden permanentemente</h3>
              <p className="text-sm text-gray-700 mb-1">
                Orden: <strong>{deleteTarget.numeroOrden}</strong>
              </p>
              <p className="text-sm text-gray-700 mb-3">
                {deleteTarget.formData.razonSocial || 'Sin razón social'}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700 font-medium">
                  Esta acción es irreversible. El registro se eliminará de la base de datos local.
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Escribí <strong className="text-red-600">ELIMINAR</strong> para confirmar:
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Escribí ELIMINAR"
                className="text-center font-mono text-lg border-red-300 focus:border-red-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText('') }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirmText !== 'ELIMINAR'}
                onClick={confirmDelete}
              >
                🗑️ Eliminar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// Modal para mostrar detalle de una tarea pendiente de Odoo
function PendingTaskDetailModal({ task, onClose }: { task: any; onClose: () => void }) {
  // Helper para no mostrar campos con valor false de Odoo
  const str = (val: any): string => (typeof val === 'string' ? val : '')
  const formatStage = (stageId: any): string => {
    if (Array.isArray(stageId)) return stageId[1] || `ID ${stageId[0]}`
    if (typeof stageId === 'number') return `ID ${stageId}`
    return str(stageId)
  }
  const formatPartner = (partnerId: any): string => {
    if (Array.isArray(partnerId)) return partnerId[1] || `ID ${partnerId[0]}`
    if (typeof partnerId === 'number') return `ID ${partnerId}`
    return str(partnerId)
  }

  // Recopilar todos los campos con información
  const sections: { title: string; icon: string; rows: { label: string; value: string }[] }[] = []

  // Identificación
  const identRows: { label: string; value: string }[] = []
  if (task.id) identRows.push({ label: 'ID Odoo', value: String(task.id) })
  if (str(task.name)) identRows.push({ label: 'Nombre tarea', value: str(task.name) })
  if (str(task.x_studio_orden_de_servicio)) identRows.push({ label: 'N° Orden de Servicio', value: str(task.x_studio_orden_de_servicio) })
  if (str(task.x_studio_fecha)) identRows.push({ label: 'Fecha', value: str(task.x_studio_fecha) })
  if (task.stage_id) identRows.push({ label: 'Etapa', value: formatStage(task.stage_id) })
  if (str(task.date_deadline)) identRows.push({ label: 'Fecha límite', value: str(task.date_deadline) })
  if (str(task.planned_date_begin)) identRows.push({ label: 'Fecha inicio planificada', value: str(task.planned_date_begin) })
  if (identRows.length > 0) sections.push({ title: 'Identificación', icon: '🏷️', rows: identRows })

  // Cliente / Contacto
  const contactRows: { label: string; value: string }[] = []
  if (task.partner_id) contactRows.push({ label: 'Partner (Odoo)', value: formatPartner(task.partner_id) })
  // Datos del cliente desde el partner (res.partner)
  const partnerRazon = task._partner
    ? (task._partner._parent?.name || (task._partner.parent_id ? str(task._partner.parent_id[1]) : str(task._partner.name)))
    : str(task.x_studio_razon_social)
  const partnerCuit = task._partner
    ? formatCuit(str(task._partner._parent?.vat || task._partner.vat || ''))
    : formatCuit(str(task.x_studio_cuit))
  const partnerContacto = task._partner?.parent_id
    ? str(task._partner.name)
    : str(task._partner?._child?.name || task.x_studio_nombre_del_contacto)
  const partnerTelefono = task._partner
    ? str(task._partner.phone || task._partner._parent?.phone || task.partner_phone || '')
    : str(task.x_studio_telefono_del_contacto || task.partner_phone || '')
  if (partnerRazon) contactRows.push({ label: 'Razón Social', value: partnerRazon })
  if (partnerCuit) contactRows.push({ label: 'CUIT', value: partnerCuit })
  if (partnerContacto) contactRows.push({ label: 'Contacto', value: partnerContacto })
  if (partnerTelefono) contactRows.push({ label: 'Teléfono', value: partnerTelefono })
  if (contactRows.length > 0) sections.push({ title: 'Cliente / Contacto', icon: '👤', rows: contactRows })

  // Ubicación
  const ubicRows: { label: string; value: string }[] = []
  const partnerLocalidad = task._partner
    ? str(task._partner.city || task._partner._parent?.city || task.x_studio_localidad || '')
    : str(task.x_studio_localidad)
  const partnerProvincia = task._partner
    ? str((task._partner.state_id && Array.isArray(task._partner.state_id) ? task._partner.state_id[1] : '') || (task._partner._parent?.state_id && Array.isArray(task._partner._parent.state_id) ? task._partner._parent.state_id[1] : '') || task.x_studio_provincia || '')
    : str(task.x_studio_provincia)
  if (partnerLocalidad) ubicRows.push({ label: 'Localidad', value: partnerLocalidad })
  if (partnerProvincia) ubicRows.push({ label: 'Provincia', value: partnerProvincia })
  if (task.x_studio_distancia_km) ubicRows.push({ label: 'Distancia', value: `${task.x_studio_distancia_km} km` })
  if (task.x_studio_duracion_hs) ubicRows.push({ label: 'Duración', value: `${task.x_studio_duracion_hs} hs` })
  if (ubicRows.length > 0) sections.push({ title: 'Ubicación', icon: '📍', rows: ubicRows })

  // Equipo
  const equipRows: { label: string; value: string }[] = []
  if (str(task.x_studio_maquina)) equipRows.push({ label: 'Máquina', value: str(task.x_studio_maquina) })
  if (str(task.x_studio_equipo)) equipRows.push({ label: 'Equipo', value: str(task.x_studio_equipo) })
  if (equipRows.length > 0) sections.push({ title: 'Equipo', icon: '🔧', rows: equipRows })

  // Descripción
  if (str(task.x_studio_descripcion_de_lo_acontecido)) {
    sections.push({ title: 'Descripción', icon: '📝', rows: [
      { label: '', value: str(task.x_studio_descripcion_de_lo_acontecido) }
    ]})
  }

  // Insumos de la orden de venta
  if (task._saleOrderLines && task._saleOrderLines.length > 0) {
    const insumoRows = task._saleOrderLines.map((line: any) => ({
      label: line.productCode ? `[${line.productCode}]` : '',
      value: `${line.productName} × ${Math.round(line.quantity)} — $${line.priceUnit.toLocaleString('es-AR')}`
    }))
    if (task.sale_order_id) {
      const soName = Array.isArray(task.sale_order_id) ? task.sale_order_id[1] : `#${task.sale_order_id}`
      insumoRows.unshift({ label: 'Orden de Venta', value: soName })
    }
    sections.push({ title: 'Insumos', icon: '📦', rows: insumoRows })
  }

  // Tipos de servicio
  const tipoRows: { label: string; value: string }[] = []
  if (task.x_studio_servicio_tecnico) tipoRows.push({ label: 'Servicio Técnico', value: '✅' })
  if (task.x_studio_instalacion) tipoRows.push({ label: 'Instalación', value: '✅' })
  if (task.x_studio_puesta_en_marcha) tipoRows.push({ label: 'Puesta en Marcha', value: '✅' })
  if (task.x_studio_capacitacion) tipoRows.push({ label: 'Capacitación', value: '✅' })
  if (task.x_studio_calibracion) tipoRows.push({ label: 'Calibración', value: '✅' })
  if (task.x_studio_tercero) tipoRows.push({ label: 'Tercero', value: '✅' })
  if (tipoRows.length > 0) sections.push({ title: 'Tipo de servicio', icon: '🛠️', rows: tipoRows })

  // Ubicación del servicio
  const lugarRows: { label: string; value: string }[] = []
  if (task.x_studio_servicio_a_campo) lugarRows.push({ label: 'A Campo', value: '✅' })
  if (task.x_studio_servicio_en_oficina) lugarRows.push({ label: 'En Oficina', value: '✅' })
  if (lugarRows.length > 0) sections.push({ title: 'Lugar del servicio', icon: '📌', rows: lugarRows })

  // Modalidad de cobro
  const cobroRows: { label: string; value: string }[] = []
  if (task.x_studio_con_cargo) cobroRows.push({ label: 'Con Cargo', value: '✅' })
  if (task.x_studio_sin_cargo) cobroRows.push({ label: 'Sin Cargo', value: '✅' })
  if (task.x_studio_servicio_en_garantia) cobroRows.push({ label: 'En Garantía', value: '✅' })
  if (task.x_studio_a_convenir) cobroRows.push({ label: 'A Convenir', value: '✅' })
  if (cobroRows.length > 0) sections.push({ title: 'Modalidad de cobro', icon: '💰', rows: cobroRows })

  // Técnico
  const tecnicoRows: { label: string; value: string }[] = []
  if (str(task.x_studio_tecnico_asignado)) tecnicoRows.push({ label: 'Técnico asignado', value: str(task.x_studio_tecnico_asignado) })
  if (str(task.x_studio_aclaracion_del_tecnico)) tecnicoRows.push({ label: 'Aclaración del técnico', value: str(task.x_studio_aclaracion_del_tecnico) })
  if (tecnicoRows.length > 0) sections.push({ title: 'Técnico', icon: '👷', rows: tecnicoRows })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-0 sm:p-4">
      <Card className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-lg rounded-none flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-orange-50 sm:rounded-t-lg flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">📄</span>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-orange-800 truncate">
                {str(task.name) || 'Sin nombre'}
              </h3>
              <p className="text-xs text-orange-600 truncate">
                {str(task.x_studio_orden_de_servicio) ? `OS ${str(task.x_studio_orden_de_servicio)}` : ''} {str(task.x_studio_razon_social) || ''}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 w-8 p-0 flex-shrink-0">
            ×
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {sections.map((section, idx) => (
            <div key={idx}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <span>{section.icon}</span> {section.title}
              </h4>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                {section.rows.map((row, rIdx) => (
                  <div key={rIdx} className={`px-3 py-2 ${rIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${row.label ? 'flex justify-between items-start gap-2' : ''}`}>
                    {row.label ? (
                      <>
                        <span className="text-xs sm:text-sm text-gray-500 flex-shrink-0">{row.label}</span>
                        <span className="text-xs sm:text-sm text-gray-900 font-medium text-right">{row.value}</span>
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-gray-800 whitespace-pre-wrap">{row.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <span className="text-3xl block mb-2">📭</span>
              <p>No hay información adicional disponible</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// Modal para mostrar detalles de una orden
function OrderDetailModal({ order, onClose }: { order: OrderRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-0 sm:p-4">
      <Card className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-lg rounded-none overflow-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-xl font-bold">
              Orden {order.numeroOrden}
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