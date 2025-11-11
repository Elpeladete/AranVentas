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
   * Autentica con el servidor Odoo usando XML-RPC
   */
  async authenticate(): Promise<OdooAuthResult> {
    try {
      console.log('🔐 Autenticando con Odoo...')
      
      const response = await fetch(`${this.config.url}/web/session/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            db: this.config.database,
            login: this.config.username,
            password: this.config.password,
          },
        }),
      })

      const data = await response.json()

      if (data.error) {
        console.error('❌ Error de autenticación Odoo:', data.error)
        return {
          uid: 0,
          success: false,
          error: data.error.data?.message || 'Error de autenticación',
        }
      }

      this.uid = data.result.uid
      console.log('✅ Autenticación exitosa. UID:', this.uid)

      return {
        uid: this.uid || 0,
        success: true,
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
   * Ejecuta un método en Odoo
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

      const response = await fetch(`${this.config.url}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model,
            method,
            args,
            kwargs,
          },
        }),
      })

      const data = await response.json()

      if (data.error) {
        console.error(`❌ Error en ${model}.${method}:`, data.error)
        return {
          success: false,
          error: data.error.data?.message || 'Error en la ejecución',
        }
      }

      console.log(`✅ ${model}.${method} ejecutado exitosamente`)
      return {
        success: true,
        data: data.result,
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
      url: process.env.NEXT_PUBLIC_ODOO_URL || '',
      database: process.env.NEXT_PUBLIC_ODOO_DATABASE || '',
      username: process.env.NEXT_PUBLIC_ODOO_USERNAME || '',
      password: process.env.NEXT_PUBLIC_ODOO_PASSWORD || '',
      apiKey: process.env.NEXT_PUBLIC_ODOO_API_KEY,
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
    process.env.NEXT_PUBLIC_ODOO_URL &&
    process.env.NEXT_PUBLIC_ODOO_DATABASE &&
    process.env.NEXT_PUBLIC_ODOO_USERNAME &&
    process.env.NEXT_PUBLIC_ODOO_PASSWORD
  )
}
