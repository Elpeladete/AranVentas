/**
 * Funcionalidad de búsqueda de insumos desde Odoo
 * 
 * Tres modos de búsqueda:
 * 1. Por Número de Serie (stock.lot) → autocompleta código y artículo
 * 2. Por Código: primero en product.supplierinfo (product_code), luego en product.template (default_code)
 *    → autocompleta artículo, precio, y sugiere números de serie
 * 3. Por Artículo/Descripción: busca en product.template (name)
 *    → autocompleta código, precio, y sugiere números de serie
 */

import { getOdooClient } from './odoo-client'

export interface InsumoData {
  codigo: string
  descripcion: string
  precioEstimado: number
  codigoOriginal: string // Referencia (default_code) del producto
  codigoProveedor?: string // Código del proveedor (product_code en product.supplierinfo)
  numeroSerie?: string   // Número de serie si viene de stock.lot
  seriesDisponibles?: string[] // Lista de números de serie disponibles para el producto
}

// ─── Helpers internos ───────────────────────────────────────────────

/**
 * Dado un array de product IDs, trae los números de serie (stock.lot) asociados
 */
async function fetchSeriesForProducts(productIds: number[]): Promise<Record<number, string[]>> {
  if (productIds.length === 0) return {}

  const client = getOdooClient()
  const lotResult = await client.searchRead(
    'stock.lot',
    [['product_id', 'in', productIds]],
    ['name', 'product_id'],
    { limit: 50 }
  )

  const map: Record<number, string[]> = {}
  if (lotResult.success && Array.isArray(lotResult.data)) {
    for (const lot of lotResult.data) {
      const prodId = Array.isArray(lot.product_id) ? lot.product_id[0] : lot.product_id
      if (!map[prodId]) map[prodId] = []
      map[prodId].push(lot.name)
    }
  }
  return map
}

/**
 * Dado un array de product.template IDs, trae los códigos de proveedor (product.supplierinfo)
 * Retorna un mapa templateId -> product_code
 */
async function fetchSupplierCodesForTemplates(templateIds: number[]): Promise<Record<number, string>> {
  if (templateIds.length === 0) return {}

  const client = getOdooClient()
  const result = await client.searchRead(
    'product.supplierinfo',
    [['product_tmpl_id', 'in', templateIds]],
    ['product_code', 'product_tmpl_id'],
    { limit: 50 }
  )

  const map: Record<number, string> = {}
  if (result.success && Array.isArray(result.data)) {
    for (const si of result.data) {
      const tmplId = Array.isArray(si.product_tmpl_id) ? si.product_tmpl_id[0] : si.product_tmpl_id
      if (tmplId && si.product_code && !map[tmplId]) {
        map[tmplId] = si.product_code
      }
    }
  }
  return map
}

/**
 * Dado un array de product.product IDs, trae los códigos de proveedor
 * Primero busca el product_tmpl_id y luego en supplierinfo
 */
async function fetchSupplierCodesForProducts(productIds: number[]): Promise<Record<number, string>> {
  if (productIds.length === 0) return {}

  const client = getOdooClient()
  // Primero obtener el product_tmpl_id de cada product.product
  const prodResult = await client.searchRead(
    'product.product',
    [['id', 'in', productIds]],
    ['product_tmpl_id'],
    { limit: productIds.length }
  )

  if (!prodResult.success || !Array.isArray(prodResult.data)) return {}

  const prodToTmpl: Record<number, number> = {}
  const tmplIds: number[] = []
  for (const p of prodResult.data) {
    const tmplId = Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : p.product_tmpl_id
    prodToTmpl[p.id] = tmplId
    tmplIds.push(tmplId)
  }

  const tmplCodes = await fetchSupplierCodesForTemplates([...new Set(tmplIds)])

  const map: Record<number, string> = {}
  for (const [prodId, tmplId] of Object.entries(prodToTmpl)) {
    if (tmplCodes[tmplId]) map[Number(prodId)] = tmplCodes[tmplId]
  }
  return map
}

/**
 * Dado un array de product.template IDs, trae los product.product asociados
 * con sus datos completos (default_code, name, list_price)
 */
async function fetchProductsByTemplateIds(templateIds: number[]): Promise<any[]> {
  if (templateIds.length === 0) return []

  const client = getOdooClient()
  const result = await client.searchRead(
    'product.product',
    [['product_tmpl_id', 'in', templateIds]],
    ['default_code', 'name', 'list_price', 'product_tmpl_id'],
    { limit: 20 }
  )

  return (result.success && Array.isArray(result.data)) ? result.data : []
}

