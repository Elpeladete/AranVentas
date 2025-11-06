"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Shield, 
  Fingerprint, 
  MapPin, 
  Wifi, 
  WifiOff, 
  Award, 
  QrCode,
  CheckCircle,
  AlertTriangle,
  Info,
  Download,
  Eye,
  Clock,
  Lock
} from 'lucide-react'
import { 
  hybridSignatureService, 
  type DigitalSignature, 
  type SignerInfo,
  type DigitalCertificate 
} from '@/lib/digital-signature-hybrid'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { toast } from '@/lib/toast'

interface HybridDigitalSignatureProps {
  documentData: any
  signerInfo: Partial<SignerInfo>
  onSignatureComplete: (signature: DigitalSignature) => void
  onLoadingChange?: (isLoading: boolean) => void // Nuevo callback para notificar estado de carga
  className?: string
}

export function HybridDigitalSignature({
  documentData,
  signerInfo: initialSignerInfo,
  onSignatureComplete,
  onLoadingChange,
  className
}: HybridDigitalSignatureProps) {
  const { isOnline } = useNetworkStatus()
  const [isLoading, setIsLoading] = useState(false)
  const [certificates, setCertificates] = useState<DigitalCertificate[]>([])
  const [selectedCertificate, setSelectedCertificate] = useState<string>('')
  const [signerInfo, setSignerInfo] = useState<SignerInfo>({
    name: initialSignerInfo.name || '',
    email: initialSignerInfo.email || '',
    role: initialSignerInfo.role || 'technician',
    dni: initialSignerInfo.dni || '',
    company: initialSignerInfo.company || 'Arán Tecnologías',
    position: initialSignerInfo.position || ''
  })
  
  // Opciones de firma
  const [options, setOptions] = useState({
    includeGeolocation: true,
    includeBiometric: false,
    requestLegalValidation: isOnline
  })

  const [lastSignature, setLastSignature] = useState<DigitalSignature | null>(null)
  const [showVerification, setShowVerification] = useState(false)

  // Cargar certificados disponibles
  useEffect(() => {
    const loadCertificates = async () => {
      const certs = hybridSignatureService.getAvailableCertificates()
      setCertificates(certs)
      
      if (certs.length > 0) {
        setSelectedCertificate(certs[0].id)
      }
    }
    
    loadCertificates()
  }, [])

  // Actualizar opción de validación legal según conectividad
  useEffect(() => {
    setOptions(prev => ({ ...prev, requestLegalValidation: isOnline }))
  }, [isOnline])

  // Notificar al padre cuando cambia el estado de carga
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading)
    }
  }, [isLoading, onLoadingChange])

  // Crear un nuevo certificado
  const handleCreateCertificate = async () => {
    if (!signerInfo.name || !signerInfo.email) {
      toast.error('Complete los datos del firmante')
      return
    }

    setIsLoading(true)
    try {
      const newCert = await hybridSignatureService.generateSelfSignedCertificate(signerInfo)
      setCertificates(prev => [...prev, newCert])
      setSelectedCertificate(newCert.id)
      
      toast.success('Certificado digital creado', {
        description: 'Nuevo certificado generado y almacenado de forma segura'
      })
    } catch (error) {
      console.error('Error creando certificado:', error)
      toast.error('Error creando certificado')
    } finally {
      setIsLoading(false)
    }
  }

  // Firmar documento
  const handleSign = async () => {
    if (!signerInfo.name) {
      toast.error('Complete los datos del firmante')
      return
    }

    setIsLoading(true)
    try {
      const signature = await hybridSignatureService.signDocument(
        documentData,
        signerInfo,
        selectedCertificate,
        options
      )

      setLastSignature(signature)
      onSignatureComplete(signature)

      // Mostrar resultado
      const signatureType = signature.type === 'hybrid' ? 'híbrida (offline + legal)' : 
                           signature.type === 'legal' ? 'legal certificada' : 'criptográfica offline'
      
      toast.success(`Documento firmado`, {
        description: `Firma ${signatureType} aplicada exitosamente`
      })

      // Sincronizar si hay conexión
      if (isOnline) {
        hybridSignatureService.syncPendingSignatures()
      }

    } catch (error) {
      console.error('Error firmando documento:', error)
      toast.error('Error en la firma digital')
    } finally {
      setIsLoading(false)
    }
  }

  // Verificar última firma
  const handleVerify = async () => {
    if (!lastSignature) return

    setIsLoading(true)
    try {
      const verification = await hybridSignatureService.verifySignature(
        lastSignature,
        documentData
      )

      if (verification.isValid) {
        toast.success('Firma verificada', {
          description: 'La firma es válida y el documento no ha sido modificado'
        })
      } else {
        toast.error('Verificación fallida', {
          description: verification.errors.join(', ')
        })
      }

      setShowVerification(true)
    } catch (error) {
      console.error('Error verificando firma:', error)
      toast.error('Error en la verificación')
    } finally {
      setIsLoading(false)
    }
  }

  // Exportar firma
  const handleExport = () => {
    if (!lastSignature) return

    const exportData = hybridSignatureService.exportSignature(lastSignature.id)
    if (exportData) {
      // Crear y descargar archivo
      const blob = new Blob([exportData.verificationData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `firma-digital-${lastSignature.id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Firma exportada', {
        description: 'Archivo de verificación descargado'
      })
    }
  }

  const getSignatureTypeColor = (type: DigitalSignature['type']) => {
    switch (type) {
      case 'hybrid': return 'bg-green-100 text-green-800 border-green-200'
      case 'legal': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'offline': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Estado de conectividad */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">Firma Digital Híbrida</h3>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <Wifi className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span>Criptografía segura (secp256k1)</span>
            <CheckCircle className="h-3 w-3 text-green-600" />
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span>Certificado auto-firmado</span>
            <CheckCircle className="h-3 w-3 text-green-600" />
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Timestamp inmutable</span>
            <CheckCircle className="h-3 w-3 text-green-600" />
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Validación legal</span>
            {isOnline ? (
              <CheckCircle className="h-3 w-3 text-green-600" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-orange-600" />
            )}
            <span className="text-xs">
              {isOnline ? 'Disponible' : 'Se aplicará al conectar'}
            </span>
          </div>
        </div>
      </Card>

      {/* Datos del firmante */}
      <Card className="p-4">
        <h4 className="font-medium mb-3">Datos del Firmante</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="signer-name">Nombre completo *</Label>
            <Input
              id="signer-name"
              value={signerInfo.name}
              onChange={(e) => setSignerInfo(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del firmante"
            />
          </div>
          <div>
            <Label htmlFor="signer-email">Email</Label>
            <Input
              id="signer-email"
              type="email"
              value={signerInfo.email}
              onChange={(e) => setSignerInfo(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@ejemplo.com"
            />
          </div>
          <div>
            <Label htmlFor="signer-dni">DNI</Label>
            <Input
              id="signer-dni"
              value={signerInfo.dni}
              onChange={(e) => setSignerInfo(prev => ({ ...prev, dni: e.target.value }))}
              placeholder="12345678"
            />
          </div>
          <div>
            <Label htmlFor="signer-position">Cargo/Posición</Label>
            <Input
              id="signer-position"
              value={signerInfo.position}
              onChange={(e) => setSignerInfo(prev => ({ ...prev, position: e.target.value }))}
              placeholder="Técnico, Cliente, etc."
            />
          </div>
        </div>
      </Card>

      {/* Certificados disponibles */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Certificado Digital</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateCertificate}
            disabled={isLoading || !signerInfo.name || !signerInfo.email}
          >
            <Award className="h-4 w-4 mr-1" />
            Nuevo Certificado
          </Button>
        </div>

        {certificates.length > 0 ? (
          <div className="space-y-2">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedCertificate === cert.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedCertificate(cert.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{cert.subject}</div>
                    <div className="text-xs text-gray-500">
                      Válido hasta: {new Date(cert.validTo).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    #{cert.serialNumber}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-4 text-gray-500">
            <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay certificados disponibles</p>
            <p className="text-xs">Cree un certificado para comenzar a firmar</p>
          </div>
        )}
      </Card>

      {/* Opciones de firma */}
      <Card className="p-4">
        <h4 className="font-medium mb-3">Opciones de Firma</h4>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="geolocation"
              checked={options.includeGeolocation}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, includeGeolocation: !!checked }))
              }
            />
            <Label htmlFor="geolocation" className="text-sm flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Incluir geolocalización
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="legal-validation"
              checked={options.requestLegalValidation}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, requestLegalValidation: !!checked }))
              }
              disabled={!isOnline}
            />
            <Label htmlFor="legal-validation" className="text-sm flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Validación legal {!isOnline && '(requiere conexión)'}
            </Label>
          </div>
        </div>
      </Card>

      {/* Botones de acción */}
      <div className="flex gap-3">
        <Button
          onClick={handleSign}
          disabled={isLoading || !signerInfo.name || (!selectedCertificate && certificates.length > 0)}
          className="flex-1"
        >
          {isLoading ? (
            'Firmando...'
          ) : (
            <>
              <Fingerprint className="h-4 w-4 mr-2" />
              Firmar Documento
            </>
          )}
        </Button>

        {lastSignature && (
          <>
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={isLoading}
            >
              <Eye className="h-4 w-4 mr-1" />
              Verificar
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isLoading}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
          </>
        )}
      </div>

      {/* Resultado de la última firma */}
      {lastSignature && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Firma Digital Aplicada</h4>
            <Badge className={getSignatureTypeColor(lastSignature.type)}>
              {lastSignature.type === 'hybrid' ? 'Híbrida' : 
               lastSignature.type === 'legal' ? 'Legal' : 'Offline'}
            </Badge>
          </div>

          <div className="grid gap-3 text-sm">
            <div>
              <span className="font-medium">ID:</span> 
              <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                {lastSignature.id}
              </code>
            </div>
            
            <div>
              <span className="font-medium">Timestamp:</span>
              <span className="ml-2">
                {new Date(lastSignature.timestamp).toLocaleString()}
              </span>
            </div>

            <div>
              <span className="font-medium">Firmado por:</span>
              <span className="ml-2">{lastSignature.signerInfo.name}</span>
            </div>

            {lastSignature.geolocation && (
              <div>
                <span className="font-medium">Ubicación:</span>
                <span className="ml-2">
                  {lastSignature.geolocation.latitude.toFixed(6)}, 
                  {lastSignature.geolocation.longitude.toFixed(6)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <QrCode className="h-4 w-4" />
              <span className="text-xs">QR de verificación incluido</span>
            </div>
          </div>

          {/* QR Code */}
          {lastSignature.verificationQR && (
            <div className="mt-4 text-center">
              <img
                src={lastSignature.verificationQR}
                alt="QR de verificación"
                className="mx-auto h-24 w-24 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Escanee para verificar la firma
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Información adicional */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <div className="font-medium mb-1">Sistema de Firma Híbrida</div>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Offline:</strong> Firma criptográfica inmutable con certificado local</li>
              <li>• <strong>Online:</strong> Validación legal adicional cuando hay conexión</li>
              <li>• <strong>Sincronización:</strong> Las firmas offline se validan legalmente automáticamente</li>
              <li>• <strong>Verificación:</strong> QR code y URL para verificación independiente</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}