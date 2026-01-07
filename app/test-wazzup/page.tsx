"use client"

import { WazzupChannelTest } from '@/components/wazzup-channel-test'
import { Card } from '@/components/ui/card'

export default function WazzupTestPage() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🧪 Pruebas de Wazzup API</h1>
          <p className="text-gray-600">
            Diagnóstico de canales de WhatsApp Business
          </p>
        </div>

        <WazzupChannelTest />

        <Card className="p-4 bg-blue-50 border-blue-200">
          <h3 className="font-semibold mb-2">ℹ️ Información</h3>
          <ul className="text-sm space-y-1 text-gray-700">
            <li>• Canal buscado: <code className="bg-white px-2 py-1 rounded">5d636b50-9ebc-4690-8c8c-ad6fb44bbcc7</code></li>
            <li>• Canal configurado: <code className="bg-white px-2 py-1 rounded">3afb4472-71cf-4709-a226-840a0522bf63</code></li>
            <li>• La API debe retornar todos los canales disponibles</li>
            <li>• El sistema selecciona automáticamente el primer canal activo</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
