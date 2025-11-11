/**
 * Configuración de la API de Odoo
 * Gestiona la conexión y autenticación con el servidor Odoo
 */

export interface OdooConfig {
  url: string
  database: string
  username: string
  password: string
  apiKey?: string
}

export interface OdooAuthResult {
  uid: number
  success: boolean
  error?: string
}

/**
 * Clase para manejar la autenticación y conexión con Odoo
 */
export class OdooClient {
  private config: OdooConfig
  private uid: number | null = null

  constructor(config: OdooConfig) {
    this.config = config
  }

  /**
   * Autentica con el servidor Odoo usando XML-RPC a través de nuestra API
   */
  async authenticate(): Promise<OdooAuthResult> {
    try {
      console.log('🔐 Autenticando con Odoo...')
      
      // Usar nuestra API local en lugar de llamar directamente a Odoo (evita CORS)
      const response = await fetch('/api/odoo/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (data.error || !response.ok) {
        console.error('❌ Error de autenticación Odoo:', data.error)
        return {
          uid: 0,
          success: false,
          error: data.error || 'Error de autenticación',
        }
      }

      if (data.result && data.result.uid) {
        this.uid = data.result.uid
        console.log('✅ Autenticación exitosa. UID:', this.uid)

        return {
          uid: this.uid || 0,
          success: true,
        }
      }

      return {
        uid: 0,
        success: false,
        error: 'Respuesta inválida del servidor',
      }
    } catch (error) {
      console.error('❌ Error conectando con Odoo:', error)
      return {
        uid: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }
    }
  }

  /**
   * Ejecuta un método en Odoo a través de nuestra API
   */
  async execute<T = any>(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      if (!this.uid) {
        const authResult = await this.authenticate()
        if (!authResult.success) {
          return { success: false, error: authResult.error }
        }
      }

      console.log(`📡 Ejecutando ${model}.${method}`)

      // Usar nuestra API local en lugar de llamar directamente a Odoo (evita CORS)
      const response = await fetch('/api/odoo/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          method,
          args,
          kwargs,
        }),
      })

      const data = await response.json()

      if (data.error || !response.ok) {
        console.error(`❌ Error en ${model}.${method}:`, data.error)
        return {
          success: false,
          error: data.error || 'Error en la ejecución',
        }
      }

      if (data.result !== undefined) {
        console.log(`✅ ${model}.${method} ejecutado exitosamente`)
        return {
          success: true,
          data: data.result,
        }
      }

      return {
        success: false,
        error: 'Respuesta inválida del servidor',
      }
    } catch (error) {
      console.error(`❌ Error ejecutando ${model}.${method}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }
    }
  }

  /**
   * Crea un registro en Odoo
   */
  async create(model: string, values: Record<string, any>) {
    return this.execute(model, 'create', [values])
  }

  /**
   * Lee registros de Odoo
   */
  async read(model: string, ids: number[], fields?: string[]) {
    const kwargs = fields ? { fields } : {}
    return this.execute(model, 'read', [ids], kwargs)
  }

  /**
   * Actualiza registros en Odoo
   */
  async write(model: string, ids: number[], values: Record<string, any>) {
    return this.execute(model, 'write', [ids, values])
  }

  /**
   * Actualiza un único registro en Odoo (alias de write para un solo ID)
   */
  async update(model: string, id: number, values: Record<string, any>) {
    return this.write(model, [id], values)
  }

  /**
   * Busca registros en Odoo
   */
  async search(model: string, domain: any[] = [], options: Record<string, any> = {}) {
    return this.execute(model, 'search', [domain], options)
  }

  /**
   * Busca y lee registros en Odoo
   */
  async searchRead(
    model: string,
    domain: any[] = [],
    fields?: string[],
    options: Record<string, any> = {}
  ) {
    const kwargs = { ...options }
    if (fields) kwargs.fields = fields
    return this.execute(model, 'search_read', [domain], kwargs)
  }

  /**
   * Elimina registros de Odoo
   */
  async unlink(model: string, ids: number[]) {
    return this.execute(model, 'unlink', [ids])
  }

  /**
   * Verifica la conexión con Odoo
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.authenticate()
      return result.success
    } catch {
      return false
    }
  }
}

/**
 * Instancia del cliente Odoo (Singleton)
 * La configuración se carga desde variables de entorno
 */
let odooClientInstance: OdooClient | null = null

export function getOdooClient(): OdooClient {
  if (!odooClientInstance) {
    const config: OdooConfig = {
      url: process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || '',
      database: process.env.ODOO_DB || process.env.NEXT_PUBLIC_ODOO_DB || '',
      username: process.env.ODOO_USERNAME || process.env.NEXT_PUBLIC_ODOO_USERNAME || '',
      password: process.env.ODOO_PASSWORD || process.env.NEXT_PUBLIC_ODOO_PASSWORD || '',
      apiKey: process.env.ODOO_API_KEY || process.env.NEXT_PUBLIC_ODOO_API_KEY,
    }

    odooClientInstance = new OdooClient(config)
  }

  return odooClientInstance
}

/**
 * Hook para verificar si Odoo está configurado
 */
export function isOdooConfigured(): boolean {
  return !!(
    (process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL) &&
    (process.env.ODOO_DB || process.env.NEXT_PUBLIC_ODOO_DB) &&
    (process.env.ODOO_USERNAME || process.env.NEXT_PUBLIC_ODOO_USERNAME) &&
    (process.env.ODOO_PASSWORD || process.env.NEXT_PUBLIC_ODOO_PASSWORD)
  )
}
