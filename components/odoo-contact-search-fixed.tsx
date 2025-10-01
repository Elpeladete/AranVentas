/**
 * Componente de búsqueda inteligente de contactos Odoo
 * Versión simplificada que usa el API interno
 */

"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  searchOdooContacts, 
  isOdooConfigured,
  testOdooConnection,
  type OdooContact 
} from "@/lib/odoo-api-client"

interface OdooContactSearchProps {
  value: string
  onValueChange: (value: string) => void
  onContactSelect: (contact: OdooContact) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function OdooContactSearch({
  value,
  onValueChange,
  onContactSelect,
  placeholder = "Escribe al menos 4 caracteres de la razón social...",
  disabled = false,
  className = ""
}: OdooContactSearchProps) {
  const [suggestions, setSuggestions] = useState<OdooContact[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [odooConnected, setOdooConnected] = useState<boolean | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Verificar estado de Odoo al cargar
  useEffect(() => {
    checkOdooConnection()
  }, [])

  // Buscar cuando cambie el valor (con debounce)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (value && value.length >= 4 && odooConnected) {
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
        setSearchError(result.error || 'Error de conexión')
      } else {
        console.log('✅ Odoo conectado exitosamente')
        setSearchError(null)
      }
    } catch (error) {
      console.error('❌ Error verificando Odoo:', error)
      setOdooConnected(false)
      setSearchError('Error de verificación')
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
      
      const result = await searchOdooContacts(searchTerm)
      
      if (result.success) {
        console.log(`✅ ${result.contacts.length} contactos encontrados`)
        setSuggestions(result.contacts)
        setShowSuggestions(result.contacts.length > 0)
      } else {
        console.error('❌ Error en búsqueda:', result.error)
        setSearchError(result.error || 'Error en búsqueda')
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error('❌ Error en búsqueda:', error)
      setSearchError('Error al buscar contactos')
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsSearching(false)
    }
  }

  const handleContactClick = (contact: OdooContact) => {
    try {
      console.log('✅ Contacto seleccionado:', contact)
      console.log('🔍 Tipo de contacto:', typeof contact)
      console.log('🔍 Claves del contacto:', Object.keys(contact))
      console.log('🔍 Valor de state:', contact.state)
      console.log('🔍 Contacto stringificado:', JSON.stringify(contact))
      onContactSelect(contact)
      onValueChange(contact.name)
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
        
        {searchError && (
          <span className="text-xs text-red-600">⚠️ {searchError}</span>
        )}
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
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        🏢 Contacto
                      </span>
                    </div>
                    
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleContactClick(contact)
                    }}
                  >
                    Seleccionar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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