"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Search,
  QrCode,
  Download,
  Clock,
  User,
  MapPin,
  Hash,
  Key,
  Eye,
  EyeOff
} from 'lucide-react'
import { 
  hybridSignatureService,
  type DigitalSignature 
} from '@/lib/digital-signature-hybrid'
import { toast } from '@/lib/toast'

interface SignatureVerificationProps {
  initialSignatureId?: string
}

interface VerificationResult {
  isValid: boolean
  details: {
    cryptoValid: boolean
    timestampValid: boolean
    certificateValid: boolean
    legalValid?: boolean
  }
  errors: string[]
}

export function SignatureVerification({ initialSignatureId }: SignatureVerificationProps) {
  const searchParams = useSearchParams()
  const [signatureId, setSignatureId] = useState(initialSignatureId || '')
  const [isLoading, setIsLoading] = useState(false)
  const [signature, setSignature] = useState<DigitalSignature | null>(null)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [documentData, setDocumentData] = useState<any>(null)

  // Verificar si hay un ID en los parámetros URL
  useEffect(() => {
    const urlSignatureId = searchParams.get('id')
    if (urlSignatureId) {
      setSignatureId(urlSignatureId)
      handleVerifySignature(urlSignatureId)
    }
  }, [searchParams])

  // Función para verificar la firma
  const handleVerifySignature = async (id?: string) => {
    const targetId = id || signatureId
    if (!targetId) {
      toast.error('Ingrese un ID de firma válido')
      return
    }

    setIsLoading(true)
    setVerificationResult(null)
    setSignature(null)
    setDocumentData(null)

    try {
      // Buscar la firma en el almacenamiento local
      const signatures = getStoredSignatures()
      const signatureData = signatures[targetId]

      if (!signatureData) {
        toast.error('Firma no encontrada', {
          description: 'El ID de firma no existe en el almacenamiento local'
        })
        return
      }

      setSignature(signatureData.signature)
      setDocumentData(signatureData.documentData)

      // Verificar la firma
      const result = await hybridSignatureService.verifySignature(
        signatureData.signature,
        signatureData.documentData
      )

      setVerificationResult(result)

      if (result.isValid) {
        toast.success('Firma verificada', {
          description: 'La firma es válida y el documento no ha sido modificado'
        })
      } else {
        toast.error('Verificación fallida', {
          description: result.errors.join(', ')
        })
      }

    } catch (error) {
      console.error('Error verificando firma:', error)
      toast.error('Error en la verificación', {
        description: 'No se pudo verificar la firma'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Obtener firmas del almacenamiento local
  const getStoredSignatures = (): Record<string, { signature: DigitalSignature, documentData: any }> => {
    if (typeof window === 'undefined') return {}
    
    try {
      const stored = localStorage.getItem('digital_signatures')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  // Formatear fecha
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Obtener color del badge según validación
  const getValidationBadge = (isValid: boolean, label: string) => {
    if (isValid) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Búsqueda de firma */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Buscar Firma Digital</h3>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="signature-id">ID de Firma</Label>
            <Input
              id="signature-id"
              value={signatureId}
              onChange={(e) => setSignatureId(e.target.value)}
              placeholder="Ingrese el ID de la firma digital"
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={() => handleVerifySignature()}
              disabled={isLoading || !signatureId}
            >
              {isLoading ? 'Verificando...' : 'Verificar'}
            </Button>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <QrCode className="h-3 w-3" />
            <span>También puede escanear el código QR de la firma</span>
          </div>
        </div>
      </Card>

      {/* Resultado de la verificación */}
      {verificationResult && signature && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Resultado de la Verificación</h3>
            <div className="flex items-center gap-2">
              {verificationResult.isValid ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  VÁLIDA
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 border-red-200">
                  <XCircle className="h-4 w-4 mr-1" />
                  INVÁLIDA
                </Badge>
              )}
            </div>
          </div>

          {/* Estado general */}
          <div className={`p-4 rounded-lg mb-4 ${
            verificationResult.isValid 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className={`flex items-center gap-2 ${
              verificationResult.isValid ? 'text-green-800' : 'text-red-800'
            }`}>
              {verificationResult.isValid ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span className="font-medium">
                {verificationResult.isValid 
                  ? 'Documento auténtico y sin modificaciones' 
                  : 'Documento inválido o modificado'}
              </span>
            </div>
            {!verificationResult.isValid && verificationResult.errors.length > 0 && (
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5">
                  {verificationResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Detalles de verificación */}
          <div className="grid gap-3 mb-4">
            <div className="flex items-center justify-between">
              <span>Firma criptográfica</span>
              {getValidationBadge(verificationResult.details.cryptoValid, 'Verificada')}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Timestamp</span>
              {getValidationBadge(verificationResult.details.timestampValid, 'Válido')}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Certificado</span>
              {getValidationBadge(verificationResult.details.certificateValid, 'Válido')}
            </div>
            
            {verificationResult.details.legalValid !== undefined && (
              <div className="flex items-center justify-between">
                <span>Validación legal</span>
                {getValidationBadge(verificationResult.details.legalValid, 'Certificada')}
              </div>
            )}
          </div>

          {/* Información de la firma */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Información de la Firma</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Firmante:</span>
                <span>{signature.signerInfo.name}</span>
                {signature.signerInfo.email && (
                  <span className="text-gray-500">({signature.signerInfo.email})</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Fecha:</span>
                <span>{formatDate(signature.timestamp)}</span>
              </div>

              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Tipo:</span>
                <Badge className={
                  signature.type === 'hybrid' ? 'bg-green-100 text-green-800' :
                  signature.type === 'legal' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }>
                  {signature.type === 'hybrid' ? 'Híbrida' : 
                   signature.type === 'legal' ? 'Legal' : 'Criptográfica'}
                </Badge>
              </div>

              {signature.geolocation && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Ubicación:</span>
                  <span>
                    {signature.geolocation.latitude.toFixed(6)}, 
                    {signature.geolocation.longitude.toFixed(6)}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-gray-500" />
                <span className="font-medium">ID de Firma:</span>
                <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                  {signature.id}
                </code>
              </div>
            </div>
          </div>

          {/* Detalles técnicos */}
          <div className="border-t pt-4 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="mb-3"
            >
              {showTechnicalDetails ? (
                <EyeOff className="h-4 w-4 mr-2" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {showTechnicalDetails ? 'Ocultar' : 'Mostrar'} detalles técnicos
            </Button>

            {showTechnicalDetails && (
              <div className="space-y-3 text-xs text-gray-600">
                <div>
                  <span className="font-medium">Hash del documento:</span>
                  <div className="font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                    {signature.documentHash}
                  </div>
                </div>

                <div>
                  <span className="font-medium">Clave pública:</span>
                  <div className="font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                    {signature.cryptoSignature.publicKey}
                  </div>
                </div>

                <div>
                  <span className="font-medium">Firma criptográfica:</span>
                  <div className="font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                    {signature.cryptoSignature.signature}
                  </div>
                </div>

                <div>
                  <span className="font-medium">Device fingerprint:</span>
                  <div className="font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                    {signature.deviceFingerprint}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Información sobre el proceso */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">
              ¿Cómo funciona la verificación?
            </h4>
            <div className="text-sm text-blue-800 space-y-2">
              <div>
                <strong>1. Verificación Criptográfica:</strong> Se comprueba que la firma digital 
                corresponde al documento usando criptografía de clave pública.
              </div>
              <div>
                <strong>2. Integridad del Documento:</strong> Se verifica que el documento no 
                haya sido modificado desde la firma.
              </div>
              <div>
                <strong>3. Validación del Certificado:</strong> Se confirma que el certificado 
                digital usado para firmar es válido.
              </div>
              <div>
                <strong>4. Timestamp:</strong> Se verifica que la firma esté dentro del 
                período de validez.
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}