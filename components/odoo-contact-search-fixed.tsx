/**
 * Componente de búsqueda inteligente de contactos Odoo
 * Con soporte para búsqueda offline
 */

"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Building2, Plus, Search } from 'lucide-react'
import { 
  searchOdooContacts, 
  isOdooConfigured,
  testOdooConnection,
  createOdooCompany,
  type OdooContact 
} from "@/lib/odoo-api-client"
import { searchOdooContactsOffline, type OdooContactSearchResult } from "@/lib/odoo-contacts-search"
import { checkConnectivity } from "@/lib/offline-data-manager"
import { toast } from "@/lib/toast"

interface OdooContactSearchProps {
  value: string
  onValueChange: (value: string) => void
  onContactSelect: (contact: OdooContact) => void
  onCompanyCreated?: (company: OdooContact, contact?: OdooContact) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function OdooContactSearch({
  value,
  onValueChange,
  onContactSelect,
  onCompanyCreated,
  placeholder = "Escribe al menos 4 caracteres de la razón social...",
  disabled = false,
  className = ""
}: OdooContactSearchProps) {
  const [suggestions, setSuggestions] = useState<OdooContact[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [odooConnected, setOdooConnected] = useState<boolean | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  
  // Estados para crear empresa
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanyCuit, setNewCompanyCuit] = useState('')
  const [newCompanyPhone, setNewCompanyPhone] = useState('')
  const [newContactName, setNewContactName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [cuitError, setCuitError] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Verificar estado de Odoo al cargar (solo si estamos online)
  useEffect(() => {
    // ⚡ OPTIMIZADO: No intentar conectar a Odoo si estamos offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('📱 Modo offline - Odoo no disponible, usando búsqueda local')
      setOdooConnected(false)
      return
    }
    checkOdooConnection()
  }, [])

  // Buscar cuando cambie el valor (con debounce)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Permitir búsqueda incluso sin Odoo configurado (usará offline)
    if (value && value.length >= 4) {
      debounceRef.current = setTimeout(() => {
        performSearch(value)
      }, 500)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [value, odooConnected])

  const checkOdooConnection = async () => {
    try {
      console.log('🔍 Verificando conexión con Odoo...')
      
      if (!isOdooConfigured()) {
        console.log('⚠️ Odoo no está configurado')
        setOdooConnected(false)
        return
      }

      const result = await testOdooConnection()
      setOdooConnected(result.success)
      
      if (!result.success) {
        console.error('❌ Error de conexión Odoo:', result.error)
        console.error('📋 Tipo de error:', typeof result.error)
        setSearchError(result.error || 'Error de conexión')
      } else {
        console.log('✅ Odoo conectado exitosamente, UID:', result.uid)
        setSearchError(null)
      }
    } catch (error) {
      console.error('❌ Error verificando Odoo:', error)
      setOdooConnected(false)
      setSearchError('Error de verificación')
    }
  }

  // Validar CUIT argentino
  const validateCuit = (cuit: string): boolean => {
    const cleanCuit = cuit.replace(/[-\s]/g, '')
    if (cleanCuit.length !== 11 || !/^\d{11}$/.test(cleanCuit)) {
      return false
    }
    // Validación de dígito verificador
    const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCuit[i]) * mult[i]
    }
    const remainder = sum % 11
    const verifier = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder
    return parseInt(cleanCuit[10]) === verifier
  }

  const handleCuitChange = (value: string) => {
    // Formatear CUIT: XX-XXXXXXXX-X
    const cleanValue = value.replace(/\D/g, '').slice(0, 11)
    let formatted = cleanValue
    if (cleanValue.length > 2) {
      formatted = `${cleanValue.slice(0, 2)}-${cleanValue.slice(2)}`
    }
    if (cleanValue.length > 10) {
      formatted = `${cleanValue.slice(0, 2)}-${cleanValue.slice(2, 10)}-${cleanValue.slice(10)}`
    }
    setNewCompanyCuit(formatted)
    
    // Validar solo si tiene 11 dígitos
    if (cleanValue.length === 11) {
      if (!validateCuit(cleanValue)) {
        setCuitError('CUIT inválido - verificar dígito verificador')
      } else {
        setCuitError(null)
      }
    } else if (cleanValue.length > 0) {
      setCuitError(`Faltan ${11 - cleanValue.length} dígitos`)
    } else {
      setCuitError(null)
    }
  }

  const openCreateDialog = () => {
    setNewCompanyName(value)
    setNewCompanyCuit('')
    setNewCompanyPhone('')
    setNewContactName('')
    setCuitError(null)
    setShowCreateDialog(true)
    setShowSuggestions(false)
  }

  const handleCreateCompany = async () => {
    if (!newCompanyName || newCompanyName.trim().length < 2) {
      toast.error('La Razón Social debe tener al menos 2 caracteres')
      return
    }

    const cleanCuit = newCompanyCuit.replace(/[-\s]/g, '')
    if (cleanCuit.length > 0 && cleanCuit.length !== 11) {
      toast.error('El CUIT debe tener 11 dígitos')
      return
    }

    if (cleanCuit.length === 11 && !validateCuit(cleanCuit)) {
      toast.error('El CUIT es inválido')
      return
    }

    try {
      setIsCreating(true)
      console.log('🏢 Creando nueva empresa...')

      const result = await createOdooCompany({
        name: newCompanyName.trim(),
        vat: cleanCuit || undefined,
        phone: newCompanyPhone.trim() || undefined,
        contactName: newContactName.trim() || undefined
      })

      if (result.success && result.company) {
        console.log('✅ Empresa creada:', result.company)
        toast.success('Empresa creada en Odoo', {
          description: `${result.company.name}${result.contact ? ` con contacto ${result.contact.name}` : ''}`,
          duration: 5000
        })

        // Notificar al padre
        if (onCompanyCreated) {
          onCompanyCreated(result.company, result.contact)
        }

        // Actualizar el valor del input
        onValueChange(result.company.name)
        
        // Seleccionar la empresa como contacto
        onContactSelect(result.company)

        // Cerrar y limpiar
        setShowCreateDialog(false)
        setNewCompanyName('')
        setNewCompanyCuit('')
        setNewCompanyPhone('')
        setNewContactName('')
      } else {
        console.error('❌ Error al crear empresa:', result.error)
        toast.error('Error al crear empresa', {
          description: result.error || 'Error desconocido'
        })
      }
    } catch (error) {
      console.error('❌ Error creando empresa:', error)
      toast.error('Error al crear empresa')
    } finally {
      setIsCreating(false)
    }
  }

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 4) {
      setSuggestions([])
      return
    }

    try {
      setIsSearching(true)
      setSearchError(null)
      
      console.log(`🔍 Buscando "${searchTerm}"...`)
      
      // Verificar conectividad
      const isOnline = await checkConnectivity()
      
      if (isOnline && odooConnected) {
        // Búsqueda online
        console.log('🌐 Búsqueda ONLINE en Odoo')
        const result = await searchOdooContacts(searchTerm)
        
        if (result.success) {
          console.log(`✅ ${result.contacts.length} contactos encontrados (online)`)
          setSuggestions(result.contacts)
          setShowSuggestions(result.contacts.length > 0)
        } else {
          console.error('❌ Error en búsqueda online:', result.error)
          // Intentar búsqueda offline como fallback
          console.log('🔄 Intentando búsqueda offline como fallback...')
          await performOfflineSearch(searchTerm)
        }
      } else {
        // Búsqueda offline
        console.log('📱 Búsqueda OFFLINE en datos locales')
        await performOfflineSearch(searchTerm)
      }
    } catch (error) {
      console.error('❌ Error en búsqueda:', error)
      // Intentar búsqueda offline como último recurso
      try {
        await performOfflineSearch(searchTerm)
      } catch (offlineError) {
        console.error('❌ Error en búsqueda offline:', offlineError)
        setSearchError('Error al buscar contactos')
        setSuggestions([])
        setShowSuggestions(false)
      }
    } finally {
      setIsSearching(false)
    }
  }

  const performOfflineSearch = async (searchTerm: string) => {
    try {
      const offlineResults = await searchOdooContactsOffline(searchTerm, 20)
      
      if (offlineResults.length > 0) {
        console.log(`✅ ${offlineResults.length} contactos encontrados (offline)`)
        
        // Convertir resultados offline a formato OdooContact
        const contacts: OdooContact[] = offlineResults.map(r => ({
          id: r.id,
          name: r.nombre,
          vat: r.cuit,
          phone: r.telefono,
          street: '',
          city: r.ciudad,
          state: r.provincia,
          is_company: r.es_empresa,
          parent_id: undefined,
          parent_name: r.empresa_nombre
        }))
        
        setSuggestions(contacts)
        setShowSuggestions(true)
        setSearchError('🔌 Modo offline')
      } else {
        console.warn('⚠️ No se encontraron contactos offline')
        setSearchError('Sin resultados offline')
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error('❌ Error en búsqueda offline:', error)
      throw error
    }
  }

  const handleContactClick = (contact: OdooContact) => {
    try {
      console.log('✅ Contacto seleccionado:', contact)
      console.log('🔍 Tipo de contacto:', typeof contact)
      console.log('🔍 Claves del contacto:', Object.keys(contact))
      console.log('🔍 Valor de state:', contact.state)
      console.log('🔍 is_company:', contact.is_company)
      console.log('🔍 parent_name:', contact.parent_name)
      console.log('🔍 Contacto stringificado:', JSON.stringify(contact))
      onContactSelect(contact)
      
      // Establecer el valor apropiado en el campo
      if (contact.is_company) {
        // Si es empresa, mostrar el nombre de la empresa
        onValueChange(contact.name)
      } else if (contact.parent_name) {
        // Si es persona con empresa, mostrar el nombre de la empresa en el campo
        onValueChange(contact.parent_name)
      } else {
        // Si es persona sin empresa, mostrar el nombre de la persona
        onValueChange(contact.name)
      }
      
      setShowSuggestions(false)
      setSuggestions([])
    } catch (error) {
      console.error('❌ Error seleccionando contacto:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onValueChange(newValue)
    
    if (newValue.length < 4) {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const getOdooStatusIndicator = () => {
    if (odooConnected === null) {
      return <span className="text-xs text-gray-400">🔄 Verificando Odoo...</span>
    }
    
    if (odooConnected) {
      return <span className="text-xs text-green-600">✅ Odoo conectado</span>
    }
    
    return <span className="text-xs text-red-600">❌ Odoo desconectado</span>
  }

  return (
    <div className="relative">
      {/* Input principal */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`${className} ${odooConnected ? 'border-green-200' : 'border-gray-200'}`}
        />
        
        {/* Indicador de búsqueda */}
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Indicador de Odoo */}
        {odooConnected && !isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <span className="text-green-500 text-sm">🔍</span>
          </div>
        )}
      </div>

      {/* Estado de conexión Odoo */}
      <div className="flex items-center justify-between mt-1">
        <div>
          {getOdooStatusIndicator()}
        </div>
        
        <div className="flex items-center gap-2">
          {searchError && (
            <span className="text-xs text-red-600">⚠️ {searchError}</span>
          )}
          
          {/* Botón para crear empresa - visible cuando hay texto y Odoo está conectado */}
          {value && value.length >= 2 && odooConnected && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreateDialog}
              className="text-xs h-6 px-2"
            >
              <Building2 className="h-3 w-3 mr-1" />
              Crear empresa
            </Button>
          )}
        </div>
      </div>

      {/* Sugerencias */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-64 overflow-y-auto"
        >
          <div className="p-2">
            <div className="text-xs text-gray-500 mb-2">
              📋 {suggestions.length} contacto{suggestions.length > 1 ? 's' : ''} encontrado{suggestions.length > 1 ? 's' : ''}
            </div>
            
            {suggestions.map((contact, index) => (
              <div
                key={`${contact.id}-${index}`}
                onClick={() => handleContactClick(contact)}
                className="p-3 hover:bg-gray-50 cursor-pointer rounded-md border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Nombre principal */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {contact.name}
                      </span>
                      {/* Indicador de tipo de contacto */}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        contact.is_company 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {contact.is_company ? '🏢 Empresa' : '👤 Persona'}
                      </span>
                    </div>
                    
                    {/* Mostrar empresa padre si existe */}
                    {!contact.is_company && contact.parent_name && (
                      <div className="text-xs text-purple-600 font-medium mb-1">
                        🏢 Empresa: {contact.parent_name}
                      </div>
                    )}
                    
                    {/* Información adicional */}
                    <div className="space-y-1">
                      {contact.vat && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">CUIT:</span> {contact.vat}
                        </div>
                      )}
                      
                      {contact.phone && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Teléfono:</span> {contact.phone}
                        </div>
                      )}
                      
                      {contact.city && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Ciudad:</span> {contact.city}
                        </div>
                      )}
                      
                      {contact.state && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Estado:</span> {contact.state}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Botón de selección */}
                  <div className="ml-2 flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs whitespace-nowrap"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleContactClick(contact)
                      }}
                    >
                      Seleccionar
                    </Button>
                    
                    {/* Indicador de lo que se autocompletará */}
                    {!contact.is_company && contact.parent_name && (
                      <div className="text-[10px] text-gray-500 text-center">
                        RS: {contact.parent_name.substring(0, 12)}...
                        <br />
                        Cont: {contact.name.substring(0, 12)}...
                      </div>
                    )}
                    {contact.is_company && (
                      <div className="text-[10px] text-gray-500 text-center">
                        Solo RS
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diálogo para crear nueva empresa */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Crear nueva empresa en Odoo
            </DialogTitle>
            <DialogDescription>
              Completa los datos para crear una nueva empresa. Los campos marcados con * son obligatorios.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-company-name">
                Razón Social <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-company-name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Ej: Mi Empresa S.A."
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-company-cuit">
                CUIT
              </Label>
              <Input
                id="new-company-cuit"
                value={newCompanyCuit}
                onChange={(e) => handleCuitChange(e.target.value)}
                placeholder="XX-XXXXXXXX-X"
                maxLength={13}
                className={cuitError && newCompanyCuit.length > 0 ? 'border-red-300' : ''}
              />
              {cuitError && newCompanyCuit.length > 0 && (
                <p className="text-xs text-red-600">{cuitError}</p>
              )}
              {!cuitError && newCompanyCuit.replace(/\D/g, '').length === 11 && (
                <p className="text-xs text-green-600">✓ CUIT válido</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-company-phone">Teléfono</Label>
              <Input
                id="new-company-phone"
                value={newCompanyPhone}
                onChange={(e) => setNewCompanyPhone(e.target.value)}
                placeholder="Ej: 2615551234"
              />
            </div>
            
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="new-contact-name">
                Nombre del contacto (opcional)
              </Label>
              <Input
                id="new-contact-name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
              <p className="text-xs text-muted-foreground">
                Si lo completas, se creará un contacto asociado a esta empresa
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateCompany}
              disabled={isCreating || !newCompanyName.trim() || (cuitError !== null && newCompanyCuit.length > 0)}
            >
              {isCreating ? (
                <>
                  <Search className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear empresa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Hook personalizado para usar búsqueda de contactos Odoo
 */
export function useOdooContactSearch() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedContact, setSelectedContact] = useState<OdooContact | null>(null)
  const [isOdooEnabled, setIsOdooEnabled] = useState(false)

  useEffect(() => {
    setIsOdooEnabled(isOdooConfigured())
  }, [])

  const handleContactSelect = (contact: OdooContact) => {
    setSelectedContact(contact)
    console.log('📝 Contacto seleccionado para autocompletado:', contact)
    console.log('🔍 Callback - Claves del contacto:', Object.keys(contact))
    console.log('🔍 Callback - Valor de state:', contact.state)
  }

  const resetSelection = () => {
    setSelectedContact(null)
    setSearchTerm('')
  }

  return {
    searchTerm,
    setSearchTerm,
    selectedContact,
    handleContactSelect,
    resetSelection,
    isOdooEnabled
  }
}