/**
 * Servicio para integración con Odoo Field Service Management (FSM)
 * Maneja la sincronización de órdenes de servicio con Odoo
 */

import { type FormData as AranFormData } from '@/hooks/use-form-data'
import { getOdooClient } from './odoo-client'

export interface OdooServiceOrder {
  id?: number
  name: string // Número de orden
  partner_id: number // ID del cliente
  date_order: string // Fecha en formato YYYY-MM-DD
  user_id?: number // ID del técnico
  description?: string // Descripción del trabajo
  order_line?: Array<{
    product_id: number
    product_uom_qty: number
    price_unit: number
    name?: string
  }>
  // Campos FSM
  project_id?: number // Proyecto/servicio asociado
  task_id?: number // Tarea asociada
  fsm_location?: string // Ubicación del servicio
  fsm_done?: boolean // Servicio completado
  // Campos personalizados ARAN
  tecnico_nombre?: string
  tecnico_firma?: string
  cliente_nombre?: string
  cliente_firma?: string
  orden_imagen?: string
}

export interface OdooPartner {
  id?: number
  name: string
  phone?: string
  email?: string
  vat?: string // CUIT/NIF
  street?: string
  city?: string
  state_id?: number
  country_id?: number
}

/**
 * Convierte los datos del formulario ARAN al formato de Odoo
 */
export function convertAranToOdooServiceOrder(
  formData: AranFormData,
  partnerId: number
): Partial<OdooServiceOrder> {
  // Convertir fecha de DD-MM-YYYY a YYYY-MM-DD
  let orderDate = new Date().toISOString().split('T')[0]
  if (formData.fecha) {
    const [day, month, year] = formData.fecha.split('-')
    orderDate = `${year}-${month}-${day}`
  }

  // Construir descripción del servicio
  const descripcion = [
    formData.descripcion || '',
    formData.servicioTecnico && 'Servicio Técnico',
    formData.instalacion && 'Instalación',
    formData.puestaEnMarcha && 'Puesta en Marcha',
    formData.capacitacion && 'Capacitación',
    formData.calibracion && 'Calibración',
  ]
    .filter(Boolean)
    .join(' | ')

  return {
    name: formData.numeroOrden || '',
    partner_id: partnerId,
    date_order: orderDate,
    description: descripcion,
    fsm_location: [formData.localidad, formData.provincia].filter(Boolean).join(', '),
    fsm_done: false,
    tecnico_nombre: formData.tecnicoNombre,
    tecnico_firma: formData.tecnicoFirma,
    cliente_nombre: formData.clienteNombre,
    cliente_firma: formData.clienteFirma,
    orden_imagen: formData.aux1,
  }
}

/**
 * Busca o crea un cliente (partner) en Odoo
 */
