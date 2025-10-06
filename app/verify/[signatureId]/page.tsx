/**
 * Página de verificación de firmas digitales
 * Permite verificar firmas usando el ID o escaneando QR
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import { SignatureVerification } from '@/components/signature-verification'

export const metadata: Metadata = {
  title: 'Verificar Firma Digital - Arán Tecnologías',
  description: 'Verificación de firmas digitales criptográficas y certificadas',
}

// Para páginas con parámetros dinámicos
export const dynamic = 'force-dynamic'

interface VerifyPageProps {
  params: {
    signatureId: string
  }
}

export default function VerifyPage({ params }: VerifyPageProps) {
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
          
          <Suspense fallback={<div className="text-center">Cargando verificador...</div>}>
            <SignatureVerification initialSignatureId={params.signatureId} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}