// ─── 1. Búsqueda por Número de Serie ────────────────────────────────

/**
 * Busca por número de serie en stock.lot.
 * Autocompleta código (Referencia/default_code) y artículo (name).
 */
export async function searchBySerialNumber(query: string): Promise<InsumoData[]> {
  if (query.length < 3) return []

  try {
    const client = getOdooClient()

    // Buscar en stock.lot por nombre de serie
    const lotResult = await client.searchRead(
      'stock.lot',
      [['name', 'ilike', query]],
      ['name', 'product_id'],
      { limit: 15 }
    )

    if (!lotResult.success || !Array.isArray(lotResult.data) || lotResult.data.length === 0) {
      console.log(`🔢 Odoo serie: 0 resultados para "${query}"`)
      return []
    }

    // Extraer IDs de productos únicos
    const productIds = [...new Set(
      lotResult.data
        .map((lot: any) => Array.isArray(lot.product_id) ? lot.product_id[0] : lot.product_id)
        .filter(Boolean)
    )] as number[]

    // Traer datos completos de los productos (incluye product_tmpl_id para fallback)
    let productMap: Record<number, any> = {}
    if (productIds.length > 0) {
      const prodResult = await client.searchRead(
        'product.product',
        [['id', 'in', productIds]],
        ['default_code', 'name', 'list_price', 'product_tmpl_id'],
        { limit: productIds.length }
      )
      if (prodResult.success && Array.isArray(prodResult.data)) {
        for (const p of prodResult.data) {
          productMap[p.id] = p
        }
      }
    }

    // Verificar si algún producto no tiene default_code → buscar en product.template
    const tmplIdsToFetch: number[] = []
    for (const p of Object.values(productMap)) {
      if (!p.default_code && p.product_tmpl_id) {
        const tmplId = Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : p.product_tmpl_id
        if (tmplId) tmplIdsToFetch.push(tmplId)
      }
    }

    let templateMap: Record<number, any> = {}
    if (tmplIdsToFetch.length > 0) {
      const tmplResult = await client.searchRead(
        'product.template',
        [['id', 'in', [...new Set(tmplIdsToFetch)]]],
        ['default_code', 'name', 'list_price'],
        { limit: tmplIdsToFetch.length }
      )
      if (tmplResult.success && Array.isArray(tmplResult.data)) {
        for (const t of tmplResult.data) {
          templateMap[t.id] = t
        }
      }
    }

    // Traer códigos de proveedor
    const supplierCodeMap = await fetchSupplierCodesForProducts(productIds)

    const results: InsumoData[] = lotResult.data.map((lot: any) => {
      const prodId = Array.isArray(lot.product_id) ? lot.product_id[0] : lot.product_id
      const prodName = Array.isArray(lot.product_id) ? lot.product_id[1] : ''
      const prod = prodId ? productMap[prodId] : null
      
      // Fallback: si product.product no tiene default_code, buscar en product.template
      let defaultCode = prod?.default_code || ''
      let name = prod?.name || prodName || ''
      let price = prod?.list_price || 0
      if (!defaultCode && prod?.product_tmpl_id) {
        const tmplId = Array.isArray(prod.product_tmpl_id) ? prod.product_tmpl_id[0] : prod.product_tmpl_id
        const tmpl = tmplId ? templateMap[tmplId] : null
        if (tmpl) {
          defaultCode = tmpl.default_code || ''
          if (!name) name = tmpl.name || ''
          if (!price) price = tmpl.list_price || 0
        }
      }

      // Si no hay default_code (Referencia), usar código de proveedor como fallback
      const supplierCode = prodId ? supplierCodeMap[prodId] || '' : ''
      const bestCode = defaultCode || supplierCode

      return {
        codigo: bestCode.toLowerCase(),
        descripcion: name,
        precioEstimado: price,
        codigoOriginal: bestCode,
        codigoProveedor: supplierCode,
        numeroSerie: lot.name || ''
      }
    })

    console.log(`🔢 Odoo serie: ${results.length} resultados para "${query}"`, results.map(r => ({ sn: r.numeroSerie, ref: r.codigoOriginal, prov: r.codigoProveedor, desc: r.descripcion })))
    return results.slice(0, 15)
  } catch (error) {
    console.error('❌ Error buscando por número de serie en Odoo:', error)
    return []
  }
}

// ─── 2. Búsqueda por Código ─────────────────────────────────────────