export async function findOrCreatePartner(
  formData: AranFormData
): Promise<{ success: boolean; partnerId?: number; error?: string }> {
  const client = getOdooClient()

  try {
    // Buscar cliente existente por CUIT o nombre
    const searchDomain = []
    
    if (formData.cuit) {
      searchDomain.push(['vat', '=', formData.cuit])
    } else if (formData.razonSocial) {
      searchDomain.push(['name', 'ilike', formData.razonSocial])
    } else {
      return { success: false, error: 'Faltan datos del cliente (CUIT o Razón Social)' }
    }

    const searchResult = await client.search('res.partner', searchDomain, { limit: 1 })

    if (!searchResult.success) {
      return { success: false, error: searchResult.error }
    }

    // Si encontró el cliente, retornar su ID
    if (searchResult.data && searchResult.data.length > 0) {
      const partnerId = searchResult.data[0]
      console.log(`✅ Cliente encontrado en Odoo: ID ${partnerId}`)
      return { success: true, partnerId }
    }

    // Si no existe, crear nuevo cliente
    console.log('📝 Creando nuevo cliente en Odoo...')
    
    const partnerData: Partial<OdooPartner> = {
      name: formData.razonSocial || formData.clienteNombre || 'Cliente sin nombre',
      phone: formData.telefono,
      vat: formData.cuit,
      city: formData.localidad,
      // state_id y country_id requieren búsqueda adicional
    }

    const createResult = await client.create('res.partner', partnerData)

    if (!createResult.success) {
      return { success: false, error: createResult.error }
    }

    console.log(`✅ Cliente creado en Odoo: ID ${createResult.data}`)
    return { success: true, partnerId: createResult.data }
  } catch (error) {
    console.error('❌ Error buscando/creando cliente:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Sincroniza una orden de servicio con Odoo FSM
 */
export async function syncServiceOrderToOdoo(
  formData: AranFormData
): Promise<{ success: boolean; orderId?: number; error?: string }> {
  const client = getOdooClient()

  try {
    console.log('🔄 Sincronizando orden de servicio con Odoo FSM...')

    // Paso 1: Buscar o crear el cliente
    const partnerResult = await findOrCreatePartner(formData)
    if (!partnerResult.success || !partnerResult.partnerId) {
      return { success: false, error: partnerResult.error || 'No se pudo obtener ID del cliente' }
    }

    // Paso 2: Convertir datos al formato Odoo
    const orderData = convertAranToOdooServiceOrder(formData, partnerResult.partnerId)

    // Paso 3: Crear la orden de servicio en Odoo
    // Usar 'sale.order' o 'project.task' dependiendo de la configuración FSM
    const createResult = await client.create('sale.order', orderData)

    if (!createResult.success) {
      return { success: false, error: createResult.error }
    }

    console.log(`✅ Orden de servicio creada en Odoo: ID ${createResult.data}`)

    // Paso 4: Si hay líneas de orden (repuestos, insumos), agregarlas
    if (formData.insumos && createResult.data) {
      await addServiceOrderLines(createResult.data, formData)
    }

    return { success: true, orderId: createResult.data }
  } catch (error) {
    console.error('❌ Error sincronizando con Odoo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Agrega líneas de orden (repuestos/insumos) a una orden de servicio
 */
async function addServiceOrderLines(
  orderId: number,
  formData: AranFormData
): Promise<void> {
  const client = getOdooClient()

  try {
    // Parsear insumos (si vienen en formato texto)
    // Formato esperado: "Producto 1 x 2, Producto 2 x 1"
    const insumos = formData.insumos?.split(',').map(i => i.trim()) || []

    for (const insumo of insumos) {
      // Intentar parsear cantidad y nombre
      const match = insumo.match(/(.+?)\s*x\s*(\d+)/)
      const name = match ? match[1].trim() : insumo
      const qty = match ? parseInt(match[2]) : 1

      // Buscar producto en Odoo (simplificado)
      const productResult = await client.search('product.product', [['name', 'ilike', name]], {
        limit: 1,
      })

      if (productResult.success && productResult.data && productResult.data.length > 0) {
        const productId = productResult.data[0]

        // Crear línea de orden
        await client.create('sale.order.line', {
          order_id: orderId,
          product_id: productId,
          product_uom_qty: qty,
          name: name,
        })

        console.log(`✅ Línea agregada: ${name} x ${qty}`)
      } else {
        console.warn(`⚠️ Producto no encontrado en Odoo: ${name}`)
      }
    }
  } catch (error) {
    console.error('❌ Error agregando líneas de orden:', error)
  }
}

/**
 * Obtiene una orden de servicio de Odoo
 */
export async function getServiceOrderFromOdoo(
  orderId: number
): Promise<{ success: boolean; order?: OdooServiceOrder; error?: string }> {
  const client = getOdooClient()

  try {
    const result = await client.read('sale.order', [orderId])

    if (!result.success) {
      return { success: false, error: result.error }
    }

    return { success: true, order: result.data[0] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Actualiza el estado de una orden de servicio en Odoo
 */
export async function updateServiceOrderStatus(
  orderId: number,
  status: { fsm_done?: boolean; [key: string]: any }
): Promise<{ success: boolean; error?: string }> {
  const client = getOdooClient()

  try {
    const result = await client.write('sale.order', [orderId], status)

    if (!result.success) {
      return { success: false, error: result.error }
    }

    console.log(`✅ Estado de orden ${orderId} actualizado en Odoo`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Verifica si Odoo FSM está disponible y configurado
 */
export async function testOdooConnection(): Promise<{
  success: boolean
  message: string
}> {
  const client = getOdooClient()

  try {
    const connected = await client.testConnection()

    if (!connected) {
      return { success: false, message: 'No se pudo conectar con Odoo' }
    }

    // Verificar que existe el modelo sale.order
    const result = await client.search('sale.order', [], { limit: 1 })

    if (!result.success) {
      return { success: false, message: 'Odoo conectado pero sin acceso a órdenes de servicio' }
    }

    return { success: true, message: 'Conexión con Odoo FSM exitosa' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
