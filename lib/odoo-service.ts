/**
 * Servicio para integración con Odoo Field Service Management (FSM)
 * Maneja la sincronización de órdenes de servicio con Odoo
 */

import { type FormData as AranFormData } from '@/hooks/use-form-data'
import { getOdooClient } from './odoo-client'

export interface OdooServiceOrder {
  id?: number
  name: string // Título de la tarea/orden
  partner_id: number // ID del CLIENTE
  partner_phone?: string // Número de contacto (project.task)
  date_order?: string // Fecha de orden (sale.order)
  stage_id?: number // ID de la etapa/estado (project.task.type)
  date_deadline?: string // Fecha límite (project.task) - datetime, fin del rango
  planned_date_begin?: string // Fecha de inicio planeada (project.task) - datetime, inicio del rango
  date_assign?: string // Fecha planeada (project.task)
  allocated_hours?: number // Tiempo asignado en horas (float - campo verificado en Odoo)
  task_properties?: any // Propiedades personalizadas (campo verificado en Odoo)
  tag_ids?: number[][] // Etiquetas de la tarea (para incluir técnico)
  user_id?: number // ID del usuario asignado (many2one - un solo usuario)
  user_ids?: Array<[number, number, number[]]> // IDs de usuarios asignados (many2many - múltiples usuarios, etiqueta "Personas asignadas")
  description?: string // Descripción del trabajo (HTML)
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
  // Campos personalizados ARAN - Odoo Studio (x_studio_*)
  // Datos del contacto/cliente
  x_studio_nombre_del_contacto?: string       // char - Nombre del contacto
  x_studio_razon_social?: string              // char - Razón Social
  x_studio_cuit?: string                      // char - CUIT
  x_studio_telefono_del_contacto?: string     // char - Teléfono del contacto
  // Tipos de servicio (booleanos)
  x_studio_servicio_tecnico?: boolean
  x_studio_instalacion?: boolean
  x_studio_puesta_en_marcha?: boolean
  x_studio_capacitacion?: boolean
  x_studio_calibracion?: boolean
  x_studio_tercero?: boolean
  // Equipo y máquina
  x_studio_maquina?: string                   // char - Máquina (tipo)
  x_studio_marca_maquina?: string             // char - Marca máquina
  x_studio_modelo_maquina?: string            // char - Modelo máquina
  x_studio_ano_maquina?: number               // integer - Año máquina
  x_studio_equipo?: string                    // char - Equipo
  // Descripción del trabajo
  x_studio_descripcion_de_lo_acontecido?: string // text - Descripción de lo acontecido
  x_studio_orden_de_servicio?: string         // char - Número de orden de servicio
  x_studio_fecha?: string                     // date - Fecha (YYYY-MM-DD)
  // Ubicación del servicio (booleanos)
  x_studio_servicio_a_campo?: boolean
  x_studio_servicio_en_oficina?: boolean
  // Ubicación geográfica
  x_studio_localidad?: string                 // char - Localidad
  x_studio_provincia?: string                 // char - Provincia
  x_studio_distancia_km?: number              // integer - Distancia (Km)
  x_studio_duracion_hs?: number               // integer - Duración (Hs)
  // Modalidad de cobro (booleanos)
  x_studio_con_cargo?: boolean
  x_studio_sin_cargo?: boolean
  x_studio_servicio_en_garantia?: boolean
  x_studio_a_convenir?: boolean
  // Valores económicos
  x_studio_precio_del_dolar?: number          // monetary - Precio del dólar
  x_studio_iva?: number                       // float - IVA porcentaje
  x_studio_total?: number                     // float - Total
  // Firmas (base64 binary)
  x_studio_firma_cliente?: string             // binary - Firma Cliente (base64)
  x_studio_binary_field_2bh_1jjr9hppn?: string // binary - Firma del técnico (base64)
  // Técnico
  x_studio_aclaracion_del_tecnico?: string    // char - Aclaración/nombre del técnico
  // Geoposición
  x_studio_geoposicion?: string               // char - URL de Google Maps
  x_studio_geoposicion_1?: string             // html - Link clicable a Google Maps
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
 * Extrae los números de serie de la descripción del trabajo
 */
function extractSerialNumbersFromDescription(descripcion: string): string[] {
  const snPrefix = 'Se agregan los siguientes SN: '
  const index = descripcion.indexOf(snPrefix)
  
  if (index === -1) return []
  
  // Extraer la parte después del prefijo
  const snSection = descripcion.substring(index + snPrefix.length)
  
  // Buscar hasta el final de la línea o del texto
  const snLine = snSection.split('\n')[0]
  
  // Separar por coma y espacio, limpiar espacios
  const serialNumbers = snLine.split(',').map(sn => sn.trim()).filter(sn => sn.length > 0)
  
  return serialNumbers
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
  
  // Extraer números de serie de la descripción
  const serialNumbersFromDescription = formData.descripcion 
    ? extractSerialNumbersFromDescription(formData.descripcion)
    : []
  
  // Combinar insumos existentes con los SN extraídos
  let insumosCompletos = formData.insumos || ''
  
  if (serialNumbersFromDescription.length > 0) {
    // Agregar SN como filas de insumos con formato: cantidad;numeroSerie;codigo;articulo;precioNeto
    const snRows = serialNumbersFromDescription.map(sn => `1;${sn};;;`).join('|')
    
    if (insumosCompletos) {
      insumosCompletos += '|' + snRows
    } else {
      insumosCompletos = snRows
    }
    
    console.log(`📦 Se agregaron ${serialNumbersFromDescription.length} números de serie desde la descripción`)
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
<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr style="background-color: #2c3e50; color: white;">
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: center; width: 8%;">Cant.</th>
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: left; width: 18%;">N° Serie</th>
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: left; width: 20%;">Código</th>
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: left; width: 39%;">Descripción</th>
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: right; width: 15%;">Precio</th>
    </tr>
  </thead>
  <tbody>
${formData.insumos.split('|').filter(line => line.trim()).map((line, index) => {
  // Formato: cantidad;numeroSerie;codigo;articulo;precioNeto
  const parts = line.split(';')
  const cantidad = parts[0] || ''
  const numeroSerie = parts[1] || ''
  const codigo = parts[2] || ''
  const descripcion = parts[3] || ''
  const precio = parts[4] || ''
  const bgColor = index % 2 === 0 ? '#ecf0f1' : '#ffffff'
  
  return `    <tr style="background-color: ${bgColor};">
      <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: center;">${cantidad}</td>
      <td style="padding: 8px; border: 1px solid #bdc3c7;">${numeroSerie}</td>
      <td style="padding: 8px; border: 1px solid #bdc3c7;">${codigo}</td>
      <td style="padding: 8px; border: 1px solid #bdc3c7;">${descripcion}</td>
      <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${precio}</td>
    </tr>`
}).join('\n')}
  </tbody>
</table>
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

  // Formato para project.task: campos estándar + campos personalizados x_studio_*
  // IMPORTANTE: project.task requiere un project_id obligatorio
  // Los campos x_studio_* almacenan los datos estructurados directamente en Odoo
  // El campo description mantiene el HTML visual como respaldo/vista rápida
  const taskData: Partial<OdooServiceOrder> = {
    // --- Campos estándar de Odoo ---
    name: `OS ${formData.numeroOrden} - ${formData.razonSocial || 'Cliente'}`,
    partner_id: partnerId,
    partner_phone: formData.telefono,
    project_id: projectId,
    stage_id: 107, // "Registro" - etapa inicial del proyecto 3 (Órdenes de Servicio ARAN)
    user_ids: [[6, 0, [5]]], // Asignar a Axel Dadone (UID 5)
    planned_date_begin: `${orderDate} 00:00:00`,
    date_deadline: `${orderDate} 23:59:59`,
    allocated_hours: formData.duracion ? parseFloat(formData.duracion) : undefined,
    description: descripcionCompleta, // HTML visual (se mantiene como respaldo)

    // --- Campos personalizados x_studio_* (datos estructurados) ---
    // Datos del contacto/cliente
    x_studio_nombre_del_contacto: formData.contacto || undefined,
    x_studio_razon_social: formData.razonSocial || undefined,
    x_studio_cuit: formData.cuit || undefined,
    x_studio_telefono_del_contacto: formData.telefono || undefined,

    // Número de orden y fecha
    x_studio_orden_de_servicio: formData.numeroOrden || undefined,
    x_studio_fecha: orderDate, // YYYY-MM-DD

    // Tipos de servicio
    x_studio_servicio_tecnico: formData.servicioTecnico || false,
    x_studio_instalacion: formData.instalacion || false,
    x_studio_puesta_en_marcha: formData.puestaEnMarcha || false,
    x_studio_capacitacion: formData.capacitacion || false,
    x_studio_calibracion: formData.calibracion || false,
    x_studio_tercero: formData.tercero || false,

    // Equipo y máquina
    x_studio_maquina: formData.maquina || undefined,
    x_studio_equipo: formData.equipo || undefined,

    // Descripción del trabajo
    x_studio_descripcion_de_lo_acontecido: formData.descripcion || undefined,

    // Ubicación del servicio
    x_studio_servicio_a_campo: formData.servicioACampo || false,
    x_studio_servicio_en_oficina: formData.servicioEnOficina || false,

    // Ubicación geográfica
    x_studio_localidad: formData.localidad || undefined,
    x_studio_provincia: formData.provincia || undefined,
    x_studio_distancia_km: formData.distancia ? parseInt(formData.distancia) : undefined,
    x_studio_duracion_hs: formData.duracion ? parseInt(formData.duracion) : undefined,

    // Modalidad de cobro
    x_studio_con_cargo: formData.conCargo || false,
    x_studio_sin_cargo: formData.sinCargo || false,
    x_studio_servicio_en_garantia: formData.servicioEnGarantia || false,
    x_studio_a_convenir: formData.aConvenir || false,

    // Valores económicos
    x_studio_precio_del_dolar: formData.tipoCambio ? parseFloat(formData.tipoCambio.replace(/\./g, '').replace(',', '.')) : undefined,
    x_studio_iva: formData.iva ? parseFloat(formData.iva.replace(/\./g, '').replace(',', '.')) : undefined,
    x_studio_total: formData.total ? parseFloat(formData.total.replace(/\./g, '').replace(',', '.')) : undefined,

    // Técnico
    x_studio_aclaracion_del_tecnico: formData.tecnicoNombre || undefined,

    // Geoposición: URL de Google Maps con las coordenadas (campo char)
    x_studio_geoposicion: (formData.aux2 && formData.aux2 !== 'Geolocalización no disponible' && formData.aux2 !== 'Geolocalización no soportada')
      ? `https://www.google.com/maps?q=${formData.aux2}`
      : undefined,
    // Geoposición HTML: link clicable (campo html)
    x_studio_geoposicion_1: (formData.aux2 && formData.aux2 !== 'Geolocalización no disponible' && formData.aux2 !== 'Geolocalización no soportada')
      ? `<a href="https://www.google.com/maps?q=${formData.aux2}" target="_blank">📍 Ver ubicación de la firma en Google Maps</a>`
      : undefined,
  }

  return taskData
}

/**
 * Busca un CLIENTE (partner) existente en Odoo por CUIT o razón social.
 * Estrategia de búsqueda escalonada:
 *   1. CUIT exacto (limpiando guiones/espacios)
 *   2. CUIT normalizado (solo dígitos)
 *   3. Razón social exacta en empresas (is_company = true)
 *   4. Razón social parcial en empresas
 *   5. Razón social parcial en todos los partners
 * NO crea contactos automáticamente.
 */
export async function findPartner(
  formData: AranFormData
): Promise<{ success: boolean; partnerId?: number; error?: string }> {
  const client = getOdooClient()

  try {
    // Normalizar CUIT: quitar guiones, espacios y puntos
    const cuitRaw = formData.cuit?.trim() || ''
    const cuitClean = cuitRaw.replace(/[-.\s]/g, '')

    // --- Paso 1: Buscar por CUIT (más confiable) ---
    if (cuitClean.length >= 8) {
      // 1a. Buscar CUIT tal cual fue ingresado
      const exactResult = await client.search('res.partner', [
        ['vat', '=', cuitRaw]
      ], { limit: 1 })

      if (exactResult.success && exactResult.data?.length > 0) {
        console.log(`✅ CLIENTE encontrado por CUIT exacto "${cuitRaw}": ID ${exactResult.data[0]}`)
        return { success: true, partnerId: exactResult.data[0] }
      }

      // 1b. Buscar CUIT normalizado (solo dígitos)
      if (cuitClean !== cuitRaw) {
        const cleanResult = await client.search('res.partner', [
          ['vat', '=', cuitClean]
        ], { limit: 1 })

        if (cleanResult.success && cleanResult.data?.length > 0) {
          console.log(`✅ CLIENTE encontrado por CUIT normalizado "${cuitClean}": ID ${cleanResult.data[0]}`)
          return { success: true, partnerId: cleanResult.data[0] }
        }
      }

      // 1c. Buscar CUIT con ilike (por si tiene formato diferente en Odoo)
      const ilikeResult = await client.search('res.partner', [
        ['vat', 'ilike', cuitClean]
      ], { limit: 1 })

      if (ilikeResult.success && ilikeResult.data?.length > 0) {
        console.log(`✅ CLIENTE encontrado por CUIT parcial "${cuitClean}": ID ${ilikeResult.data[0]}`)
        return { success: true, partnerId: ilikeResult.data[0] }
      }

      console.log(`⚠️ No se encontró partner con CUIT: "${cuitRaw}" / "${cuitClean}"`)
    }

    // --- Paso 2: Buscar por razón social ---
    const razonSocial = formData.razonSocial?.trim() || ''
    if (razonSocial.length >= 3) {
      // 2a. Buscar match exacto en empresas (is_company = true) — más preciso
      const companyExactResult = await client.search('res.partner', [
        ['name', '=', razonSocial],
        ['is_company', '=', true]
      ], { limit: 1 })

      if (companyExactResult.success && companyExactResult.data?.length > 0) {
        console.log(`✅ EMPRESA encontrada por nombre exacto "${razonSocial}": ID ${companyExactResult.data[0]}`)
        return { success: true, partnerId: companyExactResult.data[0] }
      }

      // 2b. Buscar match parcial en empresas
      const companyIlikeResult = await client.search('res.partner', [
        ['name', 'ilike', razonSocial],
        ['is_company', '=', true]
      ], { limit: 1 })

      if (companyIlikeResult.success && companyIlikeResult.data?.length > 0) {
        console.log(`✅ EMPRESA encontrada por nombre parcial "${razonSocial}": ID ${companyIlikeResult.data[0]}`)
        return { success: true, partnerId: companyIlikeResult.data[0] }
      }

      // 2c. Último recurso: buscar en todos los partners (incluye contactos)
      const anyResult = await client.search('res.partner', [
        ['name', 'ilike', razonSocial]
      ], { limit: 1 })

      if (anyResult.success && anyResult.data?.length > 0) {
        console.log(`✅ PARTNER encontrado por nombre "${razonSocial}": ID ${anyResult.data[0]} (podría ser contacto)`)
        return { success: true, partnerId: anyResult.data[0] }
      }
    }

    // No se encontró por ningún método
    if (!cuitClean && !razonSocial) {
      return { success: false, error: 'Faltan datos del CLIENTE (CUIT o Razón Social)' }
    }

    console.log('⚠️ CLIENTE no encontrado en Odoo. No se creará automáticamente.')
    return { 
      success: false, 
      error: 'Cliente no encontrado en Odoo. Seleccioná un cliente existente o creá uno nuevo desde el campo Razón Social.' 
    }
  } catch (error) {
    console.error('❌ Error buscando CLIENTE:', error)
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

    // Paso 2: Obtener el ID del CLIENTE
    // Prioridad: ID seleccionado desde el UI > búsqueda por CUIT/nombre
    let partnerId: number | undefined

    if (formData.odooPartnerId) {
      // El usuario seleccionó un contacto desde el UI - usar ese ID directamente
      partnerId = formData.odooPartnerId
      console.log(`✅ Usando partner ID seleccionado desde el formulario: ${partnerId}`)
    } else {
      // Fallback: buscar por CUIT o razón social (solo búsqueda, sin crear)
      const partnerResult = await findPartner(formData)
      if (partnerResult.success && partnerResult.partnerId) {
        partnerId = partnerResult.partnerId
      } else {
        console.warn(`⚠️ Cliente no encontrado en Odoo. Creando tarea sin partner.`)
      }
    }

    // Paso 3: Convertir datos al formato Odoo (partnerId puede ser undefined si no se encontró)
    const orderData = convertAranToOdooServiceOrder(formData, partnerId || 0, projectResult.projectId)

    // Si no hay partner, no enviar partner_id=0 (Odoo lo rechazaría)
    if (!partnerId) {
      delete orderData.partner_id
    }

    // Paso 4: Crear la tarea/orden de servicio en Odoo usando project.task
    console.log('📝 Creando tarea en Odoo con datos:', JSON.stringify(orderData, null, 2))
    const createResult = await client.create('project.task', orderData)

    if (!createResult.success) {
      return { success: false, error: createResult.error }
    }

    console.log(`✅ Tarea de servicio creada en Odoo: ID ${createResult.data}`)

    // Paso 4.6: Descargar firmas desde ImgBB y guardarlas como base64 en campos x_studio_firma_*
    await updateSignatureFields(createResult.data, formData)

    // Paso 5: Adjuntar imágenes como archivos en Odoo
    await attachImagesToTask(createResult.data, formData)

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
 * Actualiza una tarea existente en Odoo (para órdenes tomadas desde "Pendientes")
 * - Actualiza todos los campos x_studio_* con los datos completados del formulario
 * - Cambia el nombre de la tarea: "OS XXXXX - [nombre original]"
 * - Cambia la etapa a "Registro" (stage_id = 107)
 */
export async function updateServiceOrderInOdoo(
  formData: AranFormData,
  taskId: number,
  originalTaskName: string
): Promise<{ success: boolean; orderId?: number; error?: string }> {
  const client = getOdooClient()

  try {
    console.log(`🔄 Actualizando tarea existente en Odoo: ID ${taskId}...`)

    // Obtener el ID del CLIENTE
    let partnerId: number | undefined

    if (formData.odooPartnerId) {
      partnerId = formData.odooPartnerId
      console.log(`✅ Usando partner ID seleccionado desde el formulario: ${partnerId}`)
    } else {
      const partnerResult = await findPartner(formData)
      if (partnerResult.success && partnerResult.partnerId) {
        partnerId = partnerResult.partnerId
      } else {
        console.warn(`⚠️ Cliente no encontrado en Odoo.`)
      }
    }

    // Convertir fecha de DD-MM-YYYY a YYYY-MM-DD
    let orderDate = new Date().toISOString().split('T')[0]
    if (formData.fecha) {
      const [day, month, year] = formData.fecha.split('-')
      orderDate = `${year}-${month}-${day}`
    }

    // Construir el nuevo nombre: "OS XXXXX - [nombre original]"
    const newTaskName = `OS ${formData.numeroOrden} - ${originalTaskName}`

    // Construir datos de actualización
    const updateData: Record<string, any> = {
      // Cambiar nombre y etapa
      name: newTaskName,
      stage_id: 107, // "Registro"

      // Fechas
      planned_date_begin: `${orderDate} 00:00:00`,
      date_deadline: `${orderDate} 23:59:59`,
      allocated_hours: formData.duracion ? parseFloat(formData.duracion) : undefined,

      // Datos del contacto/cliente
      x_studio_nombre_del_contacto: formData.contacto || undefined,
      x_studio_razon_social: formData.razonSocial || undefined,
      x_studio_cuit: formData.cuit || undefined,
      x_studio_telefono_del_contacto: formData.telefono || undefined,

      // Número de orden y fecha
      x_studio_orden_de_servicio: formData.numeroOrden || undefined,
      x_studio_fecha: orderDate,

      // Tipos de servicio
      x_studio_servicio_tecnico: formData.servicioTecnico || false,
      x_studio_instalacion: formData.instalacion || false,
      x_studio_puesta_en_marcha: formData.puestaEnMarcha || false,
      x_studio_capacitacion: formData.capacitacion || false,
      x_studio_calibracion: formData.calibracion || false,
      x_studio_tercero: formData.tercero || false,

      // Equipo y máquina
      x_studio_maquina: formData.maquina || undefined,
      x_studio_equipo: formData.equipo || undefined,

      // Descripción del trabajo
      x_studio_descripcion_de_lo_acontecido: formData.descripcion || undefined,

      // Ubicación del servicio
      x_studio_servicio_a_campo: formData.servicioACampo || false,
      x_studio_servicio_en_oficina: formData.servicioEnOficina || false,

      // Ubicación geográfica
      x_studio_localidad: formData.localidad || undefined,
      x_studio_provincia: formData.provincia || undefined,
      x_studio_distancia_km: formData.distancia ? parseInt(formData.distancia) : undefined,
      x_studio_duracion_hs: formData.duracion ? parseInt(formData.duracion) : undefined,

      // Modalidad de cobro
      x_studio_con_cargo: formData.conCargo || false,
      x_studio_sin_cargo: formData.sinCargo || false,
      x_studio_servicio_en_garantia: formData.servicioEnGarantia || false,
      x_studio_a_convenir: formData.aConvenir || false,

      // Valores económicos
      x_studio_precio_del_dolar: formData.tipoCambio ? parseFloat(formData.tipoCambio.replace(/\./g, '').replace(',', '.')) : undefined,
      x_studio_iva: formData.iva ? parseFloat(formData.iva.replace(/\./g, '').replace(',', '.')) : undefined,
      x_studio_total: formData.total ? parseFloat(formData.total.replace(/\./g, '').replace(',', '.')) : undefined,

      // Técnico
      x_studio_aclaracion_del_tecnico: formData.tecnicoNombre || undefined,

      // Geoposición
      x_studio_geoposicion: (formData.aux2 && formData.aux2 !== 'Geolocalización no disponible' && formData.aux2 !== 'Geolocalización no soportada')
        ? `https://www.google.com/maps?q=${formData.aux2}`
        : undefined,
      x_studio_geoposicion_1: (formData.aux2 && formData.aux2 !== 'Geolocalización no disponible' && formData.aux2 !== 'Geolocalización no soportada')
        ? `<a href="https://www.google.com/maps?q=${formData.aux2}" target="_blank">📍 Ver ubicación de la firma en Google Maps</a>`
        : undefined,
    }

    // Agregar partner_id si existe
    if (partnerId) {
      updateData.partner_id = partnerId
      updateData.partner_phone = formData.telefono
    }

    // Construir descripción HTML (igual que en create)
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

    updateData.description = `<div style="font-family: Arial, sans-serif;">
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
<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr style="background-color: #2c3e50; color: white;">
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: center; width: 8%;">Cant.</th>
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: left; width: 18%;">N° Serie</th>
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: left; width: 20%;">Código</th>
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: left; width: 39%;">Descripción</th>
      <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: right; width: 15%;">Precio</th>
    </tr>
  </thead>
  <tbody>
${formData.insumos.split('|').filter((line: string) => line.trim()).map((line: string, index: number) => {
  const parts = line.split(';')
  const cantidad = parts[0] || ''
  const numeroSerie = parts[1] || ''
  const codigo = parts[2] || ''
  const descripcion = parts[3] || ''
  const precio = parts[4] || ''
  const bgColor = index % 2 === 0 ? '#ecf0f1' : '#ffffff'
  return `    <tr style="background-color: ${bgColor};">
      <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: center;">${cantidad}</td>
      <td style="padding: 8px; border: 1px solid #bdc3c7;">${numeroSerie}</td>
      <td style="padding: 8px; border: 1px solid #bdc3c7;">${codigo}</td>
      <td style="padding: 8px; border: 1px solid #bdc3c7;">${descripcion}</td>
      <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${precio}</td>
    </tr>`
}).join('\n')}
  </tbody>
</table>
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

    // Limpiar campos undefined del objeto
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })

    console.log('📝 Actualizando tarea en Odoo con datos:', JSON.stringify(updateData, null, 2))
    const updateResult = await client.update('project.task', taskId, updateData)

    if (!updateResult.success) {
      return { success: false, error: updateResult.error }
    }

    console.log(`✅ Tarea ${taskId} actualizada en Odoo: "${newTaskName}" → etapa Registro (107)`)

    // Actualizar firmas
    await updateSignatureFields(taskId, formData)

    // Adjuntar imágenes
    await attachImagesToTask(taskId, formData)

    // Agregar líneas de insumos a la orden de venta asociada
    if (formData.insumos && formData.insumos.trim()) {
      let saleOrderId = formData.odooSaleOrderId

      // Si no hay orden de venta asociada, crear una nueva
      if (!saleOrderId) {
        console.log(`🛒 No hay orden de venta asociada a la tarea ${taskId}. Creando una nueva...`)
        saleOrderId = await createSaleOrderForTask(taskId, partnerId || undefined, formData)
      }

      if (saleOrderId) {
        console.log(`📦 Agregando insumos a la orden de venta ${saleOrderId}...`)
        await addServiceOrderLines(saleOrderId, formData)
      } else {
        console.warn('⚠️ No se pudo crear la orden de venta. Los insumos no fueron agregados.')
      }
    }

    return { success: true, orderId: taskId }
  } catch (error) {
    console.error('❌ Error actualizando tarea en Odoo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Descarga imágenes de firma desde ImgBB y las guarda como base64 en los campos x_studio_firma_*
 */
async function updateSignatureFields(
  taskId: number,
  formData: AranFormData
): Promise<void> {
  const client = getOdooClient()
  const firmaUpdates: Partial<OdooServiceOrder> = {}

  try {
    // Descargar firma del técnico
    if (formData.tecnicoFirma) {
      try {
        console.log('📥 Descargando firma del técnico para campo x_studio...')
        const response = await fetch(formData.tecnicoFirma)
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString('base64')
          firmaUpdates.x_studio_binary_field_2bh_1jjr9hppn = base64
          console.log(`✅ Firma técnico descargada (${arrayBuffer.byteLength} bytes)`)
        } else {
          console.error(`⚠️ Error descargando firma técnico: HTTP ${response.status}`)
        }
      } catch (err) {
        console.error('⚠️ Error descargando firma técnico:', err)
      }
    }

    // Descargar firma del cliente
    if (formData.clienteFirma) {
      try {
        console.log('📥 Descargando firma del cliente para campo x_studio...')
        const response = await fetch(formData.clienteFirma)
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString('base64')
          firmaUpdates.x_studio_firma_cliente = base64
          console.log(`✅ Firma cliente descargada (${arrayBuffer.byteLength} bytes)`)
        } else {
          console.error(`⚠️ Error descargando firma cliente: HTTP ${response.status}`)
        }
      } catch (err) {
        console.error('⚠️ Error descargando firma cliente:', err)
      }
    }

    // Actualizar campos de firma en la tarea
    if (Object.keys(firmaUpdates).length > 0) {
      console.log('📝 Actualizando campos de firma en Odoo...')
      const updateResult = await client.update('project.task', taskId, firmaUpdates)
      if (updateResult.success) {
        console.log('✅ Campos x_studio_firma_* actualizados correctamente')
      } else {
        console.error('⚠️ Error actualizando firmas:', updateResult.error)
      }
    }
  } catch (error) {
    console.error('❌ Error en updateSignatureFields:', error)
    // No lanzamos el error para no interrumpir el flujo principal
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
 * Crea una nueva orden de venta (sale.order) y la vincula a la tarea (project.task)
 */
async function createSaleOrderForTask(
  taskId: number,
  partnerId: number | undefined,
  formData: AranFormData
): Promise<number | null> {
  const client = getOdooClient()

  try {
    // Necesitamos un partner_id para crear la orden de venta
    if (!partnerId) {
      console.warn('⚠️ No hay partner_id para crear la orden de venta')
      return null
    }

    // Convertir fecha
    let orderDate = new Date().toISOString().split('T')[0]
    if (formData.fecha) {
      const [day, month, year] = formData.fecha.split('-')
      orderDate = `${year}-${month}-${day}`
    }

    const saleOrderData: Record<string, any> = {
      partner_id: partnerId,
      date_order: `${orderDate} 00:00:00`,
      origin: `OS ${formData.numeroOrden}`,
    }

    console.log('🛒 Creando orden de venta:', JSON.stringify(saleOrderData, null, 2))
    const createResult = await client.create('sale.order', saleOrderData)

    if (!createResult.success || !createResult.data) {
      console.error('❌ Error creando orden de venta:', createResult.error)
      return null
    }

    const saleOrderId = createResult.data as number
    console.log(`✅ Orden de venta creada: ID ${saleOrderId}`)

    // Vincular la orden de venta a la tarea
    const linkResult = await client.update('project.task', taskId, {
      sale_order_id: saleOrderId,
    })

    if (linkResult.success) {
      console.log(`🔗 Orden de venta ${saleOrderId} vinculada a la tarea ${taskId}`)
    } else {
      console.warn(`⚠️ No se pudo vincular la OV ${saleOrderId} a la tarea ${taskId}:`, linkResult.error)
    }

    return saleOrderId
  } catch (error) {
    console.error('❌ Error creando orden de venta:', error)
    return null
  }
}

/**
 * Agrega líneas de insumos a una orden de venta existente en Odoo
 * Parsea el formato pipe/semicolon: "cantidad;serie;codigo;articulo;precio|..."
 */
export async function addServiceOrderLines(
  saleOrderId: number,
  formData: AranFormData
): Promise<void> {
  const client = getOdooClient()

  try {
    if (!formData.insumos || !formData.insumos.trim()) {
      console.log('📦 Sin insumos para agregar a la orden de venta')
      return
    }

    // Parsear formato: "cantidad;serie;codigo;articulo;precio|..."
    const lines = formData.insumos.split('|').filter(l => l.trim())
    console.log(`📦 Procesando ${lines.length} líneas de insumos para orden de venta ${saleOrderId}`)

    for (const line of lines) {
      const parts = line.split(';')
      const cantidad = parseInt(parts[0]) || 1
      const codigo = parts[2]?.trim() || ''
      const articulo = parts[3]?.trim() || ''
      const precio = parseFloat(parts[4]?.replace(',', '.') || '0') || 0

      if (!articulo && !codigo) continue // Skip empty lines

      // Buscar producto por código interno (default_code) o por nombre
      let productId: number | null = null

      if (codigo) {
        const byCode = await client.searchRead(
          'product.product',
          [['default_code', '=', codigo]],
          ['id'],
          { limit: 1 }
        )
        if (byCode.success && Array.isArray(byCode.data) && byCode.data.length > 0) {
          productId = byCode.data[0].id
        }
      }

      if (!productId && articulo) {
        const byName = await client.searchRead(
          'product.product',
          [['name', 'ilike', articulo]],
          ['id'],
          { limit: 1 }
        )
        if (byName.success && Array.isArray(byName.data) && byName.data.length > 0) {
          productId = byName.data[0].id
        }
      }

      // Crear la línea de orden de venta
      const lineData: Record<string, any> = {
        order_id: saleOrderId,
        product_uom_qty: cantidad,
        name: articulo || codigo || 'Producto',
      }

      if (productId) {
        lineData.product_id = productId
      }

      if (precio > 0) {
        lineData.price_unit = precio
      }

      const createResult = await client.create('sale.order.line', lineData)
      if (createResult.success) {
        console.log(`✅ Línea agregada a OV ${saleOrderId}: ${articulo || codigo} x ${cantidad}`)
      } else {
        console.warn(`⚠️ Error creando línea para ${articulo || codigo}:`, createResult.error)
      }
    }

    console.log(`📦 Líneas de insumos procesadas para OV ${saleOrderId}`)
  } catch (error) {
    console.error('❌ Error agregando líneas a la orden de venta:', error)
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