/**
 * Busca por código:
 * 1º) Código del Proveedor (product_code en product.supplierinfo)
 * 2º) Si no encuentra, busca por Referencia (default_code en product.template)
 * Sugiere números de serie disponibles.
 */
export async function searchByCodigo(query: string): Promise<InsumoData[]> {
  if (query.length < 3) return []

  try {
    const client = getOdooClient()

    // Paso 1: Buscar en product.supplierinfo por product_code
    const supplierResult = await client.searchRead(
      'product.supplierinfo',
      [['product_code', 'ilike', query]],
      ['product_code', 'product_tmpl_id', 'product_id'],
      { limit: 10 }
    )

    let results: InsumoData[] = []

    if (supplierResult.success && Array.isArray(supplierResult.data) && supplierResult.data.length > 0) {
      // Encontró por código de proveedor
      // Extraer template IDs y product IDs
      const templateIds: number[] = []
      const directProductIds: number[] = []

      for (const si of supplierResult.data) {
        if (si.product_id && (Array.isArray(si.product_id) ? si.product_id[0] : si.product_id)) {
          directProductIds.push(Array.isArray(si.product_id) ? si.product_id[0] : si.product_id)
        } else if (si.product_tmpl_id) {
          templateIds.push(Array.isArray(si.product_tmpl_id) ? si.product_tmpl_id[0] : si.product_tmpl_id)
        }
      }

      // Traer productos por template IDs
      const templateProducts = await fetchProductsByTemplateIds([...new Set(templateIds)])

      // Traer productos directos
      let directProducts: any[] = []
      const uniqueDirectIds = [...new Set(directProductIds)]
      if (uniqueDirectIds.length > 0) {
        const dpResult = await client.searchRead(
          'product.product',
          [['id', 'in', uniqueDirectIds]],
          ['default_code', 'name', 'list_price'],
          { limit: uniqueDirectIds.length }
        )
        if (dpResult.success && Array.isArray(dpResult.data)) {
          directProducts = dpResult.data
        }
      }

      const allProducts = [...directProducts, ...templateProducts]
      const allProductIds = allProducts.map(p => p.id)

      // Traer series disponibles
      const seriesMap = await fetchSeriesForProducts(allProductIds)

      // Crear mapa de supplierinfo para asociar product_code
      const supplierCodeMap: Record<number, string> = {}
      for (const si of supplierResult.data) {
        const tmplId = Array.isArray(si.product_tmpl_id) ? si.product_tmpl_id[0] : si.product_tmpl_id
        const prodId = si.product_id ? (Array.isArray(si.product_id) ? si.product_id[0] : si.product_id) : null
        if (prodId) supplierCodeMap[prodId] = si.product_code
        if (tmplId) supplierCodeMap[tmplId] = si.product_code
      }

      // Mapear product_tmpl_id para cada producto
      const prodTmplMap: Record<number, number> = {}
      for (const p of allProducts) {
        const tmplId = Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : p.product_tmpl_id
        if (tmplId) prodTmplMap[p.id] = tmplId
      }

      const seen = new Set<number>()
      for (const p of allProducts) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        const tmplId = prodTmplMap[p.id]
        const supplierCode = supplierCodeMap[p.id] || (tmplId ? supplierCodeMap[tmplId] : '') || ''
        const bestCode = p.default_code || supplierCode
        results.push({
          codigo: bestCode.toLowerCase(),
          descripcion: p.name || '',
          precioEstimado: p.list_price || 0,
          codigoOriginal: bestCode,
          codigoProveedor: supplierCode,
          seriesDisponibles: seriesMap[p.id] || []
        })
      }
    }

    // Paso 2: Si no hubo resultados por proveedor, buscar en product.template por default_code
    if (results.length === 0) {
      const templateResult = await client.searchRead(
        'product.template',
        [['default_code', 'ilike', query]],
        ['default_code', 'name', 'list_price'],
        { limit: 10 }
      )

      if (templateResult.success && Array.isArray(templateResult.data) && templateResult.data.length > 0) {
        const templateIds = templateResult.data.map((t: any) => t.id)

        // Traer product.product asociados para obtener IDs correctos para stock.lot
        const products = await fetchProductsByTemplateIds(templateIds)

        // Traer series disponibles por product.product IDs
        const productIds = products.map(p => p.id)
        const [seriesMap, supplierCodesMap] = await Promise.all([
          fetchSeriesForProducts(productIds),
          fetchSupplierCodesForTemplates(templateIds)
        ])

        // Mapear template a sus product.product
        const tmplToProducts: Record<number, any[]> = {}
        for (const p of products) {
          const tmplId = Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : p.product_tmpl_id
          if (!tmplToProducts[tmplId]) tmplToProducts[tmplId] = []
          tmplToProducts[tmplId].push(p)
        }

        for (const t of templateResult.data) {
          const associatedProducts = tmplToProducts[t.id] || []
          const allSeries: string[] = []
          for (const p of associatedProducts) {
            if (seriesMap[p.id]) allSeries.push(...seriesMap[p.id])
          }

          const supplierCode = supplierCodesMap[t.id] || ''
          const bestCode = t.default_code || supplierCode
          results.push({
            codigo: bestCode.toLowerCase(),
            descripcion: t.name || '',
            precioEstimado: t.list_price || 0,
            codigoOriginal: bestCode,
            codigoProveedor: supplierCode,
            seriesDisponibles: allSeries
          })
        }
      }
    }

    console.log(`📦 Odoo código: ${results.length} resultados para "${query}"`)
    return results.slice(0, 15)
  } catch (error) {
    console.error('❌ Error buscando por código en Odoo:', error)
    return []
  }
}

