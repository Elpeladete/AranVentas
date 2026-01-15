"use client"

import { useState } from 'react'

export default function OdooTestPage() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const testOdoo = async (testType: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/odoo-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testType })
      })
      
      const data = await response.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(`Error: ${error}`)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔧 Diagnóstico Odoo</h1>
      
      <div className="space-x-2 mb-4">
        <button 
          onClick={() => testOdoo('default')}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Config Original
        </button>
        
        <button 
          onClick={() => testOdoo('simple')}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Usuario Simple
        </button>
        
        <button 
          onClick={() => testOdoo('dbnoguion')}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          DB Sin Guión
        </button>
        
        <button 
          onClick={() => testOdoo('admin')}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          Usuario Admin
        </button>
        
        <button 
          onClick={() => setResult('')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Limpiar
        </button>
      </div>
      
      {loading && <div className="text-blue-500">🔄 Probando...</div>}
      
      {result && (
        <div className="bg-gray-100 p-4 rounded mt-4">
          <h3 className="font-bold mb-2">📊 Resultado:</h3>
          <pre className="text-sm overflow-auto">{result}</pre>
        </div>
      )}
      
      <div className="mt-6 p-4 bg-yellow-100 rounded">
        <h3 className="font-bold">🎯 Configuraciones que se van a probar:</h3>
        <ul className="mt-2 text-sm">
          <li><strong>Original:</strong> martinaused@arantecnologias.com.ar @ arantecnologias</li>
          <li><strong>Simple:</strong> martinaused @ arantecnologias</li>
          <li><strong>DB Sin Guión:</strong> martinaused@arantecnologias.com.ar @ arantecnologias</li>
          <li><strong>Admin:</strong> admin @ arantecnologias</li>
        </ul>
        
        <div className="mt-4 p-3 bg-red-50 rounded border-l-4 border-red-400">
          <p className="text-sm"><strong>⚠️ Lo que está pasando:</strong> Odoo está rechazando las credenciales con <code>&lt;boolean&gt;0&lt;/boolean&gt;</code></p>
          <p className="text-sm mt-1">Esto significa que usuario, contraseña o base de datos no coinciden exactamente.</p>
        </div>
      </div>
    </div>
  )
}