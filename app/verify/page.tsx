/**
 * Página de verificación simple (sin parámetros dinámicos)
 */

import { SignatureVerification } from '@/components/signature-verification'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Verificar Firma Digital - Arán Tecnologías',
  description: 'Verificación de firmas digitales criptográficas y certificadas',
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Verificación de Firma Digital
            </h1>
            <p className="text-gray-600 mt-2">
              Verifique la autenticidad e integridad de documentos firmados
            </p>
          </div>
          
          <SignatureVerification />
        </div>
      </div>
    </div>
  )
}