// ─── 3. Búsqueda por Artículo/Descripción ───────────────────────────

/**
 * Busca por descripción del producto (campo name en product.template).
 * Sugiere números de serie disponibles.
 */
export async function searchByArticulo(query: string): Promise<InsumoData[]> {
  if (query.length < 3) return []

  try {
    const client = getOdooClient()

    // Buscar en product.template por name
    const templateResult = await client.searchRead(
      'product.template',
      [['name', 'ilike', query]],
      ['default_code', 'name', 'list_price'],
      { limit: 10 }
    )

    if (!templateResult.success || !Array.isArray(templateResult.data) || templateResult.data.length === 0) {
      console.log(`📝 Odoo artículo: 0 resultados para "${query}"`)
      return []
    }

    const templateIds = templateResult.data.map((t: any) => t.id)

    // Traer product.product asociados
    const products = await fetchProductsByTemplateIds(templateIds)

    // Traer series disponibles y códigos de proveedor en paralelo
    const productIds = products.map(p => p.id)
    const [seriesMap, supplierCodesMap] = await Promise.all([
      fetchSeriesForProducts(productIds),
      fetchSupplierCodesForTemplates(templateIds)
    ])

    // Mapear template a sus product.product
    const tmplToProducts: Record<number, any[]> = {}
    for (const p of products) {
      const tmplId = Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : p.product_tmpl_id
      if (!tmplToProducts[tmplId]) tmplToProducts[tmplId] = []
      tmplToProducts[tmplId].push(p)
    }

    const results: InsumoData[] = templateResult.data.map((t: any) => {
      const associatedProducts = tmplToProducts[t.id] || []
      const allSeries: string[] = []
      for (const p of associatedProducts) {
        if (seriesMap[p.id]) allSeries.push(...seriesMap[p.id])
      }

      const supplierCode = supplierCodesMap[t.id] || ''
      const bestCode = t.default_code || supplierCode
      return {
        codigo: bestCode.toLowerCase(),
        descripcion: t.name || '',
        precioEstimado: t.list_price || 0,
        codigoOriginal: bestCode,
        codigoProveedor: supplierCode,
        seriesDisponibles: allSeries
      }
    })

    console.log(`📝 Odoo artículo: ${results.length} resultados para "${query}"`)
    return results.slice(0, 15)
  } catch (error) {
    console.error('❌ Error buscando por artículo en Odoo:', error)
    return []
  }
}

// ─── Compatibilidad ─────────────────────────────────────────────────

/**
 * Búsqueda genérica (legacy). Busca por código y por artículo combinados.
 */
export async function searchInsumos(query: string): Promise<InsumoData[]> {
  if (query.length < 3) return []

  const [byCodigo, byArticulo] = await Promise.all([
    searchByCodigo(query),
    searchByArticulo(query)
  ])

  // Deduplicar por codigoOriginal + descripcion
  const seen = new Set<string>()
  const results: InsumoData[] = []
  for (const item of [...byCodigo, ...byArticulo]) {
    const key = `${item.codigoOriginal}|${item.descripcion}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push(item)
    }
  }

  return results.slice(0, 15)
}

/**
 * Fuerza la recarga de datos (no-op, búsquedas son en tiempo real contra Odoo)
 */
export function refreshInsumosCache(): void {
  // No se necesita caché, las búsquedas van directo a Odoo
}