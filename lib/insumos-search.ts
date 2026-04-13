/**
 * Funcionalidad de búsqueda de insumos desde Odoo (product.product + stock.lot)
 * Busca por código interno (default_code), nombre del producto, código de barras,
 * o número de serie (stock.lot name)
 */

import { getOdooClient } from './odoo-client'

export interface InsumoData {
  codigo: string
  descripcion: string
  precioEstimado: number
  codigoOriginal: string // Código interno original del producto
  numeroSerie?: string   // Número de serie si vino de stock.lot
}

/**
 * Busca productos en Odoo que coincidan con el query
 * Busca por default_code, barcode, name (en product.product)
 * y por name en stock.lot (número de serie)
 * @param query - Texto de búsqueda (mínimo 3 caracteres)
 * @returns Array de insumos que coinciden
 */
export async function searchInsumos(query: string): Promise<InsumoData[]> {
  if (query.length < 3) {
    return []
  }

  try {
    const client = getOdooClient()

    // Lanzar ambas búsquedas en paralelo
    const [productResult, lotResult] = await Promise.all([
      // Buscar en product.product por código interno, código de barras o nombre
      client.searchRead(
        'product.product',
        ['|', '|',
          ['default_code', 'ilike', query],
          ['barcode', 'ilike', query],
          ['name', 'ilike', query]
        ],
        ['default_code', 'name', 'list_price', 'barcode'],
        { limit: 10 }
      ),
      // Buscar en stock.lot por número de serie
      client.searchRead(
        'stock.lot',
        [['name', 'ilike', query]],
        ['name', 'product_id'],
        { limit: 10 }
      )
    ])

    const results: InsumoData[] = []
    const seenProductIds = new Set<number>()

    // Procesar resultados de product.product
    if (productResult.success && Array.isArray(productResult.data)) {
      for (const p of productResult.data) {
        seenProductIds.add(p.id)
        results.push({
          codigo: (p.default_code || '').toLowerCase(),
          descripcion: p.name || '',
          precioEstimado: p.list_price || 0,
          codigoOriginal: p.default_code || p.barcode || ''
        })
      }
    }

    // Procesar resultados de stock.lot — traer datos del producto asociado
    if (lotResult.success && Array.isArray(lotResult.data) && lotResult.data.length > 0) {
      const lotProductIds = lotResult.data
        .map((lot: any) => Array.isArray(lot.product_id) ? lot.product_id[0] : lot.product_id)
        .filter((id: number) => id && !seenProductIds.has(id))
      const uniqueLotProductIds = [...new Set(lotProductIds)]

      // Traer datos de productos que no tenemos aún
      let lotProductMap: Record<number, any> = {}
      if (uniqueLotProductIds.length > 0) {
        const prodResult = await client.searchRead(
          'product.product',
          [['id', 'in', uniqueLotProductIds]],
          ['default_code', 'name', 'list_price'],
          { limit: uniqueLotProductIds.length }
        )
        if (prodResult.success && Array.isArray(prodResult.data)) {
          for (const p of prodResult.data) {
            lotProductMap[p.id] = p
          }
        }
      }

      // También incluir productos ya encontrados por búsqueda directa
      if (productResult.success && Array.isArray(productResult.data)) {
        for (const p of productResult.data) {
          lotProductMap[p.id] = p
        }
      }

      for (const lot of lotResult.data) {
        const prodId = Array.isArray(lot.product_id) ? lot.product_id[0] : lot.product_id
        const prodName = Array.isArray(lot.product_id) ? lot.product_id[1] : ''
        const prod = prodId ? lotProductMap[prodId] : null

        results.push({
          codigo: (prod?.default_code || '').toLowerCase(),
          descripcion: prod?.name || prodName || '',
          precioEstimado: prod?.list_price || 0,
          codigoOriginal: prod?.default_code || '',
          numeroSerie: lot.name || ''
        })
      }
    }

    console.log(`📦 Odoo: ${results.length} resultados para "${query}" (productos: ${productResult.data?.length || 0}, series: ${lotResult.data?.length || 0})`)
    return results.slice(0, 15)
  } catch (error) {
    console.error('❌ Error buscando productos en Odoo:', error)
    return []
  }
}

/**
 * Fuerza la recarga de datos (no-op, búsquedas son en tiempo real contra Odoo)
 */
export function refreshInsumosCache(): void {
  // No se necesita caché, las búsquedas van directo a Odoo
}