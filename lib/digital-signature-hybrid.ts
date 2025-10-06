/**
 * Sistema de Firma Digital Híbrida
 * Combina criptografía offline + validez legal online
 */

import * as CryptoJS from 'crypto-js'
import { ec as EC } from 'elliptic'
import * as KJUR from 'jsrsasign'
import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'

// Tipos para el sistema híbrido
export interface DigitalSignature {
  id: string
  type: 'offline' | 'hybrid' | 'legal'
  
  // Datos básicos
  timestamp: number
  documentHash: string
  signerInfo: SignerInfo
  
  // Firma criptográfica (siempre presente)
  cryptoSignature: {
    signature: string
    publicKey: string
    algorithm: 'secp256k1' | 'RSA'
    verified: boolean
  }
  
  // Metadatos de seguridad
  deviceFingerprint: string
  geolocation?: GeolocationInfo
  biometric?: BiometricData
  
  // Validación legal (cuando hay conexión)
  legalValidation?: {
    service: 'docusign' | 'adobe' | 'custom'
    envelopeId?: string
    certificateChain?: string[]
    timestamp_authority?: string
    status: 'pending' | 'completed' | 'failed'
  }
  
  // QR de verificación
  verificationQR: string
  verificationUrl: string
}

export interface SignerInfo {
  name: string
  email?: string
  role: 'technician' | 'client' | 'supervisor'
  dni?: string
  company?: string
  position?: string
}

export interface GeolocationInfo {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export interface BiometricData {
  type: 'signature_dynamics' | 'voice' | 'fingerprint'
  data: string // Base64 encoded biometric data
  confidence: number // 0-1
}

export interface DigitalCertificate {
  id: string
  subject: string
  issuer: string
  validFrom: Date
  validTo: Date
  publicKey: string
  serialNumber: string
}

/**
 * Servicio principal de firma digital híbrida
 */
export class HybridDigitalSignatureService {
  private ec = new EC('secp256k1')
  private baseUrl: string
  
  constructor(baseUrl: string = 'https://aranservices.vercel.app') {
    this.baseUrl = baseUrl
  }

  /**
   * Genera un certificado digital auto-firmado para uso offline
   */
  async generateSelfSignedCertificate(signerInfo: SignerInfo): Promise<DigitalCertificate> {
    const keyPair = this.ec.genKeyPair()
    const privateKeyHex = keyPair.getPrivate('hex')
    const publicKeyHex = keyPair.getPublic('hex')
    
    // Crear certificado X.509 básico con jsrsasign
    const cert = new KJUR.asn1.x509.Certificate()
    cert.setSerialNumberByParam({ int: Math.floor(Math.random() * 1000000) })
    cert.setSignatureAlgByParam({ name: 'SHA256withECDSA' })
    cert.setIssuerByParam({ str: `/CN=AranServices Self-Signed/O=Aran Tecnologias` })
    cert.setSubjectByParam({ str: `/CN=${signerInfo.name}/emailAddress=${signerInfo.email}` })
    cert.setNotBeforeByParam({ str: new Date().toISOString().split('T')[0].replace(/-/g, '') })
    cert.setNotAfterByParam({ str: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '') })
    
    const id = uuidv4()
    
    // Almacenar certificado localmente
    const certificate: DigitalCertificate = {
      id,
      subject: signerInfo.name,
      issuer: 'AranServices Self-Signed',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      publicKey: publicKeyHex,
      serialNumber: id.replace(/-/g, '').substring(0, 16)
    }
    
    // Guardar en localStorage
    if (typeof window !== 'undefined') {
      const certificates = this.getStoredCertificates()
      certificates[id] = { certificate, privateKey: privateKeyHex }
      localStorage.setItem('digital_certificates', JSON.stringify(certificates))
    }
    
    return certificate
  }

  /**
   * Obtiene certificados almacenados localmente
   */
  private getStoredCertificates(): Record<string, { certificate: DigitalCertificate, privateKey: string }> {
    if (typeof window === 'undefined') return {}
    
    try {
      const stored = localStorage.getItem('digital_certificates')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  /**
   * Obtiene la huella digital del dispositivo
   */
  private async getDeviceFingerprint(): Promise<string> {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('Device fingerprint', 2, 2)
    }
    
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      canvas: canvas.toDataURL(),
      timestamp: Date.now()
    }
    
    return CryptoJS.SHA256(JSON.stringify(fingerprint)).toString()
  }

