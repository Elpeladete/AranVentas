'use client'

/**
 * Componente para probar y configurar la conexión con Odoo FSM
 */

import { useState } from 'react'
import { testOdooConnection } from '@/lib/odoo-service'
import { isOdooConfigured } from '@/lib/odoo-client'

export function OdooConnectionTest() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const configured = isOdooConfigured()

  const handleTest = async () => {
    setTesting(true)
    setResult(null)

    try {
      const testResult = await testOdooConnection()
      setResult(testResult)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setTesting(false)
    }
  }

  if (!configured) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800">Odoo no configurado</h3>
            <p className="mt-1 text-sm text-yellow-700">
              Para habilitar la sincronización con Odoo FSM, configura las variables de entorno en
              el archivo <code className="bg-yellow-100 px-1 rounded">.env.local</code>
            </p>
            <div className="mt-3 text-xs text-yellow-600">
              <p>Variables requeridas:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>NEXT_PUBLIC_ODOO_URL</li>
                <li>NEXT_PUBLIC_ODOO_DATABASE</li>
                <li>NEXT_PUBLIC_ODOO_USERNAME</li>
                <li>NEXT_PUBLIC_ODOO_PASSWORD</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Conexión con Odoo FSM</h3>
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? 'Probando...' : 'Probar Conexión'}
        </button>
      </div>

      {result && (
        <div
          className={`mt-3 p-3 rounded-lg ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0">
              {result.success ? (
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.success ? '✅ Conexión exitosa' : '❌ Error de conexión'}
              </p>
              <p className={`mt-1 text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        <p className="font-medium mb-1">Configuración actual:</p>
        <ul className="space-y-1">
          <li>URL: {process.env.NEXT_PUBLIC_ODOO_URL || 'No configurada'}</li>
          <li>Base de datos: {process.env.NEXT_PUBLIC_ODOO_DATABASE || 'No configurada'}</li>
          <li>Usuario: {process.env.NEXT_PUBLIC_ODOO_USERNAME || 'No configurado'}</li>
        </ul>
      </div>
    </div>
  )
}
