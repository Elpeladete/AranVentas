/**
 * Servicio para integración con Odoo Field Service Management (FSM)
 * Maneja la sincronización de órdenes de servicio con Odoo
 */

import { type FormData as AranFormData } from '@/hooks/use-form-data'
import { getOdooClient } from './odoo-client'

export interface OdooServiceOrder {
  id?: number
  name: string // Título de la tarea/orden
  partner_id: number // ID delCLIENTE
  partner_phone?: string // Número de contacto (project.task)
  date_order?: string // Fecha de orden (sale.order)
  date_deadline?: string // Fecha límite (project.task) - datetime, fin del rango
  planned_date_begin?: string // Fecha de inicio planeada (project.task) - datetime, inicio del rango
  date_assign?: string // Fecha planeada (project.task)
  allocated_hours?: number // Tiempo asignado en horas (float - campo verificado en Odoo)
  task_properties?: any // Propiedades personalizadas (campo verificado en Odoo)
  tag_ids?: number[][] // Etiquetas de la tarea (para incluir técnico)
  user_id?: number // ID del usuario asignado (many2one - un solo usuario)
  user_ids?: Array<[number, number, number[]]> // IDs de usuarios asignados (many2many - múltiples usuarios, etiqueta "Personas asignadas")
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
  // Campos personalizados ARAN (x_studio_* son campos personalizados en Odoo Studio)
  tecnico_nombre?: string
  tecnico_firma?: string
 CLIENTE_nombre?: string
 CLIENTE_firma?: string
  orden_imagen?: string
  x_studio_numero_orden?: string
  x_studio_tecnico?: string
  x_studio_firma_tecnico?: string
  x_studio_firma_cliente?: string
  x_studio_imagen_orden?: string
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
 * Convierte los datos del formulario ARAN al formato de Odoo project.task
 */
export function convertAranToOdooServiceOrder(
  formData: AranFormData,
  partnerId: number,
  projectId: number
): Partial<OdooServiceOrder> {
  // Convertir fecha de DD-MM-YYYY a YYYY-MM-DD
  let orderDate = new Date().toISOString().split('T')[0]
  if (formData.fecha) {
    const [day, month, year] = formData.fecha.split('-')
    orderDate = `${year}-${month}-${day}`
  }

  // Construir descripción del servicio (completa, ya que no hay campos personalizados)
  const tiposServicio = [
    formData.servicioTecnico && 'Servicio Técnico',
    formData.instalacion && 'Instalación',
    formData.puestaEnMarcha && 'Puesta en Marcha',
    formData.capacitacion && 'Capacitación',
    formData.calibracion && 'Calibración',
  ].filter(Boolean).join(', ')

  const modalidadCobro = [
    formData.conCargo && 'Con Cargo',
    formData.sinCargo && 'Sin Cargo',
    formData.servicioEnGarantia && 'En Garantía',
    formData.aConvenir && 'A Convenir',
  ].filter(Boolean).join(', ')

  const ubicacionServicio = [
    formData.servicioACampo && 'A Campo',
    formData.servicioEnOficina && 'En Oficina',
  ].filter(Boolean).join(', ')

  // Descripción en formato HTML para mejor visualización en Odoo
  const descripcionCompleta = `<div style="font-family: Arial, sans-serif;">
<h2 style="background-color: #2c3e50; color: white; padding: 10px; margin: 0;">ORDEN DE SERVICIO N° ${formData.numeroOrden}</h2>

<h3 style="background-color: #3498db; color: white; padding: 8px; margin: 15px 0 5px 0;">DESCRIPCIÓN DEL TRABAJO</h3>
<p style="padding: 10px; background-color: #ecf0f1; margin: 0;">${formData.descripcion || 'Sin descripción'}</p>

<h3 style="background-color: #3498db; color: white; padding: 8px; margin: 15px 0 5px 0;">INFORMACIÓN DEL SERVICIO</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #ecf0f1;">
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold; width: 40%;">Tipos de servicio:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${tiposServicio || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Ubicación:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${ubicacionServicio || 'N/A'}</td>
  </tr>
  <tr style="background-color: #ecf0f1;">
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Modalidad de cobro:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${modalidadCobro || 'N/A'}</td>
  </tr>
</table>

<h3 style="background-color: #3498db; color: white; padding: 8px; margin: 15px 0 5px 0;">EQUIPO Y UBICACIÓN</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #ecf0f1;">
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold; width: 40%;">Máquina:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.maquina || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Equipo:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.equipo || 'N/A'}</td>
  </tr>
  <tr style="background-color: #ecf0f1;">
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Localidad:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.localidad || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Provincia:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.provincia || 'N/A'}</td>
  </tr>
  <tr style="background-color: #ecf0f1;">
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Distancia:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.distancia || 'N/A'} km</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Duración estimada:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.duracion || 'N/A'} hs</td>
  </tr>
</table>

<h3 style="background-color: #3498db; color: white; padding: 8px; margin: 15px 0 5px 0;">CONTACTO</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #ecf0f1;">
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold; width: 40%;">Contacto:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.contacto || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Teléfono:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.telefono || 'N/A'}</td>
  </tr>
</table>
${formData.insumos ? `
<h3 style="background-color: #3498db; color: white; padding: 8px; margin: 15px 0 5px 0;">INSUMOS UTILIZADOS</h3>
<div style="padding: 10px; background-color: #ecf0f1; white-space: pre-wrap;">${formData.insumos}</div>
` : ''}
<h3 style="background-color: #27ae60; color: white; padding: 8px; margin: 15px 0 5px 0;">TÉCNICO</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #ecf0f1;">
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold; width: 40%;">Nombre:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.tecnicoNombre || 'N/A'}</td>
  </tr>${formData.tecnicoFirma ? `
  <tr>
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Firma:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;"><a href="${formData.tecnicoFirma}" target="_blank" style="color: #2980b9;">Ver firma del técnico</a></td>
  </tr>` : ''}
</table>

<h3 style="background-color: #e67e22; color: white; padding: 8px; margin: 15px 0 5px 0;">CLIENTE</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #ecf0f1;">
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold; width: 40%;">Nombre:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;">${formData.clienteNombre || 'N/A'}</td>
  </tr>${formData.clienteFirma ? `
  <tr>
    <td style="padding: 8px; border: 1px solid #bdc3c7; font-weight: bold;">Firma:</td>
    <td style="padding: 8px; border: 1px solid #bdc3c7;"><a href="${formData.clienteFirma}" target="_blank" style="color: #2980b9;">Ver firma del cliente</a></td>
  </tr>` : ''}
</table>
${formData.aux2 && formData.aux2 !== 'Geolocalización no disponible' && formData.aux2 !== 'Geolocalización no soportada' ? `
<h3 style="background-color: #16a085; color: white; padding: 8px; margin: 15px 0 5px 0;">📍 UBICACIÓN DE FIRMA</h3>
<div style="padding: 10px; background-color: #ecf0f1;">
  <p style="margin: 0 0 8px 0;"><strong>Coordenadas:</strong> ${formData.aux2}</p>
  <p style="margin: 0;"><a href="https://www.google.com/maps?q=${formData.aux2}" target="_blank" style="color: #2980b9; font-weight: bold;">📍 Ver en Google Maps</a></p>
</div>
` : ''}
${formData.aux1 ? `
<h3 style="background-color: #8e44ad; color: white; padding: 8px; margin: 15px 0 5px 0;">IMAGEN DE LA ORDEN</h3>
<div style="padding: 10px; background-color: #ecf0f1;">
  <a href="${formData.aux1}" target="_blank" style="color: #2980b9; font-weight: bold;">Ver imagen completa de la orden de servicio</a>
</div>
` : ''}</div>`.trim()

  // Formato para project.task (solo campos estándar de Odoo)
  // IMPORTANTE: project.task requiere un project_id obligatorio
  // Todos los campos han sido verificados en la instancia de Odoo
  const taskData: Partial<OdooServiceOrder> = {
    name: `OS ${formData.numeroOrden} - ${formData.razonSocial || 'Cliente'}`,
    partner_id: partnerId,
    partner_phone: formData.telefono, // Número de contacto
    project_id: projectId, // ID del proyecto obtenido o creado
    user_ids: [[6, 0, [15]]], // Asignar a Axel Dadone (UID 15) - formato many2many: [(6, 0, [ids])]
    planned_date_begin: `${orderDate} 00:00:00`, // Inicio del rango (datetime) - mismo día que la orden
    date_deadline: `${orderDate} 23:59:59`, // Fin del rango (datetime) - mismo día que la orden
    allocated_hours: formData.duracion ? parseFloat(formData.duracion) : undefined, // Tiempo asignado (float) - campo verificado
    description: descripcionCompleta,
  }

  return taskData
}

/**
 * Busca o crea unCLIENTE (partner) en Odoo
 */
export async function findOrCreatePartner(
  formData: AranFormData
): Promise<{ success: boolean; partnerId?: number; error?: string }> {
  const client = getOdooClient()

  try {
    // BuscarCLIENTE existente por CUIT o nombre
    const searchDomain = []
    
    if (formData.cuit) {
      searchDomain.push(['vat', '=', formData.cuit])
    } else if (formData.razonSocial) {
      searchDomain.push(['name', 'ilike', formData.razonSocial])
    } else {
      return { success: false, error: 'Faltan datos delCLIENTE (CUIT o Razón Social)' }
    }

    const searchResult = await client.search('res.partner', searchDomain, { limit: 1 })

    if (!searchResult.success) {
      return { success: false, error: searchResult.error }
    }

    // Si encontró elCLIENTE, retornar su ID
    if (searchResult.data && searchResult.data.length > 0) {
      const partnerId = searchResult.data[0]
      console.log(`✅CLIENTE encontrado en Odoo: ID ${partnerId}`)
      return { success: true, partnerId }
    }

    // Si no existe, crear nuevoCLIENTE
    console.log('📝 Creando nuevoCLIENTE en Odoo...')
    
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

    console.log(`✅CLIENTE creado en Odoo: ID ${createResult.data}`)
    return { success: true, partnerId: createResult.data }
  } catch (error) {
    console.error('❌ Error buscando/creandoCLIENTE:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Obtiene el ID de un proyecto por defecto para las tareas de servicio
 * Si no existe, crea uno nuevo llamado "Órdenes de Servicio ARAN"
 */
async function getOrCreateDefaultProject(): Promise<{ success: boolean; projectId?: number; error?: string }> {
  const client = getOdooClient()

  try {
    console.log('🔍 Buscando proyecto por defecto...')
    
    // Buscar proyecto llamado "Órdenes de Servicio ARAN"
    const searchResult = await client.search('project.project', [
      ['name', '=', 'Órdenes de Servicio ARAN']
    ], { limit: 1 })

    if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
      const projectId = searchResult.data[0]
      console.log(`✅ Proyecto encontrado: ID ${projectId}`)
      return { success: true, projectId }
    }

    // Si no existe, intentar obtener el primer proyecto disponible
    console.log('📝 Buscando cualquier proyecto disponible...')
    const anyProjectResult = await client.search('project.project', [], { limit: 1 })
    
    if (anyProjectResult.success && anyProjectResult.data && anyProjectResult.data.length > 0) {
      const projectId = anyProjectResult.data[0]
      console.log(`✅ Usando proyecto existente: ID ${projectId}`)
      return { success: true, projectId }
    }

    // Si no hay ningún proyecto, intentar crear uno
    console.log('📝 Creando nuevo proyecto "Órdenes de Servicio ARAN"...')
    const createResult = await client.create('project.project', {
      name: 'Órdenes de Servicio ARAN',
      active: true,
    })

    if (!createResult.success) {
      return { success: false, error: createResult.error }
    }

    console.log(`✅ Proyecto creado: ID ${createResult.data}`)
    return { success: true, projectId: createResult.data }
  } catch (error) {
    console.error('❌ Error obteniendo/creando proyecto:', error)
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

    // Paso 1: Obtener o crear proyecto por defecto
    const projectResult = await getOrCreateDefaultProject()
    if (!projectResult.success || !projectResult.projectId) {
      return { success: false, error: projectResult.error || 'No se pudo obtener ID del proyecto' }
    }

    // Paso 2: Buscar o crear elCLIENTE
    const partnerResult = await findOrCreatePartner(formData)
    if (!partnerResult.success || !partnerResult.partnerId) {
      return { success: false, error: partnerResult.error || 'No se pudo obtener ID delCLIENTE' }
    }

    // Paso 3: Convertir datos al formato Odoo
    const orderData = convertAranToOdooServiceOrder(formData, partnerResult.partnerId, projectResult.projectId)

    // Paso 4: Crear la tarea/orden de servicio en Odoo usando project.task
    console.log('📝 Creando tarea en Odoo con datos:', JSON.stringify(orderData, null, 2))
    const createResult = await client.create('project.task', orderData)

    if (!createResult.success) {
      return { success: false, error: createResult.error }
    }

    console.log(`✅ Tarea de servicio creada en Odoo: ID ${createResult.data}`)

    // Paso 4.5: Actualizar task_properties con el técnico responsable y geolocalización
    // Formato para properties en Odoo: objeto plano con property-name como clave
    if (formData.tecnicoNombre || formData.aux2) {
      try {
        const properties: Record<string, string> = {}
        
        // Responsable (técnico) - property-name: 333a296f15b7206e
        if (formData.tecnicoNombre) {
          properties['333a296f15b7206e'] = formData.tecnicoNombre
          console.log('📝 Responsable:', formData.tecnicoNombre)
        }
        
        // Geoposición - property-name: a890c89b8a561237_html (HTML con link clickeable a Google Maps)
        if (formData.aux2 && formData.aux2 !== 'Geolocalización no disponible' && formData.aux2 !== 'Geolocalización no soportada') {
          const googleMapsLink = `https://www.google.com/maps?q=${formData.aux2}`
          const htmlLink = `<p><a href="${googleMapsLink}" target="_blank" class="o_link_in_selection">📍 Ver ubicación en Google Maps</a></p>`
          properties['a890c89b8a561237_html'] = htmlLink
          console.log('📍 Geoposición:', googleMapsLink)
        }
        
        console.log('📦 task_properties:', properties)
        
        const propertiesUpdate = await client.update('project.task', createResult.data, {
          task_properties: properties
        })
        
        console.log(propertiesUpdate.success ? '✅ task_properties actualizado' : '⚠️ Fallo en task_properties:', propertiesUpdate.error)
      } catch (error) {
        console.error('❌ Error en task_properties:', error)
      }
    }

    // Paso 5: Adjuntar imágenes como archivos en Odoo
    await attachImagesToTask(createResult.data, formData)

    // Paso 6: Marcar la tarea como completada
    await markTaskAsCompleted(createResult.data, projectResult.projectId)

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
 * Mueve una tarea al stage "Done" en Odoo (sin marcar como hecha)
 */
async function markTaskAsCompleted(
  taskId: number,
  projectId: number
): Promise<void> {
  const client = getOdooClient()

  try {
    console.log('✅ Moviendo tarea al stage "Done"...')

    // Buscar el stage "Done" del proyecto
    const stageSearchResult = await client.search('project.task.type', [
      ['project_ids', 'in', [projectId]],
      ['name', 'ilike', 'done']
    ], { limit: 1 })

    if (!stageSearchResult.success || !stageSearchResult.data || stageSearchResult.data.length === 0) {
      console.error('⚠️ No se encontró el stage "Done"')
      return
    }

    const stageId = stageSearchResult.data[0]
    console.log(`✅ Stage "Done" encontrado: ID ${stageId}`)

    // Actualizar solo el stage_id de la tarea (sin marcarla como hecha)
    const updateResult = await client.update('project.task', taskId, {
      stage_id: stageId
    })

    if (updateResult.success) {
      console.log(`✅ Tarea ${taskId} movida al stage "Done"`)
    } else {
      console.error(`⚠️ No se pudo mover la tarea:`, JSON.stringify(updateResult.error, null, 2))
    }
  } catch (error) {
    console.error('❌ Error moviendo tarea al stage:', error)
    // No lanzamos el error para no interrumpir el flujo principal
  }
}

/**
 * Adjunta las imágenes (firmas y orden completa) como archivos en una tarea de Odoo
 */
async function attachImagesToTask(
  taskId: number,
  formData: AranFormData
): Promise<void> {
  const client = getOdooClient()

  try {
    console.log('📎 Adjuntando imágenes a la tarea...')

    const attachments = []

    // Adjuntar firma del técnico
    if (formData.tecnicoFirma) {
      attachments.push({
        url: formData.tecnicoFirma,
        name: `Firma_Tecnico_${formData.numeroOrden}.png`,
        description: `Firma del técnico: ${formData.tecnicoNombre || 'N/A'}`,
      })
    }

    // Adjuntar firma del cliente
    if (formData.clienteFirma) {
      attachments.push({
        url: formData.clienteFirma,
        name: `Firma_Cliente_${formData.numeroOrden}.png`,
        description: `Firma del cliente: ${formData.clienteNombre || 'N/A'}`,
      })
    }

    // Adjuntar imagen de la orden completa
    if (formData.aux1) {
      attachments.push({
        url: formData.aux1,
        name: `Orden_Servicio_${formData.numeroOrden}.png`,
        description: `Orden de servicio completa N° ${formData.numeroOrden}`,
      })
    }

    // Descargar y adjuntar cada imagen
    for (const attachment of attachments) {
      try {
        console.log(`📥 Descargando ${attachment.name}...`)
        
        // Descargar imagen desde ImgBB
        const response = await fetch(attachment.url)
        if (!response.ok) {
          console.error(`❌ Error descargando ${attachment.name}: HTTP ${response.status}`)
          continue
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64Data = buffer.toString('base64')

        console.log(`✅ Imagen descargada: ${attachment.name} (${buffer.length} bytes)`)

        // Crear adjunto en Odoo usando ir.attachment
        const attachmentData = {
          name: attachment.name,
          datas: base64Data,
          res_model: 'project.task',
          res_id: taskId,
          description: attachment.description,
          mimetype: 'image/png',
        }

        console.log(`📎 Creando adjunto en Odoo: ${attachment.name}`)
        const createAttachmentResult = await client.create('ir.attachment', attachmentData)

        if (createAttachmentResult.success) {
          console.log(`✅ Adjunto creado en Odoo: ${attachment.name} (ID: ${createAttachmentResult.data})`)
        } else {
          console.error(`❌ Error creando adjunto ${attachment.name}:`, createAttachmentResult.error)
        }
      } catch (error) {
        console.error(`❌ Error procesando ${attachment.name}:`, error)
      }
    }

    console.log('✅ Proceso de adjuntar imágenes completado')
  } catch (error) {
    console.error('❌ Error adjuntando imágenes:', error)
    // No lanzamos el error para no interrumpir el flujo principal
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

    // Verificar que podemos leer partners (contactos/clientes)
    const result = await client.search('res.partner', [], { limit: 10 })

    if (!result.success) {
      return { 
        success: false, 
        message: `Error al buscar partners: ${result.error}` 
      }
    }

    const partnerCount = result.data?.length || 0

    // Intentar verificar qué modelos de órdenes están disponibles
    let orderModelAvailable = ''
    
    // Probar project.task (Proyectos/Tareas - más común)
    const taskResult = await client.search('project.task', [], { limit: 1 })
    if (taskResult.success) {
      orderModelAvailable = 'project.task (Tareas de Proyecto)'
    } else {
      // Probar fsm.order (Field Service Management)
      const fsmResult = await client.search('fsm.order', [], { limit: 1 })
      if (fsmResult.success) {
        orderModelAvailable = 'fsm.order (Field Service Management)'
      } else {
        orderModelAvailable = 'Ninguno disponible (instalar módulo Sale, FSM o Project)'
      }
    }

    return { 
      success: true, 
      message: `✅ Conexión exitosa!\n📋 Partners encontrados: ${partnerCount}\n🔧 Modelo de órdenes: ${orderModelAvailable}` 
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