  /**
   * Obtiene la geolocalización si está disponible
   */
  private async getGeolocation(): Promise<GeolocationInfo | undefined> {
    if (!navigator.geolocation) return undefined
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 60000
        })
      })
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      }
    } catch {
      return undefined
    }
  }

  /**
   * Firma un documento con el sistema híbrido
   */
  async signDocument(
    documentData: any,
    signerInfo: SignerInfo,
    certificateId?: string,
    options: {
      includeGeolocation?: boolean
      includeBiometric?: boolean
      requestLegalValidation?: boolean
    } = {}
  ): Promise<DigitalSignature> {
    const signatureId = uuidv4()
    
    // 1. Preparar datos del documento
    const documentHash = CryptoJS.SHA256(JSON.stringify({
      ...documentData,
      signerInfo,
      timestamp: Date.now()
    })).toString()
    
    // 2. Obtener o generar certificado
    const certificates = this.getStoredCertificates()
    let certificate: DigitalCertificate
    let privateKey: string
    
    if (certificateId && certificates[certificateId]) {
      certificate = certificates[certificateId].certificate
      privateKey = certificates[certificateId].privateKey
    } else {
      certificate = await this.generateSelfSignedCertificate(signerInfo)
      privateKey = certificates[certificate.id].privateKey
    }
    
    // 3. Crear firma criptográfica
    const keyPair = this.ec.keyFromPrivate(privateKey, 'hex')
    const signature = keyPair.sign(documentHash)
    
    // 4. Obtener metadatos de seguridad
    const deviceFingerprint = await this.getDeviceFingerprint()
    const geolocation = options.includeGeolocation ? await this.getGeolocation() : undefined
    
    // 5. Crear URL de verificación
    const verificationUrl = `${this.baseUrl}/verify/${signatureId}`
    
    // 6. Generar QR de verificación
    const verificationQR = await QRCode.toDataURL(verificationUrl)
    
    // 7. Preparar firma digital base
    const digitalSignature: DigitalSignature = {
      id: signatureId,
      type: 'offline',
      timestamp: Date.now(),
      documentHash,
      signerInfo,
      cryptoSignature: {
        signature: signature.toDER('hex'),
        publicKey: keyPair.getPublic('hex'),
        algorithm: 'secp256k1',
        verified: true
      },
      deviceFingerprint,
      geolocation,
      verificationQR,
      verificationUrl
    }
    
    // 8. Intentar validación legal si hay conexión y se solicita
    if (options.requestLegalValidation && navigator.onLine) {
      try {
        digitalSignature.legalValidation = await this.requestLegalValidation(
          digitalSignature,
          documentData
        )
        digitalSignature.type = 'hybrid'
      } catch (error) {
        console.warn('Legal validation failed, proceeding with offline signature:', error)
      }
    }
    
    // 9. Almacenar firma localmente
    await this.storeSignatureLocally(digitalSignature, documentData)
    
    return digitalSignature
  }

  /**
   * Solicita validación legal a servicios externos
   */
  private async requestLegalValidation(
    signature: DigitalSignature,
    documentData: any
  ): Promise<DigitalSignature['legalValidation']> {
    // Aquí implementarías la integración con DocuSign, Adobe Sign, etc.
    // Por ahora, simulamos el proceso
    
    console.log('🏛️ Solicitando validación legal para:', signature.id)
    
    return {
      service: 'custom',
      envelopeId: `env_${signature.id}`,
      status: 'pending',
      timestamp_authority: 'AranServices TSA'
    }
  }

  /**
   * Verifica una firma digital
   */
  async verifySignature(
    signature: DigitalSignature,
    documentData: any
  ): Promise<{
    isValid: boolean
    details: {
      cryptoValid: boolean
      timestampValid: boolean
      certificateValid: boolean
      legalValid?: boolean
    }
    errors: string[]
  }> {
    const errors: string[] = []
    
    // 1. Verificar firma criptográfica
    const keyPair = this.ec.keyFromPublic(signature.cryptoSignature.publicKey, 'hex')
    const expectedHash = CryptoJS.SHA256(JSON.stringify({
      ...documentData,
      signerInfo: signature.signerInfo,
      timestamp: signature.timestamp
    })).toString()
    
    const cryptoValid = keyPair.verify(expectedHash, signature.cryptoSignature.signature) && 
                       expectedHash === signature.documentHash
    
    if (!cryptoValid) {
      errors.push('Firma criptográfica inválida o documento modificado')
    }
    
    // 2. Verificar timestamp (no más de 30 días)
    const now = Date.now()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const timestampValid = (now - signature.timestamp) < thirtyDays
    
    if (!timestampValid) {
      errors.push('Timestamp fuera del rango válido')
    }
    
    // 3. Verificar certificado (simplificado)
    const certificates = this.getStoredCertificates()
    const certExists = Object.values(certificates).some(
      c => c.certificate.publicKey === signature.cryptoSignature.publicKey
    )
    
    if (!certExists) {
      errors.push('Certificado no encontrado o inválido')
    }
    
    // 4. Verificar validación legal si existe
    let legalValid: boolean | undefined
    if (signature.legalValidation) {
      legalValid = signature.legalValidation.status === 'completed'
      if (!legalValid) {
        errors.push('Validación legal pendiente o fallida')
      }
    }
    
    return {
      isValid: cryptoValid && timestampValid && certExists,
      details: {
        cryptoValid,
        timestampValid,
        certificateValid: certExists,
        legalValid
      },
      errors
    }
  }

  /**
   * Almacena la firma localmente para sincronización posterior
   */
  private async storeSignatureLocally(
    signature: DigitalSignature,
    documentData: any
  ): Promise<void> {
    if (typeof window === 'undefined') return
    
    try {
      const signatures = this.getStoredSignatures()
      signatures[signature.id] = {
        signature,
        documentData,
        synced: signature.legalValidation?.status === 'completed'
      }
      
      localStorage.setItem('digital_signatures', JSON.stringify(signatures))
      console.log('💾 Firma almacenada localmente:', signature.id)
    } catch (error) {
      console.error('Error almacenando firma:', error)
    }
  }

  /**
   * Obtiene firmas almacenadas localmente
   */
  private getStoredSignatures(): Record<string, {
    signature: DigitalSignature
    documentData: any
    synced: boolean
  }> {
    if (typeof window === 'undefined') return {}
    
    try {
      const stored = localStorage.getItem('digital_signatures')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  /**
   * Sincroniza firmas pendientes cuando hay conexión
   */
  async syncPendingSignatures(): Promise<void> {
    if (!navigator.onLine) return
    
    const signatures = this.getStoredSignatures()
    const pending = Object.values(signatures).filter(s => !s.synced)
    
    console.log(`🔄 Sincronizando ${pending.length} firmas pendientes...`)
    
    for (const { signature, documentData } of pending) {
      try {
        if (!signature.legalValidation) {
          signature.legalValidation = await this.requestLegalValidation(signature, documentData)
          signature.type = 'hybrid'
        }
        
        // Marcar como sincronizada
        signatures[signature.id].synced = true
        signatures[signature.id].signature = signature
      } catch (error) {
        console.warn('Error sincronizando firma:', signature.id, error)
      }
    }
    
    localStorage.setItem('digital_signatures', JSON.stringify(signatures))
  }

  /**
   * Obtiene información de certificados disponibles
   */
  getAvailableCertificates(): DigitalCertificate[] {
    const certificates = this.getStoredCertificates()
    return Object.values(certificates).map(c => c.certificate)
  }

  /**
   * Exporta una firma para compartir
   */
  exportSignature(signatureId: string): {
    signature: DigitalSignature
    verificationData: string
  } | null {
    const signatures = this.getStoredSignatures()
    const signatureData = signatures[signatureId]
    
    if (!signatureData) return null
    
    const verificationData = JSON.stringify({
      signature: signatureData.signature,
      documentHash: signatureData.signature.documentHash,
      verificationInstructions: `Verifique esta firma en: ${signatureData.signature.verificationUrl}`
    }, null, 2)
    
    return {
      signature: signatureData.signature,
      verificationData
    }
  }
}

// Instancia global del servicio
export const hybridSignatureService = new HybridDigitalSignatureService()